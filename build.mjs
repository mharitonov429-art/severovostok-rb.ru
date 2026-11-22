// Генератор статического сайта «Северо-Восток РБ». Без зависимостей: только Node.js >= 18.
// Запуск: node build.mjs            (обычная сборка)
//         node build.mjs --rotate   (сдвиг блока ротации ссылок на главной; делает GitHub Actions раз в сутки)
// Перед первой сборкой и после правки data/Health.txt: node scripts/parse-health.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, fmtDate, front, tel } from './lib/util.mjs';
import buildPages from './content/pages.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const ROTATE = process.argv.includes('--rotate');
const PER_SECTION = 10;
const SECTIONS = ['Организации и клиники', 'Списки и сравнения', 'Районы', 'Услуги партнёров', 'Статьи', 'Новости'];

const site = readJson('data/site.json');
const data = readJson('data/organizations.json');
const partners = readJson('data/partners.json');
const warnings = [];

function loadMd(dir, required) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => {
    const { meta, body } = front(fs.readFileSync(path.join(d, f), 'utf8'));
    for (const k of required) if (!meta[k]) throw new Error(`${dir}/${f}: нет поля «${k}» в шапке файла`);
    return { ...meta, slug: f.replace(/\.md$/, ''), body };
  });
}

const pages = buildPages({
  site, data, partners,
  articles: loadMd('content/stati', ['title', 'description', 'date', 'category']),
  news: loadMd('content/novosti', ['title', 'description', 'date']),
});

for (const p of pages) {
  p.published ||= site.published;
  p.updated ||= site.verified;
  p.crumb ||= p.h1;
}
const newest = (kind) => pages.filter((p) => p.kind === kind).map((p) => p.updated).sort().pop();
for (const [url, kind] of [['/novosti/', 'news'], ['/stati/', 'article']]) {
  const hub = pages.find((p) => p.url === url); const n = newest(kind);
  if (hub && n) hub.updated = n;
}
const indexable = pages.filter((p) => !p.noindex);

// ---------- ротация ссылок на главной ----------
const stateFile = path.join(ROOT, 'data/rotation-state.json');
const stateBefore = fs.readFileSync(stateFile, 'utf8');
const state = JSON.parse(stateBefore);
const pool = indexable.filter((p) => p.section && p.url !== '/');
const rotationHtml = [];
for (const sec of SECTIONS) {
  const items = pool.filter((p) => p.section === sec);
  if (!items.length) { delete state[sec]; continue; }
  const urls = items.map((p) => p.url);
  let q = (state[sec] || []).filter((u) => urls.includes(u));
  q = [...urls.filter((u) => !q.includes(u)), ...q];
  if (ROTATE && q.length > PER_SECTION) q = [...q.slice(PER_SECTION), ...q.slice(0, PER_SECTION)];
  state[sec] = q;
  const byUrl = Object.fromEntries(items.map((p) => [p.url, p]));
  rotationHtml.push(`<div><h3>${esc(sec)}</h3><ul>${q.slice(0, PER_SECTION).map((u) => `<li><a href="${u}">${esc(byUrl[u].h1)}</a></li>`).join('')}</ul></div>`);
}
for (const k of Object.keys(state)) if (!SECTIONS.includes(k)) delete state[k];
const stateAfter = JSON.stringify(state, null, 2) + '\n';
if (stateAfter !== stateBefore) fs.writeFileSync(stateFile, stateAfter);

// ---------- Яндекс Метрика (загружается только после согласия посетителя) ----------
const ID = site.metrikaId;
const CONSENT_KEY = 'sv_consent_analytics';
const METRIKA = `<script>
(function () {
  function svLoadMetrika() {
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${ID}', 'ym');
    ym(${ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
  }
  window.svLoadMetrika = svLoadMetrika;
  var v = null; try { v = localStorage.getItem('${CONSENT_KEY}'); } catch (e) {}
  if (v === 'yes') svLoadMetrika();
})();
</script>`;

const CSS = fs.readFileSync(path.join(ROOT, 'lib/style.css'), 'utf8').replace(/\n+/g, '\n').trim();
const INLINE_JS = `(function(){var K='${CONSENT_KEY}',box=document.getElementById('cookie');function get(){try{return localStorage.getItem(K);}catch(e){return null;}}function set(v){try{localStorage.setItem(K,v);}catch(e){}}if(box&&!get())box.hidden=false;var y=document.getElementById('sv-consent-yes'),n=document.getElementById('sv-consent-no'),s=document.getElementById('sv-cookie-settings');if(y)y.onclick=function(){set('yes');box.hidden=true;if(window.svLoadMetrika)window.svLoadMetrika();};if(n)n.onclick=function(){set('no');box.hidden=true;};if(s)s.onclick=function(e){e.preventDefault();try{localStorage.removeItem(K);}catch(er){}if(box)box.hidden=false;};var tp=document.getElementById('tk-pause'),tk=document.getElementById('ticker');if(tp&&tk)tp.onclick=function(){var p=tk.classList.toggle('paused');tp.textContent=p?'Продолжить':'Пауза';tp.setAttribute('aria-pressed',p);};document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-goal]');if(a&&typeof ym==='function'){ym(${ID},'reachGoal',a.getAttribute('data-goal'));}});})();`;

// ---------- JSON-LD ----------
const owner = { '@type': 'Person', '@id': `${site.domain}/#owner`, name: site.owner.name, jobTitle: site.owner.role, email: site.owner.email, telephone: site.owner.phone.replace(/\s/g, '') };
const clean = (o) => JSON.parse(JSON.stringify(o));
function graph(p) {
  const url = site.domain + p.url;
  const g = [owner];
  if (p.url === '/') g.push({ '@type': 'WebSite', '@id': `${site.domain}/#website`, url: `${site.domain}/`, name: site.name, inLanguage: 'ru-RU', publisher: { '@id': owner['@id'] } });
  if (p.url !== '/') {
    const trail = [['Главная', '/'], ...(p.crumbs || []), [p.crumb, p.url]];
    g.push({ '@type': 'BreadcrumbList', itemListElement: trail.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(i < trail.length - 1 ? { item: site.domain + u } : {}) })) });
  }
  if (p.kind === 'article' || p.kind === 'news') {
    g.push({ '@type': p.kind === 'news' ? 'NewsArticle' : 'Article', headline: p.h1, datePublished: p.published, dateModified: p.updated, inLanguage: 'ru-RU', author: { '@type': 'Person', name: site.owner.name, url: `${site.domain}/avtor/` }, publisher: { '@id': owner['@id'] }, mainEntityOfPage: url });
  } else {
    g.push({ '@type': 'WebPage', name: p.title, url, inLanguage: 'ru-RU', dateModified: p.updated });
  }
  (p.jsonld || []).forEach((x) => g.push(x));
  return JSON.stringify(clean({ '@context': 'https://schema.org', '@graph': g })).replace(/</g, '\\u003c');
}

// ---------- шаблон страницы ----------
const NAV = [['Районы', '/rayony/'], ['Медицина', '/medicina/'], ['Партнёры', '/partnery/'], ['О проекте', '/o-proekte/'], ['Контакты', '/kontakty/']];
const tickerHtml = () => {
  const items = partners.main.map((p) => `<a href="${p.page}" data-goal="ticker_${p.id}">${esc(p.ticker)}</a>`).join('<span aria-hidden="true"> · </span>');
  return `<div class="ticker" id="ticker" role="region" aria-label="Услуги партнёров"><div class="wrap"><span class="tk-label">Партнёры</span><div class="tk-view"><div class="tk-track">${items}<span aria-hidden="true"> · </span>${items.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ')}</div></div><button type="button" id="tk-pause" aria-pressed="false">Пауза</button></div></div>`;
};
function crumbsHtml(p) {
  if (p.url === '/') return '';
  const trail = [['Главная', '/'], ...(p.crumbs || [])];
  return `<nav class="crumbs" aria-label="Хлебные крошки"><ol>${trail.map(([n, u]) => `<li><a href="${u}">${esc(n)}</a></li>`).join('')}<li aria-current="page">${esc(p.crumb)}</li></ol></nav>`;
}
function render(p) {
  const url = site.domain + p.url;
  const robots = p.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  const trust = p.notrust ? '' : `<footer class="trust"><p>Автор: <a href="/avtor/">${esc(site.owner.name)}</a>, ${esc(site.owner.role.toLowerCase())}. Опубликовано: <time datetime="${p.published}">${fmtDate(p.published)}</time>. Обновлено: <time datetime="${p.updated}">${fmtDate(p.updated)}</time>.</p><p>Справочная информация неофициального сайта. Не заменяет консультацию врача или юриста. Нашли ошибку: <a href="mailto:${esc(site.owner.email)}">${esc(site.owner.email)}</a>.</p></footer>`;
  const fresh = p.url === '/' && rotationHtml.length ? `<section class="fresh" aria-label="Материалы сайта"><h2>Материалы сайта</h2><div class="fresh-grid">${rotationHtml.join('')}</div></section>` : '';
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${robots}">
<meta property="og:type" content="${p.kind === 'article' || p.kind === 'news' ? 'article' : 'website'}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="ru_RU">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
<script type="application/ld+json">${graph(p)}</script>
${METRIKA}
</head>
<body>
<a class="skip" href="#main">Перейти к содержимому</a>
<header class="top"><div class="wrap">
<a class="brand" href="/">${esc(site.name)}<span class="tagline">${esc(site.tagline)}</span></a>
<nav aria-label="Основное меню">${NAV.map(([n, u]) => `<a href="${u}">${esc(n)}</a>`).join('')}</nav>
<p class="hcall" style="margin:0">Нашли ошибку? <a href="mailto:${esc(site.owner.email)}">Напишите</a></p>
</div></header>
${p.ticker ? tickerHtml() : ''}
<main id="main"><div class="wrap">
${crumbsHtml(p)}
<h1>${esc(p.h1)}</h1>
<p class="answer">${p.answer}</p>
${p.body}
${fresh}
${trust}
</div></main>
<footer><div class="wrap">
<p><strong>${esc(site.name)}</strong> — неофициальный справочник организаций северо-востока Башкортостана. Сайт не принадлежит организациям из справочника. Реклама и партнёрство: <a href="mailto:${esc(site.owner.email)}" data-goal="mail_ads">${esc(site.owner.email)}</a>, <a href="tel:${tel(site.owner.phone)}" data-goal="call_ads">${esc(site.owner.phone)}</a>.</p>
<nav aria-label="Служебные страницы"><a href="/partnery/">Партнёры</a><a href="/o-proekte/">О проекте</a><a href="/kontakty/">Контакты</a><a href="/avtor/">Автор</a><a href="/politika-konfidencialnosti/">Политика конфиденциальности</a><a href="/soglasie/">Согласие на обработку данных</a><a href="/usloviya-ispolzovaniya/">Условия использования</a><a href="#" id="sv-cookie-settings">Настройки cookie</a><a href="/sitemap.xml">Карта сайта</a></nav>
</div></footer>
<div class="cookie" id="cookie" hidden role="dialog" aria-label="Согласие на аналитику"><p>Мы используем Яндекс Метрику (cookie, IP-адрес и данные о действиях на сайте), чтобы понимать, какие страницы полезны. Без вашего согласия счётчик не загружается. Подробнее: <a href="/politika-konfidencialnosti/">Политика</a> и <a href="/soglasie/">Согласие</a>.</p><div><button type="button" id="sv-consent-yes">Принять</button> <button type="button" id="sv-consent-no">Отклонить</button></div></div>
<script>${INLINE_JS}</script>
<script src="/webmcp.js" defer></script>
</body>
</html>
`;
}

// ---------- запись файлов ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const write = (rel, content) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

for (const p of pages) {
  if (!p.title || p.title.length > 60) warnings.push(`${p.url}: title ${p.title?.length} знаков (нужно до 60)`);
  if (!p.description || p.description.length > 160) warnings.push(`${p.url}: description ${p.description?.length} знаков (нужно до 160)`);
  if (/<h1[\s>]/i.test(p.body)) warnings.push(`${p.url}: в теле страницы есть второй H1`);
  write(p.url === '/' ? 'index.html' : `${p.url.replace(/^\//, '')}index.html`, render(p));
}
write('404.html', render({
  url: '/404.html', kind: 'page', noindex: true, notrust: true, published: site.published, updated: site.published, crumb: 'Страница не найдена', crumbs: [],
  title: `Страница не найдена — ${site.name}`, description: 'Такой страницы на сайте нет.', h1: 'Страница не найдена',
  answer: 'Такого адреса на сайте нет: страница могла переехать или ссылка набрана с ошибкой.',
  body: '<p>Начните с <a href="/">главной страницы</a>, посмотрите <a href="/rayony/">районы</a> или <a href="/medicina/">медицину северо-востока</a>.</p>',
}));

const GROUPS = [
  ['sitemap-pages.xml', ['home', 'page', 'hub', 'list', 'district', 'partner', 'legal']],
  ['sitemap-organizacii.xml', ['org']],
  ['sitemap-articles.xml', ['article']],
  ['sitemap-news.xml', ['news']],
];
const sitemapIndex = [];
for (const [file, kinds] of GROUPS) {
  const items = indexable.filter((p) => kinds.includes(p.kind));
  if (!items.length) continue;
  write(file, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.map((p) => `<url><loc>${site.domain}${p.url}</loc><lastmod>${p.updated}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  sitemapIndex.push(`<sitemap><loc>${site.domain}/${file}</loc><lastmod>${items.map((p) => p.updated).sort().pop()}</lastmod></sitemap>`);
}
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapIndex.join('\n')}\n</sitemapindex>\n`);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
copyDir(path.join(ROOT, 'static'), DIST);

// ---------- файлы для ИИ-поиска ----------
const TYPE = { org: 'organization', district: 'district', list: 'list', hub: 'hub', partner: 'partner', legal: 'legal', article: 'article', news: 'news', page: 'info', home: 'home' };
const slugOf = (u) => u.replace(/^\/|\/$/g, '').split('/').pop() || 'home';
const catOf = (p) => p.section || 'О проекте и документы';
const CATS = [...SECTIONS, 'О проекте и документы'];
const CAT_DESC = {
  'Организации и клиники': 'Карточки медицинских организаций пяти районов: адрес, телефон, график',
  'Списки и сравнения': 'Медицина по районам, ЦРБ, стоматологии, лаборатории',
  'Районы': 'Дуванский, Салаватский, Мечетлинский, Белокатайский и Кигинский районы',
  'Услуги партнёров': 'Проекты автора: ветеринария, юридические услуги, пансионаты, интеллект-клуб',
  'Статьи': 'Статьи справочника', 'Новости': 'Новости справочника',
  'О проекте и документы': 'О проекте, контакты, автор, политика, согласие, условия использования',
};
const entry = (p) => ({ slug: slugOf(p.url), title: p.h1, url: site.domain + p.url, type: TYPE[p.kind] || 'info', keywords: p.keywords || [] });
const categories = CATS.map((t) => ({ title: t, items: indexable.filter((p) => catOf(p) === t) })).filter((c) => c.items.length)
  .map((c, i) => ({ id: `cat-${i + 1}`, title: c.title, description: CAT_DESC[c.title], articles: c.items.map(entry) }));
const lastUpdated = indexable.map((p) => p.updated).sort().pop();
const OWNER = site.owner.name;
const crbs = data.orgs.filter((o) => o.type === 'bolnica');

write('ai-catalog.json', JSON.stringify({
  '@context': 'https://schema.org', type: 'Reference',
  name: `${site.name} — справочник организаций северо-востока Башкортостана`, url: `${site.domain}/`,
  description: `Неофициальный русскоязычный справочник: больницы, поликлиники, амбулатории, ФАПы, стоматологии и лаборатории Дуванского, Салаватского, Мечетлинского, Белокатайского и Кигинского районов; адреса, телефоны, график; услуги партнёров.`,
  language: 'ru', author: { type: 'Person', name: OWNER }, publisher: { type: 'Person', name: OWNER },
  isIndependent: true, isUnofficial: true,
  monetization: 'Онлайн-продаж нет. Партнёрские ссылки на проекты автора; платная реклама помечается «Реклама».',
  disclaimer: 'Сайт неофициальный. Телефоны и график уточняйте по телефону. Материалы не заменяют консультацию врача или юриста.',
  lastUpdated, totalPages: indexable.length, categories,
  availableTools: [
    { name: 'search_articles', description: 'Поиск страниц сайта по словам, категории и типу' },
    { name: 'get_article_details', description: 'Метаданные одной страницы по slug' },
    { name: 'get_contact_info', description: 'Телефоны центральных районных больниц пяти районов и контакты владельца сайта' },
  ],
  sitemapUrl: `${site.domain}/sitemap.xml`, llmsUrl: `${site.domain}/llms.txt`, aiGuideUrl: `${site.domain}/ai-guide.txt`,
  contactEmail: site.owner.email, privacyPolicyUrl: `${site.domain}/politika-konfidencialnosti/`, consentUrl: `${site.domain}/soglasie/`,
  termsUrl: `${site.domain}/usloviya-ispolzovaniya/`, aboutPageUrl: `${site.domain}/o-proekte/`,
  targetAudience: 'Жители и гости Дуванского, Салаватского, Мечетлинского, Белокатайского и Кигинского районов Башкортостана',
  medicalDisclaimer: true, legalDisclaimer: true,
}, null, 2) + '\n');

const li = (p) => `- [${p.h1}](${site.domain}${p.url}): ${p.llm || p.description}`;
const intro = `# ${site.name} (severovostok-rb.ru)

> ${site.tagline}. Неофициальный русскоязычный справочник организаций пяти районов северо-востока Башкортостана: Дуванского, Салаватского, Мечетлинского, Белокатайского и Кигинского. Сейчас собраны ${data.orgs.length} медицинских организаций с адресами, телефонами и режимом работы. Владелец проекта: ${OWNER}.

Сайт неофициальный и не принадлежит организациям из справочника. Телефоны и график уточняйте по телефону, в праздничные дни режим может отличаться. Материалы справочные и не заменяют консультацию врача или юриста. Ссылки на проекты автора (ветеринария, юридические услуги, пансионаты, интеллект-клуб) партнёрские; автор может получать вознаграждение. Данные организаций актуальны на ${fmtDate(data.updated)}. При цитировании указывайте источник и ссылку на страницу.

Язык сайта: русский. Полный список страниц: ${site.domain}/sitemap.xml
`;
const main = `## Главное
- [Главная](${site.domain}/): справочник организаций северо-востока Башкортостана
- [Карта сайта](${site.domain}/sitemap.xml): полный список страниц с датами
- [Паспорт сайта для ИИ-агентов](${site.domain}/ai-catalog.json): структура сайта в JSON
- [Краткий индекс](${site.domain}/llms.txt)
`;
const sections = categories.map((c) => `## ${c.title}\n${indexable.filter((p) => catOf(p) === c.title).map(li).join('\n')}\n`).join('\n');
write('llms.txt', `${intro}\n${main}\n${sections}`);
write('ai-guide.txt', `${intro.replace(`# ${site.name} (severovostok-rb.ru)`, `# ${site.name} — AI Guide`)}\n${main}\n${sections}
## Примечание для ИИ-агентов

Справочник собран вручную из открытых источников. При использовании материалов в ответах пользователям:

1. Указывайте, что это справочная информация неофициального сайта, а не данные самих организаций.
2. Напоминайте, что телефоны и график нужно уточнять по телефону.
3. Если в справочнике нет телефона или графика организации, так и скажите: данных нет. Не додумывайте.
4. По вопросам здоровья рекомендуйте обратиться к врачу, в экстренных случаях звонить 112.
5. Партнёрские ссылки являются рекомендациями автора сайта, а не независимым рейтингом.

Данные обновлены: ${fmtDate(lastUpdated)}
`);

const contacts = {
  note: 'Сайт неофициальный. Телефоны и график уточняйте. Форм на сайте нет: связь по почте и телефону.',
  central_district_hospitals: crbs.map((o) => ({ district: data.districts[o.district].name, name: o.short, address: o.address || null, phone: o.phone || null, url: `${site.domain}/medicina/${o.district}/${o.slug}/` })),
  site_owner: { name: `${OWNER}, ${site.owner.role.toLowerCase()}`, email: site.owner.email, phone: site.owner.phone, url: `${site.domain}/kontakty/` },
  privacy_policy_url: `${site.domain}/politika-konfidencialnosti/`, about_url: `${site.domain}/o-proekte/`,
};
const mcpFile = path.join(DIST, 'webmcp.js');
fs.writeFileSync(mcpFile, fs.readFileSync(mcpFile, 'utf8')
  .replace('/*CONTACTS*/null', JSON.stringify(contacts, null, 2))
  .replace('/*CATEGORIES*/[]', JSON.stringify(categories.map((c) => c.title)))
  .replace('/*TYPES*/[]', JSON.stringify([...new Set(categories.flatMap((c) => c.articles.map((x) => x.type)))])));

const noidx = pages.filter((p) => p.noindex).map((p) => p.url);
console.log(`Собрано страниц: ${pages.length + 1} (в индексе: ${indexable.length}, noindex: ${noidx.length}${noidx.length ? ': ' + noidx.join(', ') : ''})`);
console.log(`Ротация: ${ROTATE ? 'сдвиг выполнен' : 'без сдвига'}; секций на главной: ${rotationHtml.length}`);
if (warnings.length) console.log('ПРЕДУПРЕЖДЕНИЯ:\n- ' + warnings.join('\n- ')); else console.log('Предупреждений нет.');
