// Local "Supabase" for end-to-end tests of the website + admin panel.
//
//   Real PostgreSQL 16 (shim + all migrations + seed)  ← the real RLS policies
//   Real PostgREST (the same REST server Supabase runs)
//   A small gateway on one port that mimics Supabase's API surface:
//     /rest/v1/*     → PostgREST (role from the JWT, exactly like Supabase)
//     /auth/v1/*     → minimal stand-in for Supabase Auth (password login, refresh, user, logout)
//     /storage/v1/*  → minimal stand-in for Supabase Storage; every write goes through
//                      storage.objects as the caller's role, so the real storage RLS decides
//   plus the site (/ and /courses/*), /api/admin-config and the static admin app (/admin).
//
// Test-only. Needs: postgresql-16, and a PostgREST binary (POSTGREST_BIN or ./postgrest on PATH).
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHandler } from '../../api/page.js';
import { makeAdminConfigHandler } from '../../api/admin-config.js';
import { makeViewHandler } from '../../api/view.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PGBIN = process.env.PGBIN || '/usr/lib/postgresql/16/bin';
const JWT_SECRET = 'local-test-jwt-secret-local-test-jwt-secret-0123456789';
const RUN = process.getuid?.() === 0 ? ['sudo', '-u', 'postgres'] : [];

// ------------------------------------------------------------------ JWT --
const b64u = (b) => Buffer.from(b).toString('base64url');
export function signJwt(payload, secret = JWT_SECRET) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [h, b, s] = String(token || '').split('.');
  if (!s) return null;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (sig.length !== s.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(s))) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (p.exp && p.exp < Date.now() / 1000) return null;
  return p;
}

// ------------------------------------------------------------- helpers --
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(RUN.length ? RUN[0] : cmd, RUN.length ? [...RUN.slice(1), cmd, ...args] : args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
  return r.stdout;
};
const readBody = (req) => new Promise((resolve) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))); });
const json = (res, status, obj, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };

export async function startStack({ users = [] } = {}) {
  const work = mkdtempSync(join(tmpdir(), 'mvd-stack-'));
  chmodSync(work, 0o755);
  if (RUN.length) spawnSync('chown', ['postgres', work]);
  const pgPort = 54400 + Math.floor(Math.random() * 500);
  const files = join(work, 'storage');
  mkdirSync(files);

  // --- PostgreSQL ---------------------------------------------------------
  run(`${PGBIN}/initdb`, ['-D', join(work, 'data'), '-U', 'postgres', '--auth=trust', '-E', 'UTF8']);
  run(`${PGBIN}/pg_ctl`, ['-D', join(work, 'data'), '-o', `-p ${pgPort} -k ${work} -c listen_addresses=''`, '-l', join(work, 'pg.log'), '-w', 'start']);
  const psql = (sql, extra = []) => run('psql', ['-h', work, '-p', String(pgPort), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-t', '-A', ...extra], { input: sql });
  psql(readFileSync(join(ROOT, 'scripts/local-db/supabase_shim.sql'), 'utf8'));
  // Same order as staging: original schema → seed data → later migrations.
  const migrations = spawnSync('ls', [join(ROOT, 'supabase/migrations')], { encoding: 'utf8' }).stdout.trim().split('\n');
  const original = (f) => f <= '20261002090400~';
  for (const f of migrations.filter(original)) psql(readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8'));
  psql(readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8'));
  for (const f of migrations.filter((f) => !original(f))) psql(readFileSync(join(ROOT, 'supabase/migrations', f), 'utf8'));
  // PostgREST login role (as on Supabase) + storage rows for the 29 seeded images.
  psql(`create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
        insert into storage.objects (bucket_id, name) select 'public-media', path from public.media;`);

  const userMap = new Map();
  for (const u of users) {
    const id = crypto.randomUUID();
    psql(`insert into auth.users (id, email) values ('${id}', '${u.email.replace(/'/g, "''")}')`);
    if (u.role === 'owner') psql(`select private.bootstrap_owner('${u.email}')`);
    if (u.role === 'editor') psql(`insert into public.admin_users (user_id, role) values ('${id}', 'editor')`);
    userMap.set(u.email.toLowerCase(), { id, email: u.email, password: u.password });
  }

  // --- PostgREST ------------------------------------------------------------
  const pgrstPort = pgPort + 600;
  const conf = join(work, 'postgrest.conf');
  writeFileSync(conf, [
    `db-uri = "postgres://authenticator@/postgres?host=${work}&port=${pgPort}"`,
    'db-schemas = "public"', 'db-anon-role = "anon"', `jwt-secret = "${JWT_SECRET}"`,
    `server-port = ${pgrstPort}`, 'server-host = "127.0.0.1"', 'log-level = "warn"',
  ].join('\n'));
  const pgrstBin = process.env.POSTGREST_BIN || 'postgrest';
  const pgrst = spawn(pgrstBin, [conf], { stdio: ['ignore', 'pipe', 'pipe'] });
  let pgrstLog = '';
  pgrst.stdout.on('data', (d) => (pgrstLog += d)); pgrst.stderr.on('data', (d) => (pgrstLog += d));
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${pgrstPort}/`); if (r.status < 500) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error('PostgREST did not start: ' + pgrstLog);
  }

  // --- keys & sessions ------------------------------------------------------------
  const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat: 1700000000, exp: 4100000000 });
  const refresh = new Map();
  const authLog = []; // what the fake Auth was asked to do (tests read it)
  const issue = (u) => {
    const now = Math.floor(Date.now() / 1000);
    const access = signJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', aal: 'aal1', iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
    const rt = crypto.randomBytes(16).toString('hex');
    refresh.set(rt, u);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt,
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() } };
  };
  const claimsFrom = (req) => {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers.apikey;
    return verifyJwt(bearer);
  };

  // Run SQL as the caller's role so storage RLS applies (like Supabase Storage).
  const asCaller = (claims, sql, vars = {}) => {
    const role = claims?.role === 'authenticated' ? 'authenticated' : 'anon';
    const args = Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`]);
    const script = `begin;\nselect set_config('request.jwt.claims', :'claims', true) \\g /dev/null\nset local role ${role};\n${sql}\ncommit;`;
    const r = spawnSync(RUN.length ? RUN[0] : 'psql', [...(RUN.length ? [...RUN.slice(1), 'psql'] : []), '-h', work, '-p', String(pgPort), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-t', '-A', '-v', `claims=${JSON.stringify(claims || { role: 'anon' })}`, ...args], { encoding: 'utf8', input: script });
    return { ok: r.status === 0, out: r.stdout.trim(), err: r.stderr };
  };

  // --- site handlers ------------------------------------------------------------
  let base = '';
  const env = { SUPABASE_ANON_KEY: anonKey };
  const site = makeHandler({ env });
  const adminConfig = makeAdminConfigHandler(env);
  const viewApi = makeViewHandler({ env });
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));

  function applyHeaders(res, path) {
    for (const rule of vercel.headers) {
      const re = new RegExp('^' + rule.source.replace(/\(\.\*\)/g, '(.*)') + '$');
      if (!re.test(path)) continue;
      for (const { key, value } of rule.headers) {
        // CSP allows https://*.supabase.co in production; locally the "Supabase" is this server.
        res.setHeader(key, key === 'Content-Security-Policy' ? value.replace(/https:\/\/\*\.supabase\.co/g, `https://*.supabase.co ${base}`) : value);
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const p = url.pathname;
    try {
      // ---------- REST → PostgREST
      if (p.startsWith('/rest/v1/')) {
        const headers = { ...req.headers };
        delete headers.host;
        if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
        const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
        const r = await fetch(`http://127.0.0.1:${pgrstPort}${p.slice('/rest/v1'.length)}${url.search}`, { method: req.method, headers, body });
        const out = Buffer.from(await r.arrayBuffer());
        const h = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) h[k] = v; });
        res.writeHead(r.status, h); return res.end(out);
      }

      // ---------- Auth
      if (p === '/auth/v1/token' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        if (url.searchParams.get('grant_type') === 'password') {
          const u = userMap.get(String(b.email || '').toLowerCase());
          if (!u || u.password !== b.password) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return json(res, 200, issue(u));
        }
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const u = refresh.get(b.refresh_token);
          if (!u) return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
          refresh.delete(b.refresh_token);
          return json(res, 200, issue(u));
        }
        return json(res, 400, { msg: 'unsupported grant' });
      }
      if (p === '/auth/v1/user') {
        const c = claimsFrom(req);
        if (!c?.sub) return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
        const u = [...userMap.values()].find((x) => x.id === c.sub);
        if (req.method === 'PUT') { // update password (Supabase: PUT /auth/v1/user)
          const b = JSON.parse((await readBody(req)).toString() || '{}');
          if (b.password != null) {
            if (b.password === u.password) return json(res, 422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' });
            if (String(b.password).length < 6) return json(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
            u.password = b.password;
            authLog.push({ type: 'password_changed', email: u.email });
          }
        }
        return json(res, 200, { id: c.sub, aud: 'authenticated', role: 'authenticated', email: c.email, app_metadata: {}, user_metadata: {} });
      }
      if (p === '/auth/v1/recover' && req.method === 'POST') { // reset email: recorded instead of sent
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const u = userMap.get(String(b.email || '').toLowerCase());
        authLog.push({ type: 'recover', email: b.email, redirectTo: url.searchParams.get('redirect_to'), known: !!u });
        return json(res, 200, {});
      }
      if (p === '/auth/v1/logout') { authLog.push({ type: 'logout', scope: url.searchParams.get('scope') || 'global' }); res.writeHead(204); return res.end(); }
      if (p === '/auth/v1/signup') return json(res, 422, { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' });

      // ---------- Storage
      const pub = /^\/storage\/v1\/object\/public\/public-media\/(.+)$/.exec(p);
      if (pub && req.method === 'GET') {
        const name = decodeURIComponent(pub[1]);
        // Public bucket: anyone may read a file that exists (checked as the superuser, like Storage does).
        const exists = psql(`select count(*) from storage.objects where bucket_id='public-media' and name = '${name.replace(/'/g, "''")}'`).trim();
        if (exists !== '1') { res.writeHead(404); return res.end('not found'); }
        const local = join(files, name);
        const file = existsSync(local) ? local : join(ROOT, 'assets', name.split('/').pop());
        if (!existsSync(file)) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
        return res.end(readFileSync(file));
      }
      const obj = /^\/storage\/v1\/object\/public-media\/(.+)$/.exec(p);
      if (obj && (req.method === 'POST' || req.method === 'PUT')) {
        const name = decodeURIComponent(obj[1]);
        const body = await readBody(req);
        const type = (req.headers['content-type'] || '').split(';')[0];
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type)) return json(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${type} is not supported` });
        if (body.length > 5242880) return json(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
        const upsert = req.headers['x-upsert'] === 'true' || req.method === 'PUT';
        const r = asCaller(claimsFrom(req), `insert into storage.objects (bucket_id, name, metadata) values ('public-media', :'n', jsonb_build_object('size', ${body.length}, 'mimetype', :'t'))
          ${upsert ? "on conflict (bucket_id, name) do update set updated_at = now(), metadata = excluded.metadata" : ''} returning id;`, { n: name, t: type });
        if (!r.ok) {
          if (/duplicate key/.test(r.err)) return json(res, 409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
          return json(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
        }
        mkdirSync(dirname(join(files, name)), { recursive: true });
        writeFileSync(join(files, name), body);
        return json(res, 200, { Key: `public-media/${name}`, Id: r.out.split('\n').pop() });
      }
      if (p === '/storage/v1/object/public-media' && req.method === 'DELETE') {
        const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || '{}');
        const r = asCaller(claimsFrom(req), "delete from storage.objects where bucket_id='public-media' and name = any(string_to_array(:'names', E'\\n')) returning name;", { names: prefixes.join('\n') });
        const removed = r.ok ? r.out.split('\n').filter(Boolean).filter((n) => prefixes.includes(n)) : [];
        for (const n of removed) rmSync(join(files, n), { force: true });
        return json(res, 200, removed.map((name) => ({ name, bucket_id: 'public-media' })));
      }

      // ---------- App
      applyHeaders(res, p);
      if (p === '/api/admin-config') return adminConfig(req, res);
      if (p === '/api/view') return viewApi(req, res);
      if (p === '/' || p === '/robots.txt' || p === '/sitemap.xml' || /^\/courses\/[^/]+\/?$/.test(p) || /^\/(articles|team|books)(\/[^/]+)?\/?$/.test(p)) return site(req, res);
      if (p === '/admin' || p.startsWith('/admin/')) {
        const rel = p.replace(/^\/admin\/?/, '');
        let file = join(ROOT, 'public/admin', rel);
        if (!rel || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'public/admin/index.html');
        const data = readFileSync(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        return res.end(data);
      }
      res.writeHead(404); res.end('not found');
    } catch (err) {
      console.error('gateway error', err);
      if (!res.headersSent) res.writeHead(500);
      res.end(String(err));
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  env.SUPABASE_URL = base;

  return {
    base, anonKey, users: userMap,
    sql: (q) => psql(q).trim(),
    login: (email) => issue(userMap.get(email.toLowerCase())),
    authLog,
    // A password-reset link exactly like Supabase sends (implicit flow: tokens in the #fragment).
    recoveryLink: (email, path = '/admin/reset') => {
      const t = issue(userMap.get(email.toLowerCase()));
      return `${base}${path}#access_token=${t.access_token}&expires_at=${t.expires_at}&expires_in=3600&refresh_token=${t.refresh_token}&token_type=bearer&type=recovery`;
    },
    async stop() {
      server.close(); pgrst.kill();
      spawnSync(RUN.length ? RUN[0] : `${PGBIN}/pg_ctl`, [...(RUN.length ? [...RUN.slice(1), `${PGBIN}/pg_ctl`] : []), '-D', join(work, 'data'), '-m', 'immediate', 'stop']);
      rmSync(work, { recursive: true, force: true });
    },
  };
}

// node tests/local-supabase/stack.mjs  → run a local stack for manual testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startStack({ users: [{ email: 'owner@example.test', password: 'local-owner-pass', role: 'owner' }, { email: 'visitor@example.test', password: 'local-visitor-pass' }] });
  console.log(`Local stack: ${s.base}  (admin: ${s.base}/admin  owner@example.test / local-owner-pass)`);
}
