// Supabase client + media helpers.
// The browser only ever gets the PUBLIC key from /api/admin-config. Every write is
// checked by Row-Level Security in the database: only users listed in
// public.admin_users can change content or upload to the public-media bucket.

export const BUCKET = 'public-media';
export const FOLDERS = [
  ['flyers', 'flyer', 'Course flyers'],
  ['thumbnails', 'thumbnail', 'Course thumbnails'],
  ['mentors', 'mentor_photo', 'Mentor photos'],
  ['banners', 'banner', 'Banners'],
  ['logos', 'logo', 'Logos'],
  ['images', 'image', 'Other images'],
];
export const kindForFolder = (folder) => (FOLDERS.find((f) => f[0] === folder) || [])[1];
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
export const ALLOWED_TYPES = Object.keys(EXT);
export const MAX_BYTES = 5 * 1024 * 1024;
export const PATH_RE = /^(flyers|thumbnails|mentors|banners|logos|images)\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|avif)$/;

export let sb = null;

export async function initClient() {
  const res = await fetch('/api/admin-config', { cache: 'no-store' });
  const cfg = await res.json().catch(() => ({}));
  if (!res.ok || !cfg.supabaseUrl || !cfg.supabaseKey) throw new Error(cfg.error || 'Admin is not configured on this deployment.');
  for (let i = 0; i < 50 && !window.supabase; i++) await new Promise((r) => setTimeout(r, 50));
  if (!window.supabase) throw new Error('Could not load the Supabase library.');
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return sb;
}

// Throws on error so callers can use try/catch + errorText().
export async function q(promise) {
  const { data, error, count } = await promise;
  if (error) throw error;
  return count != null && data == null ? count : data;
}

export const publicUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export async function sha256Hex(file) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function imageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

export function checkFile(file) {
  if (!file) return 'Choose an image first.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPG, PNG, WebP or AVIF images can be uploaded.';
  if (file.size > MAX_BYTES) return 'The image is larger than 5 MB. Please make it smaller and try again.';
  if (file.size === 0) return 'The file is empty.';
  return null;
}

export function safeName(name, type) {
  const base = String(name || 'image').replace(/\.[^.]*$/, '').toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[^a-z0-9]+/, '').replace(/[-.]+$/, '').slice(0, 80) || 'image';
  return `${base}.${EXT[type]}`;
}

async function freePath(folder, fileName) {
  const dot = fileName.lastIndexOf('.');
  const stem = fileName.slice(0, dot), ext = fileName.slice(dot);
  for (let n = 1; n < 100; n++) {
    const path = `${folder}/${n === 1 ? stem : `${stem}-${n}`}${ext}`;
    const rows = await q(sb.from('media').select('id').eq('path', path).limit(1));
    if (!rows.length) return path;
  }
  throw new Error('Could not find a free file name. Rename the file and try again.');
}

// Files are sent as raw bytes with an explicit Content-Type (and Cache-Control: max-age=600).
// Upload a new image into a folder and register it in the media table.
// Resolves { media, duplicate } — duplicate=true when the same image already existed.
export async function uploadMedia(file, folder, { alt_en = null, alt_bn = null } = {}) {
  const bad = checkFile(file);
  if (bad) throw new Error(bad);
  const kind = kindForFolder(folder);
  if (!kind) throw new Error('Choose a folder.');
  const sha256 = await sha256Hex(file);
  const same = await q(sb.from('media').select('*').eq('sha256', sha256).limit(1));
  if (same.length) return { media: same[0], duplicate: true };
  const { width, height } = await imageSize(file);
  const path = await freePath(folder, safeName(file.name, file.type));
  if (!PATH_RE.test(path)) throw new Error('This file name is not allowed. Rename the file (letters, numbers, - and _ only).');

  const up = await sb.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: '600', upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await sb.from('media')
    .insert({ bucket: BUCKET, path, kind, mime: file.type, size_bytes: file.size, width, height, alt_en, alt_bn, sha256 })
    .select().single();
  if (error) {
    await sb.storage.from(BUCKET).remove([path]); // keep storage and table in step
    throw error;
  }
  return { media: data, duplicate: false };
}

// Replace the image file behind an existing media item. Same path → every page that
// uses it shows the new image (after browser/CDN caches refresh, up to ~10 minutes).
export async function replaceMedia(media, file) {
  const bad = checkFile(file);
  if (bad) throw new Error(bad);
  if (file.type !== media.mime) throw new Error(`The new image must be the same type as the old one (${media.mime.replace('image/', '').toUpperCase()}).`);
  const sha256 = await sha256Hex(file);
  if (sha256 === media.sha256) throw new Error('This is the same image that is already there.');
  const same = await q(sb.from('media').select('id,path').eq('sha256', sha256).limit(1));
  if (same.length) throw new Error(`This exact image already exists as ${same[0].path}.`);
  const { width, height } = await imageSize(file);
  const up = await sb.storage.from(BUCKET).upload(media.path, await file.arrayBuffer(), { contentType: file.type, cacheControl: '600', upsert: true });
  if (up.error) throw up.error;
  return q(sb.from('media').update({ size_bytes: file.size, sha256, width, height }).eq('id', media.id).select().single());
}

export async function mediaUsage(id) {
  return q(sb.from('media_usage').select('used_by,ref_id').eq('media_id', id));
}

// Delete only when nothing uses the image (the database also refuses otherwise).
export async function deleteMedia(media) {
  const used = await mediaUsage(media.id);
  if (used.length) throw new Error(`This image is still used (${used.map((u) => u.used_by).join(', ')}). Remove it there first.`);
  const gone = await q(sb.from('media').delete().eq('id', media.id).select('id'));
  if (!gone.length) throw new Error('Not allowed: your admin account cannot delete this image.');
  const rm = await sb.storage.from(BUCKET).remove([media.path]);
  if (rm.error || !rm.data?.length) return { warning: 'The library entry was removed, but the file itself could not be deleted from storage.' };
  return {};
}
