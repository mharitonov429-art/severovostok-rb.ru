// Все страницы сайта собираются из данных: data/organizations.json (из Health.txt), data/partners.json и Markdown-статей.
// Факты берутся только из данных владельца. Чего нет в данных, того нет и на странице.
import { esc, fmtDate, tel, md } from '../lib/util.mjs';

const TYPE_LABEL = {
  bolnica: ['Больницы', 'Центральная районная больница'],
  poliklinika: ['Поликлиники', 'Поликлиника'],
  ambulatoriya: ['Врачебные амбулатории', 'Врачебная амбулатория'],
  fap: ['ФАПы', 'Фельдшерско-акушерские пункты'],
  stomatologiya: ['Стоматология', 'Стоматология'],
  centr: ['Медицинские центры и клиники', 'Медицинский центр'],
  laboratoriya: ['Лаборатории и анализы', 'Лаборатория'],
  sanatorij: ['Санатории', 'Санаторий'],
};
const TYPE_ORDER = ['bolnica', 'poliklinika', 'ambulatoriya', 'fap', 'centr', 'stomatologiya', 'laboratoriya', 'sanatorij'];
const SCHEMA_TYPE = { bolnica: 'Hospital', stomatologiya: 'Dentist' };
const CARE_TYPES = ['bolnica', 'poliklinika', 'ambulatoriya', 'fap'];

const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n * 0.6 ? s.lastIndexOf(' ', n - 1) : n - 1).replace(/[\s,;:.\-–—]+$/, '') + '…');
const phones = (s = '') => (s.match(/\+7\s?\(\d{3,5}\)\s?[\d-]{5,}/g) || []).map((x) => x.replace(/[\s-]+$/, ''));
const ul = (items, cls = 'plain') => `<ul class="${cls}">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const a = (href, text, extra = '') => `<a href="${href}"${extra}>${text}</a>`;
const ext = (href, text, goal) => `<a href="${esc(href)}" rel="noopener nofollow" target="_blank"${goal ? ` data-goal="${goal}"` : ''}>${text}</a>`;
const phoneHtml = (s, goal = 'call_org') => {
  const list = phones(s);
  let out = esc(s);
  for (const p of list) out = out.replace(esc(p), `<a class="phone" href="tel:${tel(p)}" data-goal="${goal}">${esc(p)}</a>`);
  return out;
};
const cityOf = (d) => d.center;
const word = (n, one, few, many) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? many : k === 1 ? one : k > 1 && k < 5 ? few : many; };

export default function buildPages({ site, data, partners, articles, news }) {
  const D = data.districts;
  const orgs = data.orgs;
  const dist = Object.values(D);
  const pages = [];
  const owner = site.owner;

  const orgUrl = (o) => `/medicina/${o.district}/${o.slug}/`;
  const h1Of = (o) => `${o.short}, ${D[o.district].short} район`;
  const orgsOf = (d, type) => orgs.filter((o) => o.district === d && (!type || o.type === type));

  // ---------- страницы организаций ----------
  for (const o of orgs) {
    const d = D[o.district];
    const h1 = h1Of(o);
    const title = [`${h1}: телефон, адрес`, `${h1}: телефон`, h1].find((t) => t.length <= 60) || clip(h1, 60);
    const ph = phones(o.phone);
    const facts = [o.address && `Адрес: ${o.address}.`, o.phone && `Телефон: ${o.phone}.`, o.schedule && `График: ${o.schedule}.`].filter(Boolean);
    const shortAddr = (o.address || '').replace(/^\d{6},\s*/, '').replace(/Республика Башкортостан,\s*/, '').replace(/^[^,]*район,\s*/, '');
    const descr = clip(`${o.short}, ${d.short} район: ${[shortAddr, ph[0] && `тел. ${ph[0]}`, o.schedule].filter(Boolean).join('. ')}`, 160);
    const answer = esc(facts.join(' ') || `${o.short}: подробности в справочнике не указаны, уточните в районной больнице.`);
    const dl = [
      ['Район', a(`/rayony/${o.district}/`, esc(d.name))],
      ['Тип', esc(TYPE_LABEL[o.type][1])],
      o.address && ['Адрес', esc(o.address)],
      o.phone && ['Телефон', phoneHtml(o.phone)],
      o.email && ['Электронная почта', a(`mailto:${esc(o.email)}`, esc(o.email))],
      o.site && ['Сайт', ext(o.site, esc(o.site.replace(/^https?:\/\//, '').replace(/\/$/, '')))],
      o.schedule && ['График', esc(o.schedule)],
    ].filter(Boolean);
    const same = orgs.filter((x) => x.district === o.district && x.type === o.type && x !== o).slice(0, 6);
    const care = CARE_TYPES.includes(o.type)
      ? `<aside class="callcard"><h2>Справка для семьи</h2><p>Если нужен постоянный уход за пожилым родственником, посмотрите ${a('/pansionaty/', 'справочник по выбору пансионата')}.</p><p class="small">Проект автора сайта, подробности на странице «Партнёры».</p></aside>`
      : '';
    const body = `<dl class="passport">${dl.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
${o.note ? `<h2>Что известно об организации</h2><p>${esc(o.note)}.</p>` : ''}
<p class="status warn">Телефоны и график могут измениться, в праздники режим отличается: уточняйте по телефону. Сайт неофициальный и не даёт медицинских советов. В экстренных случаях звоните 112.</p>
${care}
${same.length ? `<h2>Другие организации этого типа в районе</h2>${ul(same.map((x) => a(orgUrl(x), esc(x.short))))}` : ''}
<p>${a(`/medicina/${o.district}/`, `Вся медицина: ${esc(d.short)} район`)} · ${a('/medicina/', 'Медицина северо-востока')}</p>`;
    const org = { '@type': SCHEMA_TYPE[o.type] || 'MedicalOrganization', name: o.short, ...(o.address ? { address: o.address } : {}), ...(ph[0] ? { telephone: ph[0].replace(/[\s()-]/g, '') } : {}), ...(o.email ? { email: o.email } : {}), ...(o.site ? { url: o.site } : {}) };
    pages.push({
      url: orgUrl(o), kind: 'org', section: 'Организации и клиники', title, description: descr, h1, answer, body,
      crumbs: [['Медицина', '/medicina/'], [`${d.short} район`, `/medicina/${o.district}/`]], crumb: o.short,
      published: site.published, updated: o.updated || data.updated, jsonld: [org],
      keywords: [o.short, d.center, `${d.short} район`, 'телефон', 'адрес', 'график', TYPE_LABEL[o.type][0]],
      llm: [o.address, o.phone, o.schedule].filter(Boolean).join('; '),
    });
  }

  // ---------- страницы районов и списки медицины по районам ----------
  const rayonyLinks = dist.map((d) => a(`/rayony/${d.slug}/`, `${esc(d.short)} район`));
  for (const d of dist) {
    const list = orgsOf(d.slug);
    const crb = list.find((o) => o.type === 'bolnica');
    const groups = TYPE_ORDER.map((t) => [t, list.filter((o) => o.type === t)]).filter(([, g]) => g.length);
    const upd = list.map((o) => o.updated).sort().pop() || data.updated;

    pages.push({
      url: `/rayony/${d.slug}/`, kind: 'district', section: 'Районы',
      title: `${d.short} район: справочник организаций`.slice(0, 60), description: clip(`${d.short} район Башкортостана, центр ${d.center}: больницы, клиники, стоматологии, лаборатории, телефоны и режим работы. В справочнике ${list.length} организаций.`, 160),
      h1: `${d.short} район: справочник организаций`,
      answer: esc(`${d.name} Республики Башкортостан входит в северо-восточную группу районов, административный центр: ${d.center}. Сейчас в справочнике ${list.length} ${word(list.length, 'медицинская организация', 'медицинские организации', 'медицинских организаций')}.${crb && crb.phone ? ` Центральная районная больница: ${crb.phone}.` : ''}`),
      body: `<h2>Что есть в районе</h2>
<div class="cards">
<a class="card" href="/medicina/${d.slug}/"><strong>Медицина</strong><span>${list.length} организаций: больница, поликлиники, амбулатории, ФАПы, стоматологии, лаборатории</span></a>
</div>
${crb ? `<h2>Центральная районная больница</h2><p>${a(orgUrl(crb), esc(crb.short))}${crb.address ? `. ${esc(crb.address)}` : ''}.${crb.phone ? ` Телефон: ${phoneHtml(crb.phone)}.` : ''}</p>` : ''}
<h2>Состав медицинских организаций</h2>
${ul(groups.map(([t, g]) => `${esc(TYPE_LABEL[t][0])}: ${g.length}`))}
<p>${a(`/medicina/${d.slug}/`, `Открыть список: медицина, ${esc(d.short)} район`)}</p>
<h2>Услуги партнёров рядом</h2>
${ul([
  `${a('/veterinariya/', 'Ветеринария и зоомагазины')}: справочник «Зоо-Месягутово»`,
  `${a('/yuridicheskie-uslugi/', 'Юридические услуги')}: «Судпомощник» по северо-востоку Башкортостана`,
  `${a('/pansionaty/', 'Пансионаты')}: как выбрать пансионат для пожилого человека`,
])}
<h2>Соседние районы справочника</h2>
${ul(rayonyLinks.filter((_, i) => dist[i].slug !== d.slug))}`,
      crumbs: [['Районы', '/rayony/']], crumb: `${d.short} район`, published: site.published, updated: upd,
      keywords: [d.short, d.center, 'район', 'справочник'], ticker: false,
    });

    pages.push({
      url: `/medicina/${d.slug}/`, kind: 'list', section: 'Списки и сравнения',
      title: `Медицина, ${d.short} район: больницы, клиники`.slice(0, 60), description: clip(`Больница, поликлиники, амбулатории, ФАПы, стоматологии и лаборатории ${d.short} района: адреса, телефоны и график. ${list.length} организаций.`, 160),
      h1: `Медицина, ${d.short} район`,
      answer: esc(`В ${d.short} районе в справочнике ${list.length} ${word(list.length, 'медицинская организация', 'медицинские организации', 'медицинских организаций')}. ${crb ? `Основная: ${crb.short}${crb.phone ? `, ${phones(crb.phone)[0] ? crb.phone : ''}` : ''}.` : ''}`),
      body: groups.map(([t, g]) => `<h2>${esc(TYPE_LABEL[t][0])}</h2><div class="scroll"><table class="sched wide"><thead><tr><th>Название</th><th>Телефон</th><th>График</th></tr></thead><tbody>${g.map((o) => `<tr><td>${a(orgUrl(o), esc(o.short))}</td><td>${o.phone ? phoneHtml(o.phone) : 'не указан'}</td><td>${o.schedule ? esc(o.schedule) : 'уточняйте'}</td></tr>`).join('')}</tbody></table></div>`).join('\n')
        + `\n<p class="status warn">Данные собраны вручную из открытых источников на ${fmtDate(upd)}. Уточняйте телефон и режим работы перед визитом.</p>\n<p>${a(`/rayony/${d.slug}/`, `${esc(d.short)} район: все разделы`)}</p>`,
      crumbs: [['Медицина', '/medicina/']], crumb: `${d.short} район`, published: site.published, updated: upd,
      keywords: [d.short, d.center, 'больница', 'поликлиника', 'стоматология', 'лаборатория'], ticker: false,
    });
  }

  // ---------- хабы и сводные списки ----------
  const crbs = orgs.filter((o) => o.type === 'bolnica');
  const stoms = orgs.filter((o) => o.type === 'stomatologiya');
  const labs = orgs.filter((o) => o.type === 'laboratoriya');
  const latest = (list) => list.map((o) => o.updated || data.updated).sort().pop();

  pages.push({
    url: '/medicina/', kind: 'hub', section: 'Списки и сравнения', ticker: true,
    title: 'Медицина северо-востока Башкортостана: справочник', description: clip(`Больницы, поликлиники, амбулатории, ФАПы, стоматологии и лаборатории пяти районов: адреса, телефоны, график. ${orgs.length} организаций.`, 160),
    h1: 'Медицина северо-востока Башкортостана',
    answer: esc(`В справочнике ${orgs.length} ${word(orgs.length, 'медицинская организация', 'медицинские организации', 'медицинских организаций')} пяти районов: Дуванского, Салаватского, Мечетлинского, Белокатайского и Кигинского. У каждой есть адрес, а где известно, телефон и режим работы. Данные актуальны на ${fmtDate(data.updated)}.`),
    body: `<h2>По районам</h2><div class="cards">${dist.map((d) => `<a class="card" href="/medicina/${d.slug}/"><strong>${esc(d.short)} район</strong><span>${orgsOf(d.slug).length} организаций, центр ${esc(d.center)}</span></a>`).join('')}</div>
<h2>Сводные списки</h2>${ul([
  `${a('/medicina/crb/', 'Центральные районные больницы пяти районов')}: телефоны и сайты`,
  `${a('/medicina/stomatologiya/', 'Стоматологии северо-востока')}: ${stoms.length} адресов`,
  `${a('/medicina/laboratorii/', 'Лаборатории и пункты сдачи анализов')}: ${labs.length} адресов`,
])}
<h2>Экстренные ситуации</h2><p>Единый номер экстренных служб: 112. Справочник не заменяет консультацию врача.</p>
<aside class="callcard"><h2>Справка для семьи</h2><p>Нужен уход за пожилым человеком? ${a('/pansionaty/', 'Справочник по выбору пансионата')} поможет сравнить варианты.</p></aside>`,
    crumbs: [], crumb: 'Медицина', published: site.published, updated: data.updated,
    keywords: ['медицина', 'больница', 'поликлиника', 'стоматология', 'анализы', 'северо-восток Башкортостана'],
  });

  const dName = (o) => D[o.district].short;
  pages.push({
    url: '/medicina/crb/', kind: 'list', section: 'Списки и сравнения',
    title: 'ЦРБ северо-востока Башкортостана: телефоны', description: 'Пять центральных районных больниц: Малоязовская, Месягутовская, Большеустьикинская, Белокатайская и Кигинская. Адреса, телефоны, сайты.',
    h1: 'Центральные районные больницы северо-востока Башкортостана',
    answer: esc(`В справочнике пять ЦРБ: Малоязовская, Месягутовская, Большеустьикинская, Белокатайская и Кигинская. Для каждой указаны адрес, телефон и официальный сайт, если они есть в собранных данных.`),
    body: `<div class="scroll"><table class="sched wide"><thead><tr><th>Район</th><th>Больница</th><th>Телефон</th><th>Сайт</th></tr></thead><tbody>${crbs.map((o) => `<tr><td>${esc(dName(o))}</td><td>${a(orgUrl(o), esc(o.short))}<br><span class="small">${esc(o.address || '')}</span></td><td>${o.phone ? phoneHtml(o.phone) : 'не указан'}</td><td>${o.site ? ext(o.site, esc(o.site.replace(/^https?:\/\//, '').replace(/\/$/, ''))) : '—'}</td></tr>`).join('')}</tbody></table></div>
<p class="status warn">Уточняйте телефон и график на официальном сайте больницы.</p>`,
    crumbs: [['Медицина', '/medicina/']], crumb: 'ЦРБ', published: site.published, updated: latest(crbs),
    keywords: ['ЦРБ', 'центральная районная больница', 'регистратура', 'телефон'],
  });
  pages.push({
    url: '/medicina/stomatologiya/', kind: 'list', section: 'Списки и сравнения',
    title: 'Стоматологии северо-востока Башкортостана', description: clip(`${stoms.length} стоматологий пяти районов: государственные отделения ЦРБ и частные клиники. Адреса, телефоны, график.`, 160),
    h1: 'Стоматологии северо-востока Башкортостана',
    answer: esc(`В справочнике ${stoms.length} ${word(stoms.length, 'стоматология', 'стоматологии', 'стоматологий')}: государственные отделения при ЦРБ и частные клиники пяти районов. Телефон указан не у всех, это отмечено в списке.`),
    body: dist.map((d) => { const g = stoms.filter((o) => o.district === d.slug); return g.length ? `<h2>${esc(d.short)} район</h2><div class="scroll"><table class="sched wide"><thead><tr><th>Название</th><th>Телефон</th><th>График</th></tr></thead><tbody>${g.map((o) => `<tr><td>${a(orgUrl(o), esc(o.short))}</td><td>${o.phone ? phoneHtml(o.phone) : 'не указан'}</td><td>${o.schedule ? esc(o.schedule) : 'уточняйте'}</td></tr>`).join('')}</tbody></table></div>` : ''; }).join('\n'),
    crumbs: [['Медицина', '/medicina/']], crumb: 'Стоматологии', published: site.published, updated: latest(stoms),
    keywords: ['стоматология', 'зубной', 'частная стоматология', 'отделение ЦРБ'],
  });
  pages.push({
    url: '/medicina/laboratorii/', kind: 'list', section: 'Списки и сравнения',
    title: 'Лаборатории и анализы на северо-востоке РБ', description: clip(`${labs.length} лабораторий и пунктов сдачи анализов пяти районов: адреса, телефоны и график.`, 160),
    h1: 'Лаборатории и пункты сдачи анализов',
    answer: esc(`В справочнике ${labs.length} ${word(labs.length, 'лаборатория', 'лаборатории', 'лабораторий')} и пунктов сдачи анализов пяти районов. Многие работают при центральных районных больницах.`),
    body: dist.map((d) => { const g = labs.filter((o) => o.district === d.slug); return g.length ? `<h2>${esc(d.short)} район</h2><div class="scroll"><table class="sched wide"><thead><tr><th>Название</th><th>Телефон</th><th>График</th></tr></thead><tbody>${g.map((o) => `<tr><td>${a(orgUrl(o), esc(o.short))}</td><td>${o.phone ? phoneHtml(o.phone) : 'не указан'}</td><td>${o.schedule ? esc(o.schedule) : 'уточняйте'}</td></tr>`).join('')}</tbody></table></div>` : ''; }).join('\n'),
    crumbs: [['Медицина', '/medicina/']], crumb: 'Лаборатории', published: site.published, updated: latest(labs),
    keywords: ['лаборатория', 'анализы', 'сдать анализы', 'забор биоматериала'],
  });

  pages.push({
    url: '/rayony/', kind: 'hub', section: 'Районы', ticker: true,
    title: 'Районы северо-востока Башкортостана: справочник', description: 'Дуванский, Салаватский, Мечетлинский, Белокатайский и Кигинский районы: организации, телефоны, режим работы и услуги партнёров.',
    h1: 'Районы северо-востока Башкортостана',
    answer: 'Справочник охватывает пять районов северо-востока Башкортостана: Дуванский, Салаватский, Мечетлинский, Белокатайский и Кигинский. Выберите район, чтобы увидеть организации и телефоны.',
    body: `<div class="cards">${dist.map((d) => `<a class="card" href="/rayony/${d.slug}/"><strong>${esc(d.short)} район</strong><span>Центр: ${esc(d.center)}. Организаций: ${orgsOf(d.slug).length}</span></a>`).join('')}</div>`,
    crumbs: [], crumb: 'Районы', published: site.published, updated: data.updated,
    keywords: ['районы', 'Дуванский', 'Салаватский', 'Мечетлинский', 'Белокатайский', 'Кигинский'],
  });

  // ---------- партнёры ----------
  const rel = ' rel="sponsored noopener" target="_blank"';
  pages.push({
    url: '/partnery/', kind: 'partner', section: 'Услуги партнёров',
    title: 'Партнёры: сайты автора и рекомендуемые проекты', description: 'Рекомендуемые проекты автора: ветеринария, юридические услуги, пансионаты, интеллект-клуб. Остальные сайты автора перечислены без ссылок.',
    h1: 'Партнёры и сайты автора',
    answer: 'Здесь собраны проекты автора справочника. Четыре основных рекомендуем с ссылками: ветеринария, юридические услуги, пансионаты и интеллект-клуб. Остальные сайты перечислены без ссылок.',
    body: `<p class="status">Автор справочника связан с этими проектами и может получать вознаграждение по партнёрским программам. Если блок размещён за плату, он помечается «Реклама». За содержание сайтов отвечают их владельцы.</p>
<h2>Рекомендуем</h2>
<div class="cards">${partners.main.map((p) => `<div class="card"><strong>${esc(p.direction)}: ${esc(p.name)}</strong><span>${esc(p.blurb)}</span><span><a href="${p.page}">Подробнее на нашем сайте</a> · <a href="${esc(p.url)}"${rel} data-goal="partner_${p.id}">${esc(p.domain)}</a></span></div>`).join('')}</div>
<h2>Другие сайты автора</h2>
<p>Эти проекты автора указаны для справки, без ссылок.</p>
${ul(partners.others.map((p) => `<span class="nolink">${esc(p.domain)}</span>: ${esc(p.text)}`))}
<p class="small">Характеристики товаров и результаты, о которых сообщают эти сайты, приводят их владельцы; справочник за них не отвечает и ничего не гарантирует.</p>`,
    crumbs: [], crumb: 'Партнёры', published: site.published, updated: site.verified, keywords: ['партнёры', 'проекты автора', 'рекомендуем'],
  });

  const dirBody = {
    zoo: `<h2>Что это</h2><p>«Зоо-Месягутово» — неофициальный справочник по ветеринарии Месягутово и Дуванского района: ветеринары, ветаптеки, магазины для животных на северо-востоке Башкирии.</p><h2>Кому подойдёт</h2>${ul(['владельцам домашних животных', 'хозяйствам, которым нужны ветеринарные службы района'])}`,
    sud: `<h2>Что это</h2><p>«Судпомощник» — справочник по судам северо-востока Башкортостана и подготовка проектов документов для судов и приставов: возражения на судебный приказ, заявление об отмене заочного решения, обращения и жалобы приставам и другие. Консультация бесплатная, работа ведётся онлайн.</p><p>Исполнитель не адвокат и не сотрудник суда, в суде заказчика не представляет, результата дела не гарантирует.</p><h2>Как связаться</h2><p>Телефон: ${a(`tel:${tel(owner.phone)}`, esc(owner.phone), ' data-goal="call_sud"')}.</p>`,
    pansionat: `<h2>Что это</h2><p>Справочник для родственников: как выбрать пансионат для пожилого человека.</p><h2>Кому подойдёт</h2>${ul(['семьям, которые выбирают пансионат для пожилого родственника'])}<p class="small">Справочник не заменяет консультацию врача и не гарантирует качество ухода в конкретных учреждениях.</p>`,
    club: `<h2>Что это</h2><p>Интеллект-клуб Матвея и Татьяны Харитоновых в Месягутово, Дуванский район: клуб Super Jump, онлайн-встречи, на которых люди развивают друг друга обменом опытом.</p><p class="small">Материалы клуба не заменяют консультацию врача или психолога и не обещают результата и дохода.</p>`,
  };
  for (const p of partners.main) {
    pages.push({
      url: p.page, kind: 'partner', section: 'Услуги партнёров', noindex: true,
      title: clip(`${p.direction}: ${p.name}`, 60), description: clip(p.blurb, 160), h1: `${p.direction}: ${p.name}`, answer: esc(p.blurb),
      body: `${dirBody[p.id]}
<p><a class="btn" href="${esc(p.url)}"${rel} data-goal="partner_${p.id}">Перейти на ${esc(p.domain)}</a></p>
<p class="small">Проект автора справочника; ссылка партнёрская. Все партнёры: ${a('/partnery/', 'страница «Партнёры»')}.</p>`,
      crumbs: [['Партнёры', '/partnery/']], crumb: p.direction, published: site.published, updated: site.verified, keywords: [p.direction, p.name],
    });
  }

  // ---------- О проекте, контакты, автор ----------
  pages.push({
    url: '/o-proekte/', kind: 'page', section: null, title: 'О проекте: Северо-Восток РБ', description: 'Неофициальный справочник организаций северо-востока Башкортостана: как собираются данные, что входит, как исправить ошибку.',
    h1: 'О проекте «Северо-Восток РБ»',
    answer: 'Мы — компас северо-востока Башкортостана: собираем в одном месте организации, телефоны и режим работы пяти районов. Справочник неофициальный и не принадлежит организациям из списка.',
    body: `<h2>Какие районы</h2><p>Дуванский, Салаватский, Мечетлинский, Белокатайский и Кигинский.</p>
<h2>Что уже есть</h2><p>Медицинские организации: ${orgs.length} ${word(orgs.length, 'запись', 'записи', 'записей')}. Данные собраны вручную из открытых источников: сайты центральных районных больниц, портал doctor.bashkortostan.ru, справочники 2ГИС, Яндекс Карты, Zoon. Актуальность: ${fmtDate(data.updated)}.</p>
<h2>Как мы работаем</h2>${ul(['ничего не выдумываем: если данных нет, пишем «не указан»', 'не даём медицинских советов', 'партнёрские ссылки помечаем и собираем на странице ' + a('/partnery/', 'Партнёры')])}
<h2>Нашли ошибку</h2><p>Напишите на ${a(`mailto:${esc(owner.email)}`, esc(owner.email))} и укажите адрес страницы. Исправим после проверки.</p>`,
    crumbs: [], crumb: 'О проекте', published: site.published, updated: site.verified, keywords: ['о проекте', 'неофициальный справочник'],
  });
  pages.push({
    url: '/kontakty/', kind: 'page', section: null, title: 'Контакты: Северо-Восток РБ', description: 'Связь с автором справочника: почта и телефон для исправления данных, партнёрства и размещения рекламы.',
    h1: 'Контакты', answer: `Электронная почта: ${esc(owner.email)}. Телефон: ${esc(owner.phone)}. Пишите, чтобы исправить данные, предложить организацию или обсудить партнёрство.`,
    body: `<h2>Связаться</h2><p>Электронная почта: ${a(`mailto:${esc(owner.email)}`, esc(owner.email), ' data-goal="mail_ads"')}.<br>Телефон: ${a(`tel:${tel(owner.phone)}`, esc(owner.phone), ' data-goal="call_ads"')}.</p>
<h2>Для чего писать</h2>${ul(['исправить телефон, адрес или график организации', 'добавить организацию в справочник', 'партнёрство и размещение рекламы (реклама помечается)', 'вопрос по персональным данным: тема «Запрос по персональным данным»'])}
<h2>Оператор сайта</h2><p>${esc(owner.name)}, физическое лицо, плательщик налога на профессиональный доход (самозанятый), ИНН ${esc(owner.inn)}. Почтовый адрес: ${esc(owner.address)}.</p>`,
    crumbs: [], crumb: 'Контакты', published: site.published, updated: site.verified, keywords: ['контакты', 'реклама', 'исправить данные'],
  });
  pages.push({
    url: '/avtor/', kind: 'page', section: null, title: 'Автор и экспертиза: Северо-Восток РБ', description: 'Кто ведёт справочник «Северо-Восток РБ»: владелец проекта, источники данных, правила проверки.',
    h1: 'Автор и источники данных', answer: `Справочник ведёт ${esc(owner.name)}, Месягутово, Дуванский район. Данные собираются вручную и проверяются по открытым источникам.`,
    body: `<h2>Кто ведёт</h2><p>${esc(owner.name)}, владелец проекта. Другие проекты автора: ${a('/partnery/', 'Партнёры')}.</p>
<h2>Источники данных</h2>${ul(['официальные сайты центральных районных больниц', 'портал doctor.bashkortostan.ru и портал Минздрава РБ', 'справочники 2ГИС, Яндекс Карты, Zoon, Dent-list.ru', 'сайты самих организаций'])}
<h2>Проверка</h2><p>Данные вносятся вручную и сверяются перед публикацией. На страницах указаны дата публикации и дата обновления.</p>`,
    crumbs: [], crumb: 'Автор', published: site.published, updated: site.verified, keywords: ['автор', 'источники', 'экспертиза'],
  });

  // ---------- юридические страницы (текст требует юридической проверки перед запуском) ----------
  const LEGAL = '22.11.2026';
  const ops = `${esc(owner.name)}, физическое лицо, плательщик налога на профессиональный доход (самозанятый), ИНН ${esc(owner.inn)}. Электронная почта: ${esc(owner.email)}. Телефон: ${esc(owner.phone)}. Почтовый адрес: ${esc(owner.address)}.`;
  pages.push({
    url: '/politika-konfidencialnosti/', kind: 'legal', section: null, title: 'Политика конфиденциальности', description: 'Как сайт severovostok-rb.ru обрабатывает персональные данные: аналитика Яндекс Метрики по согласию, обращения, права посетителя.',
    h1: 'Политика в отношении обработки персональных данных', answer: 'Сайт информационный: на нём нет регистрации, форм и платежей. Яндекс Метрика включается только после нажатия «Принять» в баннере.',
    notrust: true, crumbs: [], crumb: 'Политика конфиденциальности', published: site.published, updated: site.verified,
    body: `<p>Редакция от ${LEGAL}. Документ опубликован в соответствии со ст. 18.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» (далее — Закон).</p>
<h2>1. Общие положения</h2><p>1.1. Политика определяет порядок обработки данных посетителей сайта ${esc(site.domain)}/ (далее — Сайт).</p><p>1.2. Оператор: ${ops}</p><p>1.3. Сайт информационный: регистрации, личных кабинетов, форм сбора данных и приёма платежей нет. Связь по телефону или почте происходит по вашей инициативе.</p>
<h2>2. Цели, данные и основания</h2><div class="scroll"><table class="sched wide"><thead><tr><th>Цель</th><th>Данные</th><th>Основание</th></tr></thead><tbody>
<tr><td>Статистика и улучшение Сайта</td><td>IP-адрес; идентификатор в cookie; сведения о браузере, устройстве и экране; регион по IP; адреса просмотренных страниц и время; источник перехода; клики, прокрутка, движения мыши и запись сеанса («Вебвизор»)</td><td>Согласие посетителя (п. 1 ч. 1 ст. 6, ст. 9 Закона). Даётся кнопкой «Принять»; до этого счётчик не загружается</td></tr>
<tr><td>Ответ на обращение (звонок, письмо)</td><td>Имя, телефон, электронная почта и текст обращения: только то, что вы сообщаете сами</td><td>Ваше обращение (п. 1 ч. 1 ст. 6 Закона)</td></tr></tbody></table></div>
<p>2.1. Сайт не предназначен для лиц младше 18 лет, Оператор сознательно не собирает их данные. Специальные и биометрические категории данных Оператор не обрабатывает.</p>
<h2>3. Принципы</h2><p>Обработка ведётся по принципам ст. 5 Закона. Если согласие на аналитику не получено или отозвано, аналитика не ведётся.</p>
<h2>4. Сроки и уничтожение</h2><p>4.1. Статистика: не более 12 месяцев с последнего посещения. Обращения: не более 12 месяцев.</p><p>4.2. Данные уничтожаются по достижении цели и в течение 30 дней после отзыва согласия (ч. 5 ст. 21 Закона), если нет другого законного основания хранения.</p><p>4.3. Собственной базы посетителей Оператор не ведёт: статистика хранится в сервисе Яндекс Метрика, переписка — в телефоне и почте Оператора.</p>
<h2>5. Cookie и согласие</h2><p>Яндекс Метрика использует cookie (в частности, _ym_uid и _ym_d). Выбор хранится в браузере (localStorage, ключ sv_consent_analytics). Изменить выбор можно ссылкой «Настройки cookie» внизу страницы. Согласие оформлено отдельным документом: ${a('/soglasie/', 'Согласие на обработку персональных данных')}.</p>
<h2>6. Третьи лица и трансграничная передача</h2><p>6.1. ООО «Яндекс» (Яндекс Метрика): обработка поручена для статистики (ч. 3 ст. 6 Закона).</p><p>6.2. Хостинг: GitHub Pages (GitHub, Inc., США). При загрузке страниц хостинг технически получает IP-адрес и параметры запроса.</p>
<h2>7. Права субъекта</h2><p>Вы вправе получать сведения об обработке данных (ст. 14), требовать уточнения, блокирования или уничтожения, отозвать согласие, обжаловать действия Оператора в Роскомнадзор или суд (ст. 17). Запрос: ${esc(owner.email)}, тема «Запрос по персональным данным». Ответ в течение 10 рабочих дней (ст. 20).</p>
<h2>8. Сторонние сайты</h2><p>На Сайте есть ссылки на сайты организаций, проектов автора и партнёров. При переходе данные обрабатывают их операторы по своим политикам.</p>
<h2>9. Защита данных</h2><p>Применяется защищённое соединение (HTTPS); доступ к учётным записям (почта, GitHub, Яндекс) ограничен личными паролями. При утечке персональных данных Оператор уведомит Роскомнадзор в сроки ч. 3.1 ст. 21 Закона.</p>
<h2>10. Изменение Политики</h2><p>Новая редакция вступает в силу с момента публикации на этой странице. Действующая редакция от ${LEGAL}.</p>
<h2>11. Реквизиты</h2><p>${ops}</p>`,
  });
  pages.push({
    url: '/soglasie/', kind: 'legal', section: null, title: 'Согласие на обработку персональных данных', description: 'Согласие посетителя на обработку данных сервисом Яндекс Метрика на сайте severovostok-rb.ru. Даётся кнопкой «Принять», отзывается в любой момент.',
    h1: 'Согласие на обработку персональных данных', answer: 'Согласие даётся добровольно кнопкой «Принять» в баннере cookie и относится только к статистике Яндекс Метрики. Отозвать можно в любой момент.',
    notrust: true, crumbs: [], crumb: 'Согласие', published: site.published, updated: site.verified,
    body: `<p>Редакция от ${LEGAL}.</p>
<h2>1. Кто обрабатывает</h2><p>Оператор: ${ops}</p>
<h2>2. На что вы соглашаетесь</h2><p>Нажимая «Принять» в баннере, вы свободно, своей волей и в своём интересе даёте согласие на обработку данных о вашем посещении Сайта ${esc(site.domain)}/ с помощью сервиса Яндекс Метрика (ООО «Яндекс»), включая «Вебвизор».</p>
<h2>3. Какие данные</h2><p>IP-адрес; идентификатор в cookie; сведения о браузере, устройстве и экране; регион по IP; адреса просмотренных страниц и время; источник перехода; клики (в том числе по партнёрским ссылкам), прокрутка, движения мыши и запись сеанса.</p>
<h2>4. Цель и действия</h2><p>Цель: статистика и улучшение Сайта. Действия: сбор, запись, систематизация, накопление, хранение, использование, обезличивание, удаление. Обработка автоматизированная.</p>
<h2>5. Срок и отзыв</h2><p>Согласие действует до отзыва, но не дольше 12 месяцев с последнего посещения. Чтобы отозвать, нажмите «Настройки cookie» внизу страницы и выберите «Отклонить», либо напишите на ${esc(owner.email)} с темой «Запрос по персональным данным». Данные уничтожаются в течение 30 дней после отзыва.</p>
<h2>6. Без согласия</h2><p>Если вы не нажали «Принять» или нажали «Отклонить», Яндекс Метрика не загружается и данные в неё не передаются. Пользоваться Сайтом можно в полном объёме.</p>
<p>См. также: ${a('/politika-konfidencialnosti/', 'Политика конфиденциальности')}.</p>`,
  });
  pages.push({
    url: '/usloviya-ispolzovaniya/', kind: 'legal', section: null, title: 'Условия использования сайта', description: 'Условия использования справочника «Северо-Восток РБ»: неофициальный характер, точность данных, партнёрские ссылки, отказ от ответственности.',
    h1: 'Условия использования сайта', answer: 'Сайт — неофициальный справочник. Он ничего не продаёт, не является офертой и не даёт медицинских и юридических советов. Данные нужно уточнять по телефону.',
    notrust: true, crumbs: [], crumb: 'Условия использования', published: site.published, updated: site.verified,
    body: `<p>Редакция от ${LEGAL}.</p>
<h2>1. Характер Сайта</h2><p>Сайт — неофициальный справочник организаций северо-востока Башкортостана. Он не принадлежит организациям из справочника и не выступает от их имени.</p>
<h2>2. Точность данных</h2><p>Данные собраны вручную из открытых источников и могут устареть. Телефоны, адреса и график нужно уточнять до визита. Автор исправляет ошибки после обращения на ${esc(owner.email)}.</p>
<h2>3. Не консультация</h2><p>Материалы не являются медицинской, юридической или иной профессиональной консультацией. В экстренных случаях звоните 112.</p>
<h2>4. Партнёрские ссылки и реклама</h2><p>Автор связан с проектами, перечисленными на странице ${a('/partnery/', 'Партнёры')}, и может получать вознаграждение. Платные размещения помечаются «Реклама». Сайт не принимает платежи и не заключает договоры с посетителями.</p>
<h2>5. Ответственность</h2><p>Автор не отвечает за содержание сторонних сайтов и за решения, принятые на основе справочника без проверки данных.</p>
<h2>6. Авторские права</h2><p>Тексты и оформление охраняются законом (часть четвёртая ГК РФ). Цитировать можно с указанием источника и активной ссылкой.</p>
<h2>7. Контакты</h2><p>${a('/kontakty/', 'Страница контактов')}.</p>`,
  });

  // ---------- главная ----------
  const cardsHtml = partners.main.map((p) => `<a class="card" href="${p.page}"><strong>${esc(p.direction)}</strong><span>${esc(p.blurb)}</span></a>`).join('');
  pages.push({
    url: '/', kind: 'home', ticker: true,
    title: 'Северо-Восток Башкортостана: справочник организаций', description: clip(`Справочник пяти районов северо-востока Башкортостана: больницы, клиники, стоматологии, лаборатории, телефоны и режим работы. ${orgs.length} организаций.`, 160),
    h1: 'Северо-Восток Башкортостана: справочник организаций',
    answer: esc(`Мы — компас северо-востока Башкортостана: в одном месте организации Дуванского, Салаватского, Мечетлинского, Белокатайского и Кигинского районов с адресами, телефонами и режимом работы. Сейчас собраны ${orgs.length} ${word(orgs.length, 'медицинская организация', 'медицинские организации', 'медицинских организаций')}; разделы добавляются.`),
    body: `<h2>Выберите район</h2><div class="cards">${dist.map((d) => `<a class="card" href="/rayony/${d.slug}/"><strong>${esc(d.short)} район</strong><span>Центр: ${esc(d.center)}. Организаций: ${orgsOf(d.slug).length}</span></a>`).join('')}</div>
<h2>Направления</h2><div class="cards"><a class="card" href="/medicina/"><strong>Медицина</strong><span>${orgs.length} организаций: больницы, поликлиники, ФАПы, стоматологии, лаборатории</span></a></div>
<h2>Услуги партнёров</h2><div class="cards">${cardsHtml}</div><p class="small">Проекты автора сайта. ${a('/partnery/', 'Все партнёры')}.</p>
<h2>Быстрые списки</h2>${ul([a('/medicina/crb/', 'Телефоны центральных районных больниц'), a('/medicina/stomatologiya/', 'Стоматологии северо-востока'), a('/medicina/laboratorii/', 'Где сдать анализы')])}`,
    crumbs: [], crumb: 'Главная', published: site.published, updated: data.updated, keywords: ['справочник', 'северо-восток Башкортостана', 'телефоны', 'режим работы'],
  });

  // ---------- статьи и новости из Markdown (если есть) ----------
  for (const x of articles) pages.push({ url: `/stati/${x.slug}/`, kind: 'article', section: 'Статьи', title: x.title, description: x.description, h1: x.title, answer: esc(x.answer || x.description), body: md(x.body), crumbs: [['Статьи', '/stati/']], crumb: x.title, published: x.date, updated: x.updated || x.date, keywords: (x.keywords || '').split(',').map((s) => s.trim()).filter(Boolean) });
  for (const x of news) pages.push({ url: `/novosti/${x.slug}/`, kind: 'news', section: 'Новости', title: x.title, description: x.description, h1: x.title, answer: esc(x.answer || x.description), body: md(x.body), crumbs: [['Новости', '/novosti/']], crumb: x.title, published: x.date, updated: x.updated || x.date, keywords: (x.keywords || '').split(',').map((s) => s.trim()).filter(Boolean) });
  if (articles.length) pages.push({ url: '/stati/', kind: 'hub', section: null, title: 'Статьи: Северо-Восток РБ', description: 'Статьи о районах северо-востока Башкортостана.', h1: 'Статьи', answer: 'Материалы о районах и организациях северо-востока Башкортостана.', body: ul(articles.map((x) => a(`/stati/${x.slug}/`, esc(x.title)))), crumbs: [], crumb: 'Статьи', published: site.published, updated: site.verified });
  if (news.length) pages.push({ url: '/novosti/', kind: 'hub', section: null, title: 'Новости: Северо-Восток РБ', description: 'Новости справочника и районов северо-востока Башкортостана.', h1: 'Новости', answer: 'Новости справочника и районов северо-востока Башкортостана.', body: ul(news.map((x) => a(`/novosti/${x.slug}/`, esc(x.title)))), crumbs: [], crumb: 'Новости', published: site.published, updated: site.verified });

  return pages;
}
