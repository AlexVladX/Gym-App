// Pornirea aplicației și navigarea între ecrane. Se încarcă ultimul.

const TITLURI_ECRANE = {
  'ecran-acasa': 'Acasă',
  'ecran-sesiune': 'Antrenament',
  'ecran-biblioteca': 'Exerciții',
  'ecran-nutritie': 'Nutriție',
  'ecran-progres': 'Progres',
  'ecran-masuratori': 'Corp',
  'ecran-setari': 'Setări',
  'ecran-masa': 'Acasă',
};

// Butonul de navigare activ: același ecran și, pentru Nutriție (MEAL PREP), același grup de file.
function actualizeazaNavigatia() {
  const grup = typeof grupFilaNutritie === 'function' ? grupFilaNutritie(filaNutritie) : null;
  document.querySelectorAll('.navigatie button').forEach(b => {
    const activ = b.dataset.ecran === ecranCurent && (!b.dataset.grup || b.dataset.grup === grup);
    b.classList.toggle('activ', activ);
    if (activ) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

let ecranInainteDeSetari = null;

let ecranCurent = 'ecran-acasa';

function arataEcran(id) {
  asiguraModulEcranului(id);
  if (id === 'ecran-setari' && ecranCurent !== 'ecran-setari') ecranInainteDeSetari = ecranCurent;
  if (id === 'ecran-setari' && typeof deseneazaSetariScanare === 'function') deseneazaSetariScanare();
  const schimbat = id !== ecranCurent;
  ecranCurent = id;
  document.querySelectorAll('.ecran').forEach(s => {
    const activ = s.id === id;
    s.classList.toggle('activ', activ);
    if (activ && schimbat) {
      s.classList.remove('intra');
      void s.offsetWidth; // repornește animația
      s.classList.add('intra');
    }
  });
  actualizeazaNavigatia();
  $('titlu-ecran').textContent = id === 'ecran-nutritie' ? TITLU_GRUP_NUTRITIE[grupFilaNutritie(filaNutritie)] : (TITLURI_ECRANE[id] || 'Jurnal');
  $('btn-setari').classList.toggle('activ', id === 'ecran-setari');
  // Setările au „Înapoi” în antet (în locul semnului mărcii).
  $('btn-inapoi').hidden = id !== 'ecran-setari';
  document.querySelector('.marca-semn').hidden = id === 'ecran-setari';
  if (schimbat) window.scrollTo({ top: 0 });

  // Ecranele cu date se reîncarcă la fiecare deschidere (graficele au nevoie de dimensiunea reală).
  if (id === 'ecran-acasa') randeazaAcasa();
  if (id === 'ecran-masa') randeazaAcasaMasa();
  if (id === 'ecran-biblioteca') { deseneazaFiltre(); randeazaBiblioteca(); }
  if (id === 'ecran-nutritie') randeazaNutritie();
  if (id === 'ecran-progres') arataFilaProgres(!$('progres-realizari').hidden ? 'realizari' : $('progres-istoric').hidden ? 'grafice' : 'istoric');
  if (id === 'ecran-masuratori') reincarcaMasuratori();
  if (id === 'ecran-setari') {
    deseneazaCardCont();
    actualizeazaInfoBackup();
    deseneazaInstantanee();
    deseneazaStareStocare();
  }
  if (typeof navigareDupaEcran === 'function') navigareDupaEcran(); // istoricul pentru „Înapoi”
}

// Ieșirea din Setări: înapoi în istoric dacă se poate, altfel ecranul de dinainte (sau Acasă al modului).
function iesiDinSetari() {
  if (typeof poateMergeInapoi === 'function' && poateMergeInapoi()) { mergiInapoi(); return; }
  const inapoi = ecranInainteDeSetari && ECRANE_MOD[ecranInainteDeSetari] === modCurent ? ecranInainteDeSetari : MODURI[modCurent].acasa;
  arataEcran(inapoi);
}

async function initializeaza() {
  // Subsolul din Setări: versiunea publicată (aceeași cu cea din sw.js și styles.css).
  const v = $('versiune-app');
  if (v && document.body.dataset.versiune) v.textContent = `Gym App 3.0 · versiunea ${document.body.dataset.versiune}`;
  document.querySelectorAll('.navigatie button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.grup) { arataFilaNutritie(filaDinGrup(b.dataset.grup), { randeaza: false }); }
    arataEcran(b.dataset.ecran);
  }));
  document.querySelectorAll('[data-mod-tinta]').forEach(b => b.addEventListener('click', () => schimbaMod(b.dataset.modTinta)));
  $('btn-setari').addEventListener('click', () => {
    if (ecranCurent !== 'ecran-setari') arataEcran('ecran-setari');
    else iesiDinSetari();
  });
  $('btn-inapoi').addEventListener('click', iesiDinSetari);

  // Înălțimea antetului (pe telefon are două rânduri): bara antrenamentului în curs se lipește sub el.
  const antet = document.querySelector('.topbar');
  const masoaraAntet = () => document.documentElement.style.setProperty('--topbar-h', `${antet.offsetHeight}px`);
  masoaraAntet();
  if (typeof ResizeObserver === 'function') new ResizeObserver(masoaraAntet).observe(antet);
  else window.addEventListener('resize', masoaraAntet);

  citesteSetari();
  // tema.js a rulat înaintea butoanelor din antet: acum le marcăm și pe ele.
  if (setari.mod !== modCurent) modCurent = modValid(setari.mod);
  aplicaTema(modCurent);
  initSetari();
  initTimer();
  initSesiune();
  initCorp();
  initProgres();
  initIstoric();
  initBiblioteca();
  initNutritie();
  initBackup();
  initSiguranta();

  // Biblioteca întâi: ciorna are nevoie de tipurile exercițiilor alese de tine.
  try {
    await reincarcaBiblioteca();
  } catch (err) {
    console.warn('Biblioteca nu a putut fi citită', err);
  }
  try {
    await reincarcaIstoric();
  } catch (err) {
    console.warn('Istoricul nu a putut fi citit', err);
    notifica('Istoricul nu a putut fi citit. Dacă problema persistă, restaurează un backup.', 'eroare');
  }
  try {
    await reincarcaNutritie();
  } catch (err) {
    console.warn('Datele de nutriție nu au putut fi citite', err);
  }
  await incarcaCiorna();
  await restaureazaTimerul(); // odihna dintre serii continuă după o reîncărcare (iOS închide aplicația din fundal)
  deseneazaGrupe();
  deseneazaFiltre();
  randeazaBiblioteca();
  deseneazaExercitii();
  tineEcranulAprins();
  // Cu un antrenament în curs, aplicația se deschide direct pe el (în sală contează fiecare secundă).
  // Altfel, pe ecranul Acasă al modului ales ultima dată (GYM MODE sau MEAL PREP).
  // Istoricul pentru „Înapoi” pornește de la Acasă; antrenamentul în curs se pune deasupra lui.
  pornesteNavigarea(MODURI[modCurent].acasa);
  arataEcran(stare.exercitii.length > 0 ? 'ecran-sesiune' : MODURI[modCurent].acasa);
  document.body.classList.remove('se-incarca');
  verificaAntrenamentNeterminat();

  // În fundal, fără să întârzie afișarea:
  pornesteCloud().catch(err => console.warn('Contul nu a pornit', err));
  cerePersistenta();
  copieAutomataSaptamanala();
}

// Verifică dacă foaia de stil încărcată are aceeași versiune ca pagina.
// Dacă nu (fișiere amestecate dintr-un cache vechi), golește cache-ul aplicației și reîncarcă o singură dată.
// Întoarce true dacă a pornit reîncărcarea.
function verificaVersiuneaFisierelor() {
  const asteptata = document.body.dataset.versiune;
  const css = getComputedStyle(document.documentElement).getPropertyValue('--versiune-css').trim().replace(/["']/g, '');
  if (!asteptata || css === asteptata) {
    try { sessionStorage.removeItem('reincarcareVersiune'); } catch (_) { /* ignorat */ }
    return false;
  }
  let incercat = null;
  try { incercat = sessionStorage.getItem('reincarcareVersiune'); } catch (_) { /* ignorat */ }
  console.warn(`Foaia de stil are versiunea „${css || 'veche'}", pagina „${asteptata}".`);
  if (incercat === asteptata) return false; // am încercat deja o dată: nu intrăm în buclă
  try { sessionStorage.setItem('reincarcareVersiune', asteptata); } catch (_) { /* ignorat */ }
  const goleste = 'caches' in window
    ? caches.keys().then(chei => Promise.all(chei.map(c => caches.delete(c))))
    : Promise.resolve();
  const actualizeaza = navigator.serviceWorker
    ? navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {})
    : Promise.resolve();
  Promise.all([goleste, actualizeaza]).finally(() => location.reload());
  return true;
}

if (verificaVersiuneaFisierelor()) {
  // Pagina se reîncarcă; nu mai pornim aplicația cu stilurile greșite.
} else initializeaza().catch(err => {
  console.error(err);
  document.body.classList.remove('se-incarca');
  notifica('Aplicația nu a putut porni complet. Reîncarcă pagina.', 'eroare');
});

// Service worker: aplicația funcționează offline după prima încărcare. Necesită HTTPS sau localhost.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* fără offline, aplicația merge oricum */ });
}
