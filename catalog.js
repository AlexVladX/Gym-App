// Biblioteca unificată de exerciții: catalogul inclus (exercitii.js) + exercițiile și preferințele tale
// (store-ul „exercitii" din db.js). Partea de calcul nu atinge pagina, ca să poată fi testată în Node
// (tests/catalog.test.js).
//
// Înregistrarea ta pentru un exercițiu din catalog ține doar ce ai schimbat: { nume, grupa?, tip?, favorit?, nota? }.
// Un exercițiu propriu (care nu e în catalog) are toate câmpurile:
// { nume, grupa, secundari[], echipament, categorie, nivel, tip, instructiuni, favorit, nota, creat }.

const GRUPE = ['Piept', 'Spate', 'Umeri', 'Biceps', 'Triceps', 'Antebrațe', 'Cvadricepși', 'Femurali', 'Fese', 'Gambe', 'Abdomen'];
const GRUPA_VECHE = 'Picioare'; // folosită până la etapa 4; exercițiile proprii o păstrează până alegi alta
const NIVELURI = ['Începător', 'Mediu', 'Avansat'];
const CATEGORII = ['Compus', 'Izolare'];
const ECHIPAMENTE = ['Bară', 'Bară EZ', 'Gantere', 'Aparat', 'Scripete', 'Corp', 'Kettlebell', 'Benzi elastice', 'Altele'];
const MUSCHI = ['piept', 'umeri', 'triceps', 'biceps', 'antebrațe', 'dorsali', 'spate (mijloc)', 'trapez', 'zona lombară',
  'abdomen', 'fesieri', 'cvadricepși', 'femurali', 'gambe', 'adductori', 'abductori'];

// Mușchii care corespund fiecărei grupe principale (pentru a calcula mușchii secundari).
const MUSCHI_GRUPA = {
  Piept: ['piept'], Spate: ['dorsali', 'spate (mijloc)', 'trapez', 'zona lombară'], Umeri: ['umeri'],
  Biceps: ['biceps'], Triceps: ['triceps'], Antebrațe: ['antebrațe'], Cvadricepși: ['cvadricepși'],
  Femurali: ['femurali'], Fese: ['fesieri'], Gambe: ['gambe'], Abdomen: ['abdomen'],
};

const TIPURI_VALIDE = ['greutate', 'corp', 'timp', 'distanta'];

// Căutare fără diacritice: „impins" găsește „Împins".
function fara(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Tipul implicit al unui exercițiu din catalog.
function tipDinCatalog(e) {
  if (e.poza === 'plank') return 'timp';
  if (/farmer/i.test(e.nume)) return 'distanta';
  if (e.echipament === 'Corp') return 'corp';
  return 'greutate';
}

// Unifică o intrare de catalog (sau null) cu înregistrarea ta (sau null) într-un singur obiect.
function unificaExercitiu(dinCatalog, propriu) {
  if (dinCatalog) {
    const p = propriu || {};
    const grupa = p.grupa && (GRUPE.includes(p.grupa) || p.grupa === GRUPA_VECHE) ? p.grupa : dinCatalog.grupa;
    return {
      nume: dinCatalog.nume,
      grupa,
      secundari: (dinCatalog.muschi || []).filter(m => !(MUSCHI_GRUPA[grupa] || []).includes(m)),
      principali: (dinCatalog.muschi || []).filter(m => (MUSCHI_GRUPA[grupa] || []).includes(m)),
      echipament: dinCatalog.echipament || null,
      categorie: dinCatalog.categorie || null,
      nivel: dinCatalog.nivel || null,
      instructiuni: dinCatalog.descriere || '',
      tip: TIPURI_VALIDE.includes(p.tip) ? p.tip : tipDinCatalog(dinCatalog),
      poza: dinCatalog.poza || null,
      favorit: p.favorit === true,
      nota: typeof p.nota === 'string' ? p.nota : '',
      propriu: false,
    };
  }
  const p = propriu;
  return {
    nume: p.nume,
    grupa: typeof p.grupa === 'string' && p.grupa ? p.grupa : null,
    secundari: Array.isArray(p.secundari) ? p.secundari.filter(m => typeof m === 'string') : [],
    principali: [],
    echipament: typeof p.echipament === 'string' && p.echipament ? p.echipament : null,
    categorie: CATEGORII.includes(p.categorie) ? p.categorie : null,
    nivel: NIVELURI.includes(p.nivel) ? p.nivel : null,
    instructiuni: typeof p.instructiuni === 'string' ? p.instructiuni : '',
    tip: TIPURI_VALIDE.includes(p.tip) ? p.tip : 'greutate',
    poza: null,
    favorit: p.favorit === true,
    nota: typeof p.nota === 'string' ? p.nota : '',
    propriu: true,
  };
}

// Construiește lista completă. catalog: BIBLIOTECA; proprii: înregistrările din store.
function construiesteBiblioteca(catalog, proprii) {
  // Înregistrări care diferă doar prin litere mari/mici se unesc (câmpurile completate au prioritate),
  // ca o preferință salvată sub „Flotări" să nu fie ascunsă de o înregistrare goală „flotări".
  const dupaNume = new Map();
  for (const p of proprii) {
    if (!p || typeof p.nume !== 'string') continue;
    const cheie = p.nume.toLowerCase();
    const completate = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    // Prima înregistrare are prioritate (numele scris corect); celelalte doar completează câmpurile lipsă.
    dupaNume.set(cheie, { ...completate, ...(dupaNume.get(cheie) || {}) });
  }
  const rezultat = new Map();
  for (const e of catalog) rezultat.set(e.nume.toLowerCase(), unificaExercitiu(e, dupaNume.get(e.nume.toLowerCase())));
  for (const [cheie, p] of dupaNume) if (!rezultat.has(cheie)) rezultat.set(cheie, unificaExercitiu(null, p));
  return rezultat;
}

// Alternative pentru un exercițiu: aceeași grupă principală, ordonate după mușchii secundari comuni,
// aceeași categorie, echipament diferit (ca să ai variante când aparatul e ocupat) și dificultate apropiată.
function alternativePentru(tinta, toate, n = 4) {
  if (!tinta || !tinta.grupa) return [];
  const sec = new Set(tinta.secundari);
  const nivel = e => Math.max(0, NIVELURI.indexOf(e.nivel));
  return toate
    .filter(e => e.nume !== tinta.nume && e.grupa === tinta.grupa)
    .map(e => {
      let scor = 0;
      for (const m of e.secundari) if (sec.has(m)) scor += 2;
      if (e.categorie && e.categorie === tinta.categorie) scor += 3;
      if (e.tip === tinta.tip) scor += 1;
      if (e.echipament && tinta.echipament && e.echipament !== tinta.echipament) scor += 1;
      scor -= Math.abs(nivel(e) - nivel(tinta));
      return { e, scor };
    })
    .sort((a, b) => b.scor - a.scor || a.e.nume.localeCompare(b.e.nume, 'ro'))
    .slice(0, n)
    .map(x => x.e);
}

// Verifică datele unui exercițiu propriu din formular. Întoarce { ok, eroare?, date? }.
// existente: Set cu numele (litere mici) deja folosite; numeVechi: la editare.
function valideazaExercitiuPropriu(f, existente, numeVechi = null) {
  const nume = String(f.nume || '').trim().replace(/\s+/g, ' ');
  if (nume.length < 2) return { ok: false, eroare: 'Numele trebuie să aibă cel puțin 2 caractere.' };
  if (nume.length > 80) return { ok: false, eroare: 'Numele poate avea cel mult 80 de caractere.' };
  const schimbat = !numeVechi || numeVechi.toLowerCase() !== nume.toLowerCase();
  if (schimbat && existente.has(nume.toLowerCase())) return { ok: false, eroare: `Există deja un exercițiu numit „${nume}".` };
  if (!GRUPE.includes(f.grupa)) return { ok: false, eroare: 'Alege grupa musculară principală.' };
  return {
    ok: true,
    date: {
      nume,
      grupa: f.grupa,
      secundari: (f.secundari || []).filter(m => MUSCHI.includes(m) && !(MUSCHI_GRUPA[f.grupa] || []).includes(m)),
      echipament: ECHIPAMENTE.includes(f.echipament) ? f.echipament : 'Altele',
      categorie: CATEGORII.includes(f.categorie) ? f.categorie : 'Compus',
      nivel: NIVELURI.includes(f.nivel) ? f.nivel : 'Începător',
      tip: TIPURI_VALIDE.includes(f.tip) ? f.tip : 'greutate',
      instructiuni: String(f.instructiuni || '').trim().slice(0, 2000),
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { GRUPE, GRUPA_VECHE, MUSCHI_GRUPA, fara, tipDinCatalog, unificaExercitiu, construiesteBiblioteca,
    alternativePentru, valideazaExercitiuPropriu };
}

// ================= Partea legată de pagină =================
let exercitiiBiblioteca = new Map(); // nume cu litere mici → exercițiu unificat

function exercitiuDupaNume(nume) {
  return exercitiiBiblioteca.get(String(nume).toLowerCase()) || null;
}

function toateExercitiile() {
  return [...exercitiiBiblioteca.values()];
}

// Grupa principală: cea aleasă de tine, apoi cea din catalog.
function grupaExercitiu(nume) {
  const e = exercitiuDupaNume(nume);
  return e ? e.grupa : null;
}

function tipExercitiu(nume) {
  const e = exercitiuDupaNume(nume);
  return e ? e.tip : 'greutate';
}

async function reincarcaBiblioteca() {
  const proprii = await bibliotecaExercitii();
  exercitiiBiblioteca = construiesteBiblioteca(BIBLIOTECA, proprii);
  // Sugestii la tastare în câmpul de exerciții.
  const lista = $('biblioteca');
  if (lista) lista.replaceChildren(...toateExercitiile().map(e => el('option', { value: e.nume })));
}

// Ordinea în care ai folosit exercițiile (cele mai recente întâi), din istoric.
function exercitiiRecente(n = 12) {
  const vazute = new Map();
  for (let i = istoric.length - 1; i >= 0 && vazute.size < n; i--) {
    for (const ex of istoric[i].exercitii) {
      const cheie = ex.nume.toLowerCase();
      if (!vazute.has(cheie)) vazute.set(cheie, ex.nume);
    }
  }
  return [...vazute.values()];
}
