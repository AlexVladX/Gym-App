// Generează ilustrațiile exercițiilor: pentru fiecare exercițiu din catalog, un fișier SVG
// cu cele două poziții (ilustratii/<slug>.svg) și o miniatură cu o singură poziție (ilustratii/<slug>-mini.svg).
// Rulează din rădăcina proiectului:  node tools/ilustratii/genereaza.js
// Opțiuni: --grupa Piept (doar o grupă), --iesire <dosar>, --revizie (pagina de verificare cu toate).
'use strict';
const fs = require('fs');
const path = require('path');
const { compune } = require('./compune');
const { precizie } = require('./geom');

const RADACINA = path.join(__dirname, '..', '..');
const sursa = fs.readFileSync(path.join(RADACINA, 'exercitii.js'), 'utf8');
const { BIBLIOTECA } = new Function('document', `${sursa}; return { BIBLIOTECA };`)({});
const catalog = require(path.join(RADACINA, 'catalog.js'));

const SPECIFICATII = Object.assign({},
  ...['piept', 'spate', 'umeri', 'brate', 'picioare', 'abdomen', 'grupe'].map(n => {
    const f = path.join(__dirname, 'exercitii', `${n}.js`);
    if (!fs.existsSync(f)) return {};
    const m = { ...require(f) };
    delete m._ajutor;
    return m;
  }));

// Același nume de fișier ca în aplicație (figuri.js → numeFisierIlustratie).
function slug(nume) {
  return String(nume).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Mușchi → zone desenate (vezi corp.js).
const ZONE = {
  piept: ['piept'], umeri: ['umeri'], triceps: ['triceps'], biceps: ['biceps'], 'antebrațe': ['antebrate'],
  dorsali: ['dorsali'], 'spate (mijloc)': ['spateMijloc'], trapez: ['trapez'], 'zona lombară': ['lombar'],
  abdomen: ['abdomen'], fesieri: ['fese'], 'cvadricepși': ['cvadriceps'], femurali: ['femurali'], gambe: ['gambe'],
  adductori: ['adductori'], abductori: ['abductori'],
};
const ZONE_GRUPA = {
  Piept: ['piept'], Spate: ['dorsali', 'spateMijloc'], Umeri: ['umeri'], Biceps: ['biceps'], Triceps: ['triceps'],
  Antebrațe: ['antebrate'], Cvadricepși: ['cvadriceps'], Femurali: ['femurali'], Fese: ['fese'], Gambe: ['gambe'],
  Abdomen: ['abdomen'], Picioare: ['cvadriceps', 'femurali'],
};
function nivel(u) {
  const niv = {};
  for (const m of u.secundari || []) for (const z of ZONE[m] || []) niv[z] = Math.max(niv[z] || 0, 1);
  const pr = (u.principali || []).flatMap(m => ZONE[m] || []);
  for (const z of pr.length ? pr : (ZONE_GRUPA[u.grupa] || [])) niv[z] = 2;
  return niv;
}

function construieste(spec, niv, nume) {
  const s = spec();
  const nivFinal = s.niv ? s.niv : niv;
  const poze = s.poze.map(p => ({ ...p, niv: p.niv || nivFinal }));
  precizie(1);
  const mare = compune(poze, { raport: 1.6, eticheta: nume });
  precizie(0);
  const iMini = s.mini ?? (poze.length - 1);
  const mini = compune([{ ...poze[iMini], sageata: null }], { lod: 'mini', raport: 46 / 54, margine: 5, eticheta: nume });
  precizie(1);
  return { mare, mini };
}

function main() {
  const arg = process.argv.slice(2);
  const opt = k => { const i = arg.indexOf(k); return i >= 0 ? arg[i + 1] : null; };
  const grupa = opt('--grupa');
  const doar = opt('--doar');
  const iesire = opt('--iesire') || path.join(RADACINA, 'ilustratii');
  fs.mkdirSync(iesire, { recursive: true });
  const rezultat = [];
  const lipsa = [];
  for (const e of BIBLIOTECA) {
    if (grupa && !grupa.split(',').includes(e.grupa)) continue;
    if (doar && !e.nume.toLowerCase().includes(doar.toLowerCase())) continue;
    const spec = SPECIFICATII[e.nume];
    if (!spec) { lipsa.push(e.nume); continue; }
    const u = catalog.unificaExercitiu(e, null);
    const { mare, mini } = construieste(spec, nivel(u), e.nume);
    const s = slug(e.nume);
    fs.writeFileSync(path.join(iesire, `${s}.svg`), mare);
    fs.writeFileSync(path.join(iesire, `${s}-mini.svg`), mini);
    rezultat.push({ nume: e.nume, grupa: e.grupa, echipament: e.echipament, s, kb: (mare.length / 1024).toFixed(0), kbMini: (mini.length / 1024).toFixed(0) });
  }
  // ilustrațiile implicite pe grupe (pentru exercițiile proprii)
  if (!grupa && !doar) {
    for (const [g, spec] of Object.entries(SPECIFICATII).filter(([k]) => k.startsWith('grupa:'))) {
      const nume = g.slice(6);
      const { mare, mini } = construieste(spec, nivel({ grupa: nume, principali: [], secundari: [] }), nume);
      fs.writeFileSync(path.join(iesire, `grupa-${slug(nume)}.svg`), mare);
      fs.writeFileSync(path.join(iesire, `grupa-${slug(nume)}-mini.svg`), mini);
      rezultat.push({ nume: `Grupa ${nume}`, grupa: nume, s: `grupa-${slug(nume)}` });
    }
  }
  // lista miniaturilor, citită de service worker la instalare (sw.js)
  if (!grupa && !doar) {
    const miniaturi = fs.readdirSync(iesire).filter(f => f.endsWith('-mini.svg')).sort();
    fs.writeFileSync(path.join(iesire, 'lista.json'), JSON.stringify({ miniaturi }) + '\n');
  }
  if (arg.includes('--revizie')) {
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0E1013;font-family:system-ui;color:#fff;display:flex;flex-wrap:wrap;gap:10px;padding:10px">`
      + rezultat.map((r, i) => `<div style="width:430px;background:#171B21;border-radius:14px;padding:10px">
        <div style="font-size:14px;font-weight:600">${i + 1}. ${r.nume}</div><div style="font-size:11px;color:#9AA2AC">${r.grupa} · ${r.echipament || ''} · ${r.kb}KB / ${r.kbMini}KB</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px"><img src="${r.s}.svg" style="width:340px;height:212px;background:#1F242B;border-radius:10px">
        <img src="${r.s}-mini.svg" style="width:46px;height:54px;background:#262C34;border-radius:8px"></div></div>`).join('');
    fs.writeFileSync(path.join(iesire, 'revizie.html'), html);
  }
  console.log(`${rezultat.length} ilustrații în ${iesire}` + (lipsa.length ? `; fără specificație: ${lipsa.length}` : ''));
  if (!opt('--iesire')) console.log('Pentru aplicație rulează apoi: node tools/ilustratii/optimizeaza.mjs (optimizează și dă versiunea ilustrațiilor).');
  if (lipsa.length && arg.includes('--lipsa')) console.log(lipsa.join('\n'));
}

module.exports = { slug, nivel, construieste, SPECIFICATII };
if (require.main === module) main();
