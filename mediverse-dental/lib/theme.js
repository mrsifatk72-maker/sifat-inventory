// Site-wide look (default theme, brand colours, fonts) and Google tags, from site_settings.
// Every value is checked again here (the database also checks it), so nothing but a
// hex colour, a font from the list, or a G-/GTM- ID can ever reach the page.
// With nothing set, this adds nothing: the page is exactly the original design.
import { esc } from './markup.js';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const GA4 = /^G-[A-Z0-9]{4,20}$/;
const GTM = /^GTM-[A-Z0-9]{4,12}$/;

// Google Fonts "family" query for each allowed font.
export const FONTS_EN = {
  'Plus Jakarta Sans': null, // default, already loaded by the template
  Poppins: 'Poppins:wght@400;500;600;700;800',
  Inter: 'Inter:wght@400;500;600;700;800',
  Montserrat: 'Montserrat:wght@400;500;600;700;800',
  Nunito: 'Nunito:wght@400;500;600;700;800',
  Lato: 'Lato:wght@400;700;900',
};
export const FONTS_BN = {
  'Hind Siliguri': null, // default
  'Noto Sans Bengali': 'Noto+Sans+Bengali:wght@400;500;600;700',
  'Baloo Da 2': 'Baloo+Da+2:wght@400;500;600;700;800',
  'Anek Bangla': 'Anek+Bangla:wght@400;500;600;700;800',
  'Tiro Bangla': 'Tiro+Bangla',
};

export function themeParts(s = {}) {
  const theme = s.theme_default === 'light' ? 'light' : 'dark';
  const head = [];
  let bodyStart = '';

  const fontEn = Object.hasOwn(FONTS_EN, s.font_en || '') && FONTS_EN[s.font_en] ? s.font_en : null;
  const fontBn = Object.hasOwn(FONTS_BN, s.font_bn || '') && FONTS_BN[s.font_bn] ? s.font_bn : null;
  const families = [fontEn && FONTS_EN[fontEn].replace(/ /g, '+'), fontBn && FONTS_BN[fontBn]].filter(Boolean);
  if (families.length) {
    head.push(`<link href="https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&amp;')}&amp;display=swap" rel="stylesheet">`);
  }

  const css = [];
  const [c, b, v] = [s.color_cyan, s.color_blue, s.color_violet].map((x) => (HEX.test(x || '') ? x : null));
  if (c || b || v) {
    const vars = [c && `--cyan:${c}`, b && `--blue:${b}`, v && `--violet:${v}`].filter(Boolean);
    const grad = `--grad:linear-gradient(120deg,${c || 'var(--cyan)'} 0%,${b || 'var(--blue)'} 45%,${v || 'var(--violet)'} 100%)`;
    css.push(`:root,:root[data-theme="light"]{${[...vars, grad].join(';')}}`);
  }
  const en = fontEn ? `'${fontEn}',` : '';
  if (fontEn) css.push(`body{font-family:${en}system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.lang-btn.en{font-family:${en}sans-serif}`);
  if (fontBn) css.push(`.bn,.lang-btn,html[lang="bn"] body{font-family:'${fontBn}',${en || "'Plus Jakarta Sans',"}system-ui,sans-serif}.lang-btn.en{font-family:${en || "'Plus Jakarta Sans',"}sans-serif}`);
  if (css.length) head.push(`<style id="site-theme">${css.join('\n')}</style>`);

  if (GTM.test(s.gtm_container_id || '')) {
    const id = esc(s.gtm_container_id);
    head.push(`<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`);
    bodyStart = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n`;
  }
  if (GA4.test(s.ga4_measurement_id || '')) {
    const id = esc(s.ga4_measurement_id);
    head.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`);
  }
  return { theme, head: head.join('\n'), bodyStart };
}
