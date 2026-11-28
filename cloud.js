// Contul și sincronizarea în cloud (Gym App 3.0, Faza 2). Calculele sunt în sincron.js; aici: contul (Supabase Auth),
// rețeaua, scrierile locale și ciclul de sincronizare. Interfața din Setări e în cloud-ui.js.
//
// Ciclul (sincronizeaza): 1) id-uri comune pentru înregistrările noi, 2) se aduce ce s-a schimbat în cont de la ultima
// sincronizare (după numărul de modificare „rev”) și se combină cu ce ai pe telefon, 3) se trimite ce s-a schimbat pe
// telefon, cu versiunea de bază — cloud-ul refuză dacă între timp altcineva (alt dispozitiv) a modificat, iar atunci
// combinăm sau te întrebăm. Fără internet, modificările rămân pe telefon și pleacă la revenire. Datele de pe telefon
// nu se șterg niciodată din cauza contului: deconectarea și conectarea doar opresc/pornesc sincronizarea.

const sinc = {
  adaptor: null,      // legătura cu Supabase (sau, în teste, cu un server fals)
  utilizator: null,   // { id, email }
  stare: 'neconfigurat', // neconfigurat | deconectat | nelegat | sincronizare | sincronizat | offline | eroare
  mesaj: '',
  conflicte: 0,
  ruleaza: false,
  inca: false,
  programat: null,
  pornit: false,
};
const CHEIE_META_SINCRON = 'sincronCloud';
const LOT_TRIMITERE = 100;
const PAGINA_TRAGERE = 500;
// Marja de siguranță la tragere (etapa 6): numărul „rev” se ia când începe salvarea, dar rândul devine vizibil abia când
// salvarea se termină. O salvare mare de pe alt telefon poate deveni vizibilă DUPĂ ce cursorul a trecut de numerele ei.
// De aceea, la fiecare ciclu se reverifică ultimele MARJA_REV numere de dinaintea cursorului (doar cheie + versiune),
// iar rândurile care lipsesc se aduc întregi. ≥ 2 × lotul maxim al funcției salveaza_inregistrari (500).
const MARJA_REV = 1000;
const MAX_COPII_CLOUD = 10;

// Adresa proiectului: doar „https://<proiect>.supabase.co”. Dacă s-a lipit o adresă cu ceva după
// (ex. „…supabase.co/rest/v1/” din pagina Data API), păstrăm doar începutul — altfel serverul răspunde
// „Invalid path specified in request URL”.
function adresaProiect() {
  try { return new URL(String(CONFIG_CLOUD.url || '').trim()).origin; } catch (_) { return ''; }
}

function cloudConfigurat() {
  return typeof CONFIG_CLOUD !== 'undefined' && /^https:\/\/[^/]+$/.test(adresaProiect()) && typeof CONFIG_CLOUD.cheiePublica === 'string' && CONFIG_CLOUD.cheiePublica.trim().length > 10;
}

// ---------- Meta (pe dispozitiv): contul legat, cursorul, ultima sincronizare ----------
function citesteMetaSincron() {
  try { return JSON.parse(localStorage.getItem(CHEIE_META_SINCRON) || 'null') || {}; } catch (_) { return {}; }
}
function scrieMetaSincron(m) {
  try { localStorage.setItem(CHEIE_META_SINCRON, JSON.stringify(m)); } catch (_) { /* fără stocare: se reia de la zero */ }
}
function numeDispozitiv() {
  const m = citesteMetaSincron();
  if (m.dispozitiv) return m.dispozitiv;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const tip = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Dispozitiv';
  const nume = `${tip}-${Math.random().toString(36).slice(2, 7)}`;
  scrieMetaSincron({ ...m, dispozitiv: nume });
  return nume;
}

// ---------- Stare și anunțuri ----------
const ascultatoriSincron = new Set();
function seteazaStareSincron(stare, mesaj = '') {
  sinc.stare = stare;
  sinc.mesaj = mesaj;
  const b = typeof document !== 'undefined' && document.getElementById('btn-setari');
  if (b) b.dataset.sincron = (stare === 'eroare' || stare === 'offline' || sinc.conflicte > 0) ? (sinc.conflicte > 0 ? 'conflict' : stare) : '';
  for (const f of ascultatoriSincron) { try { f(); } catch (err) { console.warn(err); } }
}

// ---------- Adaptorul Supabase ----------
let promisiuneClient = null;
function incarcaClientSupabase() {
  if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  if (!promisiuneClient) {
    promisiuneClient = new Promise((rezolva, respinge) => {
      const s = document.createElement('script');
      s.src = `vendor/supabase.js?v=${document.body.dataset.versiune || '1'}`;
      s.onload = () => (window.supabase ? rezolva(window.supabase) : respinge(new Error('Biblioteca Supabase nu s-a încărcat.')));
      s.onerror = () => { promisiuneClient = null; respinge(new Error('Biblioteca Supabase nu s-a putut descărca.')); };
      document.head.append(s);
    });
  }
  return promisiuneClient;
}

function adresaAplicatiei() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function adaptorSupabase(client) {
  const db = client.from.bind(client);
  const verifica = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async utilizator() {
      const { data } = await client.auth.getSession();
      const u = data && data.session && data.session.user;
      return u ? { id: u.id, email: u.email } : null;
    },
    laSchimbareAuth(f) { client.auth.onAuthStateChange((ev, ses) => f(ev, ses && ses.user ? { id: ses.user.id, email: ses.user.email } : null)); },
    async inregistreaza(email, parola) {
      const { data, error } = await client.auth.signUp({ email, password: parola, options: { emailRedirectTo: adresaAplicatiei() } });
      if (error) throw error;
      return { confirmare: !data.session };
    },
    async autentifica(email, parola) { verifica(await client.auth.signInWithPassword({ email, password: parola })); },
    async deconecteaza() { await client.auth.signOut({ scope: 'local' }); },
    async reseteazaParola(email) { verifica(await client.auth.resetPasswordForEmail(email, { redirectTo: adresaAplicatiei() })); },
    async schimbaParola(parola) { verifica(await client.auth.updateUser({ password: parola })); },
    async salveaza(lot, dispozitiv) { return verifica(await client.rpc('salveaza_inregistrari', { lot, dispozitiv })); },
    async trage(cursor, limita) {
      return verifica(await db('inregistrari').select('colectie,cheie,date,sters,versiune,rev').gt('rev', cursor).order('rev', { ascending: true }).limit(limita));
    },
    // Doar cheia și versiunea rândurilor cu rev în (dela, panaLa] — pentru verificarea marjei (puține date).
    async versiuni(dela, panaLa, limita) {
      return verifica(await db('inregistrari').select('colectie,cheie,versiune,rev').gt('rev', dela).lte('rev', panaLa).order('rev', { ascending: true }).limit(limita));
    },
    async randuriDupaRev(revuri) {
      return verifica(await db('inregistrari').select('colectie,cheie,date,sters,versiune,rev').in('rev', revuri).order('rev', { ascending: true }));
    },
    async numara() {
      const { count, error } = await db('inregistrari').select('cheie', { count: 'exact', head: true }).eq('sters', false);
      if (error) throw error;
      return count || 0;
    },
    // Funcțiile Supabase (ex. „scanare”): erorile păstrează codul trimis de server ({ cod, mesaj }).
    async functie(nume, corp, { semnal } = {}) {
      const { data, error, response } = await client.functions.invoke(nume, { body: corp, signal: semnal, timeout: 45000 });
      if (!error) return data;
      let det = null;
      try { det = response ? await response.clone().json() : null; } catch (_) { det = null; }
      const status = response ? response.status : 0;
      // Fără { cod, mesaj } răspunsul nu vine din funcția noastră (ex. funcția nu e publicată → 404).
      const strain = det && !det.cod ? (det.message || det.msg || det.error || '') : '';
      const e = new Error((det && det.mesaj) || (status === 404 ? `Funcția „${nume}” nu e publicată în Supabase.` : '')
        || (status ? `Serverul a răspuns cu eroarea ${status}${strain ? ` (${String(strain).slice(0, 120)})` : ''}.` : '') || error.message || 'Eroare la server.');
      e.cod = (det && det.cod) || (status === 404 ? 'configurare' : (semnal && semnal.aborted ? 'anulat' : (error.name === 'FunctionsFetchError' ? 'retea' : 'eroare')));
      e.status = status;
      throw e;
    },
    async urcaFisier(cale, blob) { verifica(await client.storage.from('poze').upload(cale, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })); },
    async descarcaFisier(cale) { return verifica(await client.storage.from('poze').download(cale)); },
    async stergeFisier(cale) { verifica(await client.storage.from('poze').remove([cale])); },
    async listeazaFisiere(dosar) {
      const l = verifica(await client.storage.from('poze').list(dosar, { limit: 100, sortBy: { column: 'name', order: 'desc' } }));
      return (l || []).filter(f => f && f.name && f.id !== null).map(f => ({ nume: f.name, cale: `${dosar}/${f.name}`, marime: f.metadata && f.metadata.size }));
    },
  };
}

// ---------- Pornire ----------
async function pornesteCloud() {
  if (sinc.pornit) return;
  if (!cloudConfigurat() && !(typeof window !== 'undefined' && window.__adaptorCloudTest)) { seteazaStareSincron('neconfigurat'); return; }
  sinc.pornit = true;
  seteazaStareSincron('deconectat');
  // Clientul se încarcă doar dacă există o sesiune salvată sau un link din e-mail (confirmare, parolă nouă);
  // altfel abia când deschizi formularul de cont.
  const areSesiune = (() => { try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k)); } catch (_) { return false; } })();
  const dinEmail = /access_token|error_description|type=recovery/.test(location.hash);
  if (window.__adaptorCloudTest || areSesiune || dinEmail) await initializeazaAdaptor().catch(err => { console.warn(err); seteazaStareSincron('eroare', mesajEroareCloud(err)); });
  window.addEventListener('online', () => sincronizeaza());
  window.addEventListener('offline', () => { if (sinc.utilizator) seteazaStareSincron('offline'); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizeaza(); });
  setInterval(() => { if (document.visibilityState === 'visible') sincronizeaza(); }, 60000);
}

async function initializeazaAdaptor() {
  if (sinc.adaptor) return sinc.adaptor;
  if (window.__adaptorCloudTest) {
    sinc.adaptor = window.__adaptorCloudTest;
  } else {
    const lib = await incarcaClientSupabase();
    const client = lib.createClient(adresaProiect(), CONFIG_CLOUD.cheiePublica.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
    sinc.adaptor = adaptorSupabase(client);
  }
  sinc.adaptor.laSchimbareAuth((ev, u) => {
    if (ev === 'PASSWORD_RECOVERY') { if (typeof cereParolaNoua === 'function') cereParolaNoua(); return; }
    if (ev === 'SIGNED_OUT') { sinc.utilizator = null; actualizeazaTexteConfidentialitate(); seteazaStareSincron('deconectat'); return; }
    if ((ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') && u && (!sinc.utilizator || sinc.utilizator.id !== u.id)) laConectare(u);
  });
  const u = await sinc.adaptor.utilizator();
  if (/access_token|type=recovery|error_description/.test(location.hash)) {
    if (/error_description/.test(location.hash) && typeof notifica === 'function') notifica('Linkul din e-mail nu mai e valabil. Cere unul nou.', 'eroare', 6000);
    history.replaceState(history.state, '', location.pathname + location.search); // păstrăm starea de navigare (navigare.js)
  }
  if (u) await laConectare(u);
  return sinc.adaptor;
}

let conectareInCurs = null;
async function laConectare(u) {
  if (conectareInCurs) return conectareInCurs;
  conectareInCurs = (async () => {
    sinc.utilizator = u;
    actualizeazaTexteConfidentialitate(); // textele despre unde stau datele (etapa 5)
    const meta = citesteMetaSincron();
    if (meta.idCont && meta.idCont !== u.id) {
      // Alt cont pe același telefon: harta veche nu mai e valabilă (datele de pe telefon rămân).
      await golesteStareaSincron();
      scrieMetaSincron({ dispozitiv: meta.dispozitiv, idCont: u.id, legat: false, cursor: 0 });
    } else if (!meta.idCont) {
      scrieMetaSincron({ ...meta, idCont: u.id, legat: false, cursor: 0 });
    }
    await numaraConflicte();
    if (citesteMetaSincron().legat) { sincronizeaza(); return; }
    seteazaStareSincron('nelegat');
    if (typeof propuneLegarea === 'function') propuneLegarea();
  })().finally(() => { conectareInCurs = null; });
  return conectareInCurs;
}

// ---------- Acțiuni de cont (folosite de cloud-ui.js) ----------
async function contInregistrare(email, parola) { await initializeazaAdaptor(); return sinc.adaptor.inregistreaza(email, parola); }
async function contAutentificare(email, parola) {
  await initializeazaAdaptor();
  await sinc.adaptor.autentifica(email, parola);
  const u = await sinc.adaptor.utilizator();
  if (u) await laConectare(u);
}
async function contResetareParola(email) { await initializeazaAdaptor(); return sinc.adaptor.reseteazaParola(email); }
async function contSchimbaParola(parola) { await initializeazaAdaptor(); return sinc.adaptor.schimbaParola(parola); }
// Etapa 6: ștergerea definitivă a contului (funcția „sterge-cont” de pe server: pozele și copiile din cloud, apoi contul,
// cu rândurile sincronizate). Datele de pe telefon rămân; legătura cu contul se uită, ca un cont nou să pornească curat.
async function contStergere(confirmare) {
  await initializeazaAdaptor();
  if (!sinc.utilizator) throw new Error('neautentificat');
  clearTimeout(sinc.programat);
  for (let i = 0; sinc.ruleaza && i < 300; i++) await new Promise(ok => setTimeout(ok, 100)); // nu ștergem în timpul unei sincronizări
  await sinc.adaptor.functie('sterge-cont', { confirmare });
  await golesteStareaSincron();
  scrieMetaSincron({ dispozitiv: citesteMetaSincron().dispozitiv });
  try { await sinc.adaptor.deconecteaza(); } catch (_) { /* sesiunea nu mai e valabilă oricum */ }
  sinc.utilizator = null;
  actualizeazaTexteConfidentialitate();
  seteazaStareSincron('deconectat');
}
async function contDeconectare() {
  if (sinc.adaptor) await sinc.adaptor.deconecteaza();
  sinc.utilizator = null;
  actualizeazaTexteConfidentialitate();
  seteazaStareSincron('deconectat');
}

// ---------- Prima legare a dispozitivului de cont ----------
async function numaraLocale() {
  let n = 0;
  for (const def of COLECTII_SINCRON) if (def.store) n += await cere(def.store, 'readonly', st => st.count());
  return n;
}

// mod: 'urca' (contul e gol), 'combina' (contul și telefonul au date), 'descarca' (telefonul e gol)
// sau 'doarCont' (înlocuiește datele de pe telefon cu cele din cont, după o copie locală).
async function leagaDispozitivul(mod) {
  if (!sinc.utilizator) throw new Error('Nu ești conectat.');
  // Copie de siguranță locală înainte de orice: o găsești în Setări → Copii automate.
  try { await salveazaInstantaneu('Înainte de legarea la cont', await construiesteBackup({ cuPoze: false })); } catch (err) { console.warn(err); }
  if (mod === 'doarCont') {
    await golesteStoreSincronizate();
    await golesteStareaSincron();
  }
  scrieMetaSincron({ ...citesteMetaSincron(), idCont: sinc.utilizator.id, legat: true, cursor: 0 });
  await sincronizeaza({ asteapta: true });
  if (sinc.stare === 'eroare') throw new Error(sinc.mesaj);
  return verificaCopiaDinCloud();
}

// După urcare: citim tot ce e în cont și comparăm, înregistrare cu înregistrare, cu ce e pe telefon.
async function verificaCopiaDinCloud() {
  const din = new Map();
  let cursor = 0;
  for (;;) {
    const r = await sinc.adaptor.trage(cursor, PAGINA_TRAGERE);
    for (const x of r) { din.set(`${x.colectie}|${x.cheie}`, x); cursor = Math.max(cursor, x.rev); }
    if (r.length < PAGINA_TRAGERE) break;
  }
  const conf = new Set((await cere('conflicte', 'readonly', st => st.getAllKeys())));
  let identice = 0, diferite = 0, lipsa = 0;
  for (const def of COLECTII_SINCRON) {
    const locale = await citesteColectie(def);
    for (const [cheie, l] of locale) {
      const k = `${def.colectie}|${cheie}`;
      if (conf.has(k)) continue;
      const c = din.get(k);
      if (!c || c.sters) lipsa++;
      else if (amprentaCloud(c.date) === l.amprenta) identice++;
      else diferite++;
    }
  }
  const rez = { identice, diferite, lipsa, inCont: [...din.values()].filter(x => !x.sters).length, cand: new Date().toISOString() };
  scrieMetaSincron({ ...citesteMetaSincron(), verificare: rez });
  return rez;
}

// ---------- Citiri și scrieri locale ----------
async function tranzactieSincron(stores, mod) {
  const bd = await baza();
  const t = bd.transaction(stores, mod);
  t.__dinSincron = true; // scrierile sincronizării nu declanșează o nouă sincronizare
  return t;
}
const asteaptaTranzactia = t => new Promise((ok, no) => { t.oncomplete = () => ok(); t.onerror = () => no(t.error); t.onabort = () => no(t.error); });
const cerereIdb = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });

// Înregistrările vechi sau noi fără „uid” primesc unul, derivat din conținut (vezi sincron.js).
async function asiguraUiduri() {
  for (const def of COLECTII_SINCRON) {
    if (def.cheie !== 'uid') continue;
    const t = await tranzactieSincron(def.store, 'readwrite');
    const st = t.objectStore(def.store);
    st.openCursor().onsuccess = e => {
      const c = e.target.result;
      if (!c) return;
      if (c.value && !c.value.uid) c.update({ ...c.value, uid: uidDinContinut(c.value) });
      c.continue();
    };
    await asteaptaTranzactia(t);
  }
}

// Map cheie → { rec, date (forma din cloud), amprenta } pentru o colecție.
async function citesteColectie(def) {
  const idCont = sinc.utilizator ? sinc.utilizator.id : '';
  const rez = new Map();
  if (def.colectie === 'setari') {
    const date = dateCloud(def, setariPentruBackup(), idCont);
    rez.set('setari', { rec: null, date, amprenta: amprentaCloud(date) });
    return rez;
  }
  const toate = await cere(def.store, 'readonly', st => st.getAll());
  for (const rec of toate) {
    const cheie = cheieInregistrare(def, rec);
    if (!cheie) continue;
    if (def.fisier && !(rec[def.fisier] instanceof Blob)) continue; // poză fără imagine: nu are ce trimite
    const date = dateCloud(def, rec, idCont);
    rez.set(cheie, { rec, date, amprenta: amprentaCloud(date) });
  }
  return rez;
}

async function citesteLocal(def, cheie) {
  const idCont = sinc.utilizator ? sinc.utilizator.id : '';
  if (def.colectie === 'setari') return dateCloud(def, setariPentruBackup(), idCont);
  const rec = def.cheie === 'uid'
    ? await cere(def.store, 'readonly', st => st.index('uid').get(cheie))
    : await cere(def.store, 'readonly', st => st.get(cheie));
  if (!rec || (def.fisier && !(rec[def.fisier] instanceof Blob))) return null;
  return dateCloud(def, rec, idCont);
}

// Datele din cont trec prin aceleași verificări ca un backup importat; ce nu trece nu se scrie pe telefon.
function curataDinCloud(def, date) {
  if (!date || typeof date !== 'object') return null;
  const f = {
    sesiuni: typeof curataSesiune === 'function' ? curataSesiune : null,
    masuratori: typeof curataMasuratoare === 'function' ? curataMasuratoare : null,
    exercitii: typeof curataExercitiu === 'function' ? curataExercitiu : null,
    rutine: typeof curataRutina === 'function' ? curataRutina : null,
    alimente: typeof curataAliment === 'function' ? curataAliment : null,
    retete: typeof curataReteta === 'function' ? curataReteta : null,
    zileNutritie: typeof curataZiNutritie === 'function' ? curataZiNutritie : null,
    planuriNutritie: typeof curataPlanNutritie === 'function' ? curataPlanNutritie : null,
    listeCumparaturi: typeof curataListaCumparaturi === 'function' ? curataListaCumparaturi : null,
  }[def.colectie];
  if (def.colectie === 'poze') return typeof date.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.data) && date.__fisier ? date : null;
  if (def.colectie === 'pozeRetete') return typeof date.id === 'string' && date.__fisier ? date : null;
  if (def.colectie === 'setari') return date;
  return f ? f(date) : date;
}

// Scrie pe telefon varianta venită din cont (sau o combinare). Întoarce false dacă datele nu sunt valide.
async function aplicaLocal(def, cheie, date, sters) {
  if (def.colectie === 'setari') {
    if (sters || !date) return true;
    const pastrate = Object.fromEntries(SETARI_LOCALE.map(k => [k, setari[k]]));
    Object.assign(setari, SETARI_IMPLICITE, curataSetari({ ...date, ...pastrate }));
    try { localStorage.setItem('setari', JSON.stringify(setari)); } catch (_) { /* ignorat */ }
    if (typeof afiseazaSetari === 'function') afiseazaSetari();
    return true;
  }
  let rec = null;
  if (!sters) {
    const curat = curataDinCloud(def, date);
    if (!curat) return false;
    rec = { ...curat };
    if (def.fisier) {
      const f = rec.__fisier;
      delete rec.__fisier;
      rec[def.fisier] = await sinc.adaptor.descarcaFisier(f.cale); // aruncă eroare fără internet: se reia data viitoare
    }
  }
  const t = await tranzactieSincron(def.store, 'readwrite');
  const st = t.objectStore(def.store);
  if (def.cheie === 'uid') {
    const existent = await cerereIdb(st.index('uid').get(cheie));
    if (sters) { if (existent) st.delete(existent[def.local]); }
    else if (existent) st.put({ ...rec, [def.local]: existent[def.local] });
    else { delete rec[def.local]; st.add(rec); }
  } else if (sters) st.delete(cheie);
  else st.put(rec);
  await asteaptaTranzactia(t);
  return true;
}

async function citesteHarta() {
  const toate = await cere('sincron', 'readonly', st => st.getAll());
  return new Map(toate.map(h => [h.k, h]));
}
async function scrieInHarta(intrari) {
  if (!intrari.length) return;
  const t = await tranzactieSincron('sincron', 'readwrite');
  const st = t.objectStore('sincron');
  for (const h of intrari) st.put(h);
  await asteaptaTranzactia(t);
}
const intrareHarta = (colectie, cheie, versiune, sters, date, extra = {}) => ({
  k: `${colectie}|${cheie}`, colectie, cheie, versiune, sters: Boolean(sters),
  amprenta: sters ? null : amprentaCloud(date), baza: sters ? null : date, ...extra,
});

async function salveazaConflict(def, cheie, local, rand, campuri) {
  const t = await tranzactieSincron('conflicte', 'readwrite');
  t.objectStore('conflicte').put({ k: `${def.colectie}|${cheie}`, colectie: def.colectie, cheie, local, server: rand.date, serverSters: Boolean(rand.sters),
    versiune: rand.versiune, campuri: campuri || [], cand: Date.now() });
  await asteaptaTranzactia(t);
}
async function numaraConflicte() {
  sinc.conflicte = await cere('conflicte', 'readonly', st => st.count()).catch(() => 0);
  return sinc.conflicte;
}
async function golesteStareaSincron() {
  const t = await tranzactieSincron(['sincron', 'conflicte'], 'readwrite');
  t.objectStore('sincron').clear();
  t.objectStore('conflicte').clear();
  await asteaptaTranzactia(t);
  sinc.conflicte = 0;
}
async function golesteStoreSincronizate() {
  const stores = COLECTII_SINCRON.filter(d => d.store).map(d => d.store);
  const t = await tranzactieSincron(stores, 'readwrite');
  for (const s of stores) t.objectStore(s).clear();
  await asteaptaTranzactia(t);
}

// ---------- Ciclul de sincronizare ----------
function semnaleazaModificare() {
  if (!sinc.utilizator || !citesteMetaSincron().legat) return;
  clearTimeout(sinc.programat);
  sinc.programat = setTimeout(() => sincronizeaza(), 4000);
}

function mesajEroareCloud(err) {
  const m = String((err && (err.message || err.error_description || err.msg)) || err || '');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Fără legătură cu serverul.';
  if (/Invalid login credentials/i.test(m)) return 'E-mailul sau parola nu sunt corecte.';
  if (/Email not confirmed/i.test(m)) return 'Confirmă adresa de e-mail din mesajul primit, apoi intră în cont.';
  if (/User already registered/i.test(m)) return 'Există deja un cont cu acest e-mail. Intră în cont sau resetează parola.';
  if (/Password should be|weak/i.test(m)) return 'Parola e prea slabă: folosește cel puțin 8 caractere.';
  if (/not authorized|email_address_not_authorized/i.test(m)) return 'Serviciul de e-mail implicit al Supabase trimite doar la adresele din echipa proiectului. Folosește e-mailul contului tău Supabase.';
  if (/rate limit|too many|over_email_send/i.test(m)) return 'Prea multe încercări sau e-mailuri într-un timp scurt (serviciul implicit trimite puține pe oră). Mai încearcă peste o oră.';
  if (/JWT|session|not authenticated|neautentificat/i.test(m)) return 'Sesiunea a expirat. Intră din nou în cont.';
  if (/does not exist|schema cache|permission denied|42501|42P01|PGRST/i.test(m)) return 'Contul în cloud nu e configurat complet (baza de date). Vezi pașii de configurare.';
  return m || 'Eroare necunoscută.';
}

// asteapta: dacă rulează deja, așteaptă să se termine și mai rulează o dată.
async function sincronizeaza({ asteapta = false } = {}) {
  if (!sinc.utilizator || !sinc.adaptor || !citesteMetaSincron().legat) return;
  if (sinc.ruleaza) {
    sinc.inca = true;
    if (asteapta) await new Promise(ok => { const i = setInterval(() => { if (!sinc.ruleaza) { clearInterval(i); ok(); } }, 100); });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { seteazaStareSincron('offline'); return; }
  clearTimeout(sinc.programat);
  sinc.ruleaza = true;
  seteazaStareSincron('sincronizare');
  let schimbari = 0;
  try {
    await asiguraUiduri();
    schimbari += await trageDinCloud();
    schimbari += await trimiteInCloud();
    await numaraConflicte();
    scrieMetaSincron({ ...citesteMetaSincron(), ultima: new Date().toISOString() });
    seteazaStareSincron('sincronizat');
    copieCloudSaptamanala().catch(err => console.warn('Copia din cont nu s-a făcut', err));
  } catch (err) {
    console.warn('Sincronizarea nu a reușit', err);
    const mesaj = mesajEroareCloud(err);
    seteazaStareSincron(/Fără legătură/.test(mesaj) ? 'offline' : 'eroare', mesaj);
  } finally {
    sinc.ruleaza = false;
  }
  if (schimbari) reimprospateazaDupaSincron();
  if (sinc.inca) { sinc.inca = false; sincronizeaza(); }
}

async function trageDinCloud() {
  let meta = citesteMetaSincron();
  let cursor = meta.cursor || 0;
  let schimbari = 0;
  const harta = await citesteHarta();
  const vazute = new Set(); // deduplicare în același ciclu: o versiune a unui rând se procesează o singură dată
  const proceseaza = async rand => {
    const id = `${rand.colectie}|${rand.cheie}|${rand.versiune}`;
    if (vazute.has(id)) return 0;
    vazute.add(id);
    return proceseazaRand(rand, harta);
  };
  if (cursor > 0) schimbari += await verificaMarja(cursor, harta, proceseaza);
  for (;;) {
    const randuri = await sinc.adaptor.trage(cursor, PAGINA_TRAGERE);
    for (const rand of randuri) {
      schimbari += await proceseaza(rand);
      cursor = Math.max(cursor, rand.rev);
      meta = { ...citesteMetaSincron(), cursor };
      scrieMetaSincron(meta);
    }
    if (randuri.length < PAGINA_TRAGERE) break;
  }
  return schimbari;
}

// Rândurile din marjă pe care telefonul nu le are încă (sau le are într-o versiune mai veche); cele știute se sar.
async function verificaMarja(cursor, harta, proceseaza) {
  const dela = Math.max(0, cursor - MARJA_REV);
  let lipsa;
  if (sinc.adaptor.versiuni && sinc.adaptor.randuriDupaRev) {
    const usoare = await sinc.adaptor.versiuni(dela, cursor, MARJA_REV);
    const revuri = randuriDeAdus(usoare, harta).map(x => x.rev);
    lipsa = [];
    for (let i = 0; i < revuri.length; i += 100) lipsa.push(...await sinc.adaptor.randuriDupaRev(revuri.slice(i, i + 100)));
  } else {
    // adaptor fără citirea ușoară: aducem marja întreagă și păstrăm doar ce lipsește
    lipsa = randuriDeAdus((await sinc.adaptor.trage(dela, MARJA_REV)).filter(x => x.rev <= cursor), harta);
  }
  let schimbari = 0;
  for (const rand of lipsa) schimbari += await proceseaza(rand);
  return schimbari;
}

// Un rând din cont: îl aplicăm, îl combinăm sau îl punem deoparte ca conflict.
// Citirea înregistrării locale, decizia și scrierea se fac în ACEEAȘI tranzacție IndexedDB: o salvare făcută de tine
// în aceeași clipă ajunge fie înainte (și intră în combinare), fie după (și se trimite la ciclul următor) — nu se pierde.
async function proceseazaRand(rand, harta) {
  const def = DEF_SINCRON[rand.colectie];
  if (!def) return 0;
  const k = `${rand.colectie}|${rand.cheie}`;
  if (def.colectie === 'setari') return proceseazaSetari(def, rand, harta, k);
  const h = harta.get(k);
  const idCont = sinc.utilizator ? sinc.utilizator.id : '';
  // Imaginea se descarcă înainte (rețeaua nu poate sta într-o tranzacție); fără internet, rândul se reia data viitoare.
  let imagine = null;
  if (def.fisier && !rand.sters && rand.date && rand.date.__fisier && !(h && h.versiune >= rand.versiune)) {
    imagine = await sinc.adaptor.descarcaFisier(rand.date.__fisier.cale);
  }
  const t = await tranzactieSincron([def.store, 'sincron', 'conflicte'], 'readwrite');
  const st = t.objectStore(def.store);
  let rezultat = 0;
  const gata = asteaptaTranzactia(t);
  try {
    const existent = def.cheie === 'uid' ? await cerereIdb(st.index('uid').get(rand.cheie)) : await cerereIdb(st.get(rand.cheie));
    const local = existent && !(def.fisier && !(existent[def.fisier] instanceof Blob)) ? dateCloud(def, existent, idCont) : null;
    const d = decideRand(def, rand, local, h);
    if (d.actiune === 'conflict') {
      t.objectStore('conflicte').put({ k, colectie: def.colectie, cheie: rand.cheie, local, server: rand.date, serverSters: Boolean(rand.sters),
        versiune: rand.versiune, campuri: d.campuri || [], cand: Date.now() });
    } else if (d.actiune !== 'ignora') {
      const sterge = d.actiune === 'aplica' && rand.sters;
      let scris = true;
      if (sterge) {
        if (existent) st.delete(def.cheie === 'uid' ? existent[def.local] : rand.cheie);
      } else {
        const curat = curataDinCloud(def, d.actiune === 'combina' ? d.date : rand.date);
        if (!curat) scris = false;
        else {
          const rec = { ...curat };
          if (def.fisier) {
            delete rec.__fisier;
            rec[def.fisier] = imagine || (existent && existent[def.fisier]);
          }
          if (def.cheie === 'uid') {
            if (existent) st.put({ ...rec, [def.local]: existent[def.local] });
            else { delete rec[def.local]; st.add(rec); }
          } else st.put(rec);
        }
      }
      // Ce nu trece verificările nu se scrie pe telefon și nici nu se retrimite (marcat „ignorat”).
      const h2 = intrareHarta(def.colectie, rand.cheie, rand.versiune, rand.sters, rand.date, scris ? {} : { ignorat: true });
      t.objectStore('sincron').put(h2);
      harta.set(k, h2);
      rezultat = 1;
    }
  } catch (err) { try { t.abort(); } catch (_) { /* deja închisă */ } throw err; }
  await gata;
  return rezultat;
}

async function proceseazaSetari(def, rand, harta, k) {
  const h = harta.get(k);
  let local = await citesteLocal(def, rand.cheie);
  // Un dispozitiv nou are setările implicite: nu sunt „ale lui”, deci le ia pe cele din cont, fără conflict.
  if (!h && local && egale(local, dateCloud(def, { ...SETARI_IMPLICITE }, ''))) local = null;
  const d = decideRand(def, rand, local, h);
  if (d.actiune === 'ignora') return 0;
  if (d.actiune === 'conflict') { await salveazaConflict(def, rand.cheie, local, rand, d.campuri); return 0; }
  await aplicaLocal(def, rand.cheie, d.actiune === 'combina' ? d.date : rand.date, d.actiune === 'aplica' && rand.sters);
  const h2 = intrareHarta(def.colectie, rand.cheie, rand.versiune, rand.sters, rand.date);
  harta.set(k, h2);
  await scrieInHarta([h2]);
  return 1;
}

async function trimiteInCloud() {
  const harta = await citesteHarta();
  const conflicte = new Set(await cere('conflicte', 'readonly', st => st.getAllKeys()));
  const dispozitiv = numeDispozitiv();
  let schimbari = 0;
  for (const def of COLECTII_SINCRON) {
    const locale = await citesteColectie(def);
    const hartaCol = new Map([...harta.values()].filter(h => h.colectie === def.colectie).map(h => [h.cheie, h]));
    const blocate = new Set([...hartaCol.values()].filter(h => h.ignorat).map(h => h.cheie));
    for (const k of conflicte) if (k.startsWith(`${def.colectie}|`)) blocate.add(k.slice(def.colectie.length + 1));
    const lot = deTrimis(locale, hartaCol, blocate);
    for (let i = 0; i < lot.length; i += LOT_TRIMITERE) {
      const bucata = lot.slice(i, i + LOT_TRIMITERE);
      if (def.fisier) {
        for (const x of bucata) {
          if (!x.sters && x.date.__fisier) await sinc.adaptor.urcaFisier(x.date.__fisier.cale, locale.get(x.cheie).rec[def.fisier]);
        }
      }
      const rezultate = await sinc.adaptor.salveaza(bucata.map(x => ({ colectie: def.colectie, cheie: x.cheie, date: x.date, sters: x.sters, baza: x.baza })), dispozitiv);
      const deScris = [];
      for (const r of rezultate) {
        const x = bucata.find(y => y.cheie === r.cheie);
        if (!x) continue;
        if (r.stare === 'ok') {
          deScris.push(intrareHarta(def.colectie, x.cheie, r.versiune, x.sters, x.date));
          if (x.sters && def.fisier && hartaCol.get(x.cheie) && hartaCol.get(x.cheie).baza && hartaCol.get(x.cheie).baza.__fisier) {
            sinc.adaptor.stergeFisier(hartaCol.get(x.cheie).baza.__fisier.cale).catch(() => {});
          }
        } else {
          // Între timp s-a modificat pe alt dispozitiv: îl tratăm ca pe un rând adus din cont.
          schimbari += await proceseazaRand({ colectie: def.colectie, cheie: r.cheie, date: r.date, sters: r.sters, versiune: r.versiune, rev: r.rev }, harta);
        }
      }
      await scrieInHarta(deScris);
    }
  }
  return schimbari;
}

// După ce au venit modificări din cont: datele din memorie și ecranul deschis se reîncarcă
// (fără antrenamentul în curs, care ține de telefon). Cu un dialog deschis, așteptăm să se închidă.
let reimprospatareAmanata = false;
async function reimprospateazaDupaSincron() {
  if (document.querySelector('.dialog')) {
    if (!reimprospatareAmanata) {
      reimprospatareAmanata = true;
      const i = setInterval(() => { if (!document.querySelector('.dialog')) { clearInterval(i); reimprospatareAmanata = false; reimprospateazaDupaSincron(); } }, 1000);
    }
    return;
  }
  try {
    await reincarcaBiblioteca().catch(err => console.warn(err));
    await reincarcaIstoric().catch(err => console.warn(err));
    await reincarcaMasuratori().catch(err => console.warn(err));
    await reincarcaPoze().catch(err => console.warn(err));
    await reincarcaNutritiaDacaE().catch(err => console.warn(err));
    if (typeof ecranCurent !== 'undefined' && ecranCurent !== 'ecran-sesiune') arataEcran(ecranCurent);
  } catch (err) { console.warn(err); }
}

// ---------- Conflicte ----------
async function toateConflictele() { return cere('conflicte', 'readonly', st => st.getAll()); }

// alegere: 'local' (păstrează varianta de pe acest dispozitiv) sau 'cont' (varianta din cont).
async function rezolvaConflict(k, alegere) {
  const c = await cere('conflicte', 'readonly', st => st.get(k));
  if (!c) return;
  const def = DEF_SINCRON[c.colectie];
  if (alegere === 'cont') {
    await aplicaLocal(def, c.cheie, c.server, c.serverSters);
    await scrieInHarta([intrareHarta(c.colectie, c.cheie, c.versiune, c.serverSters, c.server)]);
  } else {
    // Baza devine versiunea din cont, iar amprenta forțat diferită: varianta de aici pleacă la următoarea sincronizare.
    await scrieInHarta([{ ...intrareHarta(c.colectie, c.cheie, c.versiune, c.serverSters, c.server), amprenta: c.serverSters ? null : '__alegere-locala' }]);
  }
  const t = await tranzactieSincron('conflicte', 'readwrite');
  t.objectStore('conflicte').delete(k);
  await asteaptaTranzactia(t);
  await numaraConflicte();
  seteazaStareSincron(sinc.stare);
  await sincronizeaza({ asteapta: true });
  reimprospateazaDupaSincron();
}

// ---------- Copii de siguranță în cont ----------
const dosarCopii = () => `${sinc.utilizator.id}/copii`;
async function faCopieCloud() {
  if (!sinc.utilizator) throw new Error('Nu ești conectat.');
  const continut = await construiesteBackup({ cuPoze: false });
  const nume = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await sinc.adaptor.urcaFisier(`${dosarCopii()}/${nume}`, new Blob([JSON.stringify(continut)], { type: 'application/json' }));
  scrieMetaSincron({ ...citesteMetaSincron(), ultimaCopie: new Date().toISOString() });
  const toate = await sinc.adaptor.listeazaFisiere(dosarCopii());
  for (const f of toate.sort((a, b) => b.nume.localeCompare(a.nume)).slice(MAX_COPII_CLOUD)) await sinc.adaptor.stergeFisier(f.cale).catch(() => {});
  return nume;
}
async function copieCloudSaptamanala() {
  const m = citesteMetaSincron();
  if (!sinc.utilizator || !m.legat) return;
  if (m.ultimaCopie && Date.now() - Date.parse(m.ultimaCopie) < 7 * 86400000) return;
  await faCopieCloud();
}
async function listaCopiiCloud() {
  const l = await sinc.adaptor.listeazaFisiere(dosarCopii());
  return l.filter(f => f.nume.endsWith('.json')).sort((a, b) => b.nume.localeCompare(a.nume));
}
async function citesteCopieCloud(cale) {
  const blob = await sinc.adaptor.descarcaFisier(cale);
  return JSON.parse(await blob.text());
}
