#!/usr/bin/env node
// Generează nutritie-alimente.js din lista ingredientelor (ingrediente.js) și baza de date USDA SR28.
//
// Sursa: U.S. Department of Agriculture, Agricultural Research Service, Nutrient Data Laboratory.
//   USDA National Nutrient Database for Standard Reference, Release 28 (2015, revizuită 2016). Domeniu public.
//   Fișierele ABBREV.txt și FOOD_DES.txt se iau, de exemplu, din pachetul npm „fda-nutrient-database” (data/):
//     npm pack fda-nutrient-database && tar xzf fda-nutrient-database-*.tgz
//
// Utilizare: node tools/nutritie/genereaza.js <director cu ABBREV.txt și FOOD_DES.txt>
// Coloanele folosite din ABBREV.txt (la 100 g parte comestibilă):
//   [3] Energ_Kcal, [4] Protein (g), [5] Lipid_Tot (g), [7] Carbohydrt (g, „prin diferență”, include fibrele), [8] Fiber_TD (g)

const fs = require('fs');
const path = require('path');
const lista = require('./ingrediente.js');

const dir = process.argv[2];
if (!dir) { console.error('Dă directorul cu ABBREV.txt și FOOD_DES.txt.'); process.exit(1); }

const randuri = new Map();
for (const linie of fs.readFileSync(path.join(dir, 'ABBREV.txt'), 'latin1').split(/\r?\n/)) {
  if (!linie) continue;
  const f = linie.split('^');
  randuri.set(f[0].replace(/~/g, ''), f);
}
const descrieri = new Map();
for (const linie of fs.readFileSync(path.join(dir, 'FOOD_DES.txt'), 'latin1').split(/\r?\n/)) {
  if (!linie) continue;
  const f = linie.split('^');
  descrieri.set(f[0].replace(/~/g, ''), f[2].replace(/~/g, ''));
}

const numar = (text, camp, id) => {
  if (text === '' || text === undefined) throw new Error(`${id}: lipsește ${camp} în sursă`);
  const v = Number(text);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${id}: ${camp} invalid (${text})`);
  return v;
};

const iduri = new Set();
const alimente = lista.map(([id, nume, ndb, cat, aspect, culoare, alergeni, animal, extra = {}]) => {
  if (iduri.has(id)) throw new Error(`id dublu: ${id}`);
  iduri.add(id);
  const r = randuri.get(ndb);
  if (!r) throw new Error(`${id}: codul NDB ${ndb} nu există în SR28`);
  // Fibrele lipsă din sursă: 0 doar pentru alimentele de origine animală (nu conțin fibre); altfel e o eroare.
  const fibre = r[8] === '' && animal && animal !== 'miere' ? 0 : numar(r[8], 'fibre', id);
  const a = {
    id, nume, ndb, sursa: descrieri.get(ndb), cat, aspect, culoare, alergeni, animal,
    kcal: numar(r[3], 'kcal', id),
    proteine: numar(r[4], 'proteine', id),
    carbohidrati: numar(r[7], 'carbohidrați', id),
    grasimi: numar(r[5], 'grăsimi', id),
    fibre,
  };
  if (extra.buc) a.buc = extra.buc;
  if (extra.urme) a.urme = extra.urme;
  if (extra.nota) a.nota = extra.nota;
  return a;
});

const antet = `// GENERAT de tools/nutritie/genereaza.js din tools/nutritie/ingrediente.js. Nu edita manual.
// Valori nutriționale la 100 g (parte comestibilă, crud dacă nu scrie altfel), copiate din:
//   USDA National Nutrient Database for Standard Reference, Release 28 (SR28), domeniu public.
// carbohidrati = carbohidrați totali (prin diferență, includ fibrele), ca în sursă.
`;
const corp = `const SURSA_NUTRITIE = ${JSON.stringify({
  nume: 'USDA National Nutrient Database for Standard Reference, Release 28',
  scurt: 'USDA SR28',
  autor: 'U.S. Department of Agriculture, Agricultural Research Service, Nutrient Data Laboratory',
  licenta: 'Domeniu public',
})};

const ALIMENTE_BAZA = [
${alimente.map(a => '  ' + JSON.stringify(a)).join(',\n')},
];

if (typeof module !== 'undefined') module.exports = { SURSA_NUTRITIE, ALIMENTE_BAZA };
`;
const tinta = path.join(__dirname, '..', '..', 'nutritie-alimente.js');
fs.writeFileSync(tinta, antet + corp);
console.log(`${alimente.length} alimente scrise în ${path.relative(process.cwd(), tinta)}`);
