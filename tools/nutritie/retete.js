#!/usr/bin/env node
// Unește rețetele din tools/nutritie/retete/*.js în nutritie-retete.js și le verifică.
// Utilizare: node tools/nutritie/retete.js [--raport]
//   --raport afișează valorile pe porție și etichetele fiecărei rețete (pentru verificare).

const fs = require('fs');
const path = require('path');
const { ALIMENTE_BAZA } = require('../../nutritie-alimente.js');
const c = require('../../nutritie-calcul.js');

const SURSE = [['mic-dejun', 'mic-dejun.js'], ['gustare-1', 'gustare-1.js'], ['pranz', 'pranz.js'],
  ['gustare-2', 'gustare-2.js'], ['cina', 'cina.js'], [null, 'romanesti.js']]; // romanesti.js: fiecare rețetă își spune masa
const MESE_ID = ['mic-dejun', 'gustare-1', 'pranz', 'gustare-2', 'cina'];
const FELURI = ['fel-principal', 'ciorba', 'patiserie', 'desert'];
// Câmpuri opționale (Faza 3), copiate doar dacă există.
const CAMPURI_OPTIONALE = ['numeEn', 'fel', 'bucatarie', 'timpPregatire', 'timpGatire', 'gatit', 'estimari', 'varianta'];
const VASE = ['farfurie', 'bol', 'pahar', 'borcan', 'tocator'];

const FOTO = require('./foto.js');
const FOTO_COMMONS = require('./foto-commons.js');
const idx = c.indexAlimente(ALIMENTE_BAZA);
const toate = [];
const erori = [];
for (const [masaFisier, fisier] of SURSE) {
  const cale = path.join(__dirname, 'retete', fisier);
  if (!fs.existsSync(cale)) continue;
  for (const r of require(cale)) {
    const masa = masaFisier || r.masa;
    const reteta = { id: r.id, nume: r.nume, masa, descriere: r.descriere, timp: r.timp, portii: r.portii,
      dificultate: r.dificultate, vas: r.vas, etichete: r.etichete, ingrediente: r.ingrediente, pasi: r.pasi };
    if (FOTO[r.id]) {
      const [idSursa, slug, autor, profil] = FOTO[r.id];
      // slug/autor/profil pot lipsi: pagina /photo/<id>/ redirecționează la pagina completă a fotografiei,
      // iar fără autor cunoscut atribuirea afișează doar „Foto: Pexels”.
      reteta.foto = { fisier: `foto-retete/${r.id}.webp`, furnizor: 'Pexels', idSursa,
        pagina: slug ? `https://www.pexels.com/photo/${slug}-${idSursa}/` : `https://www.pexels.com/photo/${idSursa}/` };
      if (autor) reteta.foto.autor = autor;
      if (profil) reteta.foto.profil = `https://www.pexels.com/@${profil}/`;
      if (!fs.existsSync(path.join(__dirname, '..', '..', reteta.foto.fisier))) erori.push(`${r.id}: lipsește ${reteta.foto.fisier}`);
    } else if (FOTO_COMMONS[r.id]) {
      const [fisierCommons, autor, licenta, linkLicenta] = FOTO_COMMONS[r.id];
      reteta.foto = { fisier: `foto-retete/${r.id}.webp`, furnizor: 'Wikimedia Commons', idSursa: fisierCommons,
        pagina: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fisierCommons).replace(/%20/g, '_')}`, autor, licenta, linkLicenta };
      if (!fs.existsSync(path.join(__dirname, '..', '..', reteta.foto.fisier))) erori.push(`${r.id}: lipsește ${reteta.foto.fisier}`);
    }
    for (const k of CAMPURI_OPTIONALE) if (r[k] !== undefined) reteta[k] = r[k];
    const e = (m) => erori.push(`${r.id}: ${m}`);
    if (!MESE_ID.includes(masa)) e('masă necunoscută');
    if (r.fel !== undefined && !FELURI.includes(r.fel)) e('fel necunoscut');
    if ((r.timpPregatire !== undefined || r.timpGatire !== undefined) && r.timpPregatire + r.timpGatire !== r.timp) e('timp ≠ pregătire + gătire');
    if (r.gatit !== undefined) {
      const gp = r.gatit.greutateGatita / r.portii;
      if (!(gp >= 50 && gp <= 1000) || !r.gatit.nota) e(`greutatea gătită nerealistă (${Math.round(gp)} g/porție) sau fără notă`);
    }
    if (r.estimari !== undefined && !(Array.isArray(r.estimari) && r.estimari.every(x => typeof x === 'string' && x))) e('estimări invalide');
    if (r.varianta !== undefined && !(r.varianta.grup && r.varianta.nume)) e('variantă invalidă');
    if (!/^[a-z0-9-]+$/.test(r.id || '')) e('id invalid');
    if (toate.some(x => x.id === r.id)) e('id dublu');
    if (!r.nume || !r.descriere) e('fără nume sau descriere');
    if (!(r.timp > 0) || !(r.portii >= 1)) e('timp sau porții invalide');
    if (!c.DIFICULTATI[r.dificultate]) e('dificultate necunoscută');
    if (!VASE.includes(r.vas)) e('vas necunoscut');
    if (!Array.isArray(r.pasi) || r.pasi.length < 2) e('prea puțini pași');
    for (const t of r.etichete || []) if (!c.ETICHETE_DECLARATE.includes(t)) e(`etichetă nedeclarabilă ${t}`);
    for (const [id, g] of r.ingrediente || []) {
      if (!idx.has(id)) e(`ingredient necunoscut ${id}`);
      if (!(g > 0)) e(`cantitate invalidă la ${id}`);
    }
    if (toate.some(x => x.nume.toLowerCase() === r.nume.toLowerCase())) e('nume dublu');
    toate.push(reteta);
  }
}
for (const id of [...Object.keys(FOTO), ...Object.keys(FOTO_COMMONS)]) if (!toate.some(r => r.id === id)) erori.push(`foto: rețeta ${id} nu există`);
if (erori.length) { console.error(erori.join('\n')); process.exit(1); }

if (process.argv.includes('--raport')) {
  for (const r of toate) {
    const v = c.valoriPortie(r, idx);
    const d = c.distributieEnergie(v);
    const pc = x => String(Math.round(x * 100)).padStart(2);
    console.log(`${r.masa.padEnd(9)} ${r.id.padEnd(30)} ${String(Math.round(v.kcal)).padStart(4)} kcal  P ${v.proteine.toFixed(0).padStart(3)} C ${v.carbohidrati.toFixed(0).padStart(3)} G ${v.grasimi.toFixed(0).padStart(3)} F ${v.fibre.toFixed(0).padStart(2)}  (${pc(d.proteine)}/${pc(d.carbohidrati)}/${pc(d.grasimi)})  ${c.eticheteReteta(r, idx).join(',')}`);
  }
  const pe = {};
  for (const r of toate) for (const t of c.eticheteReteta(r, idx)) pe[t] = (pe[t] || 0) + 1;
  console.log(toate.length, 'rețete', JSON.stringify(pe));
}

const text = `// GENERAT de tools/nutritie/retete.js din tools/nutritie/retete/*.js. Nu edita manual.
// Cantitățile (grame) sunt pentru toată rețeta; valorile nutriționale și etichetele dietetice
// se calculează din ingrediente în nutritie-calcul.js.
const RETETE_BAZA = [
${toate.map(r => '  ' + JSON.stringify(r)).join(',\n')},
];

if (typeof module !== 'undefined') module.exports = { RETETE_BAZA };
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'nutritie-retete.js'), text);
console.log(`${toate.length} rețete scrise în nutritie-retete.js`);
