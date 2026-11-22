// Проверка готового сайта (dist/): ссылки, H1, canonical, JSON-LD, Метрика, верификации, страница партнёров.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DOMAIN = 'severovostok-rb.ru';
const METRIKA_ID = '114506332';
const errors = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIST);
const htmls = files.filter((f) => f.endsWith('.html') && !/googled|yandex_/.test(f));
const exists = (url) => {
  const clean = decodeURIComponent(url.split('#')[0].split('?')[0]);
  const p = path.join(DIST, clean);
  return fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, 'index.html')));
};

for (const f of htmls) {
  const rel = path.relative(DIST, f);
  const html = fs.readFileSync(f, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) errors.push(`${rel}: H1 = ${h1}`);
  if (!new RegExp(`<link rel="canonical" href="https://${DOMAIN}[^"]*">`).test(html)) errors.push(`${rel}: нет canonical`);
  if (!html.includes(`mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`)) errors.push(`${rel}: нет кода Метрики`);
  if (!html.includes("localStorage.getItem('sv_consent_analytics')") || !/if \(v === 'yes'\) svLoadMetrika\(\)/.test(html)) errors.push(`${rel}: Метрика не привязана к согласию`);
  if (/<noscript>[\s\S]*mc\.yandex\.ru\/watch/.test(html)) errors.push(`${rel}: пиксель Метрики в noscript работает без согласия`);
  if (!html.includes('id="sv-consent-yes"') || !html.includes('id="sv-cookie-settings"')) errors.push(`${rel}: нет баннера согласия или ссылки «Настройки cookie»`);
  if (!html.includes('<html lang="ru">')) errors.push(`${rel}: нет lang="ru"`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { errors.push(`${rel}: JSON-LD не разбирается`); }
  }
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) if (!exists(m[1])) errors.push(`${rel}: битая ссылка ${m[1]}`);
  if (/\[ЗАПОЛНИТЬ\]/.test(html) && !/noindex/.test(html)) errors.push(`${rel}: заглушка [ЗАПОЛНИТЬ] на индексируемой странице`);
  // внешние партнёрские ссылки только на страницах направлений и в списке партнёров
  const partnerPages = ['partnery/', 'veterinariya/', 'yuridicheskie-uslugi/', 'pansionaty/', 'intellekt-klub/'];
  const isPartnerPage = partnerPages.some((p) => rel === `${p}index.html`.replace(/\//g, path.sep) || rel === path.join(p, 'index.html'));
  const sponsored = (html.match(/rel="sponsored noopener"/g) || []).length;
  if (sponsored && !isPartnerPage) errors.push(`${rel}: партнёрская ссылка вне страниц партнёров (рискует выглядеть как сетка ссылок)`);
}

const partners = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/partners.json'), 'utf8'));
const pp = fs.readFileSync(path.join(DIST, 'partnery', 'index.html'), 'utf8');
for (const o of partners.others) {
  const href = new RegExp(`href="https?://${o.domain.replace(/\./g, '\\.')}`, 'i');
  if (href.test(pp)) errors.push(`partnery: у сайта ${o.domain} не должно быть ссылки (он в списке «без ссылок»)`);
}
for (const m of partners.main) if (!pp.includes(`href="${m.url}"`)) errors.push(`partnery: нет ссылки на ${m.domain}`);

for (const need of ['sitemap.xml', 'robots.txt', 'llms.txt', 'ai-guide.txt', 'ai-catalog.json', 'webmcp.js', 'CNAME', '404.html', 'googled005414cfdf84903.html', 'yandex_36326144e74f9c11.html']) {
  if (!fs.existsSync(path.join(DIST, need))) errors.push(`нет файла ${need}`);
}
for (const j of files.filter((f) => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(j, 'utf8')); } catch (e) { errors.push(`${path.relative(DIST, j)}: некорректный JSON`); }
}
const mcp = fs.readFileSync(path.join(DIST, 'webmcp.js'), 'utf8');
for (const m of ['/*CONTACTS*/', '/*CATEGORIES*/', '/*TYPES*/']) if (mcp.includes(m)) errors.push(`webmcp.js: не подставлено ${m}`);
const cat = JSON.parse(fs.readFileSync(path.join(DIST, 'ai-catalog.json'), 'utf8'));
for (const c of cat.categories) for (const a of c.articles) if (!exists(new URL(a.url).pathname)) errors.push(`ai-catalog.json: нет страницы ${a.url}`);
for (const t of cat.availableTools) if (!mcp.includes(`name: '${t.name}'`)) errors.push(`webmcp.js: нет инструмента ${t.name}`);
for (const f of ['llms.txt', 'ai-guide.txt']) {
  for (const m of fs.readFileSync(path.join(DIST, f), 'utf8').matchAll(new RegExp(`\\]\\(https://${DOMAIN.replace(/\./g, '\\.')}([^)]*)\\)`, 'g'))) if (!exists(m[1])) errors.push(`${f}: нет страницы ${m[1]}`);
}
for (const sm of files.filter((f) => /sitemap-.*\.xml$/.test(f))) {
  for (const m of fs.readFileSync(sm, 'utf8').matchAll(new RegExp(`<loc>https://${DOMAIN.replace(/\./g, '\\.')}([^<]*)</loc>`, 'g'))) if (!exists(m[1])) errors.push(`${path.basename(sm)}: нет страницы ${m[1]}`);
}
console.log(`Проверено HTML-страниц: ${htmls.length}`);
if (errors.length) { console.log('ОШИБКИ:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('Ошибок нет.');
