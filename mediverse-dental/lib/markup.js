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
