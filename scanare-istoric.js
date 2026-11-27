// Scanarea meselor, etapa 4: istoricul scanărilor (cu poze doar pe acest telefon), păstrarea pozelor,
// limita ta de scanări pe zi și costul estimat. Logica de sus e testată în tests/scanare-istoric.test.js.

const OPTIUNI_POZE_SCANARE = [
  { id: 'nu', nume: 'Nu le păstra' },
  { id: '30', nume: '30 de zile' },
  { id: '90', nume: '90 de zile' },
  { id: 'mereu', nume: 'Până le șterg eu' },
];
// Prețurile Gemini 3.1 Flash-Lite (USD la 1 milion de tokeni), verificate în noiembrie 2026 pe ai.google.dev/gemini-api/docs/pricing.
const PRET_INTRARE_SCANARE = 0.25;
const PRET_IESIRE_SCANARE = 1.5;
const CHEIE_CONTOR_SCANARI = 'scanariContor';
const ZI_MS_SCANARE = 86400000;

function curataInregistrareScanare(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || !(x.creat > 0)) return null;
  const sc = typeof curataSnapshotScanare === 'function' ? curataSnapshotScanare({ articole: x.articole }) : require('./nutritie-zi.js').curataSnapshotScanare({ articole: x.articole });
  if (!sc) return null;
  const t = x.total && typeof x.total === 'object' ? x.total : {};
  const n = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    id: x.id, creat: x.creat,
    data: /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : '', ora: /^\d{2}:\d{2}$/.test(x.ora || '') ? x.ora : '',
    masa: typeof x.masa === 'string' ? x.masa : '', nume: typeof x.nume === 'string' ? x.nume.slice(0, 80) : 'Masă din poză',
    idIntrare: typeof x.idIntrare === 'string' ? x.idIntrare : '',
    articole: sc.articole,
    total: { kcal: n(t.kcal), proteine: n(t.proteine), carbohidrati: n(t.carbohidrati), grasimi: n(t.grasimi), fibre: n(t.fibre) },
    poza: x.poza || null,
    tokeni: x.tokeni && typeof x.tokeni === 'object' ? { intrare: n(x.tokeni.intrare), iesire: n(x.tokeni.iesire) } : null,
  };
}

// Căutare după numele mesei sau al oricărui aliment (fără diacritice).
function filtreazaScanari(lista, text) {
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cuvinte = norm(text).split(/\s+/).filter(Boolean);
  if (!cuvinte.length) return lista;
  return lista.filter(s => {
    const tot = norm([s.nume, ...s.articole.map(a => a.nume)].join(' '));
    return cuvinte.every(c => tot.includes(c));
  });
}

// Data de la care pozele mai vechi se șterg (ms), după setare; null = nu se șterge nimic.
function limitaPozeScanare(setare, acum = Date.now()) {
  if (setare === 'mereu') return null;
  if (setare === 'nu') return Infinity;
  const zile = Number(setare);
  return zile > 0 ? acum - zile * ZI_MS_SCANARE : null;
}

// Diferențele dintre două scanări (b față de a).
function comparaScanari(a, b) {
  const campuri = ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre'];
  return campuri.map(c => ({ camp: c, a: a.total[c], b: b.total[c], diferenta: Math.round((b.total[c] - a.total[c]) * 10) / 10 }));
}

// Contorul de pe acest telefon: scanările de azi (după server) și tokenii lunii, pentru limita ta și costul estimat.
function actualizeazaContorScanari(c, raspuns, acum = new Date()) {
  const zi = acum.toISOString ? formatDataScanare(acum) : '';
  const luna = zi.slice(0, 7);
  const v = c && typeof c === 'object' ? { ...c } : {};
  if (v.luna !== luna) Object.assign(v, { luna, scanariLuna: 0, intrare: 0, iesire: 0 });
  const u = raspuns && raspuns.utilizare;
  if (u && Number.isFinite(u.azi)) Object.assign(v, { zi, aziServer: u.azi, limitaServer: Number(u.limita) || null });
  const t = raspuns && raspuns.tokeni;
  v.scanariLuna = (v.scanariLuna || 0) + 1;
  if (t) { v.intrare = (v.intrare || 0) + (Number(t.intrare) || 0); v.iesire = (v.iesire || 0) + (Number(t.iesire) || 0); }
  return v;
}
function formatDataScanare(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function costEstimatScanari(c) {
  if (!c) return 0;
  return ((c.intrare || 0) * PRET_INTRARE_SCANARE + (c.iesire || 0) * PRET_IESIRE_SCANARE) / 1e6;
}

// null = poți scana; altfel mesajul (limita ta, mai mică decât a serverului).
function verificaLimitaProprie(c, limita, azi) {
  if (!limita || !c || c.zi !== azi || !(c.aziServer >= limita)) return null;
  return { cod: 'limita_proprie', message: `Ai atins limita ta de ${limita} scanări pe azi (o poți schimba din Setări → Scanarea meselor).` };
}

if (typeof module !== 'undefined') module.exports = {
  OPTIUNI_POZE_SCANARE, PRET_INTRARE_SCANARE, PRET_IESIRE_SCANARE, curataInregistrareScanare, filtreazaScanari, limitaPozeScanare,
  comparaScanari, actualizeazaContorScanari, costEstimatScanari, verificaLimitaProprie,
};

// ======================= Interfața (doar în browser) =======================
function citesteContorScanari() { try { return JSON.parse(localStorage.getItem(CHEIE_CONTOR_SCANARI) || 'null'); } catch (_) { return null; } }
function scrieContorScanari(c) { try { localStorage.setItem(CHEIE_CONTOR_SCANARI, JSON.stringify(c)); } catch (_) { /* doar statistică */ } }
function noteazaScanareReusita(raspuns) { scrieContorScanari(actualizeazaContorScanari(citesteContorScanari(), raspuns)); }
function limitaProprieAtinsa() { return verificaLimitaProprie(citesteContorScanari(), setari.limitaScanari, dataLocala()); }

// Pozele expirate (după setare) se scot; valorile rămân.
async function curataPozeExpirateScanari() {
  const prag = limitaPozeScanare(setari.pozeScanare);
  if (prag == null) return 0;
  try { return await stergePozeScanariIstoric(prag); } catch (err) { console.warn(err); return 0; }
}

// Miniatura păstrată (latura lungă 480 px), doar dacă păstrarea pozelor e pornită.
async function miniaturaScanare(blob) {
  const bmp = await createImageBitmap(blob);
  const f = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise(ok => c.toBlob(b => ok(b), 'image/jpeg', 0.72));
}

async function inregistreazaScanareInIstoric({ intrare, data, blob, tokeni }) {
  let poza = null;
  if (setari.pozeScanare !== 'nu' && blob) { try { poza = await miniaturaScanare(blob); } catch (err) { console.warn(err); } }
  const rec = {
    id: `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, creat: Date.now(), data, ora: intrare.ora || '', masa: intrare.masa,
    nume: intrare.nume, idIntrare: intrare.id, articole: intrare.scanare.articole, total: intrare.valoriPortie, poza, tokeni: tokeni || null,
  };
  try { await salveazaScanareIstoric(rec); } catch (err) { console.warn('Istoricul scanării nu a putut fi salvat', err); }
}

// Pe primul ecran al scanării: ultimele 3 scanări.
async function blocScanariRecente() {
  let lista = [];
  try { lista = await toateScanarileIstoric(); } catch (err) { console.warn(err); }
  if (!lista.length) return null;
  const urluri = [];
  const bloc = el('div', { class: 'scan-recente' }, [
    el('div', { class: 'scan-recente-cap' }, [el('strong', { text: 'Scanări recente' }), buton({ text: `Toate (${lista.length})`, tip: 'fantoma', mic: true, onclick: () => { inchideScanare(); deschideIstoricScanari(); } })]),
    ...lista.slice(0, 3).map(s => randScanare(s, urluri, () => { inchideScanare(); deschideIstoricScanari(s.id); })),
  ]);
  bloc.urluri = urluri;
  return bloc;
}

function randScanare(s, urluri, onclick, extra = null) {
  let img;
  if (s.poza) { const u = URL.createObjectURL(s.poza); urluri.push(u); img = el('img', { class: 'scan-istoric-img', src: u, alt: '' }); }
  else img = el('span', { class: 'scan-istoric-img scan-istoric-fara' }, [iconita('camera')]);
  return el('div', { class: 'scan-istoric-rand' }, [
    extra,
    el('button', { type: 'button', class: 'scan-istoric-btn', onclick, 'aria-label': `${s.nume}, ${afiseazaData(s.data)}, ${Math.round(s.total.kcal)} kcal. Detalii` }, [
      img,
      el('span', { class: 'scan-istoric-text' }, [
        el('strong', { text: s.nume }),
        el('span', { class: 'nota nota-mica', text: [s.data ? afiseazaData(s.data) : '', s.ora, s.masa ? numeMasa(s.masa) : ''].filter(Boolean).join(' · ') }),
      ]),
      el('b', { class: 'scan-istoric-kcal', text: `${Math.round(s.total.kcal)} kcal` }),
    ]),
  ]);
}

// Istoricul: căutare, detalii, comparare, ștergerea pozei sau a scanării.
async function deschideIstoricScanari(idDeschis = null) {
  await curataPozeExpirateScanari();
  let lista = [];
  try { lista = await toateScanarileIstoric(); } catch (err) { console.error(err); notifica('Istoricul scanărilor nu a putut fi citit.', 'eroare'); return; }
  const urluri = [];
  const elibereaza = () => { for (const u of urluri.splice(0)) URL.revokeObjectURL(u); };
  const zona = el('div', { class: 'scan-istoric' });
  const alese = new Set();
  let cautare = '';
  const d = deschideDialog({ titlu: 'Istoricul scanărilor', continut: zona, butoane: [], laAnulare: elibereaza });
  d.caseta.classList.add('dialog-scanare');
  const butoane = (...b) => d.caseta.querySelector('.dialog-butoane').replaceChildren(...b.filter(Boolean));
  const inchide = buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide(elibereaza) });

  const deseneazaLista = () => {
    elibereaza();
    const filtrate = filtreazaScanari(lista, cautare);
    const cauta = el('input', { type: 'search', value: cautare, placeholder: 'Caută după masă sau aliment', 'aria-label': 'Caută în scanări' });
    cauta.addEventListener('input', () => { cautare = cauta.value; const poz = cauta.selectionStart; deseneazaLista(); const c = zona.querySelector('input[type=search]'); c.focus(); c.setSelectionRange(poz, poz); });
    zona.replaceChildren(...[
      lista.length ? cauta : null,
      !lista.length ? stareGoala({ icon: 'camera', titlu: 'Nicio scanare încă', text: 'Mesele fotografiate și adăugate în zi apar aici.' }) : null,
      lista.length && !filtrate.length ? el('p', { class: 'nota', text: 'Nicio scanare nu se potrivește căutării.' }) : null,
      el('p', { class: 'nota nota-mica', text: lista.length ? `Bifează două scanări ca să le compari. Pozele: ${(OPTIUNI_POZE_SCANARE.find(o => o.id === setari.pozeScanare) || {}).nume.toLowerCase()} (Setări → Scanarea meselor). Istoricul e doar pe acest telefon.` : '' }),
      el('div', { class: 'scan-istoric-lista' }, filtrate.map(s => {
        const bifa = el('input', { type: 'checkbox', checked: alese.has(s.id), 'aria-label': `Alege ${s.nume} pentru comparare` });
        bifa.addEventListener('change', () => { if (bifa.checked) { if (alese.size >= 2) { bifa.checked = false; notifica('Poți compara două scanări o dată.', 'info'); return; } alese.add(s.id); } else alese.delete(s.id); actualizeazaButoane(); });
        return randScanare(s, urluri, () => deseneazaDetaliu(s), el('label', { class: 'scan-istoric-bifa' }, [bifa]));
      })),
    ].filter(Boolean));
    actualizeazaButoane();
  };
  const actualizeazaButoane = () => butoane(inchide, alese.size === 2 ? buton({ text: 'Compară', icon: 'schimba', tip: 'principal', onclick: deseneazaComparare }) : null);

  const deseneazaDetaliu = s => {
    elibereaza();
    const fmt = x => String(Math.round(x * 10) / 10).replace('.', ',');
    let img = null;
    if (s.poza) { const u = URL.createObjectURL(s.poza); urluri.push(u); img = el('img', { class: 'scan-poza', src: u, alt: `Poza: ${s.nume}` }); }
    let confirmare = false;
    const btnSterge = buton({ text: 'Șterge scanarea', icon: 'cos', tip: 'fantoma', mic: true, onclick: async () => {
      if (!confirmare) { confirmare = true; btnSterge.querySelector('span').textContent = 'Apasă din nou ca să ștergi'; return; }
      await stergeScanareIstoric(s.id);
      lista = lista.filter(x => x.id !== s.id); alese.delete(s.id);
      notifica('Scanarea a fost ștearsă din istoric. Masa din ziua ta a rămas.', 'info');
      deseneazaLista();
    } });
    zona.replaceChildren(...[
      img || el('p', { class: 'nota nota-mica', text: 'Poza nu (mai) e păstrată; valorile au rămas.' }),
      el('h3', { class: 'detaliu-titlu', text: s.nume }),
      el('p', { class: 'nota', text: [s.data ? afiseazaData(s.data) : '', s.ora, s.masa ? numeMasa(s.masa) : ''].filter(Boolean).join(' · ') }),
      el('div', { class: 'scan-total' }, [
        el('div', { class: 'scan-total-sus' }, [el('span', { class: 'nota', text: 'Total' }), el('strong', { text: `${Math.round(s.total.kcal)} kcal` })]),
        el('div', { class: 'scan-total-macro' }, [el('span', { text: `P ${fmt(s.total.proteine)} g` }), el('span', { text: `C ${fmt(s.total.carbohidrati)} g` }), el('span', { text: `G ${fmt(s.total.grasimi)} g` })]),
      ]),
      el('ul', { class: 'scan-salvate' }, s.articole.map(a => el('li', { class: 'scan-salvat' }, [
        el('strong', { text: a.nume }),
        el('span', { class: 'nota nota-mica', text: `${fmt(a.cantitate || 0)} ${a.unitate || ''}${a.estimat ? ' (estimat din poză)' : ''} · ${Math.round(a.valori.kcal)} kcal · P ${fmt(a.valori.proteine)} · C ${fmt(a.valori.carbohidrati)} · G ${fmt(a.valori.grasimi)}` }),
        el('span', { class: 'nota nota-mica', text: [a.sursa.eticheta, a.sursa.nume].filter(Boolean).join(' · ') }),
      ]))),
      el('p', { class: 'nota nota-mica', text: 'Ca să schimbi cantitățile sau numele, deschide masa în ziua ta. Ștergerea scanării nu șterge masa din zi.' }),
      el('div', { class: 'rand-butoane' }, [
        s.data ? buton({ text: 'Deschide în Ziua mea', icon: 'calendar', tip: 'secundar', mic: true, onclick: () => d.inchide(() => { elibereaza(); dataZiNutritie = s.data; arataEcran('ecran-nutritie'); arataFilaNutritie('zi'); }) }) : null,
        s.poza ? buton({ text: 'Șterge poza', tip: 'fantoma', mic: true, onclick: async () => {
          const nou = { ...s, poza: null };
          await salveazaScanareIstoric(nou);
          lista = lista.map(x => (x.id === s.id ? nou : x));
          deseneazaDetaliu(nou);
        } }) : null,
        btnSterge,
      ].filter(Boolean)),
    ]);
    butoane(buton({ text: 'Înapoi', tip: 'fantoma', onclick: deseneazaLista }));
    d.caseta.scrollTop = 0;
  };

  const deseneazaComparare = () => {
    const [a, b] = lista.filter(s => alese.has(s.id)).sort((x, y) => x.creat - y.creat);
    const NUME = { kcal: 'Calorii', proteine: 'Proteine (g)', carbohidrati: 'Carbohidrați (g)', grasimi: 'Grăsimi (g)', fibre: 'Fibre (g)' };
    const fmt = x => String(Math.round(x * 10) / 10).replace('.', ',');
    zona.replaceChildren(
      el('table', { class: 'scan-comparare' }, [
        el('thead', {}, [el('tr', {}, [el('th', { text: '' }), el('th', { text: `${a.nume} (${afiseazaData(a.data)})` }), el('th', { text: `${b.nume} (${afiseazaData(b.data)})` }), el('th', { text: 'Diferență' })])]),
        el('tbody', {}, comparaScanari(a, b).map(r => el('tr', {}, [el('th', { text: NUME[r.camp] }), el('td', { text: fmt(r.a) }), el('td', { text: fmt(r.b) }), el('td', { class: r.diferenta > 0 ? 'mai-mult' : r.diferenta < 0 ? 'mai-putin' : '', text: `${r.diferenta > 0 ? '+' : ''}${fmt(r.diferenta)}` })]))),
      ]),
      el('p', { class: 'nota nota-mica', text: 'Valorile sunt estimări (gramaje din poze); comparația arată diferența, nu o măsurătoare.' }),
    );
    butoane(buton({ text: 'Înapoi', tip: 'fantoma', onclick: deseneazaLista }));
  };

  const tinta = idDeschis && lista.find(s => s.id === idDeschis);
  if (tinta) deseneazaDetaliu(tinta); else deseneazaLista();
}

// Cardul din Setări: păstrarea pozelor, limita ta, scanările de azi și costul estimat al lunii.
async function deseneazaSetariScanare() {
  const card = document.getElementById('set-scanare');
  if (!card) return;
  const c = citesteContorScanari();
  const azi = dataLocala();
  const poze = el('select', { id: 'set-poze-scanare', 'aria-label': 'Păstrează pozele scanărilor' }, OPTIUNI_POZE_SCANARE.map(o => el('option', { value: o.id, text: o.nume })));
  poze.value = setari.pozeScanare;
  poze.addEventListener('change', async () => {
    setari.pozeScanare = poze.value; salveazaSetari();
    const n = await curataPozeExpirateScanari();
    if (n) notifica(`${plural(n, 'poză ștearsă', 'poze șterse')} (valorile au rămas).`, 'info');
  });
  const limita = el('input', { id: 'set-limita-scanari', type: 'number', inputmode: 'numeric', min: '1', max: '200', class: 'camp-scurt', value: setari.limitaScanari || '', placeholder: String((c && c.limitaServer) || 20), 'aria-label': 'Limita ta de scanări pe zi' });
  limita.addEventListener('change', () => {
    const v = parseInt(limita.value, 10);
    if (!limita.value.trim()) setari.limitaScanari = null;
    else if (v >= 1 && v <= 200) setari.limitaScanari = v;
    else { notifica('Limita trebuie să fie între 1 și 200 (gol = limita serverului).', 'eroare'); limita.value = setari.limitaScanari || ''; return; }
    salveazaSetari();
  });
  let nrIstoric = 0;
  try { nrIstoric = (await toateScanarileIstoric()).length; } catch (_) { /* fără istoric */ }
  const lunaAceasta = c && c.luna === azi.slice(0, 7);
  const cost = lunaAceasta ? costEstimatScanari(c) : 0;
  card.replaceChildren(
    el('div', { class: 'rand aliniat' }, [el('label', { for: 'set-poze-scanare', text: 'Păstrează pozele scanărilor' }), poze]),
    el('p', { class: 'nota', text: 'Pozele stau doar pe acest telefon (nu se urcă în cont). Când expiră se șterg singure; valorile meselor rămân.' }),
    el('div', { class: 'rand aliniat' }, [el('label', { for: 'set-limita-scanari', text: 'Limita ta de scanări pe zi' }), limita]),
    el('p', { class: 'nota', text: `Gol = limita serverului (${(c && c.limitaServer) || 20}). Azi: ${c && c.zi === azi ? `${c.aziServer} ${c.aziServer === 1 ? 'scanare' : 'scanări'}` : 'nicio scanare'}.` }),
    el('p', { class: 'nota', text: lunaAceasta
      ? `Luna aceasta, de pe acest telefon: ${plural(c.scanariLuna, 'scanare', 'scanări')}, cost estimat ≈ ${cost < 0.01 ? '< 0,01' : cost.toFixed(2).replace('.', ',')} $ (din tokenii raportați de Gemini, la prețurile Flash-Lite din nov. 2026; factura reală e în Google AI Studio).`
      : 'Costul estimat al lunii apare după prima scanare.' }),
    el('div', { class: 'scan-setari-butoane' }, [
      buton({ text: `Istoricul scanărilor${nrIstoric ? ` (${nrIstoric})` : ''}`, icon: 'istoric', tip: 'secundar', mic: true, lat: true, onclick: () => deschideIstoricScanari() }),
      buton({ text: 'Șterge toate pozele scanărilor', icon: 'cos', tip: 'fantoma', mic: true, lat: true, onclick: async () => {
        if (!(await confirma({ titlu: 'Ștergi pozele scanărilor?', text: 'Se șterg toate pozele din istoricul scanărilor de pe acest telefon. Mesele și valorile lor rămân.', ok: 'Șterge pozele', pericol: true }))) return;
        const n = await stergePozeScanariIstoric(Infinity);
        notifica(n ? `${plural(n, 'poză ștearsă', 'poze șterse')}.` : 'Nu era nicio poză păstrată.', 'info');
      } }),
    ]),
  );
}

if (typeof window !== 'undefined') window.addEventListener('load', () => setTimeout(() => { curataPozeExpirateScanari(); }, 3000));
