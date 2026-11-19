// Timerul de pauză dintre serii și semnalul de final.
// Ținem minte momentul de final, nu numărăm secunde. Așa, dacă ecranul se blochează
// sau aplicația e în fundal, timpul rămas se recalculează corect la revenire.
// Când timerul e pus pe pauză, ținem minte timpul rămas.

let sfarsitPauza = null;      // timestamp de final, când timerul merge
let ramasPauzaMs = null;      // timpul rămas, când timerul e pe pauză
let durataPauzaCurenta = 0;   // secunde, pentru bara de progres
let intervalTimer = null;

// ---------- Sunet ----------
// iOS cere ca AudioContext să fie creat sau reluat dintr-un tap al utilizatorului.
let audioCtx = null;
function deblocheazaAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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

// ---------- Stare ----------
function timerActiv() { return sfarsitPauza !== null || ramasPauzaMs !== null; }
function timerPePauza() { return ramasPauzaMs !== null; }

function msRamase() {
  if (ramasPauzaMs !== null) return ramasPauzaMs;
  if (sfarsitPauza !== null) return Math.max(0, sfarsitPauza - Date.now());
  return 0;
}

// ---------- Comenzi ----------
function porneshteTimerul(secunde = setari.pauzaSec) {
  deblocheazaAudio();
  durataPauzaCurenta = secunde;
  sfarsitPauza = Date.now() + secunde * 1000;
  ramasPauzaMs = null;
  afiseazaBaraTimer(true);
  clearInterval(intervalTimer);
  intervalTimer = setInterval(actualizeazaTimerul, 250);
  actualizeazaTimerul();
}

function opresteTimerul() {
  clearInterval(intervalTimer);
  sfarsitPauza = null;
  ramasPauzaMs = null;
  afiseazaBaraTimer(false);
}

function pauzeazaTimerul() {
  if (sfarsitPauza === null) return;
  ramasPauzaMs = Math.max(0, sfarsitPauza - Date.now());
  sfarsitPauza = null;
  clearInterval(intervalTimer);
  actualizeazaTimerul();
}

function reiaTimerul() {
  if (ramasPauzaMs === null) return;
  sfarsitPauza = Date.now() + ramasPauzaMs;
  ramasPauzaMs = null;
  clearInterval(intervalTimer);
  intervalTimer = setInterval(actualizeazaTimerul, 250);
  actualizeazaTimerul();
}

function ajusteazaTimerul(secunde) {
  if (!timerActiv()) return;
  if (ramasPauzaMs !== null) ramasPauzaMs = Math.max(1000, ramasPauzaMs + secunde * 1000);
  else sfarsitPauza = Math.max(Date.now() + 1000, sfarsitPauza + secunde * 1000);
  durataPauzaCurenta = Math.max(durataPauzaCurenta + secunde, Math.ceil(msRamase() / 1000), 1);
  actualizeazaTimerul();
}

function afiseazaBaraTimer(vizibil) {
  $('timer').hidden = !vizibil;
  document.body.classList.toggle('cu-timer', vizibil);
}

function actualizeazaTimerul() {
  if (!timerActiv()) return;
  const rest = Math.ceil(msRamase() / 1000);
  $('timer-afisaj').textContent = formatDurata(rest);
  const procent = durataPauzaCurenta > 0 ? Math.min(100, rest / durataPauzaCurenta * 100) : 0;
  $('timer-progres').style.width = `${procent}%`;
  const pePauza = timerPePauza();
  $('timer').classList.toggle('pe-pauza', pePauza);
  $('timer-eticheta').textContent = pePauza ? 'Pauză oprită' : 'Pauză';
  const btn = $('btn-timer-pauza');
  btn.replaceChildren(iconita(pePauza ? 'play' : 'pauza'));
  btn.setAttribute('aria-label', pePauza ? 'Pornește din nou timerul' : 'Oprește temporar timerul');
  if (rest === 0 && !pePauza) {
    opresteTimerul();
    if (setari.semnal) {
      sunaSemnalul();
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]); // nu funcționează pe iPhone
    }
    notifica('Pauza s-a terminat. Următoarea serie!', 'succes');
  }
}

function initTimer() {
  $('btn-timer-oprit').addEventListener('click', opresteTimerul);
  $('btn-timer-minus').addEventListener('click', () => ajusteazaTimerul(-15));
  $('btn-timer-plus').addEventListener('click', () => ajusteazaTimerul(15));
  $('btn-timer-pauza').addEventListener('click', () => (timerPePauza() ? reiaTimerul() : pauzeazaTimerul()));
}
