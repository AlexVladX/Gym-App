// Nutriție — calcule (fără DOM, testabile în Node: tests/nutritie.test.js).
// Toate valorile unei rețete se calculează din ingrediente: grame × valoarea la 100 g / 100.
// Nimic nu e scris de mână: dacă schimbi o cantitate, se schimbă tot.

const MESE = [
  { id: 'mic-dejun', nume: 'Mic dejun', scurt: 'Mic dejun' },
  { id: 'gustare-1', nume: 'Gustarea 1', scurt: 'Gustare 1' },
  { id: 'pranz', nume: 'Prânz', scurt: 'Prânz' },
  { id: 'gustare-2', nume: 'Gustarea 2', scurt: 'Gustare 2' },
  { id: 'cina', nume: 'Cină', scurt: 'Cină' },
];

// Cele 5 mese ale planului + „Altă masă” (doar pentru mese notate de tine, ex. din poză; generatorul nu o planifică).
const MESE_TOATE = [...MESE, { id: 'alta', nume: 'Altă masă', scurt: 'Altă masă' }];

// Sortarea listelor de rețete (valori pe porție) și alimente (la 100 g) după macronutrienți.
const SORTARI_NUTRITIE = [
  { id: '', nume: 'Ordinea obișnuită' },
  { id: 'proteine-desc', nume: 'Cele mai multe proteine' },
  { id: 'proteine-kcal', nume: 'Cele mai multe proteine la 100 kcal' },
  { id: 'carbohidrati-asc', nume: 'Cei mai puțini carbohidrați' },
  { id: 'carbohidrati-desc', nume: 'Cei mai mulți carbohidrați' },
  { id: 'grasimi-asc', nume: 'Cele mai puține grăsimi' },
  { id: 'grasimi-desc', nume: 'Cele mai multe grăsimi' },
  { id: 'fibre-desc', nume: 'Cele mai multe fibre' },
  { id: 'kcal-asc', nume: 'Cele mai puține calorii' },
  { id: 'kcal-desc', nume: 'Cele mai multe calorii' },
];
// Valoarea după care se sortează (mai mare = mai sus în listă).
function valoareSortareNutritie(v, cheie) {
  if (!v || !cheie) return 0;
  if (cheie === 'proteine-kcal') return v.kcal > 0 ? v.proteine / v.kcal * 100 : 0;
  const [camp, dir] = cheie.split('-');
  const x = Number(v[camp]) || 0;
  return dir === 'asc' ? -x : x;
}

const NUTRIENTI = [
  { id: 'kcal', nume: 'Calorii', unitate: 'kcal' },
  { id: 'proteine', nume: 'Proteine', unitate: 'g' },
  { id: 'carbohidrati', nume: 'Carbohidrați', unitate: 'g' },
  { id: 'grasimi', nume: 'Grăsimi', unitate: 'g' },
  { id: 'fibre', nume: 'Fibre', unitate: 'g' },
];

const CATEGORII_ALIMENTE = [
  { id: 'carne', nume: 'Carne și pește' },
  { id: 'lactate', nume: 'Lactate și ouă' },
  { id: 'legume', nume: 'Legume' },
  { id: 'fructe', nume: 'Fructe' },
  { id: 'cereale', nume: 'Cereale' },
  { id: 'nuci', nume: 'Nuci și semințe' },
  { id: 'altele', nume: 'Alte ingrediente' },
];

// Cei 14 alergeni din Regulamentul UE 1169/2011.
const ALERGENI = [
  { id: 'gluten', nume: 'Gluten' }, { id: 'crustacee', nume: 'Crustacee' }, { id: 'oua', nume: 'Ouă' },
  { id: 'peste', nume: 'Pește' }, { id: 'arahide', nume: 'Arahide' }, { id: 'soia', nume: 'Soia' },
  { id: 'lapte', nume: 'Lapte' }, { id: 'nuci', nume: 'Fructe cu coajă (nuci, migdale…)' },
  { id: 'telina', nume: 'Țelină' }, { id: 'mustar', nume: 'Muștar' }, { id: 'susan', nume: 'Susan' },
  { id: 'sulfiti', nume: 'Sulfiți' }, { id: 'lupin', nume: 'Lupin' }, { id: 'moluste', nume: 'Moluște' },
];

const ORIGINI_ANIMALE = ['carne', 'peste', 'lactate', 'oua', 'miere'];

const DIFICULTATI = { usor: 'Ușor', mediu: 'Mediu', avansat: 'Avansat' };

// Etichetele dietetice. „declarata” = o alegi tu (nu se poate deduce din ingrediente);
// restul se calculează la fiecare afișare, deci rămân corecte și după ce modifici rețeta.
const ETICHETE = [
  { id: 'proteic', nume: 'Bogat în proteine', regula: 'Cel puțin 25% din energie din proteine și cel puțin 20 g pe porție (12 g la gustări).' },
  { id: 'putine-calorii', nume: 'Puține calorii', regula: 'Cel mult 400 kcal pe porție la mesele principale și 200 kcal la gustări.' },
  { id: 'bogat-carbo', nume: 'Bogat în carbohidrați', regula: 'Cel puțin 55% din energie din carbohidrați.' },
  { id: 'sarac-carbo', nume: 'Sărac în carbohidrați', regula: 'Cel mult 20% din energie din carbohidrați.' },
  { id: 'echilibrat', nume: 'Echilibrat', regula: 'Proteine 15–35%, carbohidrați 35–55% și grăsimi 20–35% din energie.' },
  { id: 'vegetarian', nume: 'Vegetarian', regula: 'Fără carne și pește.' },
  { id: 'vegan', nume: 'Vegan', regula: 'Fără ingrediente de origine animală (carne, pește, lactate, ouă, miere).' },
  { id: 'fara-gluten', nume: 'Fără gluten', regula: 'Niciun ingredient care conține sau poate conține gluten.' },
  { id: 'fara-lactate', nume: 'Fără lactate', regula: 'Niciun ingredient care conține sau poate conține lapte.' },
  { id: 'meal-prep', nume: 'Meal prep', regula: 'Se poate găti dinainte pentru mai multe zile.', declarata: true },
  { id: 'buget', nume: 'Buget redus', regula: 'Ingrediente ieftine și ușor de găsit.', declarata: true },
  { id: 'rapid', nume: 'Rapid', regula: 'Gata în cel mult 15 minute.' },
];
const ETICHETE_DECLARATE = ETICHETE.filter(e => e.declarata).map(e => e.id);

const PRAG_GUSTARE_PROTEINE = 12;
const PRAG_MASA_PROTEINE = 20;

function esteGustare(masa) { return masa === 'gustare-1' || masa === 'gustare-2'; }

function valoriGoale() { return { kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 }; }

// Rotunjiri pentru afișare: calorii la întreg, grame la o zecimală.
function rotunjesteValori(v) {
  return {
    kcal: Math.round(v.kcal),
    proteine: Math.round(v.proteine * 10) / 10,
    carbohidrati: Math.round(v.carbohidrati * 10) / 10,
    grasimi: Math.round(v.grasimi * 10) / 10,
    fibre: Math.round(v.fibre * 10) / 10,
  };
}

function indexAlimente(...liste) {
  const idx = new Map();
  for (const lista of liste) for (const a of lista || []) if (a && a.id) idx.set(a.id, a);
  return idx;
}

function valoriAliment(aliment, grame) {
  const f = (Number(grame) || 0) / 100;
  return {
    kcal: aliment.kcal * f,
    proteine: aliment.proteine * f,
    carbohidrati: aliment.carbohidrati * f,
    grasimi: aliment.grasimi * f,
    fibre: aliment.fibre * f,
  };
}

function adunaValori(a, b, factor = 1) {
  return {
    kcal: a.kcal + b.kcal * factor,
    proteine: a.proteine + b.proteine * factor,
    carbohidrati: a.carbohidrati + b.carbohidrati * factor,
    grasimi: a.grasimi + b.grasimi * factor,
    fibre: a.fibre + b.fibre * factor,
  };
}

function inmultesteValori(v, factor) {
  return adunaValori(valoriGoale(), v, factor);
}

// Totalul unei liste [[idAliment, grame]]. Ingredientele necunoscute (ex. un aliment propriu șters)
// nu se ghicesc: apar în „lipsa”, iar totalul le exclude.
function valoriIngrediente(ingrediente, idx) {
  let total = valoriGoale();
  const lipsa = [];
  let grame = 0;
  for (const [id, g] of ingrediente || []) {
    const a = idx.get(id);
    if (!a) { lipsa.push(id); continue; }
    total = adunaValori(total, valoriAliment(a, g));
    grame += Number(g) || 0;
  }
  return { total, lipsa, grame };
}

// Valorile unei porții: totalul rețetei împărțit la numărul de porții.
function valoriPortie(reteta, idx) {
  const { total, lipsa, grame } = valoriIngrediente(reteta.ingrediente, idx);
  const portii = reteta.portii > 0 ? reteta.portii : 1;
  return { ...inmultesteValori(total, 1 / portii), lipsa, grame: grame / portii };
}

// Ponderea energetică a macronutrienților, din 4/4/9 kcal pe gram.
// Se raportează la suma lor (nu la kcal din sursă), ca procentele să dea 100.
function distributieEnergie(v) {
  const p = v.proteine * 4, c = v.carbohidrati * 4, g = v.grasimi * 9;
  const s = p + c + g;
  if (!(s > 0)) return { proteine: 0, carbohidrati: 0, grasimi: 0 };
  return { proteine: p / s, carbohidrati: c / s, grasimi: g / s };
}

function alergeniReteta(reteta, idx) {
  const contine = new Set(), urme = new Set();
  for (const [id] of reteta.ingrediente || []) {
    const a = idx.get(id);
    if (!a) continue;
    for (const x of a.alergeni || []) contine.add(x);
    for (const x of a.urme || []) urme.add(x);
  }
  for (const x of contine) urme.delete(x);
  const ordine = ALERGENI.map(a => a.id);
  const sorteaza = s => [...s].sort((x, y) => ordine.indexOf(x) - ordine.indexOf(y));
  return { contine: sorteaza(contine), urme: sorteaza(urme) };
}

function originiReteta(reteta, idx) {
  const o = new Set();
  for (const [id] of reteta.ingrediente || []) {
    const a = idx.get(id);
    if (a && a.animal) o.add(a.animal);
  }
  return o;
}

// Toate etichetele rețetei: cele calculate + cele declarate de autor.
// Dacă un ingredient lipsește din bibliotecă, etichetele de dietă și de alergeni nu se acordă
// (nu știm ce conține), ca să nu promitem ceva ce nu putem verifica.
function eticheteReteta(reteta, idx) {
  const v = valoriPortie(reteta, idx);
  const d = distributieEnergie(v);
  const gustare = esteGustare(reteta.masa);
  const rez = [];
  if (d.proteine >= 0.25 && v.proteine >= (gustare ? PRAG_GUSTARE_PROTEINE : PRAG_MASA_PROTEINE)) rez.push('proteic');
  if (v.kcal > 0 && v.kcal <= (gustare ? 200 : 400)) rez.push('putine-calorii');
  if (d.carbohidrati >= 0.55) rez.push('bogat-carbo');
  if (v.kcal > 0 && d.carbohidrati <= 0.20) rez.push('sarac-carbo');
  if (d.proteine >= 0.15 && d.proteine <= 0.35 && d.carbohidrati >= 0.35 && d.carbohidrati <= 0.55 &&
    d.grasimi >= 0.20 && d.grasimi <= 0.35) rez.push('echilibrat');
  if (v.lipsa.length === 0) {
    const o = originiReteta(reteta, idx);
    const al = alergeniReteta(reteta, idx);
    if (!o.has('carne') && !o.has('peste')) rez.push('vegetarian');
    if (o.size === 0) rez.push('vegan');
    if (!al.contine.includes('gluten') && !al.urme.includes('gluten')) rez.push('fara-gluten');
    if (!al.contine.includes('lapte') && !al.urme.includes('lapte')) rez.push('fara-lactate');
  }
  for (const e of reteta.etichete || []) if (ETICHETE_DECLARATE.includes(e)) rez.push(e);
  if (reteta.timp > 0 && reteta.timp <= 15) rez.push('rapid');
  const ordine = ETICHETE.map(e => e.id);
  return rez.sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
}

// Afișarea unei cantități: „150 g”, sau „2 ouă (100 g)” când alimentul are o unitate și cantitatea e un număr întreg de bucăți.
function textCantitate(aliment, grame) {
  const g = Math.round(grame * 10) / 10;
  const textG = `${String(g).replace('.', ',')} g`;
  if (aliment && Array.isArray(aliment.buc)) {
    const [gBuc, unu, multe] = aliment.buc;
    const n = grame / gBuc;
    const intreg = Math.round(n * 2) / 2;
    if (intreg > 0 && Math.abs(n - intreg) < 0.02) {
      const nr = String(intreg).replace('.', ',');
      return `${nr} ${intreg === 1 ? unu : multe} (${textG})`;
    }
  }
  return textG;
}

// Caută fără diacritice și fără litere mari: „branza” găsește „Brânză”.
function normalizeazaText(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

if (typeof module !== 'undefined') {
  module.exports = {
    MESE, MESE_TOATE, NUTRIENTI, SORTARI_NUTRITIE, valoareSortareNutritie, CATEGORII_ALIMENTE, ALERGENI, ORIGINI_ANIMALE, DIFICULTATI, ETICHETE, ETICHETE_DECLARATE,
    esteGustare, valoriGoale, rotunjesteValori, indexAlimente, valoriAliment, adunaValori, inmultesteValori,
    valoriIngrediente, valoriPortie, distributieEnergie, alergeniReteta, originiReteta, eticheteReteta,
    textCantitate, normalizeazaText,
  };
}
