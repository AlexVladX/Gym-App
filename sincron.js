// Sincronizarea cu contul (Faza 2): partea de calcul, fără rețea și fără IndexedDB (testabilă în Node).
// Rețeaua, contul și scrierile locale sunt în cloud.js.
//
// Modelul: fiecare înregistrare a ta devine în cloud un rând { colectie, cheie, date, sters, versiune }.
// Pe telefon ținem, pentru fiecare rând sincronizat, „harta”: amprenta (hash) și versiunea din cloud
// la ultima sincronizare, plus o copie a datelor de atunci („baza”). Așa știm:
//   • ce s-a schimbat pe telefon de atunci (amprenta diferă) → se trimite, cu versiunea de bază;
//   • ce s-a schimbat în cloud (versiune mai mare) → se aduce;
//   • ce s-a schimbat în ambele părți → combinare pe câmpuri față de bază; dacă același câmp
//     are valori diferite în ambele părți, nu alegem noi: devine conflict și te întreabă aplicația.

// Ce se sincronizează. „cheie”: câmpul care identifică înregistrarea în cloud (același pe toate dispozitivele).
// „local”: cheia numerică dată de telefon (diferă de la un dispozitiv la altul, deci nu pleacă în cloud).
// „fisier”: câmpul cu imaginea (Blob), care merge separat, în spațiul privat de fișiere.
// Nu se sincronizează: ciorna (antrenamentul în curs, ține de telefon), coșul, copiile automate locale, meta.
const COLECTII_SINCRON = [
  { colectie: 'sesiuni', store: 'sesiuni', cheie: 'uid', local: 'id' },
  { colectie: 'masuratori', store: 'masuratori', cheie: 'uid', local: 'id' },
  { colectie: 'rutine', store: 'rutine', cheie: 'uid', local: 'id' },
  { colectie: 'poze', store: 'poze', cheie: 'uid', local: 'id', fisier: 'imagine' },
  { colectie: 'exercitii', store: 'exercitii', cheie: 'nume' },
  { colectie: 'alimente', store: 'alimente', cheie: 'id' },
  { colectie: 'retete', store: 'retete', cheie: 'id' },
  { colectie: 'pozeRetete', store: 'pozeRetete', cheie: 'id', fisier: 'imagine' },
  { colectie: 'zileNutritie', store: 'zileNutritie', cheie: 'data' },
  { colectie: 'planuriNutritie', store: 'planuriNutritie', cheie: 'id' },
  { colectie: 'listeCumparaturi', store: 'listeCumparaturi', cheie: 'id' },
  { colectie: 'setari', store: null, cheie: null },
];
const DEF_SINCRON = Object.fromEntries(COLECTII_SINCRON.map(d => [d.colectie, d]));
// Setări care țin de dispozitiv și nu se copiază pe celelalte (modul ales, ecranul aprins în sală).
const SETARI_LOCALE = ['mod', 'ecranAprins', 'tema']; // tema (etapa 5) ține de telefon, ca modul

const esteBlob = v => typeof Blob !== 'undefined' && v instanceof Blob;

// JSON cu cheile ordonate: aceeași valoare dă mereu același text (deci aceeași amprentă).
function jsonStabil(v) {
  if (v === undefined) return 'null';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (esteBlob(v)) return JSON.stringify({ __blob: v.size, tip: v.type });
  if (Array.isArray(v)) return `[${v.map(jsonStabil).join(',')}]`;
  return `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${jsonStabil(v[k])}`).join(',')}}`;
}

// Amprentă rapidă (cyrb53, 53 de biți) a unui text.
function amprenta(text) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

// Id stabil pentru înregistrările care încă nu au unul, calculat din conținut: aceeași înregistrare
// veche (de ex. importată din același backup pe două telefoane) primește același id și nu se dublează.
function uidDinContinut(rec) {
  const { id, uid, ...rest } = rec || {};
  return `c${amprenta(jsonStabil(rest))}`;
}

function cheieInregistrare(def, rec) {
  if (def.colectie === 'setari') return 'setari';
  const v = rec && rec[def.cheie];
  return typeof v === 'string' && v ? v : null;
}

// Calea fișierului unei înregistrări cu imagine, în spațiul privat (primul dosar = id-ul contului).
function caleFisier(idCont, def, cheie) { return `${idCont}/${def.colectie}/${encodeURIComponent(cheie)}`; }

// Forma din cloud a unei înregistrări locale: fără cheia locală, fără imagine (în locul ei: calea, tipul, mărimea).
function dateCloud(def, rec, idCont) {
  if (!rec) return null;
  if (def.colectie === 'setari') {
    const s = { ...rec };
    for (const k of SETARI_LOCALE) delete s[k];
    return s;
  }
  const d = { ...rec };
  if (def.local) delete d[def.local];
  if (def.fisier) {
    const b = d[def.fisier];
    delete d[def.fisier];
    if (esteBlob(b)) d.__fisier = { cale: caleFisier(idCont, def, cheieInregistrare(def, rec)), tip: b.type || 'image/jpeg', marime: b.size };
  }
  return d;
}

const amprentaCloud = date => amprenta(jsonStabil(date));
const egale = (a, b) => jsonStabil(a) === jsonStabil(b);

// ---------- Combinarea a două variante față de bază (three-way merge) ----------
// Pentru fiecare câmp: dacă doar o parte l-a schimbat față de bază, câștigă schimbarea; dacă ambele l-au
// schimbat la fel, e bine; dacă l-au schimbat diferit, e conflict (nu ghicim).
// Fără bază (prima legare a unui dispozitiv): câmpurile egale sau prezente într-o singură parte se păstrează.
// Câmpurile-marcă de timp („modificat” etc.) se schimbă la orice salvare, pe fiecare dispozitiv: nu sunt un conflict
// adevărat, deci se păstrează cea mai recentă valoare.
const CAMPURI_TIMP = new Set(['modificat', 'actualizat']);
function maiRecent(a, b) {
  if (a === undefined || a === null) return b;
  if (b === undefined || b === null) return a;
  return (typeof a === 'number' && typeof b === 'number') ? Math.max(a, b) : (String(a) >= String(b) ? a : b);
}

function combinaCampuri(baza, local, server, special = {}) {
  const b = baza || {}, rez = {};
  const conflicte = [];
  const chei = new Set([...Object.keys(local || {}), ...Object.keys(server || {})]);
  for (const k of chei) {
    const l = local ? local[k] : undefined, s = server ? server[k] : undefined, o = b[k];
    if (egale(l, s)) { if (l !== undefined) rez[k] = l; continue; }
    if (CAMPURI_TIMP.has(k)) { rez[k] = maiRecent(l, s); continue; }
    if (special[k]) {
      const r = special[k](o, l, s);
      if (!r.ok) { conflicte.push(k); continue; }
      if (r.valoare !== undefined) rez[k] = r.valoare;
      continue;
    }
    if (baza && egale(l, o)) { if (s !== undefined) rez[k] = s; continue; }
    if (baza && egale(s, o)) { if (l !== undefined) rez[k] = l; continue; }
    if (!baza && (l === undefined || s === undefined)) { rez[k] = l !== undefined ? l : s; continue; }
    conflicte.push(k);
  }
  return conflicte.length ? { ok: false, campuri: conflicte } : { ok: true, valoare: rez };
}

// Liste de obiecte cu id (mesele unei zile, articolele proprii): combinare pe elemente.
function combinaListaDupaId(baza, local, server) {
  const harta = l => new Map((Array.isArray(l) ? l : []).filter(x => x && x.id != null).map(x => [String(x.id), x]));
  const B = harta(baza), L = harta(local), S = harta(server);
  const ordine = [...new Set([...(Array.isArray(server) ? server : []), ...(Array.isArray(local) ? local : [])].filter(x => x && x.id != null).map(x => String(x.id)))];
  const rez = [];
  for (const id of ordine) {
    const o = B.get(id), l = L.get(id), s = S.get(id);
    if (egale(l, s)) { if (l) rez.push(l); continue; }
    if (baza !== undefined && baza !== null && egale(l, o)) { if (s) rez.push(s); continue; }   // schimbat/șters doar în cloud
    if (baza !== undefined && baza !== null && egale(s, o)) { if (l) rez.push(l); continue; }   // schimbat/șters doar aici
    if ((baza === undefined || baza === null || !o) && (!l || !s)) { rez.push(l || s); continue; } // adăugat într-o singură parte
    return { ok: false };
  }
  return { ok: true, valoare: rez };
}

// Obiecte de forma { cheie: valoare } (bifele listei de cumpărături): combinare pe chei.
function combinaHarta(baza, local, server) {
  const r = combinaCampuri(baza || null, local || {}, server || {});
  return r.ok ? { ok: true, valoare: r.valoare } : { ok: false };
}

// Liste de texte unde doar se adaugă (cafelele zilnice scoase dintr-o zi): reuniune, fără conflict.
function combinaReuniune(baza, local, server) {
  const l = Array.isArray(local) ? local : [], s = Array.isArray(server) ? server : [];
  return { ok: true, valoare: [...new Set([...s, ...l])] };
}

const SPECIAL_COMBINARE = {
  zileNutritie: { mese: combinaListaDupaId, cafele: combinaListaDupaId, cafeleSarite: combinaReuniune },
  listeCumparaturi: { cumparate: combinaHarta, eliminate: combinaHarta, cantitati: combinaHarta, personalizate: combinaListaDupaId },
};

// Rezultat: { ok: true, date } sau { ok: false, campuri: [...] } (conflict).
function combinaInregistrare(def, baza, local, server) {
  const r = combinaCampuri(baza, local, server, SPECIAL_COMBINARE[def.colectie] || {});
  return r.ok ? { ok: true, date: r.valoare } : r;
}

// ---------- Ce pleacă spre cloud ----------
// locale: Map cheie → { date, amprenta } (forma din cloud a înregistrărilor de pe telefon, pentru o colecție)
// harta:  Map cheie → { amprenta, versiune, sters } (din ultima sincronizare)
// blocate: Set cu cheile în conflict nerezolvat (nu se trimit până nu alegi).
// Întoarce lista { cheie, date, sters, baza } de trimis.
function deTrimis(locale, harta, blocate = new Set()) {
  const lot = [];
  for (const [cheie, l] of locale) {
    if (blocate.has(cheie)) continue;
    const h = harta.get(cheie);
    if (h && !h.sters && h.amprenta === l.amprenta) continue;
    lot.push({ cheie, date: l.date, sters: false, baza: h ? h.versiune : null });
  }
  for (const [cheie, h] of harta) {
    if (h.sters || locale.has(cheie) || blocate.has(cheie)) continue;
    lot.push({ cheie, date: null, sters: true, baza: h.versiune }); // șters pe telefon
  }
  return lot;
}

// Din rândurile marjei (doar colectie, cheie, versiune, rev): cele pe care harta nu le știe în versiunea lor sau una mai nouă.
// Colecțiile necunoscute se sar; o cheie apărută de mai multe ori se ia o singură dată, în versiunea cea mai mare.
function randuriDeAdus(randuri, harta) {
  const cele = new Map();
  for (const r of randuri || []) {
    if (!r || !DEF_SINCRON[r.colectie]) continue;
    const k = `${r.colectie}|${r.cheie}`;
    const h = harta.get(k);
    if (h && h.versiune >= r.versiune) continue;
    const ant = cele.get(k);
    if (!ant || r.versiune > ant.versiune) cele.set(k, r);
  }
  return [...cele.values()].sort((a, b) => a.rev - b.rev);
}

// ---------- Ce facem cu un rând venit din cloud ----------
// local: forma din cloud a înregistrării de pe telefon (sau null dacă nu există); h: intrarea din hartă (sau undefined).
// Întoarce: { actiune: 'ignora' } | { actiune: 'aplica' } (scrie varianta din cloud) |
//           { actiune: 'combina', date } (scrie combinarea; rămâne de trimis) | { actiune: 'conflict', campuri }
function decideRand(def, rand, local, h) {
  if (h && h.versiune >= rand.versiune) return { actiune: 'ignora' };
  const amprentaLocala = local ? amprentaCloud(local) : null;
  const neschimbat = h ? (h.sters ? local === null : amprentaLocala === h.amprenta) : local === null;
  if (neschimbat) return { actiune: 'aplica' };
  if (rand.sters) return local === null ? { actiune: 'aplica' } : { actiune: 'conflict', campuri: ['șters în altă parte'] };
  if (local === null) return { actiune: 'conflict', campuri: ['șters pe acest dispozitiv'] };
  if (egale(local, rand.date)) return { actiune: 'aplica' };
  const r = combinaInregistrare(def, h && !h.sters ? h.baza : null, local, rand.date);
  return r.ok ? { actiune: 'combina', date: r.date } : { actiune: 'conflict', campuri: r.campuri };
}

if (typeof module !== 'undefined') {
  module.exports = { COLECTII_SINCRON, DEF_SINCRON, SETARI_LOCALE, jsonStabil, amprenta, uidDinContinut, cheieInregistrare, caleFisier,
    dateCloud, amprentaCloud, egale, combinaCampuri, combinaListaDupaId, combinaInregistrare, deTrimis, decideRand, randuriDeAdus };
}
