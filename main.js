// Pornirea aplicației și navigarea între ecrane. Se încarcă ultimul.

const TITLURI_ECRANE = {
  'ecran-sesiune': 'Antrenament',
  'ecran-biblioteca': 'Exerciții',
  'ecran-progres': 'Progres',
  'ecran-masuratori': 'Corp',
  'ecran-setari': 'Setări',
};

let ecranCurent = 'ecran-sesiune';

function arataEcran(id) {
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
  document.querySelectorAll('.navigatie button').forEach(b => {
    const activ = b.dataset.ecran === id;
    b.classList.toggle('activ', activ);
    if (activ) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('titlu-ecran').textContent = TITLURI_ECRANE[id] || 'Jurnal';
  $('btn-setari').classList.toggle('activ', id === 'ecran-setari');
  if (schimbat) window.scrollTo({ top: 0 });

  // Ecranele cu date se reîncarcă la fiecare deschidere (graficele au nevoie de dimensiunea reală).
  if (id === 'ecran-progres') arataFilaProgres($('progres-istoric').hidden ? 'grafice' : 'istoric');
  if (id === 'ecran-masuratori') reincarcaMasuratori();
  if (id === 'ecran-setari') {
    actualizeazaInfoBackup();
    deseneazaInstantanee();
    deseneazaStareStocare();
  }
}

async function initializeaza() {
  document.querySelectorAll('.navigatie button').forEach(b =>
    b.addEventListener('click', () => arataEcran(b.dataset.ecran)));
  $('btn-setari').addEventListener('click', () => arataEcran(ecranCurent === 'ecran-setari' ? 'ecran-sesiune' : 'ecran-setari'));

  citesteSetari();
  initSetari();
  initTimer();
  initSesiune();
  initCorp();
  initProgres();
  initIstoric();
  initBiblioteca();
  initBackup();

  await incarcaCiorna();
  try {
    await reincarcaIstoric();
  } catch (err) {
    console.warn('Istoricul nu a putut fi citit', err);
    notifica('Istoricul nu a putut fi citit. Dacă problema persistă, restaurează un backup.', 'eroare');
  }
  try {
    await reincarcaBiblioteca();
  } catch (err) {
    console.warn('Biblioteca nu a putut fi citită', err);
  }
  deseneazaGrupe();
  deseneazaExercitii();
  tineEcranulAprins();
  document.body.classList.remove('se-incarca');

  // În fundal, fără să întârzie afișarea:
  cerePersistenta();
  copieAutomataSaptamanala();
}

initializeaza().catch(err => {
  console.error(err);
  document.body.classList.remove('se-incarca');
  notifica('Aplicația nu a putut porni complet. Reîncarcă pagina.', 'eroare');
});

// Service worker: aplicația funcționează offline după prima încărcare. Necesită HTTPS sau localhost.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* fără offline, aplicația merge oricum */ });
}
