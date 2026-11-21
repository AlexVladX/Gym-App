// Validarea fișierelor de backup înainte de restaurare.
// Nu atinge pagina (DOM) și nici baza de date, ca să poată fi testată separat (tests/validare.test.js).
//
// Formatul backupului:
//   v1/v2 (versiunile vechi): { versiune, exportat, sesiuni, exercitii, masuratori, rutine? }
//   v3 (de acum):             la fel, plus { aplicatie, schema, setari }
//                             și, din etapa 6, opțional poze: [{ id, data, unghi, imagine: 'data:image/jpeg;base64,…', latime, inaltime, creat }]
//                             (o versiune mai veche a aplicației ignoră pozele, restul se citește la fel)
//                             și, din modulul de nutriție, opțional alimente, retete, pozeRetete (ignorate de versiunile vechi)
// Câmpurile necunoscute ale fiecărei înregistrări se păstrează (compatibilitate înainte).

const VERSIUNE_BACKUP = 3;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function dataValida(d) {
  if (typeof d !== 'string' || !DATA_RE.test(d)) return false;
  const t = Date.parse(d + 'T12:00:00');
  return Number.isFinite(t);
}

function numarOri(v, implicit) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : implicit;
}

function textNevid(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function idValid(id) {
  return Number.isInteger(id) && id > 0;
}

// Întoarce seria curățată sau null dacă nu poate fi folosită.
function curataSerie(s) {
  if (!s || typeof s !== 'object') return null;
  const kg = numarOri(s.kg, 0);
  const repetari = numarOri(s.repetari, 0);
  if (kg < 0 || kg > 2000 || repetari < 0 || repetari > 1000) return null;
  const rez = { ...s, kg, repetari: Math.round(repetari) };
  // Câmpurile de la etapa 3: timp, distanță, tipul seriei.
  for (const [camp, max] of [['durataSec', 86400], ['distantaM', 1000000]]) {
    if (!(camp in s)) continue;
    const v = numarOri(s[camp], NaN);
    if (Number.isFinite(v) && v >= 0 && v <= max) rez[camp] = v; else delete rez[camp];
  }
  if ('tip' in s && !['incalzire', 'drop', 'esec', 'normal'].includes(s.tip)) delete rez.tip;
  delete rez.facut;
  return rez;
}

function curataSesiune(s) {
  if (!s || typeof s !== 'object' || !dataValida(s.data) || !Array.isArray(s.exercitii)) return null;
  const exercitii = [];
  for (const ex of s.exercitii) {
    if (!ex || !textNevid(ex.nume) || !Array.isArray(ex.serii)) continue;
    const serii = ex.serii.map(curataSerie).filter(Boolean);
    exercitii.push({ ...ex, nume: ex.nume.trim(), serii });
  }
  const rezultat = { ...s, exercitii };
  rezultat.grupe = Array.isArray(s.grupe) ? s.grupe.filter(textNevid) : [];
  if ('nota' in s && typeof s.nota !== 'string') delete rezultat.nota;
  if ('pauze' in s && !Array.isArray(s.pauze)) delete rezultat.pauze;
  for (const camp of ['inceput', 'sfarsit', 'durataActivaMs', 'volum', 'serii']) {
    if (s[camp] !== undefined && s[camp] !== null && !Number.isFinite(s[camp])) delete rezultat[camp];
  }
  return rezultat;
}

function curataExercitiu(e) {
  if (!e || !textNevid(e.nume)) return null;
  return { ...e, nume: e.nume.trim(), grupa: textNevid(e.grupa) ? e.grupa : null };
}

function curataMasuratoare(m) {
  if (!m || !dataValida(m.data) || !textNevid(m.tip)) return null;
  const valoare = numarOri(m.valoare, NaN);
  if (!Number.isFinite(valoare)) return null;
  return { ...m, tip: m.tip.trim(), valoare };
}

// Poza: dată validă, imaginea ca data-URL JPEG/PNG/WebP (max. ~10 MB de text), unghi cunoscut (altfel „fata").
const UNGHIURI_VALIDE = ['fata', 'lateral', 'spate'];
const IMAGINE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function curataPoza(p) {
  if (!p || typeof p !== 'object' || !dataValida(p.data)) return null;
  if (typeof p.imagine !== 'string' || p.imagine.length > 10 * 1024 * 1024 || !IMAGINE_RE.test(p.imagine)) return null;
  const rez = { ...p, unghi: UNGHIURI_VALIDE.includes(p.unghi) ? p.unghi : 'fata' };
  for (const camp of ['latime', 'inaltime', 'creat']) if (camp in p && !Number.isFinite(p[camp])) delete rez[camp];
  return rez;
}

// ---------- Nutriție ----------
// Listele de mai jos trebuie să coincidă cu cele din nutritie-calcul.js (verificat în tests/nutritie.test.js).
const ALERGENI_VALIZI = ['gluten', 'crustacee', 'oua', 'peste', 'arahide', 'soia', 'lapte', 'nuci', 'telina', 'mustar', 'susan', 'sulfiti', 'lupin', 'moluste'];
const CATEGORII_ALIMENT_VALIDE = ['carne', 'lactate', 'legume', 'fructe', 'cereale', 'nuci', 'altele'];
const ORIGINI_VALIDE = ['carne', 'peste', 'lactate', 'oua', 'miere'];
const MESE_VALIDE = ['mic-dejun', 'gustare-1', 'pranz', 'gustare-2', 'cina'];
const VASE_VALIDE = ['farfurie', 'bol', 'pahar', 'borcan', 'tocator'];
const DIFICULTATI_VALIDE = ['usor', 'mediu', 'avansat'];
const ETICHETE_DECLARABILE = ['meal-prep', 'buget'];
const ID_PROPRIU_RE = /^u-[A-Za-z0-9-]{1,60}$/;
const CULOARE_RE = /^#[0-9a-fA-F]{6}$/;

function numarInInterval(v, min, max) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

// Un aliment propriu: valori la 100 g. Proteinele + carbohidrații + grăsimile nu pot depăși 100 g.
function curataAliment(a) {
  if (!a || typeof a !== 'object' || typeof a.id !== 'string' || !ID_PROPRIU_RE.test(a.id) || !textNevid(a.nume)) return null;
  const v = {};
  for (const [camp, max] of [['kcal', 900], ['proteine', 100], ['carbohidrati', 100], ['grasimi', 100], ['fibre', 100]]) {
    const n = numarOri(a[camp], NaN);
    if (!numarInInterval(n, 0, max)) return null;
    v[camp] = n;
  }
  if (v.proteine + v.carbohidrati + v.grasimi > 100.5 || v.fibre > v.carbohidrati + 0.5) return null;
  const lista = (x, valide) => (Array.isArray(x) ? [...new Set(x.filter(e => valide.includes(e)))] : []);
  const rez = {
    ...a, ...v,
    nume: a.nume.trim().slice(0, 80),
    cat: CATEGORII_ALIMENT_VALIDE.includes(a.cat) ? a.cat : 'altele',
    alergeni: lista(a.alergeni, ALERGENI_VALIZI),
    urme: lista(a.urme, ALERGENI_VALIZI),
    animal: ORIGINI_VALIDE.includes(a.animal) ? a.animal : null,
    culoare: typeof a.culoare === 'string' && CULOARE_RE.test(a.culoare) ? a.culoare : '#9AA39A',
    aspect: typeof a.aspect === 'string' && a.aspect ? a.aspect : 'bile',
  };
  if (!(Array.isArray(a.buc) && numarInInterval(a.buc[0], 0.1, 5000) && textNevid(a.buc[1]) && textNevid(a.buc[2]))) delete rez.buc;
  return rez;
}

// O rețetă proprie. Ingredientele se păstrează chiar dacă alimentul nu (mai) există: calculul le arată ca lipsă.
function curataReteta(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !ID_PROPRIU_RE.test(r.id) || !textNevid(r.nume)) return null;
  if (!MESE_VALIDE.includes(r.masa) || !Array.isArray(r.ingrediente)) return null;
  const ingrediente = [];
  for (const x of r.ingrediente) {
    if (!Array.isArray(x) || typeof x[0] !== 'string' || !x[0]) continue;
    const g = numarOri(x[1], NaN);
    if (numarInInterval(g, 0.1, 20000)) ingrediente.push([x[0], g]);
  }
  if (ingrediente.length === 0) return null;
  const portii = numarOri(r.portii, 1);
  const timp = numarOri(r.timp, 0);
  return {
    ...r,
    nume: r.nume.trim().slice(0, 100),
    descriere: typeof r.descriere === 'string' ? r.descriere.trim() : '',
    portii: Number.isInteger(portii) && portii >= 1 && portii <= 50 ? portii : 1,
    timp: Number.isInteger(timp) && timp >= 0 && timp <= 1440 ? timp : 0,
    dificultate: DIFICULTATI_VALIDE.includes(r.dificultate) ? r.dificultate : 'usor',
    vas: VASE_VALIDE.includes(r.vas) ? r.vas : 'farfurie',
    etichete: Array.isArray(r.etichete) ? [...new Set(r.etichete.filter(e => ETICHETE_DECLARABILE.includes(e)))] : [],
    ingrediente,
    pasi: Array.isArray(r.pasi) ? r.pasi.filter(textNevid).map(p => p.trim()) : [],
  };
}

// Poza unei rețete, în backup (imaginea ca data-URL).
function curataPozaReteta(p) {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id || p.id.length > 80) return null;
  if (typeof p.imagine !== 'string' || p.imagine.length > 10 * 1024 * 1024 || !IMAGINE_RE.test(p.imagine)) return null;
  const rez = { ...p };
  for (const camp of ['latime', 'inaltime', 'creat']) if (camp in p && !Number.isFinite(p[camp])) delete rez[camp];
  return rez;
}

// La id-uri text duplicate rămâne ultima înregistrare.
function unicDupaId(lista) {
  const map = new Map();
  for (const e of lista) map.set(e.id, e);
  return [...map.values()];
}

function curataRutina(r) {
  if (!r || !textNevid(r.nume) || !Array.isArray(r.exercitii)) return null;
  const exercitii = r.exercitii.filter(textNevid);
  if (exercitii.length === 0) return null;
  return { ...r, nume: r.nume.trim(), exercitii, grupe: Array.isArray(r.grupe) ? r.grupe.filter(textNevid) : [] };
}

// Id-urile duplicate sau invalide se scot; baza le dă altele noi.
function curataIduri(lista) {
  const vazute = new Set();
  return lista.map(item => {
    if (idValid(item.id) && !vazute.has(item.id)) {
      vazute.add(item.id);
      return item;
    }
    const { id, ...rest } = item;
    return rest;
  });
}

// Exercițiile din bibliotecă au cheia „nume": la duplicat rămâne ultimul.
function unicDupaNume(lista) {
  const map = new Map();
  for (const e of lista) map.set(e.nume, e);
  return [...map.values()];
}

// Verifică și curăță un obiect de backup.
// Întoarce { ok: true, date, ignorate, rezumat } sau { ok: false, eroare }.
//   date:     { sesiuni, exercitii, masuratori, rutine?, poze?, setari? } — gata de scris în bază (pozele încă ca text)
//   ignorate: numărul înregistrărilor care nu au putut fi citite
function valideazaBackup(brut) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
    return { ok: false, eroare: 'Fișierul nu conține un backup al jurnalului.' };
  }
  if (typeof brut.versiune === 'number' && brut.versiune > VERSIUNE_BACKUP) {
    return { ok: false, eroare: 'Backupul a fost făcut cu o versiune mai nouă a aplicației. Actualizează aplicația și încearcă din nou.' };
  }
  if (!Array.isArray(brut.sesiuni) || !Array.isArray(brut.exercitii) || !Array.isArray(brut.masuratori)) {
    return { ok: false, eroare: 'Fișierul nu are structura unui backup al jurnalului (lipsesc sesiunile, exercițiile sau măsurătorile).' };
  }

  let ignorate = 0;
  const curata = (lista, functie) => {
    const bune = [];
    for (const item of lista) {
      const c = functie(item);
      if (c) bune.push(c); else ignorate++;
    }
    return bune;
  };

  const date = {
    sesiuni: curataIduri(curata(brut.sesiuni, curataSesiune)),
    exercitii: unicDupaNume(curata(brut.exercitii, curataExercitiu)),
    masuratori: curataIduri(curata(brut.masuratori, curataMasuratoare)),
  };
  if (Array.isArray(brut.rutine)) date.rutine = curataIduri(curata(brut.rutine, curataRutina));
  if (Array.isArray(brut.poze)) date.poze = curataIduri(curata(brut.poze, curataPoza));
  if (Array.isArray(brut.alimente)) date.alimente = unicDupaId(curata(brut.alimente, curataAliment));
  if (Array.isArray(brut.retete)) date.retete = unicDupaId(curata(brut.retete, curataReteta));
  if (Array.isArray(brut.pozeRetete)) date.pozeRetete = unicDupaId(curata(brut.pozeRetete, curataPozaReteta));
  if (brut.setari && typeof brut.setari === 'object' && !Array.isArray(brut.setari)) date.setari = brut.setari;

  const lung = x => (Array.isArray(x) ? x.length : 0);
  const total = brut.sesiuni.length + brut.exercitii.length + brut.masuratori.length +
    lung(brut.rutine) + lung(brut.poze) + lung(brut.alimente) + lung(brut.retete) + lung(brut.pozeRetete);
  if (total > 0 && ignorate === total) {
    return { ok: false, eroare: 'Nicio înregistrare din fișier nu a putut fi citită. Fișierul pare deteriorat.' };
  }

  return {
    ok: true,
    date,
    ignorate,
    rezumat: {
      sesiuni: date.sesiuni.length,
      masuratori: date.masuratori.length,
      rutine: date.rutine ? date.rutine.length : null,
      poze: date.poze ? date.poze.length : null,
      alimente: date.alimente ? date.alimente.length : null,
      retete: date.retete ? date.retete.length : null,
      pozeRetete: date.pozeRetete ? date.pozeRetete.length : null,
      exportat: typeof brut.exportat === 'string' ? brut.exportat : null,
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { valideazaBackup, dataValida, VERSIUNE_BACKUP, curataAliment, curataReteta, curataPozaReteta,
    ALERGENI_VALIZI, CATEGORII_ALIMENT_VALIDE, ORIGINI_VALIDE, MESE_VALIDE, VASE_VALIDE, DIFICULTATI_VALIDE, ETICHETE_DECLARABILE };
}
