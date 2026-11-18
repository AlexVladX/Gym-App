// Timerul de pauză dintre serii și semnalul sonor.
// Ținem minte momentul de final, nu numărăm secunde. Așa, dacă ecranul se blochează
// sau aplicația e în fundal, timpul rămas se recalculează corect la revenire.

let sfarsitPauza = null;
let durataPauzaCurenta = 0;
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

// ---------- Timer ----------
function porneshteTimerul() {
  durataPauzaCurenta = setari.pauzaSec;
  sfarsitPauza = Date.now() + durataPauzaCurenta * 1000;
  $('timer').hidden = false;
  document.body.classList.add('cu-timer');
  clearInterval(intervalTimer);
  intervalTimer = setInterval(actualizeazaTimerul, 250);
  actualizeazaTimerul();
}

function opresteTimerul() {
  clearInterval(intervalTimer);
  sfarsitPauza = null;
  $('timer').hidden = true;
  document.body.classList.remove('cu-timer');
}

function ajusteazaTimerul(secunde) {
  if (sfarsitPauza === null) return;
  sfarsitPauza = Math.max(Date.now() + 1000, sfarsitPauza + secunde * 1000);
  durataPauzaCurenta = Math.max(durataPauzaCurenta + secunde, 1);
  actualizeazaTimerul();
}

function actualizeazaTimerul() {
  if (sfarsitPauza === null) return;
  const rest = Math.max(0, Math.ceil((sfarsitPauza - Date.now()) / 1000));
  $('timer-afisaj').textContent = formatDurata(rest);
  const procent = durataPauzaCurenta > 0 ? Math.min(100, rest / durataPauzaCurenta * 100) : 0;
  $('timer-progres').style.width = `${procent}%`;
  if (rest === 0) {
    opresteTimerul();
    sunaSemnalul();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]); // nu funcționează pe iPhone
    notifica('Pauza s-a terminat. Următoarea serie!', 'succes');
  }
}

function initTimer() {
  $('btn-timer-oprit').addEventListener('click', opresteTimerul);
  $('btn-timer-minus').addEventListener('click', () => ajusteazaTimerul(-15));
  $('btn-timer-plus').addEventListener('click', () => ajusteazaTimerul(15));
}
