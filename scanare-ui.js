// Scanarea meselor — ecranele (etapa 1: poză → analiză → alimente și gramaje de verificat).
// Logica (validare, gramaje, mesaje de eroare, cache) e în scanare.js; serverul în supabase/functions/scanare.

const scanare = { ctrl: null, fisier: null, imagine: null, url: null, rezultat: null, articole: [], nota: '', cerere: null, inCurs: false };

function deschideScanare() {
  inchideResurseScanare();
  Object.assign(scanare, { fisier: null, imagine: null, rezultat: null, articole: [], nota: '', cerere: null, inCurs: false });
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
  const cheieCache = amprenta ? `${amprenta}:${scanare.nota.trim()}` : null;
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
  scanare.articole = scanare.rezultat.articole;
  pasRevizuireScanare();
}

// Ecranul 4: alimentele recunoscute — nume, încredere, gramaj (editabil), preparare, variante.
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
  const lista = el('div', { class: 'scan-lista' }, scanare.articole.map(cardArticolScanare));
  const ascunse = ascunseDeAdaugat(scanare.articole);
  puneInZona(zona, 
    el('div', { class: 'scan-antet' }, [
      el('img', { class: 'scan-poza scan-poza-mica', src: scanare.url, alt: 'Poza analizată' }),
      el('div', {}, [
        el('strong', { text: scanare.articole.length ? `${plural(scanare.articole.length, 'aliment recunoscut', 'alimente recunoscute')}` : 'Niciun aliment în listă' }),
        el('p', { class: 'nota', text: 'Verifică numele și gramajele. Gramajele sunt estimate din poză, nu cântărite.' }),
      ]),
    ]),
    r.calitate === 'slaba' ? el('p', { class: 'scan-atentie', text: 'Poza e neclară sau întunecată; verifică atent fiecare aliment.' }) : null,
    r.observatii ? el('p', { class: 'nota scan-observatii', text: r.observatii }) : null,
    r.eliminate ? el('p', { class: 'nota nota-mica', text: `${plural(r.eliminate, 'element', 'elemente')} din răspunsul AI nu au avut formatul corect și au fost ignorate.` }) : null,
    lista,
    ascunse.length ? el('div', { class: 'scan-ascunse' }, [
      el('p', { class: 'nota', text: 'Poate conține și ingrediente care nu se văd. Adaugă-le dacă știi că sunt:' }),
      el('div', { class: 'scan-chips' }, ascunse.map(x => el('button', { type: 'button', class: 'chip', onclick: () => adaugaArticolScanare(x) }, [iconita('plus', 'iconita mica'), el('span', { text: x })]))),
    ]) : null,
    buton({ text: 'Adaugă un aliment', icon: 'plus', tip: 'secundar', lat: true, onclick: () => adaugaArticolScanare('') }),
    el('p', { class: 'scan-urmeaza nota nota-mica', text: 'În lucru: caloriile din baza de date și salvarea în ziua ta vin în etapa următoare. Deocamdată lista nu se salvează.' }),
    r.utilizare ? el('p', { class: 'nota nota-mica', text: `Scanări azi: ${r.utilizare.azi} din ${r.utilizare.limita}${r.dinCache ? ' (rezultat refolosit, fără o scanare nouă)' : ''}.` })
      : (r.dinCache ? el('p', { class: 'nota nota-mica', text: 'Rezultat refolosit pentru aceeași poză, fără o scanare nouă.' }) : null),
  );
  butoaneScanare(
    buton({ text: 'Închide', tip: 'fantoma', onclick: inchideScanare }),
    buton({ text: 'Altă poză', icon: 'camera', tip: 'secundar', onclick: () => pasAlegereScanare() }),
  );
}

function adaugaArticolScanare(nume) {
  const a = articolManualScanare(nume);
  scanare.articole = [...scanare.articole, a];
  pasRevizuireScanare();
  const camp = zonaScanare().querySelector(`[data-id="${a.id}"] ${nume ? '.scan-grame' : '.scan-nume'}`);
  if (camp) setTimeout(() => { camp.focus(); camp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
}

function actualizeazaArticolScanare(id, f) {
  scanare.articole = scanare.articole.map(a => (a.id === id ? f(a) : a));
  return scanare.articole.find(a => a.id === id);
}

function cardArticolScanare(a) {
  const inc = INCREDERI_SCANARE[a.incredere] || INCREDERI_SCANARE.scazuta;
  const nume = el('input', { type: 'text', class: 'scan-nume', maxlength: '80', value: a.nume, placeholder: 'Numele alimentului', 'aria-label': 'Numele alimentului' });
  nume.addEventListener('input', () => actualizeazaArticolScanare(a.id, x => ({ ...x, nume: nume.value })));
  const grame = el('input', { type: 'number', class: 'scan-grame', inputmode: 'numeric', min: '1', max: '3000', step: '1', value: a.grame == null ? '' : String(a.grame), 'aria-label': `Gramaj pentru ${a.nume || 'aliment'}` });
  const insigna = el('span', { class: 'scan-insigna' });
  const deseneazaInsigna = x => { const e = etichetaGramajScanare(x); insigna.textContent = e.text; insigna.className = `scan-insigna scan-insigna-${e.clasa}`; };
  deseneazaInsigna(a);
  grame.addEventListener('input', () => deseneazaInsigna(actualizeazaArticolScanare(a.id, x => seteazaGrameScanare(x, grame.value))));
  const prep = el('select', { 'aria-label': 'Mod de preparare' }, PREPARARI_SCANARE.map(p => el('option', { value: p.id, text: p.nume })));
  prep.value = a.preparare;
  prep.addEventListener('change', () => actualizeazaArticolScanare(a.id, x => ({ ...x, preparare: prep.value })));
  const detalii = [
    a.vizibile.length ? `Se vede: ${a.vizibile.join(', ')}.` : '',
    a.ascunse.length ? `Poate conține, fără să se vadă: ${a.ascunse.join(', ')}.` : '',
    a.marca ? `Marca de pe ambalaj: ${a.marca}.` : '',
    a.note,
  ].filter(Boolean);
  return el('div', { class: `scan-aliment scan-${inc.clasa}`, 'data-id': a.id }, [
    el('div', { class: 'scan-aliment-sus' }, [
      nume,
      el('span', { class: `scan-incredere scan-incredere-${inc.clasa}`, text: inc.text }),
      buton({ icon: 'cos', tip: 'fantoma', mic: true, eticheta: `Șterge ${a.nume || 'alimentul'}`, onclick: () => { scanare.articole = scanare.articole.filter(x => x.id !== a.id); pasRevizuireScanare(); } }),
    ]),
    inc.detaliu ? el('p', { class: 'nota nota-mica scan-incredere-text', text: inc.detaliu }) : null,
    a.alternative.length ? el('div', { class: 'scan-chips' }, [
      el('span', { class: 'nota nota-mica', text: 'Poate fi:' }),
      ...a.alternative.map(alt => el('button', { type: 'button', class: 'chip', onclick: () => {
        actualizeazaArticolScanare(a.id, x => ({ ...x, nume: alt, alternative: [x.nume, ...x.alternative.filter(y => y !== alt)].slice(0, 3), incredere: 'medie' }));
        pasRevizuireScanare();
      } }, [el('span', { text: alt })])),
    ]) : null,
    el('div', { class: 'scan-aliment-jos' }, [
      el('label', { class: 'scan-gramaj' }, [grame, el('span', { class: 'nota', text: 'g' })]),
      prep,
    ]),
    el('div', { class: 'scan-aliment-info' }, [insigna, a.grameEstimat != null ? el('span', { class: 'nota nota-mica', text: textIntervalScanare(a) }) : null]),
    detalii.length ? el('details', { class: 'scan-detalii' }, [el('summary', { text: 'Detalii' }), ...detalii.map(t => el('p', { class: 'nota nota-mica', text: t }))]) : null,
  ]);
}

// Butonul mare de pe Acasă (MEAL PREP).
function cardScanareAcasa() {
  return el('button', { type: 'button', class: 'scan-buton-acasa', onclick: deschideScanare }, [
    el('span', { class: 'scan-buton-icon' }, [iconita('camera')]),
    el('span', { class: 'scan-buton-text' }, [el('strong', { text: 'Fotografiază masa' }), el('span', { text: 'recunoaștere AI · tu verifici înainte de orice salvare' })]),
    iconita('sageata', 'iconita mica'),
  ]);
}
