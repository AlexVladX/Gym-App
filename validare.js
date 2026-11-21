// Validarea fișierelor de backup înainte de restaurare.
// Nu atinge pagina (DOM) și nici baza de date, ca să poată fi testată separat (tests/validare.test.js).
//
// Formatul backupului:
//   v1/v2 (versiunile vechi): { versiune, exportat, sesiuni, exercitii, masuratori, rutine? }
//   v3 (de acum):             la fel, plus { aplicatie, schema, setari }
//                             și, din etapa 6, opțional poze: [{ id, data, unghi, imagine: 'data:image/jpeg;base64,…', latime, inaltime, creat }]
//                             (o versiune mai veche a aplicației ignoră pozele, restul se citește la fel)
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
  if (brut.setari && typeof brut.setari === 'object' && !Array.isArray(brut.setari)) date.setari = brut.setari;

  const total = brut.sesiuni.length + brut.exercitii.length + brut.masuratori.length +
    (Array.isArray(brut.rutine) ? brut.rutine.length : 0) + (Array.isArray(brut.poze) ? brut.poze.length : 0);
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
      exportat: typeof brut.exportat === 'string' ? brut.exportat : null,
    },
  };
}

if (typeof module !== 'undefined') {
  module.exports = { valideazaBackup, dataValida, VERSIUNE_BACKUP };
}
