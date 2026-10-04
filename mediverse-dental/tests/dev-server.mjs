// Local preview + test server. Pretends to be Supabase:
//   /rest/v1/<table>                                → rows from tests/fixtures/content.json
//   /storage/v1/object/public/public-media/<path>   → image files from assets/
// and serves the real page handler (api/page.js) at / and /courses/<slug>.
// No network access and no real keys are needed.
//
//   node tests/dev-server.mjs            (then open http://localhost:3000)
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { makeHandler } from '../api/page.js';

const ROOT = new URL('../', import.meta.url);
const FIXTURE = JSON.parse(readFileSync(new URL('tests/fixtures/content.json', ROOT), 'utf8'));
const FAKE_KEY = 'local-test-anon-key';

// `mutate(data)` may change a copy of the fixture (e.g. turn a homepage option off).
export function startServer(port = 0, { mutate } = {}) {
  const data = structuredClone(FIXTURE);
  mutate?.(data);
  let base = '';
  const env = { SUPABASE_ANON_KEY: FAKE_KEY };        // SUPABASE_URL set once the port is known
  const handler = makeHandler({ env });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    const rest = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    if (rest) {
      if (req.headers.apikey !== FAKE_KEY) { res.statusCode = 401; return res.end('{}'); }
      const rows = data[rest[1]];
      if (!rows) { res.statusCode = 404; return res.end('{}'); }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(rows));
    }
    const img = /^\/storage\/v1\/object\/public\/public-media\/(?:logos|flyers|mentors)\/([A-Za-z0-9._-]+)$/.exec(url.pathname);
    if (img) {
      const file = new URL(`assets/${img[1]}`, ROOT);
      if (!existsSync(file)) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', img[1].endsWith('.png') ? 'image/png' : 'image/jpeg');
      return res.end(readFileSync(file));
    }
    if (url.pathname === '/robots.txt' || url.pathname === '/sitemap.xml' || url.pathname === '/' || /^\/courses\/[^/]+\/?$/.test(url.pathname)) return handler(req, res);
    res.statusCode = 404; res.end('not found');
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}`;
    env.SUPABASE_URL = base;                          // the "database" is this server
    resolve({ server, base });
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { base } = await startServer(Number(process.env.PORT) || 3000);
  console.log(`Local preview: ${base}  (fake Supabase, fixture data)`);
}
