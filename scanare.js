// Scanarea meselor — logica fără DOM (testată în tests/scanare.test.js).
// Poza → micșorată pe telefon → funcția Supabase „scanare” (Gemini) → alimente + gramaje ESTIMATE, pe care le verifici tu.
// Aici nu există valori nutriționale: AI-ul nu le dă, iar ele vor veni din bazele de date (etapa următoare).

const DIMENSIUNE_MAX_SCANARE = 1024;       // latura lungă a pozei trimise (destul pentru recunoaștere)
const MAX_OCTETI_SCANARE = 1400000;        // limita serverului e 1,5 MB
const MAX_OCTETI_FISIER_SCANARE = 30 * 1024 * 1024;
const CHEIE_CACHE_SCANARE = 'scanariCache';
const MAX_CACHE_SCANARE = 8;
const VALABILITATE_CACHE_SCANARE = 7 * 24 * 3600 * 1000;

const PREPARARI_SCANARE = [
  { id: 'necunoscut', nume: 'Nu știu' },
  { id: 'crud', nume: 'Crud' },
  { id: 'fiert', nume: 'Fiert' },
  { id: 'abur', nume: 'La abur' },
  { id: 'gratar', nume: 'La grătar' },
  { id: 'cuptor', nume: 'La cuptor' },
  { id: 'fript', nume: 'Fript / rumenit' },
  { id: 'prajit', nume: 'Prăjit' },
];

// Încrederea e o etichetă calitativă dată de model, nu o probabilitate măsurată — de aceea nu afișăm procente.
const INCREDERI_SCANARE = {
  ridicata: { text: 'Sigur', clasa: 'sigur', detaliu: '' },
  medie: { text: 'De verificat', clasa: 'verifica', detaliu: 'Verifică dacă e corect.' },
  scazuta: { text: 'Nesigur', clasa: 'nesigur', detaliu: 'Nu sunt sigur ce e. Alege o variantă sau scrie numele corect.' },
  manual: { text: 'Adăugat de tine', clasa: 'manual', detaliu: '' },
};

function dimensiuniMicsorare(latime, inaltime, max = DIMENSIUNE_MAX_SCANARE) {
  if (!(latime > 0 && inaltime > 0)) throw new Error('Poza nu are dimensiuni valide.');
  const f = Math.min(1, max / Math.max(latime, inaltime));
  return { latime: Math.max(1, Math.round(latime * f)), inaltime: Math.max(1, Math.round(inaltime * f)) };
}

// null = fișier acceptat; altfel textul erorii.
function verificaFisierScanare(f) {
  if (!f) return 'Nu ai ales nicio poză.';
  if (f.type && !/^image\//.test(f.type)) return 'Fișierul ales nu e o poză.';
  if (f.size > MAX_OCTETI_FISIER_SCANARE) return 'Poza e prea mare (peste 30 MB).';
  if (f.size === 0) return 'Fișierul e gol.';
  return null;
}

let contorIdScanare = 0;
function idArticolScanare() { contorIdScanare += 1; return `sa-${Date.now().toString(36)}-${contorIdScanare}`; }

const textScurt = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const listaScurta = (v, n, max) => (Array.isArray(v) ? v.map(x => textScurt(x, max)).filter(Boolean).slice(0, n) : []);
const intregIn = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

// Răspunsul serverului e deja verificat acolo; îl verificăm din nou aici (aplicația nu se bazează pe nimic primit din rețea).
function curataRezultatScanare(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.alimente)) throw new Error('Răspunsul scanării nu are formatul așteptat.');
  const articole = [];
  for (const a of r.alimente.slice(0, 15)) {
    if (!a || typeof a !== 'object') continue;
    const nume = textScurt(a.nume, 80);
    const grame = intregIn(a.grame, 1, 2000);
    if (!nume || grame == null) continue;
    const min = intregIn(a.grameMin, 1, 2000);
    const max = intregIn(a.grameMax, 1, 3000);
    articole.push({
      id: idArticolScanare(),
      nume, numeEn: textScurt(a.numeEn, 80) || nume,
      alternative: listaScurta(a.alternative, 3, 80),
      grame, grameEstimat: grame,
      grameMin: min != null && min <= grame ? min : grame,
      grameMax: max != null && max >= grame ? max : grame,
      sursaGramaj: 'estimat',
      preparare: PREPARARI_SCANARE.some(p => p.id === a.preparare) ? a.preparare : 'necunoscut',
      incredere: INCREDERI_SCANARE[a.incredere] && a.incredere !== 'manual' ? a.incredere : 'scazuta',
      vizibile: listaScurta(a.vizibile, 10, 60),
      ascunse: listaScurta(a.ascunse, 10, 60),
      note: textScurt(a.note, 200),
      ambalat: a.ambalat === true,
      marca: textScurt(a.marca, 60),
      bucati: intregIn(a.bucati, 2, 60) || null,
    });
  }
  const u = r.utilizare && typeof r.utilizare === 'object' ? r.utilizare : null;
  return {
    esteMancare: r.esteMancare !== false,
    portieIndividuala: r.portieIndividuala !== false,
    calitate: ['buna', 'slaba', 'inutilizabila'].includes(r.calitate) ? r.calitate : 'slaba',
    observatii: textScurt(r.observatii, 240),
    eliminate: intregIn(r.eliminate, 0, 100) || 0,
    articole,
    utilizare: u && intregIn(u.azi, 0, 1000) != null && intregIn(u.limita, 1, 1000) != null ? { azi: Number(u.azi), limita: Number(u.limita) } : null,
  };
}

// Un aliment adăugat de mână (sau un ingredient „posibil ascuns”, ex. ulei): gramajul îl scrii tu.
function articolManualScanare(nume = '') {
  return {
    id: idArticolScanare(), nume: textScurt(nume, 80), numeEn: '', alternative: [],
    grame: null, grameEstimat: null, grameMin: null, grameMax: null, sursaGramaj: 'manual',
    preparare: 'necunoscut', incredere: 'manual', vizibile: [], ascunse: [], note: '', ambalat: false, marca: '', bucati: null,
  };
}

// Gramajul scris de tine. Același număr ca estimarea = rămâne „estimat”; altul = „modificat de tine”.
function seteazaGrameScanare(a, valoare) {
  const v = parseFloat(String(valoare).replace(',', '.'));
  const grame = Number.isFinite(v) && v > 0 && v <= 3000 ? Math.round(v) : null;
  const sursaGramaj = a.grameEstimat != null && grame === a.grameEstimat ? 'estimat' : 'manual';
  return { ...a, grame, sursaGramaj };
}

function textIntervalScanare(a) {
  if (a.grameEstimat == null) return '';
  if (a.grameMin != null && a.grameMax != null && a.grameMax > a.grameMin) return `estimat ${a.grameMin}–${a.grameMax} g`;
  return `estimat ~${a.grameEstimat} g`;
}

function etichetaGramajScanare(a) {
  if (a.grame == null) return { text: 'Scrie gramajul', clasa: 'lipsa' };
  return a.sursaGramaj === 'estimat' ? { text: 'Estimat din poză', clasa: 'estimat' } : { text: 'Scris de tine', clasa: 'manual' };
}

// Ingredientele posibil ascunse (ulei, unt, sos) care nu sunt deja în listă.
function ascunseDeAdaugat(articole) {
  const existente = new Set(articole.map(a => a.nume.toLowerCase()));
  const vazute = new Set();
  const rez = [];
  for (const a of articole) for (const x of a.ascunse) {
    const k = x.toLowerCase();
    if (existente.has(k) || vazute.has(k)) continue;
    vazute.add(k);
    rez.push(x);
  }
  return rez.slice(0, 6);
}

// Lista e gata de trecut mai departe doar dacă fiecare aliment are nume și gramaj.
function problemeScanare(articole) {
  const p = [];
  if (!articole.length) p.push('Lista e goală. Adaugă cel puțin un aliment.');
  if (articole.some(a => !a.nume.trim())) p.push('Un aliment nu are nume.');
  if (articole.some(a => a.grame == null)) p.push('Un aliment nu are gramaj.');
  return p;
}

// Mesajul pentru o scanare eșuată. tip: 'limita' (o limită de utilizare), 'cont', 'retea', 'configurare', 'tehnic'.
function mesajEroareScanare(err) {
  const cod = err && err.cod;
  const m = err && err.message ? String(err.message) : '';
  if (cod === 'anulat') return { tip: 'anulat', titlu: 'Analiza a fost oprită', text: '' };
  if (cod === 'limita_zilnica') return { tip: 'limita', titlu: 'Limita zilnică de scanări', text: m || 'Ai atins limita de scanări pe azi.' };
  if (cod === 'limita_cautari') return { tip: 'limita', titlu: 'Prea multe căutări', text: m || 'Prea multe căutări într-o oră. Încearcă din nou mai târziu.' };
  if (cod === 'limita_proprie') return { tip: 'limita', titlu: 'Limita ta zilnică de scanări', text: m };
  if (cod === 'limita_furnizor') return { tip: 'limita', titlu: 'Limita furnizorului AI', text: m || 'Furnizorul AI a refuzat temporar cererea (limită de utilizare sau buget). Încearcă mai târziu.' };
  if (cod === 'neautentificat' || cod === 'fara_cont') return { tip: 'cont', titlu: 'E nevoie de cont', text: m || 'Conectează-te la contul din cloud (Setări → Cont) ca să folosești scanarea.' };
  if (cod === 'retea' || cod === 'offline') return { tip: 'retea', titlu: 'Fără internet', text: 'Scanarea are nevoie de internet. Verifică conexiunea și încearcă din nou.' };
  if (cod === 'configurare') return { tip: 'configurare', titlu: 'Scanarea nu e configurată', text: m || 'Serverul de scanare nu e configurat complet.' };
  if (cod === 'blocat') return { tip: 'tehnic', titlu: 'Poza nu a putut fi analizată', text: m };
  if (cod === 'imagine_prea_mare' || cod === 'cerere_invalida') return { tip: 'tehnic', titlu: 'Poza nu a putut fi trimisă', text: m || 'Încearcă altă poză.' };
  if (cod === 'timeout') return { tip: 'tehnic', titlu: 'Analiza a durat prea mult', text: 'Încearcă din nou.' };
  return { tip: 'tehnic', titlu: 'Eroare tehnică', text: m && m.length < 200 ? m : 'Scanarea nu a reușit. Încearcă din nou peste puțin timp.' };
}

// Cache local: aceeași poză (aceeași amprentă SHA-256) nu se trimite de două ori la AI.
function citesteCacheScanare(stocare, amprenta, acum = Date.now()) {
  try {
    const c = JSON.parse(stocare.getItem(CHEIE_CACHE_SCANARE) || '{}');
    const i = c && c[amprenta];
    return i && acum - i.timp < VALABILITATE_CACHE_SCANARE ? i.rezultat : null;
  } catch (_) { return null; }
}

function scrieCacheScanare(stocare, amprenta, rezultat, acum = Date.now()) {
  try {
    let c = {};
    try { c = JSON.parse(stocare.getItem(CHEIE_CACHE_SCANARE) || '{}') || {}; } catch (_) { c = {}; }
    c[amprenta] = { timp: acum, rezultat };
    const chei = Object.keys(c).filter(k => c[k] && acum - c[k].timp < VALABILITATE_CACHE_SCANARE).sort((a, b) => c[b].timp - c[a].timp).slice(0, MAX_CACHE_SCANARE);
    const nou = {};
    for (const k of chei) nou[k] = c[k];
    stocare.setItem(CHEIE_CACHE_SCANARE, JSON.stringify(nou));
  } catch (_) { /* cache-ul e doar o economie; fără el scanarea merge la fel */ }
}

if (typeof module !== 'undefined') module.exports = {
  DIMENSIUNE_MAX_SCANARE, MAX_OCTETI_SCANARE, PREPARARI_SCANARE, INCREDERI_SCANARE,
  dimensiuniMicsorare, verificaFisierScanare, curataRezultatScanare, articolManualScanare, seteazaGrameScanare,
  textIntervalScanare, etichetaGramajScanare, ascunseDeAdaugat, problemeScanare, mesajEroareScanare,
  citesteCacheScanare, scrieCacheScanare,
};
