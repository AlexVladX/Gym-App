// Scanarea meselor — ecranele (etapa 1: poză → analiză → alimente și gramaje de verificat).
// Logica (validare, gramaje, mesaje de eroare, cache) e în scanare.js; serverul în supabase/functions/scanare.

const scanare = { ctrl: null, fisier: null, imagine: null, url: null, rezultat: null, articole: [], nota: '', cerere: null, inCurs: false, deschise: new Set(), avertizariCautare: [], manualDeschis: null };

function deschideScanare() {
  inchideResurseScanare();
  Object.assign(scanare, { fisier: null, imagine: null, rezultat: null, articole: [], nota: '', cerere: null, inCurs: false, deschise: new Set(), avertizariCautare: [], manualDeschis: null });
  const zona = el('div', { class: 'scan-zona' });
  scanare.ctrl = deschideDialog({
    titlu: 'Fotografiază masa', continut: zona, butoane: [],
    laAnulare: () => { if (scanare.cerere) scanare.cerere.abort(); inchideResurseScanare(); },
  });
  scanare.ctrl.caseta.classList.add('dialog-scanare');
  pasAlegereScanare();
}

function inchideResurseScanare() {
  if (scanare.url) URL.revokeObjectURL(scanare.url);
  scanare.url = null;
}

function zonaScanare() { return scanare.ctrl && scanare.ctrl.caseta.querySelector('.scan-zona'); }
// replaceChildren(null) ar scrie textul „null”; elementele opționale lipsă se sar.
function puneInZona(zona, ...copii) { if (zona) zona.replaceChildren(...copii.filter(Boolean)); }
function butoaneScanare(...b) { if (scanare.ctrl) scanare.ctrl.caseta.querySelector('.dialog-butoane').replaceChildren(...b.filter(Boolean)); }
function inchideScanare() { if (scanare.ctrl) scanare.ctrl.inchide(() => { if (scanare.cerere) scanare.cerere.abort(); inchideResurseScanare(); }); }

// Ecranul 1: cameră sau galerie.
function pasAlegereScanare(eroare = '') {
  const intrare = captura => {
    const i = el('input', { type: 'file', accept: 'image/*', class: 'ascuns-vizual', tabindex: '-1', 'aria-hidden': 'true' });
    if (captura) i.setAttribute('capture', 'environment');
    i.addEventListener('change', () => { const f = i.files && i.files[0]; i.value = ''; if (f) alegeFisierScanare(f); });
    return i;
  };
  const camera = intrare(true), galerie = intrare(false);
  const mare = (icon, titlu, detaliu, input) => el('button', { type: 'button', class: 'scan-alegere', onclick: () => input.click() }, [
    el('span', { class: 'scan-alegere-icon' }, [iconita(icon)]), el('strong', { text: titlu }), el('span', { class: 'nota', text: detaliu })]);
  puneInZona(zonaScanare(), 
    eroare ? el('p', { class: 'scan-eroare', role: 'alert', text: eroare }) : null,
    stareContScanare(),
    el('div', { class: 'scan-alegeri' }, [
      mare('camera', 'Fă o poză', 'cu camera telefonului', camera),
      mare('galerie', 'Din galerie', 'o poză pe care o ai deja', galerie),
    ]),
    camera, galerie,
    el('ul', { class: 'scan-sfaturi nota' }, [
      el('li', { text: 'Fotografiază de sus, cu toată farfuria în cadru și lumină bună.' }),
      el('li', { text: 'Alimentele separate se recunosc mai bine decât cele amestecate.' }),
      el('li', { text: 'Gramajele vor fi estimate din poză; le poți corecta înainte de orice salvare.' }),
    ]),
  );
  butoaneScanare(buton({ text: 'Închide', tip: 'fantoma', onclick: inchideScanare }));
}

// Scanarea are nevoie de cont și de internet; spunem asta de la început, nu după ce alegi poza.
function stareContScanare() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return el('p', { class: 'scan-atentie', text: 'Nu ai internet acum. Poți alege poza, dar analiza merge doar cu internet.' });
  if (!sinc.utilizator) {
    return el('div', { class: 'scan-atentie' }, [
      el('p', { text: 'Scanarea folosește contul din cloud (pentru siguranța cheii AI și limita zilnică). Conectează-te din Setări → Cont.' }),
      buton({ text: 'Deschide Setări', tip: 'secundar', mic: true, onclick: () => { inchideScanare(); arataEcran('ecran-setari'); } }),
    ]);
  }
  return null;
}

async function alegeFisierScanare(f) {
  const problema = verificaFisierScanare(f);
  if (problema) return pasAlegereScanare(problema);
  puneInZona(zonaScanare(), el('div', { class: 'scan-progres' }, [el('span', { class: 'scan-rotita', 'aria-hidden': 'true' }), el('span', { text: 'Pregătesc poza…' })]));
  try {
    scanare.imagine = await pregatesteImagineScanare(f);
  } catch (err) {
    console.warn(err);
    return pasAlegereScanare('Poza nu a putut fi deschisă. Încearcă altă poză (JPEG sau PNG).');
  }
  scanare.fisier = f;
  inchideResurseScanare();
  scanare.url = URL.createObjectURL(scanare.imagine.blob);
  pasPrevizualizareScanare();
}

// Micșorare pe telefon (latura lungă max. 1024 px, JPEG) — trimitem cât trebuie pentru recunoaștere, nu poza originală.
async function pregatesteImagineScanare(f) {
  let sursa;
  try { sursa = await createImageBitmap(f, { imageOrientation: 'from-image' }); }
  catch (_) {
    sursa = await new Promise((ok, no) => {
      const img = new Image(); const u = URL.createObjectURL(f);
      img.onload = () => { URL.revokeObjectURL(u); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(u); no(new Error('imagine')); };
      img.src = u;
    });
  }
  const { latime, inaltime } = dimensiuniMicsorare(sursa.width || sursa.naturalWidth, sursa.height || sursa.naturalHeight);
  const c = document.createElement('canvas');
  c.width = latime; c.height = inaltime;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, latime, inaltime);
  ctx.drawImage(sursa, 0, 0, latime, inaltime);
  if (sursa.close) sursa.close();
  const blobDin = q => new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('blob'))), 'image/jpeg', q));
  let calitate = 0.82, blob = await blobDin(calitate);
  while (blob.size > MAX_OCTETI_SCANARE && calitate > 0.45) { calitate -= 0.12; blob = await blobDin(calitate); }
  if (blob.size > MAX_OCTETI_SCANARE) throw new Error('Poza e prea mare și după micșorare.');
  const amprenta = await amprentaScanare(blob);
  return { blob, latime, inaltime, amprenta };
}

async function amprentaScanare(blob) {
  try {
    const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { return null; }
}

function base64Blob(blob) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] || '');
    r.onerror = () => no(r.error);
    r.readAsDataURL(blob);
  });
}

// Ecranul 2: poza aleasă, o notă opțională și „Analizează”.
function pasPrevizualizareScanare(eroare = null) {
  const nota = el('input', { type: 'text', maxlength: '200', value: scanare.nota, placeholder: 'ex.: gătit cu ulei de măsline, porție mare', 'aria-label': 'Detalii despre masă (opțional)' });
  nota.addEventListener('input', () => { scanare.nota = nota.value; });
  puneInZona(zonaScanare(), 
    eroare ? casetaEroareScanare(eroare) : null,
    el('img', { class: 'scan-poza', src: scanare.url, alt: 'Poza mesei aleasă pentru analiză' }),
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Detalii (opțional) — ajută la ce nu se vede' }), nota]),
    stareContScanare(),
  );
  butoaneScanare(
    buton({ text: 'Șterge poza', tip: 'fantoma', onclick: () => { inchideResurseScanare(); scanare.imagine = null; pasAlegereScanare(); } }),
    buton({ text: 'Altă poză', tip: 'secundar', onclick: () => pasAlegereScanare() }),
    buton({ text: 'Analizează', icon: 'cauta', tip: 'principal', onclick: analizeazaScanare }),
  );
}

function casetaEroareScanare(m) {
  return el('div', { class: `scan-eroare scan-eroare-${m.tip}`, role: 'alert' }, [el('strong', { text: m.titlu }), m.text ? el('p', { text: m.text }) : null]);
}

// Ecranul 3: analiza. Un singur apel o dată (butonul dispare), cu „Oprește”.
async function analizeazaScanare() {
  if (scanare.inCurs || !scanare.imagine) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return pasPrevizualizareScanare(mesajEroareScanare({ cod: 'offline' }));
  if (!sinc.utilizator || !sinc.adaptor || typeof sinc.adaptor.functie !== 'function') return pasPrevizualizareScanare(mesajEroareScanare({ cod: 'fara_cont' }));
  const amprenta = scanare.imagine.amprenta;
  const cheieCache = amprenta ? `p2:${amprenta}:${scanare.nota.trim()}` : null;
  const dinCache = cheieCache ? citesteCacheScanare(localStorage, cheieCache) : null;
  if (dinCache) return arataRezultatScanare(dinCache, true);

  scanare.inCurs = true;
  const ctrl = new AbortController();
  scanare.cerere = ctrl;
  puneInZona(zonaScanare(), 
    el('div', { class: 'scan-analiza' }, [
      el('img', { class: 'scan-poza scan-poza-analiza', src: scanare.url, alt: '' }),
      el('div', { class: 'scan-progres', role: 'status' }, [el('span', { class: 'scan-rotita', 'aria-hidden': 'true' }), el('span', { text: 'Se analizează poza… de obicei durează câteva secunde.' })]),
    ]),
  );
  butoaneScanare(buton({ text: 'Oprește', tip: 'fantoma', onclick: () => ctrl.abort() }));
  try {
    const corp = { imagine: await base64Blob(scanare.imagine.blob), tip: 'image/jpeg', nota: scanare.nota.trim() };
    const raspuns = await sinc.adaptor.functie('scanare', corp, { semnal: ctrl.signal });
    if (ctrl.signal.aborted) throw Object.assign(new Error('oprit'), { cod: 'anulat' });
    if (cheieCache) scrieCacheScanare(localStorage, cheieCache, raspuns);
    arataRezultatScanare(raspuns, false);
  } catch (err) {
    if (ctrl.signal.aborted) err = Object.assign(new Error('oprit'), { cod: 'anulat' });
    console.warn(err);
    const m = mesajEroareScanare(err);
    if (scanare.ctrl && dialogDeschis === scanare.ctrl) pasPrevizualizareScanare(m.tip === 'anulat' ? null : m);
  } finally {
    scanare.inCurs = false;
    scanare.cerere = null;
  }
}

function arataRezultatScanare(raspuns, dinCache) {
  if (!scanare.ctrl || dialogDeschis !== scanare.ctrl) return;
  try {
    scanare.rezultat = curataRezultatScanare(raspuns);
  } catch (err) {
    return pasPrevizualizareScanare(mesajEroareScanare({ cod: 'raspuns_invalid', message: err.message }));
  }
  scanare.rezultat.dinCache = dinCache;
  scanare.deschise = new Set();
  scanare.avertizariCautare = [];
  scanare.articole = scanare.rezultat.articole.map(a => potrivesteLocalScanare(initializeazaCantitateScanare(a)));
  pasRevizuireScanare();
  cautaExternScanare(scanare.articole.filter(a => a.stareCautare === 'cauta').map(a => a.id));
}

// Pasul 1 din potrivire: alimentele și rețetele din aplicație (fără nicio cerere în rețea).
function potrivesteLocalScanare(a) {
  if (!a.nume.trim()) return { ...a, candidatiLocali: [], candidatiExterni: [], potrivire: null, stareCautare: 'gol' };
  const locali = candidatiLocaliScanare(a, toateAlimentele(), toateRetetele(), indexNutritie);
  const ales = alegeLocalScanare(locali);
  const b = { ...a, candidatiLocali: locali, candidatiExterni: a.candidatiExterni || [], potrivire: null, stareCautare: ales ? 'gata' : 'cauta' };
  return ales ? aplicaPotrivireScanare(b, ales) : b;
}

// Pasul 2: USDA / Open Food Facts prin funcția Supabase, într-o singură cerere pentru toate alimentele rămase.
async function cautaExternScanare(iduri, textManual = null) {
  const tinte = scanare.articole.filter(a => iduri.includes(a.id));
  if (!tinte.length) return;
  const cereri = tinte.map(a => ({ id: a.id, text: (textManual || a.numeEn || a.nume).trim().slice(0, 80), ambalat: Boolean(a.ambalat), marca: a.marca || '' }));
  const rezultate = new Map();
  const deTrimis = [];
  for (const c of cereri) {
    const dinCache = citesteCacheCautari(localStorage, cheieCautareScanare(c));
    if (dinCache) rezultate.set(c.id, dinCache); else deTrimis.push(c);
  }
  if (deTrimis.length) {
    if (!sinc.utilizator || !sinc.adaptor || typeof sinc.adaptor.functie !== 'function' || navigator.onLine === false) {
      for (const c of deTrimis) rezultate.set(c.id, null);
      scanare.avertizariCautare = [navigator.onLine === false ? 'Fără internet: nu pot căuta în USDA acum. Alege din aplicație sau scrie valorile.' : 'Căutarea în USDA cere contul din cloud.'];
    } else {
      try {
        const r = await sinc.adaptor.functie('scanare', { actiune: 'cauta', cereri: deTrimis });
        scanare.avertizariCautare = Array.isArray(r && r.avertizari) ? r.avertizari.map(String).slice(0, 4) : [];
        for (const x of (r && Array.isArray(r.rezultate) ? r.rezultate : [])) {
          const c = deTrimis.find(y => y.id === x.id);
          if (!c) continue;
          const lista = Array.isArray(x.candidati) ? x.candidati : [];
          rezultate.set(c.id, lista);
          if (lista.length || !scanare.avertizariCautare.length) scrieCacheCautari(localStorage, cheieCautareScanare(c), lista);
        }
      } catch (err) {
        console.warn(err);
        scanare.avertizariCautare = [mesajEroareScanare(err).text || 'Căutarea în bazele de date nu a reușit.'];
        for (const c of deTrimis) if (!rezultate.has(c.id)) rezultate.set(c.id, null);
      }
    }
  }
  if (!scanare.ctrl || dialogDeschis !== scanare.ctrl) return;
  for (const t of tinte) {
    const lista = rezultate.get(t.id);
    actualizeazaArticolScanare(t.id, a => {
      if (lista == null) return { ...a, stareCautare: a.potrivire ? 'gata' : 'eroare' };
      const { candidati, ales } = ordoneazaExterneScanare(a, lista);
      const b = { ...a, candidatiExterni: candidati };
      if (textManual) return { ...b, stareCautare: a.potrivire ? 'gata' : 'alege' };
      if (ales && !a.potrivire) return aplicaPotrivireScanare(b, ales);
      return { ...b, stareCautare: a.potrivire ? 'gata' : (candidati.length || a.candidatiLocali.length ? 'alege' : 'negasit') };
    });
    if (textManual || !scanare.articole.find(a => a.id === t.id).potrivire) scanare.deschise.add(t.id);
  }
  redeseneazaRevizuireScanare();
}

// Redesenarea păstrează focusul (dacă scrii într-un câmp când sosesc rezultatele).
function redeseneazaRevizuireScanare() {
  const activ = document.activeElement;
  const card = activ && activ.closest && activ.closest('.scan-aliment');
  const id = card && card.dataset.id;
  const clasa = activ && activ.classList && [...activ.classList].find(c => c.startsWith('scan-'));
  const sus = zonaScanare() ? scanare.ctrl.caseta.scrollTop : 0;
  pasRevizuireScanare();
  scanare.ctrl.caseta.scrollTop = sus;
  if (id && clasa) {
    const e = zonaScanare().querySelector(`[data-id="${id}"] .${clasa}`);
    if (e) e.focus({ preventScroll: true });
  }
}

// Ecranul de revizuire: alimente, cantități, surse, valori și totalul mesei — totul se recalculează imediat.
function pasRevizuireScanare() {
  const r = scanare.rezultat;
  const zona = zonaScanare();
  if (!r.esteMancare || r.calitate === 'inutilizabila') {
    puneInZona(zona,
      el('img', { class: 'scan-poza scan-poza-mica', src: scanare.url, alt: 'Poza analizată' }),
      el('div', { class: 'scan-eroare scan-eroare-tehnic', role: 'alert' }, [
        el('strong', { text: r.esteMancare ? 'Poza nu poate fi folosită' : 'Nu am găsit mâncare în poză' }),
        el('p', { text: r.observatii || 'Încearcă o poză mai clară, de sus, cu lumină bună — sau adaugă alimentele de mână.' }),
      ]),
    );
    butoaneScanare(
      buton({ text: 'Adaugă de mână', tip: 'fantoma', onclick: () => { scanare.rezultat.esteMancare = true; scanare.rezultat.calitate = 'slaba'; adaugaArticolScanare(''); } }),
      buton({ text: 'Altă poză', tip: 'principal', onclick: () => pasAlegereScanare() }),
    );
    return;
  }
  const ascunse = ascunseDeAdaugat(scanare.articole);
  puneInZona(zona,
    el('div', { class: 'scan-antet' }, [
      el('img', { class: 'scan-poza scan-poza-mica', src: scanare.url, alt: 'Poza analizată' }),
      el('div', {}, [
        el('strong', { text: scanare.articole.length ? `${plural(scanare.articole.length, 'aliment', 'alimente')}` : 'Niciun aliment în listă' }),
        el('p', { class: 'nota', text: 'Verifică numele, cantitățile și sursa valorilor. Gramajele sunt estimate din poză, nu cântărite.' }),
      ]),
    ]),
    blocTotalScanare(),
    r.calitate === 'slaba' ? el('p', { class: 'scan-atentie', text: 'Poza e neclară sau întunecată; verifică atent fiecare aliment.' }) : null,
    r.observatii ? el('p', { class: 'nota scan-observatii', text: r.observatii }) : null,
    r.eliminate ? el('p', { class: 'nota nota-mica', text: `${plural(r.eliminate, 'element', 'elemente')} din răspunsul AI nu au avut formatul corect și au fost ignorate.` }) : null,
    scanare.avertizariCautare.length ? el('div', { class: 'scan-atentie' }, scanare.avertizariCautare.map(t => el('p', { text: t }))) : null,
    el('div', { class: 'scan-lista' }, scanare.articole.map(cardArticolScanare)),
    ascunse.length ? el('div', { class: 'scan-ascunse' }, [
      el('p', { class: 'nota', text: 'Poate conține și ingrediente care nu se văd. Adaugă-le dacă știi că sunt:' }),
      el('div', { class: 'scan-chips' }, ascunse.map(x => el('button', { type: 'button', class: 'chip', onclick: () => adaugaArticolScanare(x) }, [iconita('plus', 'iconita mica'), el('span', { text: x })]))),
    ]) : null,
    buton({ text: 'Adaugă un aliment', icon: 'plus', tip: 'secundar', lat: true, onclick: () => adaugaArticolScanare('') }),
    el('p', { class: 'scan-urmeaza nota nota-mica', text: 'În lucru: salvarea în ziua ta vine în etapa următoare. Deocamdată lista nu se salvează.' }),
    r.utilizare ? el('p', { class: 'nota nota-mica', text: `Scanări azi: ${r.utilizare.azi} din ${r.utilizare.limita}${r.dinCache ? ' (rezultat refolosit, fără o scanare nouă)' : ''}.` })
      : (r.dinCache ? el('p', { class: 'nota nota-mica', text: 'Rezultat refolosit pentru aceeași poză, fără o scanare nouă.' }) : null),
  );
  butoaneScanare(
    buton({ text: 'Închide', tip: 'fantoma', onclick: inchideScanare }),
    buton({ text: 'Altă poză', icon: 'camera', tip: 'secundar', onclick: () => pasAlegereScanare() }),
  );
}

function blocTotalScanare() {
  const b = el('div', { class: 'scan-total', 'aria-live': 'polite' });
  umpleTotalScanare(b);
  return b;
}
function umpleTotalScanare(b) {
  const t = totalScanare(scanare.articole);
  const v = t.valori;
  const fmt = x => String(x).replace('.', ',');
  const extra = [`fibre ${fmt(v.fibre)} g`, t.zahar != null ? `zahăr ${fmt(t.zahar)} g` : null, t.saturate != null ? `grăsimi saturate ${fmt(t.saturate)} g` : null].filter(Boolean).join(' · ');
  b.replaceChildren(...[
    el('div', { class: 'scan-total-sus' }, [el('span', { class: 'nota', text: 'Total masă (estimare)' }), el('strong', { text: `${v.kcal} kcal` })]),
    el('div', { class: 'scan-total-macro' }, [
      el('span', { text: `P ${fmt(v.proteine)} g` }), el('span', { text: `C ${fmt(v.carbohidrati)} g` }), el('span', { text: `G ${fmt(v.grasimi)} g` }),
    ]),
    el('p', { class: 'nota nota-mica', text: extra }),
    t.lipsa ? el('p', { class: 'scan-total-lipsa', text: `${plural(t.lipsa, 'aliment nu are', 'alimente nu au')} încă valori și nu ${t.lipsa === 1 ? 'e inclus' : 'sunt incluse'} în total.` }) : null,
  ].filter(Boolean));
}
function actualizeazaTotalScanare() {
  const b = zonaScanare() && zonaScanare().querySelector('.scan-total');
  if (b) umpleTotalScanare(b);
}

function adaugaArticolScanare(nume) {
  const a = { ...initializeazaCantitateScanare(articolManualScanare(nume)), candidatiLocali: [], candidatiExterni: [], potrivire: null, stareCautare: 'gol' };
  scanare.articole = [...scanare.articole, nume ? potrivesteLocalScanare(a) : a];
  const nou = scanare.articole[scanare.articole.length - 1];
  if (!nou.potrivire && nume) scanare.deschise.add(nou.id);
  pasRevizuireScanare();
  const camp = zonaScanare().querySelector(`[data-id="${a.id}"] ${nume ? '.scan-cantitate' : '.scan-nume'}`);
  if (camp) setTimeout(() => { camp.focus(); camp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
}

function actualizeazaArticolScanare(id, f) {
  scanare.articole = scanare.articole.map(a => (a.id === id ? f(a) : a));
  return scanare.articole.find(a => a.id === id);
}

const fmtNrScan = x => String(Math.round(x * 10) / 10).replace('.', ',');

function cardArticolScanare(a) {
  const inc = INCREDERI_SCANARE[a.incredere] || INCREDERI_SCANARE.scazuta;
  const nume = el('input', { type: 'text', class: 'scan-nume', maxlength: '80', value: a.nume, placeholder: 'Numele alimentului', 'aria-label': 'Numele alimentului' });
  nume.addEventListener('input', () => actualizeazaArticolScanare(a.id, x => ({ ...x, nume: nume.value })));
  // Numele nou caută în aplicație, dar actualizează doar sursa din card (focusul rămâne unde l-ai mutat, ex. la cantitate).
  nume.addEventListener('change', () => {
    const x = scanare.articole.find(y => y.id === a.id);
    if (x && !x.potrivire && x.nume.trim()) {
      const y = actualizeazaArticolScanare(a.id, potrivesteLocalScanare);
      if (!y.potrivire) scanare.deschise.add(a.id);
      reimprospateazaCardScanare(a.id);
    }
  });
  const cantitate = el('input', { type: 'number', class: 'scan-cantitate', inputmode: 'decimal', min: '0.1', max: '3000', step: 'any', value: a.cantitate == null ? '' : String(a.cantitate), 'aria-label': `Cantitate pentru ${a.nume || 'aliment'}` });
  const unitati = unitatiArticolScanare(a);
  const unitate = el('select', { class: 'scan-unitate', 'aria-label': 'Unitatea de măsură' }, unitati.map(u => el('option', { value: u.id, text: u.nume })));
  unitate.value = unitati.some(u => u.id === a.unitate) ? a.unitate : unitati[0].id;
  const insigna = el('span', { class: 'scan-insigna' });
  const valori = el('p', { class: 'scan-valori' });
  const gramaj = el('span', { class: 'nota nota-mica scan-gramaj-text' });
  const deseneaza = x => {
    const e = etichetaGramajScanare(x.unitate === 'portie' ? { ...x, grame: x.cantitate, sursaGramaj: 'manual' } : x);
    insigna.textContent = x.unitate === 'portie' ? (x.cantitate ? 'Porții alese de tine' : 'Scrie numărul de porții') : e.text;
    insigna.className = `scan-insigna scan-insigna-${x.unitate === 'portie' ? (x.cantitate ? 'manual' : 'lipsa') : e.clasa}`;
    gramaj.textContent = [x.unitate !== 'g' && x.grame != null ? `= ${fmtNrScan(x.grame)} g` : '', textIntervalScanare(x)].filter(Boolean).join(' · ');
    const v = valoriArticolScanare(x);
    valori.textContent = v ? textValoriScanare(v) : (x.potrivire ? 'Scrie cantitatea ca să calculez valorile.' : 'Fără valori încă — alege sursa de mai jos.');
    valori.classList.toggle('scan-valori-lipsa', !v);
  };
  deseneaza(a);
  cantitate.addEventListener('input', () => { deseneaza(actualizeazaArticolScanare(a.id, x => seteazaCantitateScanare(x, cantitate.value))); actualizeazaTotalScanare(); });
  unitate.addEventListener('change', () => {
    const x = actualizeazaArticolScanare(a.id, y => seteazaUnitateScanare(y, unitate.value));
    cantitate.value = x.cantitate == null ? '' : String(x.cantitate);
    deseneaza(x); actualizeazaTotalScanare();
  });
  const prep = el('select', { class: 'scan-preparare', 'aria-label': 'Mod de preparare' }, PREPARARI_SCANARE.map(p => el('option', { value: p.id, text: p.nume })));
  prep.value = a.preparare;
  prep.addEventListener('change', () => { actualizeazaArticolScanare(a.id, x => ({ ...x, preparare: prep.value })); redeseneazaRevizuireScanare(); });
  const detalii = [
    a.vizibile.length ? `Se vede: ${a.vizibile.join(', ')}.` : '',
    a.ascunse.length ? `Poate conține, fără să se vadă: ${a.ascunse.join(', ')}.` : '',
    a.marca ? `Marca de pe ambalaj: ${a.marca}.` : '',
    a.note,
  ].filter(Boolean);
  const card = el('div', { class: `scan-aliment scan-${inc.clasa}`, 'data-id': a.id }, [
    el('div', { class: 'scan-aliment-sus' }, [
      nume,
      el('span', { class: `scan-incredere scan-incredere-${inc.clasa}`, text: inc.text }),
      buton({ icon: 'cos', tip: 'fantoma', mic: true, eticheta: `Șterge ${a.nume || 'alimentul'}`, onclick: () => { scanare.articole = scanare.articole.filter(x => x.id !== a.id); pasRevizuireScanare(); } }),
    ]),
    inc.detaliu ? el('p', { class: 'nota nota-mica scan-incredere-text', text: inc.detaliu }) : null,
    a.alternative.length ? el('div', { class: 'scan-chips' }, [
      el('span', { class: 'nota nota-mica', text: 'Poate fi:' }),
      ...a.alternative.map(alt => el('button', { type: 'button', class: 'chip', onclick: () => {
        const x = actualizeazaArticolScanare(a.id, y => potrivesteLocalScanare({ ...y, nume: alt, numeEn: '', alternative: [y.nume, ...y.alternative.filter(z => z !== alt)].slice(0, 3), incredere: 'medie', candidatiExterni: [] }));
        if (!x.potrivire) scanare.deschise.add(a.id);
        pasRevizuireScanare();
      } }, [el('span', { text: alt })])),
    ]) : null,
    el('div', { class: 'scan-aliment-jos' }, [el('div', { class: 'scan-gramaj' }, [cantitate, unitate]), prep]),
    el('div', { class: 'scan-aliment-info' }, [insigna, gramaj]),
    valori,
    blocSursaScanare(a),
    detalii.length ? el('details', { class: 'scan-detalii' }, [el('summary', { text: 'Detalii' }), ...detalii.map(t => el('p', { class: 'nota nota-mica', text: t }))]) : null,
  ]);
  card.reimprospateaza = () => {
    const x = scanare.articole.find(y => y.id === a.id);
    if (!x) return;
    const u = unitatiArticolScanare(x);
    unitate.replaceChildren(...u.map(v => el('option', { value: v.id, text: v.nume })));
    unitate.value = u.some(v => v.id === x.unitate) ? x.unitate : u[0].id;
    card.querySelector('.scan-sursa-bloc').replaceWith(blocSursaScanare(x));
    deseneaza(x);
  };
  return card;
}

function reimprospateazaCardScanare(id) {
  const card = zonaScanare() && zonaScanare().querySelector(`.scan-aliment[data-id="${id}"]`);
  if (card && card.reimprospateaza) card.reimprospateaza(); else redeseneazaRevizuireScanare();
  actualizeazaTotalScanare();
}

const TEXT_CAUTARE_SCAN = { cauta: 'Caut valorile în USDA…', alege: 'Am găsit mai multe variante — alege una.', negasit: 'Nu am găsit o potrivire sigură. Caută alt nume sau scrie valorile.', eroare: 'Căutarea nu a reușit. Alege din aplicație sau scrie valorile.', gol: 'Scrie numele, apoi alege sursa valorilor.' };

// Sursa valorilor + lista de variante (din aplicație și din USDA / Open Food Facts) + căutare + valori scrise de tine.
function blocSursaScanare(a) {
  const p = a.potrivire;
  const deschis = scanare.deschise.has(a.id);
  const comuta = () => { if (deschis) scanare.deschise.delete(a.id); else scanare.deschise.add(a.id); redeseneazaRevizuireScanare(); };
  const av = avertizariPotrivireScanare(a);
  const cap = p ? el('div', { class: `scan-sursa scan-sursa-${p.tip}` }, [
    el('div', { class: 'scan-sursa-text' }, [
      el('span', { class: 'scan-sursa-eticheta', text: p.eticheta }),
      el('span', { class: 'scan-sursa-nume', text: p.nume }),
      p.detaliu ? el('span', { class: 'nota nota-mica', text: p.detaliu + (p.preluat ? ` · preluat ${p.preluat}` : '') }) : null,
      p.url ? el('a', { href: p.url, target: '_blank', rel: 'noopener', class: 'nota nota-mica', text: 'Vezi înregistrarea la sursă' }) : null,
    ]),
    buton({ text: deschis ? 'Gata' : 'Schimbă', tip: 'fantoma', mic: true, eticheta: `Schimbă sursa valorilor pentru ${a.nume || 'aliment'}`, onclick: comuta }),
  ]) : el('div', { class: 'scan-sursa scan-sursa-lipsa' }, [
    el('span', { class: 'scan-sursa-text' }, [a.stareCautare === 'cauta' ? el('span', { class: 'scan-rotita scan-rotita-mica', 'aria-hidden': 'true' }) : null, el('span', { text: TEXT_CAUTARE_SCAN[a.stareCautare] || TEXT_CAUTARE_SCAN.gol })]),
    a.stareCautare !== 'cauta' ? buton({ text: deschis ? 'Gata' : 'Alege valorile', tip: deschis ? 'fantoma' : 'secundar', mic: true, onclick: comuta }) : null,
  ]);
  return el('div', { class: 'scan-sursa-bloc' }, [
    cap,
    av.length ? el('ul', { class: 'scan-avertizari' }, av.map(t => el('li', { text: t }))) : null,
    deschis ? panouPotriviriScanare(a) : null,
  ]);
}

function randPotrivireScanare(a, c) {
  const activ = a.potrivire && a.potrivire.tip === c.tip && a.potrivire.id === c.id;
  const val = c.tip === 'reteta' ? `${Math.round(c.valoriPortie.kcal)} kcal / porție` : `${Math.round(c.per100.kcal)} kcal / 100 g`;
  return el('button', { type: 'button', class: 'scan-varianta' + (activ ? ' activ' : ''), 'aria-pressed': activ ? 'true' : 'false', onclick: () => {
    actualizeazaArticolScanare(a.id, x => aplicaPotrivireScanare(x, c));
    scanare.deschise.delete(a.id);
    redeseneazaRevizuireScanare();
  } }, [
    el('span', { class: 'scan-varianta-nume', text: c.nume }),
    el('span', { class: 'nota nota-mica', text: `${c.eticheta} · ${val}${c.marca ? ` · ${c.marca}` : ''}` }),
    (c.avertizari || []).length && c.tip !== 'reteta' ? el('span', { class: 'nota nota-mica scan-varianta-atentie', text: c.avertizari[0] }) : null,
  ]);
}

function panouPotriviriScanare(a) {
  const variante = [...(a.candidatiLocali || []), ...(a.candidatiExterni || [])];
  const cauta = el('input', { type: 'search', class: 'scan-cauta', maxlength: '80', value: a.cautareText || a.numeEn || a.nume, 'aria-label': 'Caută alt aliment', placeholder: 'ex.: chicken breast roasted / piept de pui' });
  const ruleaza = () => {
    const t = cauta.value.trim();
    if (t.length < 2) return;
    actualizeazaArticolScanare(a.id, x => ({ ...x, cautareText: t, candidatiLocali: cautaLocalScanare(t, x, toateAlimentele(), toateRetetele(), indexNutritie), candidatiExterni: [], stareCautare: x.potrivire ? 'gata' : 'cauta' }));
    redeseneazaRevizuireScanare();
    cautaExternScanare([a.id], t);
  };
  cauta.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ruleaza(); } });
  const manual = scanare.manualDeschis === a.id;
  return el('div', { class: 'scan-potriviri' }, [
    variante.length ? el('div', { class: 'scan-variante', role: 'group', 'aria-label': 'Variante găsite' }, variante.map(c => randPotrivireScanare(a, c)))
      : el('p', { class: 'nota nota-mica', text: a.stareCautare === 'cauta' ? 'Caut…' : 'Nicio variantă găsită încă.' }),
    el('div', { class: 'scan-cauta-rand' }, [cauta, buton({ text: 'Caută', icon: 'cauta', tip: 'secundar', mic: true, onclick: ruleaza })]),
    el('p', { class: 'nota nota-mica', text: 'Caută întâi în aplicație, apoi în USDA (în engleză se găsește mai mult). Starea contează: „cooked/roasted” ≠ „raw”.' }),
    manual ? formularValoriScanare(a) : buton({ text: 'Scriu eu valorile (de pe etichetă)', icon: 'editeaza', tip: 'fantoma', mic: true, onclick: () => { scanare.manualDeschis = a.id; redeseneazaRevizuireScanare(); } }),
  ]);
}

function formularValoriScanare(a) {
  const camp = (cheie, et) => el('label', { class: 'scan-manual-camp' }, [el('span', { class: 'nota nota-mica', text: et }), el('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', 'data-camp': cheie, 'aria-label': `${et} la 100 g` })]);
  const f = el('div', { class: 'scan-manual' }, [
    el('p', { class: 'nota nota-mica', text: 'Valorile la 100 g (de pe eticheta produsului):' }),
    el('div', { class: 'scan-manual-campuri' }, [camp('kcal', 'kcal'), camp('proteine', 'Proteine g'), camp('carbohidrati', 'Carbohidrați g'), camp('grasimi', 'Grăsimi g'), camp('fibre', 'Fibre g')]),
    el('p', { class: 'scan-eroare-mica', role: 'alert' }),
    el('div', { class: 'scan-manual-butoane' }, [
      buton({ text: 'Renunță', tip: 'fantoma', mic: true, onclick: () => { scanare.manualDeschis = null; redeseneazaRevizuireScanare(); } }),
      buton({ text: 'Folosește valorile', tip: 'principal', mic: true, onclick: () => {
        const v = {};
        f.querySelectorAll('input[data-camp]').forEach(i => { v[i.dataset.camp] = i.value; });
        const p = potrivireManualaScanare(v);
        if (!p) { f.querySelector('.scan-eroare-mica').textContent = 'Completează kcal, proteine, carbohidrați și grăsimi (la 100 g, valori posibile).'; return; }
        actualizeazaArticolScanare(a.id, x => aplicaPotrivireScanare(x, p));
        scanare.manualDeschis = null; scanare.deschise.delete(a.id);
        redeseneazaRevizuireScanare();
      } }),
    ]),
  ]);
  return f;
}

// Butonul mare de pe Acasă (MEAL PREP).
function cardScanareAcasa() {
  return el('button', { type: 'button', class: 'scan-buton-acasa', onclick: deschideScanare }, [
    el('span', { class: 'scan-buton-icon' }, [iconita('camera')]),
    el('span', { class: 'scan-buton-text' }, [el('strong', { text: 'Fotografiază masa' }), el('span', { text: 'recunoaștere AI · tu verifici înainte de orice salvare' })]),
    iconita('sageata', 'iconita mica'),
  ]);
}
