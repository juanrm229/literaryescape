// Build: content/nyewu/*.md  ->  site/data/nyewu.js
// - Splits each Berkas file into documents (## ID · Title)
// - Strips production notes meant for the site builder
// - Hashes the accepted answers and encrypts the locked pages (IX-03, IX-04)
//   with a key that only exists once all 26 names are found.
//
// Usage: node scripts/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content', 'nyewu');
const OUT = path.join(ROOT, 'site', 'data', 'nyewu.js');

// ---------- crypto helpers (mirrored in site/assets/js/crypt.js) ----------
const fnv = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const keystream = (key, n) => {
  let s = fnv(key) || 1;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    s = (s ^ (s << 13)) >>> 0; s = (s ^ (s >>> 17)) >>> 0; s = (s ^ (s << 5)) >>> 0;
    out[i] = (s ^ key.charCodeAt(i % key.length)) & 255;
  }
  return out;
};
const seal = (text, key) => {
  const bytes = Buffer.from('LE:' + text, 'utf8');
  const ks = keystream(key, bytes.length);
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= ks[i];
  return bytes.toString('base64');
};
const SALT = 'nyewu:';
const hashName = (n) => fnv(SALT + n).toString(36);
export const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

// ---------- parse ----------
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md')).sort();
const berkas = [];

for (const file of files) {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8').replace(/\r/g, '');
  const lines = text.split('\n');
  const h1 = lines.findIndex((l) => l.startsWith('# '));
  let head = lines[h1].slice(2).trim();
  let id, title;
  if (head.startsWith('Berkas ')) {
    const m = head.match(/^Berkas\s+(\S+)\s+·\s+(.+)$/);
    id = m[1]; title = m[2];
  } else { id = '0'; title = 'Pengantar'; }

  const body = lines.slice(h1 + 1).join('\n');
  const parts = body.split(/^## /m);
  let intro = parts.shift()
    .split('\n')
    .filter((l) => !/^\w{3} \d+, \d{4} · @/.test(l))
    .filter((l) => !l.includes('Catatan produksi'))
    .join('\n');
  intro = trimRules(intro);
  if (/^-+$/.test(intro)) intro = "";

  const docs = parts.map((p) => {
    const nl = p.indexOf('\n');
    const header = p.slice(0, nl).trim();
    const [did, ...rest] = header.split(' · ');
    return { id: did.trim(), title: rest.join(' · ').trim(), md: trimRules(p.slice(nl + 1)) };
  });
  berkas.push({ id, title, intro, docs });
}

function trimRules(s) {
  return s.replace(/^\s+/, '').replace(/(\n\s*---\s*)+\s*$/, '').trim();
}

// ---------- Berkas IX: strip builder notes, lock pages ----------
const ix = berkas.find((b) => b.id === 'IX');
const getDoc = (did) => ix.docs.find((d) => d.id === did);

const ix01 = getDoc('IX-01');
ix01.md = trimRules(ix01.md.slice(0, ix01.md.indexOf('*\\[Formulir')));

const stripOnly = (md) => md.split('\n').filter((l) => !l.startsWith('*\\[Hanya tampil')).join('\n').trim();
const ix03 = stripOnly(getDoc('IX-03').md);
const ix04 = stripOnly(getDoc('IX-04').md);

const ix05raw = getDoc('IX-05').md;
const cut = (label) => {
  const start = ix05raw.indexOf(label);
  if (start < 0) throw new Error('IX-05 variant missing: ' + label);
  const after = ix05raw.slice(start + label.length);
  const next = after.search(/\n\*\*Jika /);
  return (next < 0 ? after : after.slice(0, next)).trim();
};
const ix05 = {
  before: cut('**Jika tanggal hari ini sebelum 12 Februari 2027:**'),
  incomplete: cut('**Jika jawaban belum lengkap:**'),
  after: cut('**Jika tanggal sudah lewat 12 Februari 2027 dan teka-teki tidak terpecahkan:**'),
};
ix.docs = [
  ix01,
  getDoc('IX-02'),
  { id: 'IX-03', title: getDoc('IX-03').title, md: null, locked: 'solve' },
  { id: 'IX-04', title: getDoc('IX-04').title, md: null, locked: 'date' },
];

// ---------- answers ----------
// Each person: canonical display name, aliases, the habit printed on the stamp,
// the question they repeat in the loop, a motif colour index and their year.
const PEOPLE = [
  ['Kasan', ['kasan', 'kangkasan', 'pakkasan'], 'Sisir hitam', 'Aku wis tekan durung?', 1979],
  ['Ngadimin', ['ngadimin', 'din', 'adimin', 'madin'], 'Siul camar', 'Mak, aku ora telat to?', 1979],
  ['Suroto', ['suroto', 'roto', 'kangroto'], 'Hitungan kayuh', 'Pitungatus telu, pitungatus papat…', 1979],
  ['Tarmuji', ['tarmuji', 'muji'], 'Joko di pundak', 'Joko wis turu durung?', 1979],
  ['Jumadi', ['jumadi', 'jum'], 'Kacang rebus', 'Yanto mau pengin melu.', 1979],
  ['Slamet Riyadi', ['slametriyadi', 'slamet', 'met', 'riyadi', 'slametriadi'], 'Puisi bungkus rokok', '(memandangi lampu suar)', 1979],
  ['Gunadi', ['gunadi', 'gun'], 'Perahu kayu waru', 'Ratna isih nyimpen praune?', 1979],
  ['Rusdi', ['rusdi', 'rus'], 'Kentrung fals', 'Gitarku ojo didol.', 1979],
  ['Kasiman', ['kasiman', 'siman'], 'Layangan koran', 'Budi, layangane wis munggah?', 1979],
  ['Ahmad Sholeh', ['ahmadsholeh', 'sholeh', 'soleh', 'ahmadsoleh', 'saleh', 'ahmadsaleh'], 'Azan subuh', 'Allahu akbar, Allahu akbar…', 1979],
  ['Joyo', ['joyo', 'mbahjo', 'mbahjoyo', 'pakjoyo'], 'Dongeng 1937', 'Iki durung sepira, Le.', 1979],
  ['Marto', ['marto', 'kangmarto', 'mbahmarto', 'pakmarto'], 'Timbang tangan', 'Dewi wis isa ngomong durung?', 1979],
  ['Wakidi', ['wakidi', 'kidi'], 'Telinga kiri', 'Aku krungu sing kiwa wae, Mbah.', 1979],
  ['Tukimin', ['tukimin', 'kimin', 'buto'], 'Dua piring', 'Isih adoh, Kang?', 1979],
  ['Wardi', ['wardi'], 'Pisang goreng', 'Ponijah! Gorengan pisang!', 1979],
  ['Giyanto', ['giyanto', 'gi', 'sigi', 'gianto'], 'Duduk di haluan', 'Mbah Rukmini, aku wedi.', 1979],
  ['Kliwon', ['kliwon'], 'Rumpun pandan', 'Pandane wis dhuwur?', 1979],
  ['Ridwan', ['ridwan', 'wan'], 'Koran bekas', 'Ana kabar apa?', 1979],
  ['Tasrip', ['tasrip'], 'Bambang · Endah', 'Bambang, Endah, Bapak bali!', 1979],
  ['Painah', ['painah', 'bupainah'], 'Kerudung merah', 'Kang Roto wis cedhak.', 1987],
  ['Sainah', ['sainah', 'mboksainah', 'mbahsainah'], 'Biji asam', 'Diiin! Mulih, Din, wis surup!', 1995],
  ['Ponijah', ['ponijah', 'buponijah'], 'Gelang akar bahar', 'Siji, loro, telu…', 2003],
  ['Sumarni', ['sumarni', 'marni'], 'Tasbih 33 butir', 'Alif. Ba. Ta. Tsa…', 2003],
  ['Rasmi', ['rasmi', 'burasmi'], 'Sarung kotak hijau', '(menyiapkan dua gelas teh)', 2011],
  ['Agus', ['agus'], 'Tangan berminyak', 'Kok isa loro-lorone?', 2011],
  ['Gita Anjani', ['gitaanjani', 'gita', 'anjani', 'mbakgita'], 'Pulpen hijau', 'Bu, kok dekat banget lampunya…', 2019],
];

const masterKey = PEOPLE.map((p) => norm(p[0])).join('|');
const answers = [];
const seen = new Set();
PEOPLE.forEach(([name, aliases, habit, q, year], i) => {
  for (const a of aliases) {
    const k = norm(a);
    if (seen.has(k)) throw new Error('duplicate alias ' + k);
    seen.add(k);
    answers.push({ h: hashName(k), p: seal(JSON.stringify({ i, name, habit, q, year, k: norm(name) }), k) });
  }
});

// Wrong answers -> response code
const WRONG = {
  sampai: ['darmaji', 'kangji', 'ji', 'kadir', 'wagiman', 'mbahwagi', 'wagi', 'sapari', 'pari', 'paklikpari', 'rohmat', 'mat',
    'paimin', 'mulyono', 'mul', 'sukarman', 'karman', 'darto', 'karyo', 'bejo', 'josumberrejeki', 'sabar', 'ponidi', 'sanusi',
    'sunardi', 'nardi', 'mardi', 'rebo', 'harjo', 'pakjo', 'pakjoslamet', 'sugeng', 'miskun', 'samidi', 'paijo', 'jobojonesumarsih'],
  tidur: ['rukmini', 'mbahrukmini', 'mbokrukmini'],
  tahu: ['sumi', 'busumi', 'sumarsih', 'ngatini', 'sarinem', 'painem', 'kasmini', 'yatmi', 'fatimah', 'wiryo', 'pakwiryo',
    'wiryosudarmo', 'darsono', 'pakdarsono', 'sastro', 'paksastro', 'sapuan', 'rakijah', 'mbokrakijah', 'soerodikromo',
    'vanhaaften', 'haaften', 'verhoeff', 'sukinah', 'ginem', 'lasmi', 'siti', 'umi'],
  sini: ['warta', 'suwarta', 'maswarta'],
  darat: ['rini', 'yuli', 'budi', 'ratna', 'endang', 'ninik', 'yanto', 'nining', 'hastuti', 'ibuhastuti', 'joko', 'tumi',
    'bambang', 'endah', 'lastri', 'dewi', 'kasih', 'edi', 'ani', 'supri', 'ida', 'tumirah', 'halimah', 'wati', 'rafa',
    'gimin', 'narti', 'parjo', 'eko', 'dwi', 'tri', 'lilis', 'kustini', 'wahyuni', 'arif', 'anto', 'puji', 'ponirah',
    'hartini', 'rofiq', 'sutinah', 'wahyu', 'sukidi', 'hadi', 'pakhadi', 'wulandari', 'bidanwulandari', 'kusno'],
  jo: ['jo'],
};
const wrong = {};
for (const [code, list] of Object.entries(WRONG)) for (const n of list) {
  const k = norm(n);
  if (seen.has(k)) throw new Error('wrong/right clash ' + k);
  wrong[hashName(k)] = code;
}

const data = {
  id: 'nyewu',
  built: new Date().toISOString().slice(0, 10),
  berkas,
  ix05,
  locked: { 'IX-03': seal(ix03, masterKey), 'IX-04': seal(ix04, masterKey) },
  total: PEOPLE.length,
  answers,
  wrong,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, '/* generated by scripts/build.mjs — do not edit */\nwindow.CASE_DATA = window.CASE_DATA || {};\nwindow.CASE_DATA.nyewu = ' + JSON.stringify(data) + ';\n');
const docCount = berkas.reduce((n, b) => n + b.docs.length, 0);
console.log(`nyewu: ${berkas.length} berkas, ${docCount} dokumen, ${answers.length} alias, ${Object.keys(wrong).length} jawaban keliru -> ${path.relative(ROOT, OUT)}`);
