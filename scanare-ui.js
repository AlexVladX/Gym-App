// Scanarea meselor — ecranele (etapa 1: poză → analiză → alimente și gramaje de verificat).
// Logica (validare, gramaje, mesaje de eroare, cache) e în scanare.js; serverul în supabase/functions/scanare.

const scanare = { ctrl: null, fisier: null, imagine: null, url: null, rezultat: null, articole: [], nota: '', cerere: null, inCurs: false, deschise: new Set(), avertizariCautare: [], manualDeschis: null };

// tinta (opțional): { masa, data } când pornești din „Ziua mea” pentru o masă anume.
function deschideScanare(tinta = null) {
  inchideResurseScanare();
  Object.assign(scanare, { faraPoza: false, fisier: null, imagine: null, rezultat: null, articole: [], nota: '', cerere: null, inCurs: false, deschise: new Set(), avertizariCautare: [], manualDeschis: null, tinta: tinta && typeof tinta === 'object' && !(tinta instanceof Event) ? tinta : null, salvare: null, probleme: [] });
  const zona = el('div', { class: 'scan-zona' });
  scanare.ctrl = deschideDialog({
    titlu: 'Fotografiază masa', continut: zona, butoane: [],
    laAnulare: () => { if (scanare.cerere) scanare.cerere.abort(); inchideResurseScanare(); },
  });
  scanare.ctrl.caseta.classList.add('dialog-scanare');
  pasAlegereScanare();
}

// „Adaugă un aliment”: același ecran de verificare, fără poză și fără AI — cauți alimentul, alegi cantitatea, salvezi.
function deschideAdaugareAlimente(tinta = null) {
  if (scanare.ctrl && dialogDeschis === scanare.ctrl) scanare.ctrl.inchide();
  inchideResurseScanare();
  Object.assign(scanare, { fisier: null, imagine: null, articole: [], nota: '', cerere: null, inCurs: false, deschise: new Set(), avertizariCautare: [], manualDeschis: null,
    tinta: tinta && typeof tinta === 'object' && !(tinta instanceof Event) ? tinta : null, salvare: null, probleme: [], faraPoza: true, tokeni: null,
    cautareRapida: '', rezultateExterne: null,
    rezultat: { esteMancare: true, portieIndividuala: true, calitate: 'buna', observatii: '', eliminate: 0, articole: [], utilizare: null } });
  const zona = el('div', { class: 'scan-zona' });
  scanare.ctrl = deschideDialog({ titlu: 'Adaugă alimente', continut: zona, butoane: [], laAnulare: () => inchideResurseScanare() });
  scanare.ctrl.caseta.classList.add('dialog-scanare');
  pasRevizuireScanare();
  const c = zona.querySelector('.scan-cauta-aliment input');
  if (c) setTimeout(() => c.focus(), 60);
}

function inchideResurseScanare() {
  if (scanare.url) URL.revokeObjectURL(scanare.url);
  scanare.url = null;
  for (const u of scanare.urluriRecente || []) URL.revokeObjectURL(u);
  scanare.urluriRecente = [];
}

// Pașii fluxului, sub titlu: Poză → Analiză → Verificare → Salvare.
const PASI_SCANARE = ['Poză', 'Analiză', 'Verificare', 'Salvare'];
function pasScanare(n) {
  if (!scanare.ctrl) return;
  if (scanare.faraPoza) { const b = scanare.ctrl.caseta.querySelector('.scan-pasi'); if (b) b.remove(); return; }
  let bara = scanare.ctrl.caseta.querySelector('.scan-pasi');
  if (!bara) { bara = el('ol', { class: 'scan-pasi', 'aria-label': 'Pașii scanării' }); scanare.ctrl.caseta.querySelector('h2').after(bara); }
  bara.replaceChildren(...PASI_SCANARE.map((t, k) => el('li', { class: k + 1 < n ? 'gata' : k + 1 === n ? 'activ' : '', 'aria-current': k + 1 === n ? 'step' : null, text: t })));
}

function zonaScanare() { return scanare.ctrl && scanare.ctrl.caseta.querySelector('.scan-zona'); }
// replaceChildren(null) ar scrie textul „null”; elementele opționale lipsă se sar.
function puneInZona(zona, ...copii) { if (zona) zona.replaceChildren(...copii.filter(Boolean)); }
function butoaneScanare(...b) { if (scanare.ctrl) scanare.ctrl.caseta.querySelector('.dialog-butoane').replaceChildren(...b.filter(Boolean)); }
function inchideScanare() { if (scanare.ctrl) scanare.ctrl.inchide(() => { if (scanare.cerere) scanare.cerere.abort(); inchideResurseScanare(); }); }

// Ecranul 1: cameră sau galerie.
function pasAlegereScanare(eroare = '') {
  pasScanare(1);
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
    buton({ text: 'Fără poză: caută alimentul (ex. un măr)', icon: 'cauta', tip: 'secundar', lat: true, onclick: () => deschideAdaugareAlimente(scanare.tinta) }),
    camera, galerie,
    el('ul', { class: 'scan-sfaturi nota' }, [
      el('li', { text: 'Fotografiază de sus, cu toată farfuria în cadru și lumină bună.' }),
      el('li', { text: 'Alimentele separate se recunosc mai bine decât cele amestecate.' }),
      el('li', { text: 'Gramajele vor fi estimate din poză; le poți corecta înainte de orice salvare.' }),
    ]),
  );
  butoaneScanare(buton({ text: 'Închide', tip: 'fantoma', onclick: inchideScanare }));
  if (typeof blocScanariRecente === 'function') {
    const zona = zonaScanare();
    blocScanariRecente().then(b => {
      if (!b) return;
      if (zonaScanare() !== zona || !zona.querySelector('.scan-alegeri') || zona.querySelector('.scan-recente')) { (b.urluri || []).forEach(u => URL.revokeObjectURL(u)); return; }
      zona.append(b);
      scanare.urluriRecente = b.urluri || [];
    });
  }
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
  pasScanare(1);
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
  const cheieCacheVerif = amprenta ? `p4:${amprenta}:${scanare.nota.trim()}` : null;
  const limitaMea = typeof limitaProprieAtinsa === 'function' ? limitaProprieAtinsa() : null;
  if (limitaMea && !(cheieCacheVerif && citesteCacheScanare(localStorage, cheieCacheVerif))) return pasPrevizualizareScanare(mesajEroareScanare(limitaMea));
  const cheieCache = amprenta ? `p4:${amprenta}:${scanare.nota.trim()}` : null;
  const dinCache = cheieCache ? citesteCacheScanare(localStorage, cheieCache) : null;
  if (dinCache) return arataRezultatScanare(dinCache, true);

  scanare.inCurs = true;
  pasScanare(2);
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
    if (typeof noteazaScanareReusita === 'function') noteazaScanareReusita(raspuns);
    scanare.tokeni = raspuns && raspuns.tokeni ? raspuns.tokeni : null;
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
  // Un produs ambalat cu marcă se caută întâi exact (Open Food Facts / USDA Branded); varianta generică rămâne în listă.
  const ales = a.ambalat && a.marca ? null : alegeLocalScanare(locali);
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
  pasScanare(3);
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
  if (scanare.faraPoza) {
    puneInZona(zona,
      blocCautareAlimentScanare(),
      scanare.articole.length ? blocTotalScanare() : el('p', { class: 'nota', text: 'Caută un aliment (ex. „măr”), alege-l, apoi scrie cantitatea. Poți adăuga mai multe în aceeași masă.' }),
      scanare.avertizariCautare.length ? el('div', { class: 'scan-atentie' }, scanare.avertizariCautare.map(t => el('p', { text: t }))) : null,
      el('div', { class: 'scan-lista' }, scanare.articole.map(cardArticolScanare)),
      scanare.probleme.length ? el('div', { class: 'scan-eroare scan-probleme', role: 'alert' }, [el('strong', { text: 'Înainte de salvare:' }), el('ul', {}, scanare.probleme.map(t => el('li', { text: t })))]) : null,
    );
    butoaneScanare(
      scanare.articole.length ? buton({ text: textButonSalvareScanare(), icon: 'bifa', tip: 'principal', lat: true, onclick: incearcaSalvareScanare }) : null,
      buton({ text: 'Închide', tip: 'fantoma', lat: true, onclick: inchideScanare }),
    );
    return;
  }
  puneInZona(zona,
    el('div', { class: 'scan-antet' }, [
      el('img', { class: 'scan-poza scan-poza-mica', src: scanare.url, alt: 'Poza analizată' }),
      el('div', {}, [
        el('strong', { text: scanare.articole.length ? `${plural(scanare.articole.length, 'aliment', 'alimente')}` : 'Niciun aliment în listă' }),
        el('p', { class: 'nota', text: 'Verifică numele, cantitățile și sursa valorilor. Gramajele sunt estimate din poză, nu cântărite.' }),
      ]),
    ]),
    blocTotalScanare(),
    !r.portieIndividuala ? el('div', { class: 'scan-atentie', role: 'note' }, [
      el('strong', { text: 'Poza arată un bufet sau o masă comună, nu porția ta.' }),
      el('p', { text: 'Gramajele de mai jos sunt pentru tot ce se vede. Pentru caloriile tale, fotografiază farfuria ta — sau schimbă cantitățile la cât ai mâncat.' }),
    ]) : null,
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
    scanare.probleme.length ? el('div', { class: 'scan-eroare scan-probleme', role: 'alert' }, [el('strong', { text: 'Înainte de salvare:' }), el('ul', {}, scanare.probleme.map(t => el('li', { text: t })))]) : null,
    r.utilizare ? el('p', { class: 'nota nota-mica', text: `Scanări azi: ${r.utilizare.azi} din ${r.utilizare.limita}${r.dinCache ? ' (rezultat refolosit, fără o scanare nouă)' : ''}.` })
      : (r.dinCache ? el('p', { class: 'nota nota-mica', text: 'Rezultat refolosit pentru aceeași poză, fără o scanare nouă.' }) : null),
  );
  butoaneScanare(
    buton({ text: textButonSalvareScanare(), icon: 'bifa', tip: 'principal', lat: true, onclick: incearcaSalvareScanare }),
    buton({ text: 'Altă poză', icon: 'camera', tip: 'fantoma', lat: true, onclick: () => pasAlegereScanare() }),
  );
}

// Căutarea unui aliment: întâi în aplicație (pe loc), apoi, la cerere, în USDA / Open Food Facts.
function blocCautareAlimentScanare() {
  const rezultate = el('div', { class: 'scan-variante scan-rezultate-aliment', role: 'group', 'aria-label': 'Rezultate' });
  const input = el('input', { type: 'search', value: scanare.cautareRapida, maxlength: '80', placeholder: 'ex.: măr, iaurt grecesc, nuci', 'aria-label': 'Caută un aliment', autocomplete: 'off' });
  const deseneaza = () => {
    const t = scanare.cautareRapida.trim();
    if (t.length < 2) { rezultate.replaceChildren(); return; }
    const locale = cautaLocalScanare(t, { preparare: 'necunoscut' }, toateAlimentele(), toateRetetele(), indexNutritie);
    const ext = scanare.rezultateExterne && scanare.rezultateExterne.text === t ? scanare.rezultateExterne : null;
    const lista = [...locale, ...(ext ? ext.candidati : [])];
    puneInZona(rezultate,
      ...lista.map(c => el('button', { type: 'button', class: 'scan-varianta', onclick: () => adaugaAlimentGasitScanare(c, t) }, [
        el('span', { class: 'scan-varianta-nume', text: c.nume }),
        el('span', { class: 'nota nota-mica', text: `${c.eticheta} · ${c.tip === 'reteta' ? `${Math.round(c.valoriPortie.kcal)} kcal / porție` : `${Math.round(c.per100.kcal)} kcal / 100 g`}${c.portii && c.portii[0] ? ` · ${c.portii[0].unu ? `1 ${c.portii[0].unu}` : c.portii[0].nume} ≈ ${Math.round(c.portii[0].grame)} g` : ''}` }),
      ])),
      ext && !ext.candidati.length ? el('p', { class: 'nota nota-mica', text: 'Nimic în USDA pentru acest nume. Încearcă în engleză (ex. „apple, raw”) sau scrie valorile de pe etichetă după ce adaugi alimentul.' }) : null,
      ext && ext.eroare ? el('p', { class: 'nota nota-mica', text: ext.eroare }) : null,
      !ext ? buton({ text: ext === null && scanare.rezultateExterne && scanare.rezultateExterne.inCurs === t ? 'Caut în USDA…' : `Caută „${t}” și în USDA`, icon: 'cauta', tip: 'fantoma', mic: true, onclick: () => cautaAlimentExternScanare(t) }) : null,
      el('button', { type: 'button', class: 'scan-varianta scan-varianta-noua', onclick: () => { const a = { ...initializeazaCantitateScanare(articolManualScanare(t)), candidatiLocali: locale, candidatiExterni: ext ? ext.candidati : [], potrivire: null, stareCautare: 'alege' }; scanare.articole = [...scanare.articole, a]; scanare.deschise.add(a.id); scanare.cautareRapida = ''; scanare.manualDeschis = a.id; pasRevizuireScanare(); } }, [
        el('span', { class: 'scan-varianta-nume', text: `„${t}” cu valori scrise de tine` }), el('span', { class: 'nota nota-mica', text: 'de pe etichetă, la 100 g' }),
      ]),
    );
  };
  input.addEventListener('input', () => { scanare.cautareRapida = input.value; deseneaza(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const prim = rezultate.querySelector('.scan-varianta'); if (prim) prim.click(); } });
  deseneaza();
  return el('div', { class: 'scan-cauta-aliment' }, [el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: scanare.articole.length ? 'Adaugă încă un aliment' : 'Caută un aliment' }), input]), rezultate]);
}

async function cautaAlimentExternScanare(text) {
  if (!sinc.utilizator || !sinc.adaptor || typeof sinc.adaptor.functie !== 'function' || navigator.onLine === false) {
    scanare.rezultateExterne = { text, candidati: [], eroare: navigator.onLine === false ? 'Fără internet: caută doar în aplicație.' : 'Căutarea în USDA cere contul din cloud (Setări → Cont).' };
    return redeseneazaRevizuireScanare();
  }
  scanare.rezultateExterne = { inCurs: text };
  redeseneazaRevizuireScanare();
  const cerere = { id: 'r', text, ambalat: false, marca: '' };
  let lista = citesteCacheCautari(localStorage, cheieCautareScanare(cerere));
  let eroare = '';
  if (!lista) {
    try {
      const r = await sinc.adaptor.functie('scanare', { actiune: 'cauta', cereri: [cerere] });
      lista = (r && r.rezultate && r.rezultate[0] && r.rezultate[0].candidati) || [];
      if (r && r.avertizari && r.avertizari.length) eroare = r.avertizari[0]; else scrieCacheCautari(localStorage, cheieCautareScanare(cerere), lista);
    } catch (err) { lista = []; eroare = mesajEroareScanare(err).text || 'Căutarea nu a reușit.'; }
  }
  if (!scanare.ctrl || dialogDeschis !== scanare.ctrl) return;
  const { candidati } = ordoneazaExterneScanare({ nume: text, numeEn: text, preparare: 'necunoscut' }, lista);
  scanare.rezultateExterne = { text, candidati, eroare };
  redeseneazaRevizuireScanare();
}

// Alimentul ales intră în listă cu o cantitate de pornire: 1 bucată dacă are greutatea unei bucăți, 1 porție la rețete, altfel 100 g.
function adaugaAlimentGasitScanare(p, textCautat) {
  const nume = p.tip === 'local' || p.tip === 'reteta' ? p.nume : (textCautat.charAt(0).toUpperCase() + textCautat.slice(1));
  let a = { ...initializeazaCantitateScanare(articolManualScanare(nume)), candidatiLocali: [], candidatiExterni: [], stareCautare: 'gata' };
  a = aplicaPotrivireScanare({ ...a, unitate: 'g', cantitate: 100, grame: 100 }, p);
  if (p.tip !== 'reteta' && p.portii && p.portii[0]) a = { ...a, unitate: 'p0', cantitate: 1, grame: Math.round(p.portii[0].grame * 10) / 10 };
  a = { ...a, sursaGramaj: 'manual' };
  scanare.articole = [...scanare.articole, a];
  scanare.cautareRapida = '';
  scanare.rezultateExterne = null;
  scanare.probleme = [];
  pasRevizuireScanare();
  const c = zonaScanare().querySelector(`[data-id="${a.id}"] .scan-cantitate`);
  if (c) setTimeout(() => { c.focus(); c.select(); }, 30);
}

function textButonSalvareScanare() {
  const data = (scanare.tinta && scanare.tinta.data) || dataLocala();
  return data === dataLocala() ? 'Adaugă la nutriția de azi' : `Adaugă în ${afiseazaData(data)}`;
}

function incearcaSalvareScanare() {
  scanare.probleme = problemeSalvareScanare(scanare.articole);
  if (scanare.probleme.length) {
    redeseneazaRevizuireScanare();
    const b = zonaScanare().querySelector('.scan-probleme');
    if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  pasConfirmareScanare();
}

// Ecranul 5: confirmarea — masa, numele, data și ora. Abia aici se salvează.
function pasConfirmareScanare() {
  pasScanare(4);
  const acum = new Date();
  const oraAcum = `${String(acum.getHours()).padStart(2, '0')}:${String(acum.getMinutes()).padStart(2, '0')}`;
  const t = scanare.tinta || {};
  const st = scanare.salvare || { masa: t.masa || masaImplicitaScanare(oraAcum), nume: numeImplicitScanare(scanare.articole), data: t.data || dataLocala(), ora: oraAcum };
  scanare.salvare = st;
  const total = totalScanare(scanare.articole);
  const chipuri = el('div', { class: 'scan-chips scan-mese', role: 'radiogroup', 'aria-label': 'Masa' });
  const deseneazaChipuri = () => chipuri.replaceChildren(...MESE_TOATE.map(m => el('button', {
    type: 'button', class: 'chip' + (st.masa === m.id ? ' activ' : ''), role: 'radio', 'aria-checked': String(st.masa === m.id),
    onclick: () => { st.masa = m.id; deseneazaChipuri(); },
  }, [el('span', { text: m.nume })])));
  deseneazaChipuri();
  const nume = el('input', { type: 'text', maxlength: '80', value: st.nume, class: 'scan-confirmare-nume', 'aria-label': 'Numele mesei' });
  nume.addEventListener('input', () => { st.nume = nume.value; });
  const data = el('input', { type: 'date', value: st.data, max: mutaData(dataLocala(), 7), 'aria-label': 'Data' });
  data.addEventListener('change', () => { if (/^\d{4}-\d{2}-\d{2}$/.test(data.value)) { st.data = data.value; butoaneConfirmare(); } });
  const ora = el('input', { type: 'time', value: st.ora, 'aria-label': 'Ora' });
  ora.addEventListener('change', () => { st.ora = ora.value; });
  const fmt = x => String(x).replace('.', ',');
  puneInZona(zonaScanare(),
    el('div', { class: 'scan-antet' }, [
      scanare.url ? el('img', { class: 'scan-poza scan-poza-mica', src: scanare.url, alt: 'Poza mesei' }) : el('span', { class: 'scan-istoric-img scan-istoric-fara' }, [iconita('nutritie')]),
      el('div', {}, [
        el('strong', { text: `${total.valori.kcal} kcal` }),
        el('p', { class: 'nota', text: `P ${fmt(total.valori.proteine)} g · C ${fmt(total.valori.carbohidrati)} g · G ${fmt(total.valori.grasimi)} g · ${plural(scanare.articole.length, 'aliment', 'alimente')}` }),
      ]),
    ]),
    panouNutritional(total.valori, 'în total'),
    el('div', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Masa' }), chipuri]),
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Numele mesei' }), nume]),
    el('div', { class: 'scan-data-ora' }, [
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Data' }), data]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Ora' }), ora]),
    ]),
    el('ul', { class: 'scan-rezumat nota nota-mica' }, scanare.articole.map(a => {
      const v = valoriArticolScanare(a);
      return el('li', {}, [el('span', { text: `${a.nume} · ${fmt(a.cantitate)} ${a.unitate === 'g' ? 'g' : (unitatiArticolScanare(a).find(u => u.id === a.unitate) || {}).nume || ''}`.trim() }), el('b', { text: `${Math.round(v.kcal)} kcal` })]);
    })),
    el('p', { class: 'nota nota-mica', text: 'Se salvează ca „Mâncată”, cu valorile de acum ale fiecărui aliment. Dacă un aliment din bibliotecă se schimbă mai târziu, masa aceasta rămâne la fel. O poți edita sau șterge din „Ziua mea”.' }),
  );
  const butoaneConfirmare = () => butoaneScanare(
    buton({ text: st.data === dataLocala() ? 'Adaugă la nutriția de azi' : `Adaugă în ${afiseazaData(st.data)}`, icon: 'bifa', tip: 'principal', lat: true, onclick: salveazaScanareInZi }),
    buton({ text: 'Înapoi', tip: 'fantoma', lat: true, onclick: () => pasRevizuireScanare() }),
  );
  butoaneConfirmare();
  scanare.ctrl.caseta.scrollTop = 0;
}

async function salveazaScanareInZi() {
  if (scanare.salvareInCurs) return;
  const st = scanare.salvare;
  let intrare;
  try {
    const articole = scanare.articole.map(instantaneuArticolScanare);
    if (articole.some(x => !x)) throw new Error('Unele alimente nu au valori complete.');
    intrare = intrareDinScanare({ id: idNutritieNou(), masa: st.masa, nume: st.nume, articole, ora: st.ora, portieIndividuala: scanare.rezultat.portieIndividuala, sursa: scanare.faraPoza ? 'alimente' : 'scanare' });
  } catch (err) { notifica(err.message, 'eroare'); return; }
  scanare.salvareInCurs = true;
  try {
    const zi = (await citesteZiNutritieSalvata(st.data)) || { data: st.data, mese: [] };
    await salveazaZiNutritie({ ...zi, data: st.data, mese: [...zi.mese, intrare] });
  } catch (err) {
    console.error(err);
    scanare.salvareInCurs = false;
    notifica(mesajEroareSalvare(err, 'Masa nu a putut fi salvată. Încearcă din nou.'), 'eroare');
    return;
  }
  scanare.salvareInCurs = false;
  const data = st.data;
  // Istoricul (cu miniatura) se scrie în fundal: masa e deja salvată, dialogul se poate închide imediat.
  if (!scanare.faraPoza && typeof inregistreazaScanareInIstoric === 'function') inregistreazaScanareInIstoric({ intrare, data, blob: scanare.imagine && scanare.imagine.blob, tokeni: scanare.tokeni });
  inchideScanare();
  notifica(`${intrare.nume}: ${Math.round(intrare.valoriPortie.kcal)} kcal adăugate la ${numeMasa(intrare.masa).toLowerCase()}${data === dataLocala() ? '' : `, ${afiseazaData(data)}`}.`, 'succes', 6000, {
    text: 'Vezi ziua', onclick: () => { dataZiNutritie = data; arataEcran('ecran-nutritie'); arataFilaNutritie('zi'); },
  });
  if (typeof ecranCurent !== 'undefined' && ecranCurent === 'ecran-masa') randeazaAcasaMasa();
  if (typeof ziNutritie !== 'undefined' && ziNutritie.data === data && typeof ecranCurent !== 'undefined' && ecranCurent === 'ecran-nutritie') randeazaZiNutritie({ reincarca: true });
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
    panouNutritional(v, scanare.faraPoza ? 'în total' : 'în total (estimare)'),
    t.zahar != null || t.saturate != null ? el('p', { class: 'nota nota-mica', text: extra.replace(/^fibre [^·]+· ?/, '') }) : null,
    t.lipsa ? el('p', { class: 'scan-total-lipsa', text: `${plural(t.lipsa, 'aliment nu are', 'alimente nu au')} încă valori și nu ${t.lipsa === 1 ? 'e inclus' : 'sunt incluse'} în total.` }) : null,
  ].filter(Boolean));
}
function actualizeazaTotalScanare() {
  const b = zonaScanare() && zonaScanare().querySelector('.scan-total');
  if (b) umpleTotalScanare(b);
}

// „Împarte”: un aliment cu mai multe nume devine alimente separate, fiecare căutat în aplicație și apoi în USDA.
function imparteInScanare(id) {
  const k = scanare.articole.findIndex(a => a.id === id);
  if (k < 0) return;
  const parti = imparteArticolScanare(scanare.articole[k], () => `sa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  if (!parti) return;
  const noi = parti.map(potrivesteLocalScanare);
  scanare.articole = [...scanare.articole.slice(0, k), ...noi, ...scanare.articole.slice(k + 1)];
  scanare.deschise.delete(id);
  pasRevizuireScanare();
  const deCautat = noi.filter(a => a.stareCautare === 'cauta').map(a => a.id);
  if (deCautat.length) cautaExternScanare(deCautat);
  const prim = zonaScanare().querySelector(`[data-id="${noi[0].id}"]`);
  if (prim) prim.scrollIntoView({ block: 'center', behavior: 'smooth' });
  notifica(`Împărțit în ${noi.length} alimente. Verifică gramajele: s-au împărțit egal.`, 'info', 4500);
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
    const e = etichetaGramajScanare(x);
    insigna.textContent = e.text;
    insigna.className = `scan-insigna scan-insigna-${e.clasa}`;
    const reteta = x.potrivire && x.potrivire.tip === 'reteta';
    const portii = reteta && x.unitate !== 'portie' ? portiiRetetaScanare(x) : null;
    gramaj.textContent = [x.unitate !== 'g' && x.grame != null ? `= ${fmtNrScan(x.grame)} g` : '', portii ? `= ${fmtNrScan(portii)} ${portii === 1 ? 'porție' : 'porții'}` : '', textIntervalScanare(x)].filter(Boolean).join(' · ');
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
    partiNumeScanare(a.nume) ? el('div', { class: 'scan-imparte' }, [
      el('span', { class: 'nota nota-mica', text: `Pare să fie mai multe alimente: ${partiNumeScanare(a.nume).join(' + ')}.` }),
      buton({ text: 'Împarte', icon: 'schimba', tip: 'secundar', mic: true, eticheta: `Împarte ${a.nume} în alimente separate`, onclick: () => imparteInScanare(a.id) }),
    ]) : null,
    a.alternative.length ? el('div', { class: 'scan-chips' }, [
      el('span', { class: 'nota nota-mica', text: 'Poate fi:' }),
      ...a.alternative.map(alt => el('button', { type: 'button', class: 'chip', onclick: () => {
        const x = actualizeazaArticolScanare(a.id, y => potrivesteLocalScanare({ ...y, nume: alt, numeEn: '', alternative: [y.nume, ...y.alternative.filter(z => z !== alt)].slice(0, 3), incredere: 'medie', candidatiExterni: [] }));
        if (!x.potrivire) scanare.deschise.add(a.id);
        pasRevizuireScanare();
      } }, [el('span', { text: alt })])),
    ]) : null,
    el('div', { class: 'scan-aliment-jos' }, [el('div', { class: 'scan-gramaj' }, [cantitate, unitate]), scanare.faraPoza ? null : prep]),
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
    poateIntraInBibliotecaScanare(a) && !deschis ? blocBibliotecaScanare(a) : null,
    deschis ? panouPotriviriScanare(a) : null,
  ]);
}

// „Salvează în alimentele mele”: cu sursa, id-ul, linkul și data preluării; verifică întâi dacă îl ai deja.
function blocBibliotecaScanare(a) {
  if (a.salvatInBiblioteca) return el('p', { class: 'nota nota-mica scan-biblioteca-ok' }, [iconita('bifa', 'iconita mica'), el('span', { text: ' Salvat în alimentele tale.' })]);
  const dup = duplicatAlimentScanare(alimenteMele, a);
  if (dup) {
    return el('div', { class: 'scan-biblioteca' }, [
      el('span', { class: 'nota nota-mica', text: `Ai deja „${dup.nume}” în alimentele tale.` }),
      buton({ text: 'Folosește-l', tip: 'fantoma', mic: true, onclick: () => {
        actualizeazaArticolScanare(a.id, x => aplicaPotrivireScanare(x, potrivireDinAliment(dup, x)));
        reimprospateazaCardScanare(a.id);
      } }),
    ]);
  }
  return el('div', { class: 'scan-biblioteca' }, [
    buton({ text: 'Salvează în alimentele mele', icon: 'descarca', tip: 'fantoma', mic: true, eticheta: `Salvează ${a.nume} în alimentele mele`, onclick: async () => {
      let al;
      try { al = alimentDinScanare(a, idNutritieNou()); } catch (err) { notifica(err.message, 'eroare'); return; }
      try {
        await salveazaAlimentMeu(al);
        await reincarcaNutritie();
      } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Alimentul nu a putut fi salvat.'), 'eroare'); return; }
      actualizeazaArticolScanare(a.id, x => ({ ...x, salvatInBiblioteca: al.id }));
      reimprospateazaCardScanare(a.id);
      notifica(`„${al.nume}” e acum în alimentele tale (Rețete → Alimente). Îl poți edita acolo: categorie, alergeni, note.`, 'succes', 5000);
    } }),
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

// ---------- O masă din poză deja salvată în zi ----------
function deschideIntrareScanata(i) {
  let articole = i.scanare.articole.map(a => ({ ...a }));
  let masa = i.masa;
  const fmt = x => String(Math.round(x * 10) / 10).replace('.', ',');
  const lista = el('ul', { class: 'scan-salvate' });
  const total = el('div', { class: 'scan-total' });
  const nume = el('input', { type: 'text', maxlength: '80', value: i.nume, 'aria-label': 'Numele mesei' });
  const selectMasa = el('select', { 'aria-label': 'Masa' }, MESE_TOATE.map(m => el('option', { value: m.id, text: m.nume })));
  selectMasa.value = masa;
  selectMasa.addEventListener('change', () => { masa = selectMasa.value; });
  const eroare = el('p', { class: 'scan-eroare-mica', role: 'alert' });
  const deseneazaTotal = () => {
    const v = sumaArticoleScanate(articole);
    total.replaceChildren(panouNutritional(v, 'în total'));
  };
  const deseneazaLista = () => {
    lista.replaceChildren(...articole.map((a, k) => {
      const valoriEl = el('span', { class: 'nota nota-mica', text: `${Math.round(a.valori.kcal)} kcal · P ${fmt(a.valori.proteine)} · C ${fmt(a.valori.carbohidrati)} · G ${fmt(a.valori.grasimi)}` });
      let camp = el('span', { class: 'nota', text: `${fmt(a.cantitate || 0)} ${a.unitate || ''}` });
      if (articolScanatEditabil(a)) {
        camp = el('input', { type: 'number', inputmode: 'decimal', min: '0.1', max: '5000', step: 'any', value: String(a.cantitate), 'aria-label': `Cantitate ${a.nume}` });
        camp.addEventListener('input', () => {
          try { articole[k] = scaleazaArticolScanat(articole[k], parseFloat(String(camp.value).replace(',', '.'))); eroare.textContent = ''; }
          catch (err) { eroare.textContent = err.message; return; }
          const b = articole[k];
          valoriEl.textContent = `${Math.round(b.valori.kcal)} kcal · P ${fmt(b.valori.proteine)} · C ${fmt(b.valori.carbohidrati)} · G ${fmt(b.valori.grasimi)}`;
          deseneazaTotal();
        });
      }
      return el('li', { class: 'scan-salvat' }, [
        el('div', { class: 'scan-salvat-sus' }, [
          el('strong', { text: a.nume }),
          buton({ icon: 'cos', tip: 'fantoma', mic: true, eticheta: `Scoate ${a.nume}`, onclick: () => { articole = articole.filter((_, j) => j !== k); deseneazaLista(); deseneazaTotal(); } }),
        ]),
        el('div', { class: 'scan-salvat-cant' }, [camp, articolScanatEditabil(a) ? el('span', { class: 'nota', text: a.unitate || '' }) : null, a.estimat ? el('span', { class: 'scan-insigna', text: 'estimat din poză' }) : null]),
        valoriEl,
        el('span', { class: 'nota nota-mica', text: [a.sursa.eticheta || a.sursa.tip, a.sursa.nume].filter(Boolean).join(' · ') + (a.sursa.preluat ? ` · preluat ${a.sursa.preluat}` : '') }),
      ]);
    }));
  };
  deseneazaLista(); deseneazaTotal();
  const d = deschideDialog({
    titlu: i.sursa === 'alimente' ? 'Alimente adăugate' : 'Masă din poză',
    continut: el('div', {}, [
      el('p', { class: 'nota', text: `${numeMasa(i.masa)} · ${textStareIntrare(i)}${i.ora ? ` · ${i.ora}` : ''}` }),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Numele mesei' }), nume]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Masa' }), selectMasa]),
      total, lista, eroare,
      el('p', { class: 'nota nota-mica', text: 'Valorile sunt cele salvate când ai adăugat masa; la o cantitate nouă se recalculează din aceleași valori (la 100 g sau pe porție), nu din baza de date de acum.' }),
      el('div', { class: 'rand-butoane mt' }, [buton({ text: 'Scoate din zi', icon: 'cos', tip: 'fantoma', mic: true, onclick: () => d.inchide(() => scoateIntrarea(i)) })]),
    ]),
    butoane: [
      buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        let noua;
        try { noua = modificaIntrareScanata(i, { nume: nume.value, masa, articole }); } catch (err) { eroare.textContent = err.message; return; }
        d.inchide();
        await inlocuiesteIntrarea(noua);
      } }),
    ],
  });
}

// Butonul mare de pe Acasă (MEAL PREP).
function cardScanareAcasa() {
  return el('button', { type: 'button', class: 'scan-buton-acasa', onclick: deschideScanare }, [
    el('span', { class: 'scan-buton-icon' }, [iconita('camera')]),
    el('span', { class: 'scan-buton-text' }, [el('strong', { text: 'Fotografiază masa' }), el('span', { text: 'recunoaștere AI · tu verifici înainte de orice salvare' })]),
    iconita('sageata', 'iconita mica'),
  ]);
}
