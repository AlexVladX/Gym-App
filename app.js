// Jurnal de antrenament — aplicația completă.
// Stocarea (IndexedDB) este în db.js.

const GRUPE = ['Piept', 'Spate', 'Umeri', 'Biceps', 'Triceps', 'Picioare', 'Gambe', 'Fese', 'Abdomen', 'Antebrațe'];
const TIPURI_IMPLICITE = ['Greutate', 'Talie'];

const stare = {
  grupe: new Set(),
  exercitii: [], // { nume, serii: [{ kg, repetari }] }
  inceput: null,
  pauzaSec: 90,
};

// Istoricul și recordurile, ținute în memorie (se reîncarcă după fiecare salvare).
// Funcțiile de calcul sunt în analiza.js.
let istoric = [];
let recorduri = new Map();

async function reincarcaIstoric() {
  istoric = await toateSesiunile();
  recorduri = recorduriDin(istoric);
}

// ---------- Setări de progresie ----------
const SETARI_IMPLICITE = { minRep: 8, maxRep: 12, pasKg: 2.5, ecranAprins: true };
const setari = { ...SETARI_IMPLICITE };

function citesteSetari() {
  try {
    const salvate = JSON.parse(localStorage.getItem('setari') || '{}');
    Object.assign(setari, salvate);
  } catch (_) { /* rămân valorile implicite */ }
}

function salveazaSetari() {
  try { localStorage.setItem('setari', JSON.stringify(setari)); } catch (_) { /* ignorat */ }
}

// ---------- Utilitare ----------

// Construiește elemente fără innerHTML, ca textul să nu fie interpretat ca HTML.
function el(tag, props = {}, copii = []) {
  const e = document.createElement(tag);
  for (const [cheie, valoare] of Object.entries(props)) {
    if (cheie === 'text') e.textContent = valoare;
    else if (cheie.startsWith('on')) e.addEventListener(cheie.slice(2), valoare);
    else e.setAttribute(cheie, valoare);
  }
  for (const c of copii) e.append(c);
  return e;
}

function $(id) { return document.getElementById(id); }

// Un singur mesaj vizibil o dată: cel nou îl înlocuiește pe cel vechi.
let timerAnunt = null;
function anunta(text) {
  document.querySelectorAll('.anunt').forEach(a => a.remove());
  const t = el('div', { class: 'anunt', text });
  document.body.append(t);
  clearTimeout(timerAnunt);
  timerAnunt = setTimeout(() => t.remove(), 3500);
}

// „1 exercițiu", „3 exerciții", „20 de exerciții".
function plural(n, unu, multe) {
  if (n === 1) return `1 ${unu}`;
  const rest = n % 100;
  return (n === 0 || (rest >= 1 && rest <= 19)) ? `${n} ${multe}` : `${n} de ${multe}`;
}

// Data locală AAAA-LL-ZZ (toISOString ar folosi UTC și ar muta sesiunile de seara).
function formatData(d) {
  const luna = String(d.getMonth() + 1).padStart(2, '0');
  const zi = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${luna}-${zi}`;
}
function dataLocala() { return formatData(new Date()); }

// Timestamp pentru o dată AAAA-LL-ZZ (la prânz, ca să nu sară peste zi din cauza fusului orar).
function timpDinData(data) { return Date.parse(data + 'T12:00:00'); }

// Luni-ul săptămânii în care cade data (format AAAA-LL-ZZ).
function luniaSaptamanii(data) {
  const d = new Date(timpDinData(data));
  const zi = (d.getDay() + 6) % 7; // 0 = luni
  d.setDate(d.getDate() - zi);
  return formatData(d);
}

function afiseazaData(data) {
  const [an, luna, zi] = data.split('-');
  return `${zi}.${luna}.${an}`;
}

// ---------- Ciornă (sesiunea în curs) ----------
let timerCiorna = null;
function programeazaCiorna() {
  clearTimeout(timerCiorna);
  timerCiorna = setTimeout(() => {
    salveazaCiorna({ grupe: [...stare.grupe], exercitii: stare.exercitii, inceput: stare.inceput })
      .catch(err => console.warn('Ciorna nu a putut fi salvată', err));
  }, 400);
}

// ---------- Navigație ----------
function arataEcran(id) {
  document.querySelectorAll('.ecran').forEach(s => s.classList.toggle('activ', s.id === id));
  document.querySelectorAll('.navigatie button').forEach(b =>
    b.classList.toggle('activ', b.dataset.ecran === id));

  // Ecranele cu date se reîncarcă la fiecare deschidere (graficele au nevoie de dimensiunea reală).
  if (id === 'ecran-progres') arataFilaProgres($('progres-istoric').hidden ? 'grafice' : 'istoric');
  if (id === 'ecran-masuratori') reincarcaMasuratori().catch(err => console.error(err));
  if (id === 'ecran-setari') actualizeazaInfoBackup();
}
document.querySelectorAll('.navigatie button').forEach(b =>
  b.addEventListener('click', () => arataEcran(b.dataset.ecran)));

// ---------- Sesiunea: grupe ----------
function deseneazaGrupe() {
  $('grupe').replaceChildren(...GRUPE.map(nume => el('button', {
    class: 'chip' + (stare.grupe.has(nume) ? ' activ' : ''),
    type: 'button',
    text: nume,
    onclick: () => {
      if (stare.grupe.has(nume)) stare.grupe.delete(nume);
      else stare.grupe.add(nume);
      deseneazaGrupe();
      programeazaCiorna();
    },
  })));
}

// ---------- Ecran aprins în timpul sesiunii ----------
// Cât timp o sesiune e în curs, telefonul nu intră în repaus (Screen Wake Lock).
// Sistemul eliberează blocarea când ieși din aplicație; o cerem din nou la revenire.
let wakeLock = null;

async function tineEcranulAprins() {
  if (!setari.ecranAprins || stare.inceput === null || wakeLock || !('wakeLock' in navigator)) return;
  if (document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) {
    wakeLock = null; // refuzat (de ex. baterie descărcată): aplicația merge oricum
  }
}

function elibereazaEcranul() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    tineEcranulAprins();
    actualizeazaTimerul(); // recalculează imediat timpul rămas
  }
});
// Unele browsere cer un tap înainte de prima blocare: încercăm la orice atingere.
document.addEventListener('click', () => tineEcranulAprins());

// ---------- Sesiunea: exerciții și serii ----------
function valoareNumerica(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function adaugaExercitiu() {
  deblocheazaAudio();
  const input = $('exercitiu-nume');
  const nume = input.value.trim();
  if (!nume) return;

  if (stare.inceput === null) stare.inceput = Date.now();
  tineEcranulAprins();

  const ultima = ultimaSesiuneCu(istoric, nume);
  const serii = ultima ? ultima.serii.map(s => ({ kg: s.kg, repetari: s.repetari })) : [];

  stare.exercitii.push({ nume, serii });
  const grupa = grupaExercitiu(nume);
  if (grupa) { stare.grupe.add(grupa); deseneazaGrupe(); }
  input.value = '';
  deseneazaExercitii();
  programeazaCiorna();
}

function adaugaSerie(exercitiu) {
  deblocheazaAudio(); // gest al utilizatorului, necesar pentru sunet pe iOS
  tineEcranulAprins();
  // Preluăm valorile de la seria anterioară, ca să modifici doar ce s-a schimbat.
  const ultima = exercitiu.serii[exercitiu.serii.length - 1];
  exercitiu.serii.push({ kg: ultima?.kg ?? '', repetari: ultima?.repetari ?? '' });
  deseneazaExercitii();
  programeazaCiorna();
  porneshteTimerul();
}

// Tipul de record pentru o serie din sesiunea curentă, sau null.
function recordSerie(nume, s) {
  const kg = valoareNumerica(s.kg) ?? 0;
  const rep = valoareNumerica(s.repetari) ?? 0;
  return esteRecord(recorduri, nume, kg, rep);
}

const ETICHETE_RECORD = {
  greutate: 'greutate maximă',
  forta: 'forță estimată',
  repetari: 'repetări',
};

// Marchează rândul ca record (fără să redeseneze lista, ca să nu pierzi câmpul în care scrii).
function actualizeazaRecordRand(rand, ex, s) {
  const tip = recordSerie(ex.nume, s);
  const era = rand.classList.contains('pr');
  rand.classList.toggle('pr', Boolean(tip));
  rand.querySelector('.insigna').hidden = !tip;
  if (tip && !era) anunta(`🏆 Record nou la ${ex.nume}: ${ETICHETE_RECORD[tip]}!`);
}

function randSerie(ex, s, i) {
  const insigna = el('span', { class: 'insigna', text: 'PR' });
  const rand = el('div', { class: 'serie' });
  rand.append(
    el('span', { class: 'numar', text: String(i + 1) }),
    el('input', {
      type: 'number', inputmode: 'decimal', placeholder: 'kg', value: s.kg,
      onchange: e => { s.kg = e.target.value; programeazaCiorna(); actualizeazaRecordRand(rand, ex, s); },
    }),
    el('input', {
      type: 'number', inputmode: 'numeric', placeholder: 'reps', value: s.repetari,
      onchange: e => { s.repetari = e.target.value; programeazaCiorna(); actualizeazaRecordRand(rand, ex, s); },
    }),
    el('button', {
      class: 'buton', type: 'button', text: '×', 'aria-label': 'Șterge seria',
      onclick: () => {
        ex.serii.splice(i, 1);
        deseneazaExercitii();
        programeazaCiorna();
      },
    }),
    insigna,
  );
  const tip = recordSerie(ex.nume, s);
  rand.classList.toggle('pr', Boolean(tip));
  insigna.hidden = !tip;
  return rand;
}

// Caseta „Data trecută / Sugestie" de sub numele exercițiului.
function casetaSugestie(ex) {
  const ultima = ultimaSesiuneCu(istoric, ex.nume);
  if (!ultima) {
    return el('p', { class: 'eticheta', text: 'Prima dată la acest exercițiu. Seriile de azi devin reperul.' });
  }
  const sug = sugestieProgresie(ultima, setari);
  const copii = [
    el('p', { class: 'eticheta', text: `Data trecută (${afiseazaData(ultima.data)}): ${rezumatSerii(ultima.serii)}` }),
  ];
  if (sug) {
    copii.push(
      el('p', { class: 'sugestie-text' + (sug.crestere ? ' crestere' : ''), text: (sug.crestere ? '⬆ ' : '→ ') + sug.text }),
      el('button', {
        class: 'buton mic', type: 'button', text: 'Aplică sugestia',
        onclick: () => aplicaSugestia(ex, sug),
      }),
    );
  }
  return el('div', { class: 'sugestie' }, copii);
}

// Pentru exercițiile noi, fără grupă: o listă din care alegi grupa (o singură dată).
function alegereGrupa(ex) {
  if (grupaExercitiu(ex.nume)) return el('span', { hidden: '' });
  const select = el('select', {
    class: 'selector', 'aria-label': `Grupa musculară pentru ${ex.nume}`,
    onchange: e => { if (e.target.value) seteazaGrupa(ex.nume, e.target.value); },
  }, [
    el('option', { value: '', text: 'Alege grupa musculară principală…' }),
    ...GRUPE.map(g => el('option', { value: g, text: g })),
  ]);
  return el('div', { class: 'grupa-noua' }, [
    el('p', { class: 'eticheta', text: 'Exercițiu nou: ce grupă lucrează în principal? (pentru seriile pe săptămână)' }),
    select,
  ]);
}

// Completează seriile de lucru cu greutatea și repetările sugerate.
// Seriile mai ușoare (încălzire) rămân cum sunt.
function aplicaSugestia(ex, sug) {
  const valori = ex.serii.map(s => valoareNumerica(s.kg) ?? 0);
  const top = valori.length ? Math.max(...valori) : 0;
  let deLucru = ex.serii.filter(s => (valoareNumerica(s.kg) ?? 0) === top);
  if (deLucru.length === 0) {
    for (let i = 0; i < sug.numarSerii; i++) ex.serii.push({ kg: '', repetari: '' });
    deLucru = ex.serii;
  }
  for (const s of deLucru) {
    s.kg = sug.kg;
    s.repetari = sug.repetari;
  }
  deseneazaExercitii();
  programeazaCiorna();
}

function deseneazaExercitii() {
  $('exercitii').replaceChildren(...stare.exercitii.map(ex => el('div', { class: 'card exercitiu' }, [
    el('div', { class: 'exercitiu-cap' }, [
      miniatura(ex.nume, 'figura-mica'),
      el('h3', { text: ex.nume }),
      el('button', {
        class: 'buton mic sterge-ex', type: 'button', text: '×', 'aria-label': 'Scoate exercițiul',
        onclick: () => {
          if (ex.serii.length && !confirm(`Scoți ${ex.nume} din sesiune?`)) return;
          stare.exercitii.splice(stare.exercitii.indexOf(ex), 1);
          deseneazaExercitii();
          programeazaCiorna();
        },
      }),
    ]),
    alegereGrupa(ex),
    casetaSugestie(ex),
    ...ex.serii.map((s, i) => randSerie(ex, s, i)),
    el('button', { class: 'buton', type: 'button', text: '+ Serie', onclick: () => adaugaSerie(ex) }),
  ])));
}

// ---------- Sunet ----------
// iOS cere ca AudioContext să fie creat sau reluat dintr-un tap al utilizatorului.
let audioCtx = null;
function deblocheazaAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function sunaSemnalul() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const acum = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) { // trei bipuri scurte
    const start = acum + i * 0.4;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  }
}

// ---------- Durata pauzei ----------
function citestePauza() {
  try {
    const v = parseInt(localStorage.getItem('pauzaSec'), 10);
    if (v >= 10 && v <= 600) stare.pauzaSec = v;
  } catch (_) { /* localStorage indisponibil: rămâne 90 s */ }
  $('pauza-sec').value = stare.pauzaSec;
}

$('pauza-sec').addEventListener('change', e => {
  const v = Math.min(600, Math.max(10, parseInt(e.target.value, 10) || 90));
  stare.pauzaSec = v;
  e.target.value = v;
  try { localStorage.setItem('pauzaSec', String(v)); } catch (_) { /* ignorat */ }
});

// ---------- Timer de pauză ----------
// Ținem minte momentul de final, nu numărăm secunde. Așa, dacă ecranul se blochează
// sau aplicația e în fundal, timpul rămas se recalculează corect la revenire.
let sfarsitPauza = null;
let intervalTimer = null;

function porneshteTimerul() {
  sfarsitPauza = Date.now() + stare.pauzaSec * 1000;
  $('timer').hidden = false;
  clearInterval(intervalTimer);
  intervalTimer = setInterval(actualizeazaTimerul, 250);
  actualizeazaTimerul();
}

function opresteTimerul() {
  clearInterval(intervalTimer);
  sfarsitPauza = null;
  $('timer').hidden = true;
}

function actualizeazaTimerul() {
  if (sfarsitPauza === null) return;
  const rest = Math.max(0, Math.ceil((sfarsitPauza - Date.now()) / 1000));
  const min = String(Math.floor(rest / 60)).padStart(2, '0');
  const sec = String(rest % 60).padStart(2, '0');
  $('timer-afisaj').textContent = `${min}:${sec}`;
  if (rest === 0) {
    opresteTimerul();
    sunaSemnalul();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]); // nu funcționează pe iPhone
  }
}

// ---------- Biblioteca și grupa fiecărui exercițiu ----------
// Grupele alese de tine pentru exercițiile proprii (cheie: numele cu litere mici).
let grupeProprii = new Map();

async function reincarcaBiblioteca() {
  const lista = await bibliotecaExercitii();
  grupeProprii = new Map(lista.filter(e => e.grupa).map(e => [e.nume.toLowerCase(), e.grupa]));
  // Sugestii la tastare: exercițiile tale și cele din bibliotecă.
  const nume = new Map();
  for (const e of [...lista, ...BIBLIOTECA]) {
    if (!nume.has(e.nume.toLowerCase())) nume.set(e.nume.toLowerCase(), e.nume);
  }
  $('biblioteca').replaceChildren(...[...nume.values()].map(n => el('option', { value: n })));
}

// Grupa principală a exercițiului: întâi cea aleasă de tine, apoi cea din bibliotecă.
function grupaExercitiu(nume) {
  const cheie = nume.toLowerCase();
  if (grupeProprii.has(cheie)) return grupeProprii.get(cheie);
  const dinBiblioteca = BIBLIOTECA.find(e => e.nume.toLowerCase() === cheie);
  return dinBiblioteca ? dinBiblioteca.grupa : null;
}

async function seteazaGrupa(nume, grupa) {
  try {
    await adaugaInBiblioteca(nume, grupa);
  } catch (err) {
    console.error(err);
    anunta('Grupa nu a putut fi salvată.');
    return;
  }
  grupeProprii.set(nume.toLowerCase(), grupa);
  stare.grupe.add(grupa);
  deseneazaGrupe();
  deseneazaExercitii();
  programeazaCiorna();
}

// ---------- Închiderea sesiunii ----------
async function inchideSesiunea() {
  const exercitii = stare.exercitii
    .map(ex => ({
      nume: ex.nume,
      serii: ex.serii
        .filter(s => s.kg !== '' || s.repetari !== '')
        .map(s => ({ kg: Number(s.kg) || 0, repetari: Number(s.repetari) || 0 })),
    }))
    .filter(ex => ex.serii.length > 0);

  if (exercitii.length === 0) {
    anunta('Adaugă cel puțin o serie înainte să închizi sesiunea.');
    return;
  }

  // Recordurile se numără înainte de salvare, față de istoricul de până acum.
  let numarRecorduri = 0;
  for (const ex of exercitii) {
    if (ex.serii.some(s => esteRecord(recorduri, ex.nume, s.kg, s.repetari))) numarRecorduri++;
  }

  const sfarsit = Date.now();
  const numarSerii = exercitii.reduce((t, ex) => t + ex.serii.length, 0);
  const volum = exercitii.reduce((t, ex) =>
    t + ex.serii.reduce((v, s) => v + s.kg * s.repetari, 0), 0);
  const durataMin = Math.round((sfarsit - stare.inceput) / 60000);

  try {
    await salveazaSesiune({
      data: dataLocala(),
      inceput: stare.inceput,
      sfarsit,
      grupe: [...stare.grupe],
      exercitii,
    });
    for (const ex of exercitii) await adaugaInBiblioteca(ex.nume);
    await stergeCiorna();
  } catch (err) {
    console.error(err);
    anunta('Sesiunea nu a putut fi salvată. Încearcă din nou.');
    return;
  }

  stare.grupe.clear();
  stare.exercitii = [];
  stare.inceput = null;
  opresteTimerul();
  elibereazaEcranul();
  await reincarcaIstoric().catch(err => console.warn(err));
  deseneazaGrupe();
  deseneazaExercitii();
  reincarcaBiblioteca().catch(() => {});
  const textRecorduri = numarRecorduri
    ? ` 🏆 Recorduri noi la ${plural(numarRecorduri, 'exercițiu', 'exerciții')}.`
    : '';
  anunta(`Salvat: ${plural(exercitii.length, 'exercițiu', 'exerciții')}, ${plural(numarSerii, 'serie', 'serii')}, ${durataMin} min, volum ${Math.round(volum)} kg.${textRecorduri}`);
}

// ---------- Grafice (canvas, fără biblioteci externe) ----------
// puncte: [{ x: timestamp, y: număr }]
function deseneazaGrafic(canvas, puncte, formateazaY) {
  const latime = canvas.clientWidth || 320;
  const inaltime = 180;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = latime * ratio;
  canvas.height = inaltime * ratio;
  canvas.style.height = inaltime + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, latime, inaltime);
  ctx.font = '11px system-ui, sans-serif';

  if (puncte.length === 0) {
    ctx.fillStyle = '#9aa0aa';
    ctx.fillText('Nu sunt date încă', 12, 24);
    return;
  }

  const pad = { l: 46, r: 12, t: 12, b: 24 };
  const xMin = Math.min(...puncte.map(p => p.x));
  const xMax = Math.max(...puncte.map(p => p.x));
  let yMin = Math.min(...puncte.map(p => p.y));
  let yMax = Math.max(...puncte.map(p => p.y));
  if (yMin === yMax) { const d = Math.max(1, Math.abs(yMin) * 0.05); yMin -= d; yMax += d; }
  const marjaY = (yMax - yMin) * 0.1;
  yMin -= marjaY;
  yMax += marjaY;

  const areaL = latime - pad.l - pad.r;
  const areaI = inaltime - pad.t - pad.b;
  const X = x => xMax === xMin ? pad.l + areaL / 2 : pad.l + (x - xMin) / (xMax - xMin) * areaL;
  const Y = y => pad.t + (1 - (y - yMin) / (yMax - yMin)) * areaI;

  // Linii orizontale și etichete pe axa Y
  ctx.strokeStyle = '#2a2e36';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#9aa0aa';
  for (let i = 0; i <= 3; i++) {
    const v = yMin + (yMax - yMin) * i / 3;
    const y = Y(v);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(latime - pad.r, y);
    ctx.stroke();
    ctx.fillText(formateazaY(v), 4, y + 4);
  }

  // Linia și punctele
  ctx.strokeStyle = '#3ddc84';
  ctx.lineWidth = 2;
  ctx.beginPath();
  puncte.forEach((p, i) => i === 0 ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y)));
  ctx.stroke();

  ctx.fillStyle = '#3ddc84';
  for (const p of puncte) {
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Datele de la capetele axei X
  const scurta = t => new Date(t).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
  ctx.fillStyle = '#9aa0aa';
  ctx.fillText(scurta(xMin), pad.l, inaltime - 6);
  const eticheta = scurta(xMax);
  ctx.fillText(eticheta, latime - pad.r - ctx.measureText(eticheta).width, inaltime - 6);
}

const formatNumar = v => (Math.round(v * 10) / 10).toString();

// ---------- Progres ----------
async function reincarcaProgres() {
  await reincarcaIstoric();
  const sesiuni = istoric;

  // Lista de exerciții care apar în sesiuni
  const nume = new Map();
  for (const s of sesiuni) {
    for (const e of s.exercitii) {
      const cheie = e.nume.toLowerCase();
      if (!nume.has(cheie)) nume.set(cheie, e.nume);
    }
  }
  const selector = $('progres-exercitiu');
  const anterior = selector.value;
  const optiuni = [...nume.values()].sort((a, b) => a.localeCompare(b, 'ro'));
  selector.replaceChildren(...optiuni.map(n => el('option', { value: n, text: n })));
  if (optiuni.includes(anterior)) selector.value = anterior;

  deseneazaProgresExercitiu(sesiuni);
  deseneazaVolumGrupe(sesiuni);
}

function deseneazaProgresExercitiu(sesiuni) {
  const selector = $('progres-exercitiu');
  if (!selector.value) {
    deseneazaGrafic($('grafic-forta'), [], formatNumar);
    deseneazaGrafic($('grafic-volum'), [], formatNumar);
    $('progres-sumar').textContent = 'Salvează o sesiune ca să vezi progresul.';
    $('progres-recorduri').replaceChildren();
    return;
  }

  const cautat = selector.value.toLowerCase();
  deseneazaRecorduri(recorduri.get(cautat));
  const forta = [];
  const volum = [];
  for (const s of sesiuni) {
    const ex = s.exercitii.find(e => e.nume.toLowerCase() === cautat);
    if (!ex) continue;
    const t = timpDinData(s.data);
    let bestEpley = 0;
    let totalVolum = 0;
    for (const se of ex.serii) {
      if (se.repetari > 0) bestEpley = Math.max(bestEpley, se.kg * (1 + se.repetari / 30));
      totalVolum += se.kg * se.repetari;
    }
    forta.push({ x: t, y: Math.round(bestEpley * 10) / 10, data: s.data });
    volum.push({ x: t, y: Math.round(totalVolum), data: s.data });
  }

  deseneazaGrafic($('grafic-forta'), forta, formatNumar);
  deseneazaGrafic($('grafic-volum'), volum, formatNumar);

  if (forta.length === 0) {
    $('progres-sumar').textContent = 'Nu ai sesiuni cu acest exercițiu.';
    return;
  }
  const cel = forta.reduce((b, p) => p.y > b.y ? p : b, forta[0]);
  $('progres-sumar').textContent =
    `${plural(forta.length, 'sesiune', 'sesiuni')}. Cea mai bună forță estimată: ${formatNumar(cel.y)} kg (${afiseazaData(cel.data)}).`;
}

// Cele trei recorduri ale exercițiului ales, ca plăcuțe.
function deseneazaRecorduri(r) {
  if (!r) { $('progres-recorduri').replaceChildren(); return; }
  const placuta = (eticheta, valoare, detaliu) => el('div', { class: 'placuta' }, [
    el('span', { class: 'eticheta', text: eticheta }),
    el('strong', { text: valoare }),
    el('span', { class: 'eticheta', text: detaliu }),
  ]);
  const placute = r.kg > 0
    ? [
      placuta('Greutate maximă', `${formatNumar(r.kg)} kg`, `× ${r.kgRepetari} · ${afiseazaData(r.kgData)}`),
      placuta('Forță estimată', `${formatNumar(r.e1rm)} kg`, `${formatNumar(r.e1rmKg)}×${r.e1rmRepetari} · ${afiseazaData(r.e1rmData)}`),
      placuta('Volum / sesiune', `${Math.round(r.volum)} kg`, afiseazaData(r.volumData)),
    ]
    : [placuta('Repetări maxime', String(r.repetari), afiseazaData(r.repetariData))];
  $('progres-recorduri').replaceChildren(...placute);
}

// Seriile pe săptămână pe fiecare grupă, cu luni-ul săptămânii în selector.
const SERII_MIN = 10;
const SERII_MAX = 20;

function deseneazaVolumGrupe(sesiuni) {
  const selector = $('saptamana');
  const luniCunoscuti = new Set();
  for (const s of sesiuni) luniCunoscuti.add(luniaSaptamanii(s.data));
  luniCunoscuti.add(luniaSaptamanii(dataLocala())); // săptămâna curentă, chiar fără sesiuni

  const luni = [...luniCunoscuti].sort().reverse();
  const anterioara = selector.value;
  selector.replaceChildren(...luni.map(l => el('option', {
    value: l, text: l === luniaSaptamanii(dataLocala()) ? 'Săptămâna aceasta' : `Săptămâna din ${afiseazaData(l)}`,
  })));
  if (luni.includes(anterioara)) selector.value = anterioara;
  if (!selector.value) selector.value = luni[0];

  const saptamana = selector.value;
  const dinSaptamana = sesiuni.filter(s => luniaSaptamanii(s.data) === saptamana);
  const serii = seriiPeGrupa(dinSaptamana, grupaExercitiu);

  const randuri = [...GRUPE];
  if (serii.Nealocat) randuri.push('Nealocat');
  const scala = Math.max(SERII_MAX + 4, ...Object.values(serii));

  $('volum-grupe').replaceChildren(...randuri.map(g => {
    const n = serii[g] || 0;
    const zona = n === 0 ? '' : n < SERII_MIN ? ' sub' : n > SERII_MAX ? ' peste' : ' in-zona';
    return el('div', { class: 'bara-rand' }, [
      el('span', { class: 'bara-nume', text: g }),
      el('div', { class: 'bara-fundal' }, [
        el('div', { class: 'bara-zona', style: `left:${SERII_MIN / scala * 100}%;width:${(SERII_MAX - SERII_MIN) / scala * 100}%` }),
        el('div', { class: 'bara' + zona, style: `width:${n / scala * 100}%` }),
      ]),
      el('span', { class: 'bara-valoare', text: n ? plural(n, 'serie', 'serii') : '—' }),
    ]);
  }));
}

$('progres-exercitiu').addEventListener('change', () => {
  reincarcaProgres().catch(err => console.error(err));
});
$('saptamana').addEventListener('change', () => {
  reincarcaProgres().catch(err => console.error(err));
});

// ---------- Greutatea corporală pe ecranul principal ----------
async function deseneazaGreutate() {
  const toate = await toateMasuratorile();
  const greutati = toate.filter(m => m.tip === 'Greutate');
  const t = tendintaGreutate(greutati);
  const info = $('greutate-info');

  if (!t) {
    info.replaceChildren(el('p', { class: 'eticheta', text: 'Cântărește-te de 2–3 ori pe săptămână, dimineața, ca să vezi tendința.' }));
    return;
  }
  const rand = [
    el('div', { class: 'placuta' }, [
      el('span', { class: 'eticheta', text: 'Media ultimelor 7 zile' }),
      el('strong', { text: `${formatNumar(t.media7)} kg` }),
      el('span', { class: 'eticheta', text: `ultima: ${formatNumar(t.ultima)} kg, ${afiseazaData(t.dataUltima)}` }),
    ]),
  ];
  if (t.kgPeSaptamana === null) {
    rand.push(el('div', { class: 'placuta' }, [
      el('span', { class: 'eticheta', text: 'Tendință' }),
      el('strong', { text: '—' }),
      el('span', { class: 'eticheta', text: 'minimum 3 cântăriri pe 7 zile' }),
    ]));
  } else {
    const v = t.kgPeSaptamana;
    const semn = v > 0.05 ? '↑ +' : v < -0.05 ? '↓ ' : '→ ';
    rand.push(el('div', { class: 'placuta' }, [
      el('span', { class: 'eticheta', text: 'Tendință' }),
      el('strong', { class: v > 0.05 ? 'pozitiv' : '', text: `${semn}${formatNumar(v)} kg/săpt.` }),
      el('span', { class: 'eticheta', text: `ultimele ${t.zile} zile` }),
    ]));
  }
  info.replaceChildren(el('div', { class: 'placute' }, rand));
}

$('btn-greutate').addEventListener('click', async () => {
  const valoare = parseFloat($('greutate-valoare').value);
  if (!Number.isFinite(valoare) || valoare < 20 || valoare > 300) {
    anunta('Introdu greutatea în kg (de exemplu 74.5).');
    return;
  }
  try {
    await salveazaMasuratoare({ data: dataLocala(), tip: 'Greutate', valoare, creat: Date.now() });
  } catch (err) {
    console.error(err);
    anunta('Greutatea nu a putut fi salvată.');
    return;
  }
  $('greutate-valoare').value = '';
  $('greutate-valoare').blur();
  await deseneazaGreutate();
  anunta(`Greutate salvată: ${formatNumar(valoare)} kg.`);
});

// ---------- Rutine proprii ----------
// Salvează lista de exerciții (fără greutăți) ca rutină reutilizabilă.
async function salveazaCaRutina(exercitii, grupe, numeImplicit) {
  const nume = (prompt('Numele rutinei:', numeImplicit) || '').trim();
  if (!nume) return false;
  try {
    await salveazaRutina({ nume, grupe: [...new Set(grupe)], exercitii: [...new Set(exercitii)], creat: Date.now() });
  } catch (err) {
    console.error(err);
    anunta('Rutina nu a putut fi salvată.');
    return false;
  }
  anunta(`Rutina „${nume}" e salvată în Biblioteca → Antrenamente.`);
  return true;
}

$('btn-rutina').addEventListener('click', () => {
  if (stare.exercitii.length === 0) {
    anunta('Adaugă întâi exercițiile pe care vrei să le salvezi ca rutină.');
    return;
  }
  const grupe = stare.grupe.size ? [...stare.grupe] : stare.exercitii.map(e => grupaExercitiu(e.nume)).filter(Boolean);
  salveazaCaRutina(stare.exercitii.map(e => e.nume), grupe, [...stare.grupe].join(', '));
});

// ---------- Măsurători ----------
let masuratoriCache = [];

async function reincarcaMasuratori() {
  masuratoriCache = await toateMasuratorile();

  // Tipurile existente plus cele implicite
  const tipuri = new Set(TIPURI_IMPLICITE);
  masuratoriCache.forEach(m => tipuri.add(m.tip));
  const lista = [...tipuri].sort((a, b) => a.localeCompare(b, 'ro'));

  $('tipuri').replaceChildren(...lista.map(t => el('option', { value: t })));

  const selector = $('masuratoare-grafic-tip');
  const anterior = selector.value;
  selector.replaceChildren(...lista.map(t => el('option', { value: t, text: t })));
  if (lista.includes(anterior)) selector.value = anterior;

  if (!$('masuratoare-data').value) $('masuratoare-data').value = dataLocala();

  deseneazaMasuratori();
}

function deseneazaMasuratori() {
  const tip = $('masuratoare-grafic-tip').value;
  const intrari = masuratoriCache
    .filter(m => m.tip === tip)
    .sort((a, b) => a.data.localeCompare(b.data));

  deseneazaGrafic($('grafic-masuratori'),
    intrari.map(m => ({ x: timpDinData(m.data), y: m.valoare })),
    formatNumar);

  $('masuratori-lista').replaceChildren(...[...intrari].reverse().map(m =>
    el('div', { class: 'rand-lista' }, [
      el('span', { text: `${afiseazaData(m.data)}` }),
      el('span', { class: 'valoare', text: `${formatNumar(m.valoare)}` }),
      el('button', {
        class: 'buton mic', type: 'button', text: '×',
        onclick: async () => {
          if (!confirm('Ștergi această măsurătoare?')) return;
          await stergeMasuratoare(m.id);
          reincarcaMasuratori();
          deseneazaGreutate().catch(() => {});
        },
      }),
    ])));
}

$('masuratoare-grafic-tip').addEventListener('change', deseneazaMasuratori);

$('btn-masuratoare').addEventListener('click', async () => {
  const tip = $('masuratoare-tip').value.trim();
  const valoare = parseFloat($('masuratoare-valoare').value);
  const data = $('masuratoare-data').value || dataLocala();
  if (!tip || !Number.isFinite(valoare)) {
    anunta('Completează tipul și valoarea.');
    return;
  }
  try {
    await salveazaMasuratoare({ data, tip, valoare, creat: Date.now() });
  } catch (err) {
    console.error(err);
    anunta('Măsurătoarea nu a putut fi salvată.');
    return;
  }
  $('masuratoare-valoare').value = '';
  $('masuratoare-tip').value = tip;
  $('masuratoare-grafic-tip').value = tip;
  await reincarcaMasuratori();
  deseneazaGreutate().catch(() => {});
  anunta('Măsurătoare salvată.');
});

// ---------- Backup ----------
const CHEIE_ULTIM_BACKUP = 'ultimBackup';

function actualizeazaInfoBackup() {
  let ultim = null;
  try { ultim = localStorage.getItem(CHEIE_ULTIM_BACKUP); } catch (_) { /* ignorat */ }
  if (!ultim) {
    $('backup-info').textContent = 'Nu ai exportat niciun backup încă. Fă unul săptămânal.';
    return;
  }
  const zile = Math.floor((Date.now() - Date.parse(ultim)) / 86400000);
  const cand = zile === 0 ? 'azi' : `acum ${zile} ${zile === 1 ? 'zi' : 'zile'}`;
  $('backup-info').textContent = `Ultimul backup: ${cand}.` +
    (zile >= 7 ? ' Ai trecut de o săptămână, exportă unul nou.' : '');
}

$('btn-exporta').addEventListener('click', async () => {
  try {
    const date = await exportaToate();
    const blob = new Blob([JSON.stringify(date, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `jurnal-backup-${dataLocala()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    try { localStorage.setItem(CHEIE_ULTIM_BACKUP, new Date().toISOString()); } catch (_) { /* ignorat */ }
    actualizeazaInfoBackup();
    anunta('Backup exportat. Salvează fișierul în Fișiere sau trimite-l pe e-mail.');
  } catch (err) {
    console.error(err);
    anunta('Exportul a eșuat.');
  }
});

$('fisier-import').addEventListener('change', async e => {
  const fisier = e.target.files[0];
  e.target.value = '';
  if (!fisier) return;

  let date;
  try {
    date = JSON.parse(await fisier.text());
  } catch (_) {
    anunta('Fișierul nu este un backup valid.');
    return;
  }
  const valid = date && Array.isArray(date.sesiuni) && Array.isArray(date.exercitii) && Array.isArray(date.masuratori);
  if (!valid) {
    anunta('Fișierul nu are structura unui backup al jurnalului.');
    return;
  }
  if (!confirm(`Restaurezi backupul? Datele actuale vor fi înlocuite: ${date.sesiuni.length} sesiuni, ${date.masuratori.length} măsurători.`)) {
    return;
  }
  try {
    await inlocuiesteToate(date);
  } catch (err) {
    console.error(err);
    anunta('Restaurarea a eșuat. Datele actuale nu au fost modificate.');
    return;
  }
  await reincarcaIstoric();
  await reincarcaBiblioteca();
  await reincarcaMasuratori();
  await deseneazaGreutate();
  deseneazaExercitii();
  if (typeof randeazaBiblioteca === 'function') randeazaBiblioteca();
  anunta('Backup restaurat.');
});

// ---------- Inițializare ----------
$('btn-exercitiu').addEventListener('click', adaugaExercitiu);
$('exercitiu-nume').addEventListener('keydown', e => {
  if (e.key === 'Enter') adaugaExercitiu();
});
$('btn-timer-oprit').addEventListener('click', opresteTimerul);
$('btn-inchide').addEventListener('click', inchideSesiunea);

async function initializeaza() {
  try {
    const ciorna = await citesteCiorna();
    if (ciorna) {
      stare.grupe = new Set(ciorna.grupe);
      stare.exercitii = ciorna.exercitii;
      stare.inceput = ciorna.inceput;
    }
  } catch (err) {
    console.warn('Ciorna nu a putut fi citită', err);
  }
  try {
    await reincarcaIstoric();
  } catch (err) {
    console.warn('Istoricul nu a putut fi citit', err);
  }
  try {
    await reincarcaBiblioteca();
  } catch (err) {
    console.warn('Biblioteca nu a putut fi citită', err);
  }
  deseneazaGrupe();
  deseneazaExercitii();
  deseneazaGreutate().catch(err => console.warn(err));
  tineEcranulAprins();
}

// ---------- Setări: progresie și ecran ----------
function afiseazaSetari() {
  $('set-min-rep').value = setari.minRep;
  $('set-max-rep').value = setari.maxRep;
  $('set-pas-kg').value = setari.pasKg;
  $('set-ecran').checked = setari.ecranAprins;
}

function citesteCampuriSetari() {
  const minRep = parseInt($('set-min-rep').value, 10);
  const maxRep = parseInt($('set-max-rep').value, 10);
  const pasKg = parseFloat($('set-pas-kg').value);
  if (minRep >= 1 && maxRep >= minRep && maxRep <= 50) {
    setari.minRep = minRep;
    setari.maxRep = maxRep;
  } else {
    anunta('Intervalul de repetări nu e valid (minimul trebuie să fie cel mult cât maximul).');
  }
  if (pasKg > 0 && pasKg <= 20) setari.pasKg = pasKg;
  setari.ecranAprins = $('set-ecran').checked;
  if (!setari.ecranAprins) elibereazaEcranul();
  salveazaSetari();
  afiseazaSetari();
  deseneazaExercitii();
}

['set-min-rep', 'set-max-rep', 'set-pas-kg', 'set-ecran'].forEach(id =>
  $(id).addEventListener('change', citesteCampuriSetari));

citesteSetari();
afiseazaSetari();
citestePauza();
initializeaza();

// Service worker: aplicația funcționează offline după prima încărcare. Necesită HTTPS sau localhost.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* fără offline, aplicația merge oricum */ });
}
