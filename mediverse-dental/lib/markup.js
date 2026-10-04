// Safe text → HTML for content coming from the database.
// Everything is HTML-escaped first; only this tiny markup is turned into tags:
//   [[text]]          → <span class="grad-text">text</span>   (gradient highlight)
//   **text**          → <b>text</b>
//   [label](url)      → link (only safe URLs; anything else stays plain text)
//   newline           → <br>
// No raw HTML from the database ever reaches the page.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

// Same allowlist as the database CHECK constraint private.is_safe_url().
export function isSafeUrl(u) {
  if (typeof u !== 'string' || u.length > 2048) return false;
  if (/^\s*(javascript|data|vbscript|file):/i.test(u)) return false;
  return (
    /^https?:\/\/[^\s<>"'`]+$/i.test(u) ||
    /^mailto:[^\s<>"'`]+$/i.test(u) ||
    /^tel:\+?[0-9 ()-]{3,20}$/.test(u) ||
    /^#[A-Za-z0-9_-]*$/.test(u) ||
    /^\/(?!\/)[^\s<>"'`]*$/.test(u)
  );
}

export function safeUrl(u, fallback = '#') {
  return isSafeUrl(u) ? u : fallback;
}

export function inline(text) {
  let s = esc(text);
  // Links: [label](url) — the URL was escaped above, so unescape &amp; for the check only.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const raw = url.replace(/&amp;/g, '&');
    if (!isSafeUrl(raw)) return m;
    const external = /^https?:/i.test(raw);
    return `<a href="${url}"${external ? ' target="_blank" rel="noopener"' : ''} style="color:var(--cyan)">${label}</a>`;
  });
  s = s.replace(/\[\[(.+?)\]\]/g, '<span class="grad-text">$1</span>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/\r?\n/g, '<br>');
  return s;
}

// Multi-paragraph text (course details): blank line = new paragraph, "- " = list item.
export function blocks(text) {
  const out = [];
  const isItem = (l) => /^\s*[-•]\s+/.test(l);
  for (const chunk of String(text ?? '').trim().split(/\n\s*\n/)) {
    if (!chunk.trim()) continue;
    // A paragraph may mix normal lines and "- " bullet lines: each run becomes <p> or <ul>.
    const runs = [];
    for (const l of chunk.split('\n')) {
      const kind = isItem(l) ? 'ul' : 'p';
      if (runs.length && runs.at(-1).kind === kind) runs.at(-1).lines.push(l);
      else runs.push({ kind, lines: [l] });
    }
    for (const r of runs) {
      if (r.kind === 'ul') out.push('<ul>' + r.lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('') + '</ul>');
      else if (r.lines.join('').trim()) out.push(`<p>${inline(r.lines.join('\n'))}</p>`);
    }
  }
  return out.join('');
}

// Article body. Safe markup only (no HTML is ever passed through):
//   ## Heading / ### Sub-heading, "- " bullets, "1. " numbered items, "> " quote,
//   ![description](articles/photo.webp) on its own line = image from our media library,
//   blank line = new paragraph, plus everything inline() supports (**bold**, [[highlight]], [link](url)).
// `imageUrl(path)` returns the public URL for an allowed media path, or null.
export const ARTICLE_IMAGE_PATH = /^(articles|images|books|team|flyers|thumbnails|mentors|banners|logos)\/[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.(jpe?g|png|webp|avif)$/;
export function articleHtml(text, imageUrl) {
  const out = [];
  let list = null; // { tag, items }
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join('\n'))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flush = () => { flushPara(); flushList(); };
  for (const raw of String(text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = /^(#{2,3})\s+(.+)$/.exec(line))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = /^!\[([^\]\n]{0,200})\]\(([^)\s]+)\)$/.exec(line.trim()))) {
      flush();
      const src = ARTICLE_IMAGE_PATH.test(m[2]) ? imageUrl(m[2]) : null;
      if (src) out.push(`<figure><img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy" decoding="async">${m[1] ? `<figcaption>${esc(m[1])}</figcaption>` : ''}</figure>`);
      continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) { flush(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    const bullet = /^\s*[-•]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d{1,3}[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flush();
  return out.join('\n');
}

// Reading time in minutes (≈200 words/min, minimum 1).
export const readMinutes = (text) => Math.max(1, Math.round(String(text || '').split(/\s+/).filter(Boolean).length / 200));
