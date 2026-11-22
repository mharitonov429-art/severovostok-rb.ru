// Разбор data/Health.txt (собран вручную) в data/organizations.json.
// Ничего не додумывает: если поля нет в файле, его нет и в JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'data/Health.txt'), 'utf8').replace(/\r/g, '');

const DISTRICTS = {
  'Салаватский район': { slug: 'salavatskiy', short: 'Салаватский', center: 'Малояз' },
  'Дуванский район': { slug: 'duvanskiy', short: 'Дуванский', center: 'Месягутово' },
  'Мечетлинский район': { slug: 'mechetlinskiy', short: 'Мечетлинский', center: 'Большеустьикинское' },
  'Белокатайский район': { slug: 'belokatayskiy', short: 'Белокатайский', center: 'Новобелокатай' },
  'Кигинский район': { slug: 'kiginskiy', short: 'Кигинский', center: 'Верхние Киги' },
};
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
const slugify = (s) => s.toLowerCase().replace(/[а-яё]/g, (c) => TR[c] ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');

function classify(name) {
  const n = name.toLowerCase();
  if (/фап|фельдшерско/.test(n)) return 'fap';
  if (/санатори/.test(n)) return 'sanatorij';
  if (/стоматолог|дент\b|-дент/.test(n)) return 'stomatologiya';
  if (/центральная районная больница/.test(n)) return 'bolnica';
  if (/поликлиник/.test(n)) return 'poliklinika';
  if (/амбулатор/.test(n)) return 'ambulatoriya';
  if (/^(клиника|многопрофильн|медицинский центр|диагностический центр)/.test(n)) return 'centr';
  if (/лаборатор/.test(n)) return 'laboratoriya';
  return 'centr';
}

const orgs = [];
let district = null;
let cur = null;
let updated = null;
let curDate = null;
const used = new Set();
for (const raw of src.split('\n')) {
  const line = raw.trim();
  let m;
  if ((m = line.match(/^Дата актуализации:\s*(\d{2})\.(\d{2})\.(\d{4})/)) ) { curDate = `${m[3]}-${m[2]}-${m[1]}`; if (!updated || curDate > updated) updated = curDate; continue; }
  if ((m = line.match(/^###\s+(.+)$/))) { district = DISTRICTS[m[1].trim()] ? m[1].trim() : null; cur = null; continue; }
  if (line.startsWith('## Источники')) break;
  if ((m = line.match(/^##\s+\d+\.\s+(.+)$/)) && district) {
    const name = m[1].trim();
    const d = DISTRICTS[district];
    const short = name.replace(/\([^)]*\)/g, ' ').replace(/ГБУЗ РБ\s+/g, '').replace(/\s+/g, ' ').trim();
    let slug = slugify(short);
    if (used.has(d.slug + '/' + slug)) slug += '-2';
    used.add(d.slug + '/' + slug);
    cur = { district: d.slug, slug, name, short, type: classify(name), updated: curDate };
    orgs.push(cur);
    continue;
  }
  if (!cur || !line) continue;
  if ((m = line.match(/^(Адрес|Телефон|Электронная почта|Сайт|График|Примечание):\s*(.*)$/))) {
    const key = { 'Адрес': 'address', 'Телефон': 'phone', 'Электронная почта': 'email', 'Сайт': 'site', 'График': 'schedule', 'Примечание': 'note' }[m[1]];
    const val = m[2].trim().replace(/[.\s]+$/, '');
    if (val && !/^нет данных/i.test(val)) cur[key] = val;
  }
}
const out = { updated, districts: Object.fromEntries(Object.entries(DISTRICTS).map(([k, v]) => [v.slug, { name: k, ...v }])), orgs };
fs.writeFileSync(path.join(ROOT, 'data/organizations.json'), JSON.stringify(out, null, 2) + '\n');
const byType = {};
for (const o of orgs) byType[o.type] = (byType[o.type] || 0) + 1;
console.log(`Организаций: ${orgs.length}; актуализация ${updated}`, JSON.stringify(byType));
for (const o of orgs) console.log(o.district.padEnd(14), o.type.padEnd(14), o.slug.padEnd(44), o.phone ? 'T' : '-', o.schedule ? 'G' : '-', o.address ? 'A' : '-');
