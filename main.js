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

// Butonul de navigare activ: același ecran și, pentru modul Nutriție, același grup de file.
function actualizeazaNavigatia() {
  const grup = typeof grupFilaNutritie === 'function' ? grupFilaNutritie(filaNutritie) : null;
  document.querySelectorAll('.navigatie button').forEach(b => {
    const activ = b.dataset.ecran === ecranCurent && (!b.dataset.grup || b.dataset.grup === grup);
    b.classList.toggle('activ', activ);
    if (activ) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

let ecranInainteDeSetari = null;

// ---------- Setările pe categorii (etapa 5) ----------
// '' = lista categoriilor; altfel categoria deschisă (un „ecran” separat, cu „Înapoi” și intrare în istoric).
const CATEGORII_SETARI = { cont: 'Cont și sincronizare', antrenament: 'Antrenament', progresie: 'Progresie', scanare: 'Scanarea meselor', nutritie: 'Nutriție', aspect: 'Aspect', date: 'Date și backup', despre: 'Despre' };
const NUME_TEME = { intunecata: 'Întunecată', deschisa: 'Deschisă', sistem: 'Ca sistemul' };

// Setări → Antrenament: echipamentul din sala ta (etapa 7, funcția 3). Gol = totul disponibil.
function deseneazaSetareEchipament() {
  const zona = $('set-echipament');
  if (!zona) return;
  const ales = new Set(setari.echipamentSala || []);
  zona.replaceChildren(
    el('h2', { text: 'Echipamentul din sala mea' }),
    el('p', { class: 'nota', text: 'Bifează ce ai la dispoziție. La „Schimbă” exercițiul, alternativele care cer altceva coboară la final. Fără nimic bifat, totul e considerat disponibil.' }),
    el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Echipamentul din sala mea' }, ECHIPAMENTE_SALA.map(e => el('button', {
      type: 'button', class: 'chip chip-mic' + (ales.has(e) ? ' activ' : ''), 'aria-pressed': String(ales.has(e)), text: e,
      onclick: () => {
        if (ales.has(e)) ales.delete(e); else ales.add(e);
        setari.echipamentSala = curataEchipamentSala([...ales]);
        salveazaSetari(); deseneazaSetareEchipament();
      },
    }))),
    el('p', { class: 'nota nota-mica', text: 'Greutatea corpului e mereu disponibilă.' }));
}

// Setări → Nutriție (etapa 7): necesarul adaptiv și istoricul țintelor aplicate.
function deseneazaSetariNecesar() {
  const zona = $('set-necesar'), zIst = $('set-istoric-tinte');
  if (!zona) return;
  const n = curataNecesarAdaptiv(setari.necesarAdaptiv);
  const scrie = modificari => {
    setari.necesarAdaptiv = { ...curataNecesarAdaptiv(setari.necesarAdaptiv), ...modificari };
    setari.necesarAdaptiv = curataNecesarAdaptiv(setari.necesarAdaptiv);
    salveazaSetari(); deseneazaSetariNecesar(); afiseazaCategorieSetari();
  };
  const chipuri = (optiuni, activ, laAlegere, eticheta) => el('div', { class: 'chipuri chipuri-mici', role: 'radiogroup', 'aria-label': eticheta },
    optiuni.map(([v, t]) => el('button', { type: 'button', role: 'radio', class: 'chip chip-mic' + (activ === v ? ' activ' : ''), 'aria-checked': String(activ === v), text: t, onclick: () => laAlegere(v) })));
  const select = (optiuni, activ, laAlegere, eticheta) => {
    const s = el('select', { 'aria-label': eticheta, onchange: () => laAlegere(s.value) },
      optiuni.map(([v, t]) => el('option', { value: String(v), text: t, selected: String(v) === String(activ) })));
    return s;
  };
  const procente = (min, max, pas) => { const r = []; for (let v = min; v <= max + 1e-9; v += pas) r.push(Math.round(v * 100) / 100); return r; };
  const fp = v => String(v).replace('.', ',');
  const copii = [
    el('h2', { text: 'Necesar caloric adaptiv' }),
    el('p', { class: 'nota', text: 'Din cântăririle din Corp și din ce bifezi ca mâncat, aplicația calculează cât ardei de fapt și îți propune o dată pe săptămână țintele potrivite. Țintele se schimbă doar dacă apeși „Aplică”.' }),
    chipuri([[true, 'Pornit'], [false, 'Oprit']], n.pornit, v => scrie({ pornit: v }), 'Necesar adaptiv'),
  ];
  if (n.pornit) {
    const r = RITM_OBIECTIV;
    copii.push(
      el('label', { class: 'camp mt' }, [el('span', { class: 'camp-eticheta', text: 'Ziua verificării' }),
        select([1, 2, 3, 4, 5, 6, 0].map(z => [z, ZILE_SAPTAMANA_NUME[z][0].toUpperCase() + ZILE_SAPTAMANA_NUME[z].slice(1)]), n.ziVerificare, v => scrie({ ziVerificare: Number(v) }), 'Ziua verificării')]),
      el('div', { class: 'grila-2' }, [
        el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Ritm la masă musculară' }),
          select(procente(r.masa.min, r.masa.max, 0.05).map(v => [v, `+${fp(v)}% pe săpt.`]), n.ritmMasa ?? r.masa.implicit, v => scrie({ ritmMasa: Number(v) }), 'Ritm la masă musculară')]),
        el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Ritm la slăbire' }),
          select(procente(r.slabire.min, r.slabire.max, 0.05).map(v => [v, `−${fp(v)}% pe săpt.`]), n.ritmSlabire ?? r.slabire.implicit, v => scrie({ ritmSlabire: Number(v) }), 'Ritm la slăbire')]),
      ]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Proteine' }),
        select([['', 'După obiectiv (2,0 / 1,8 / 2,2 g/kg)'], ...procente(1.6, 2.6, 0.1).map(v => [v, `${fp(v)} g/kg`])], n.proteinePeKg ?? '', v => {
          const x = { ...curataNecesarAdaptiv(setari.necesarAdaptiv) };
          if (v === '') delete x.proteinePeKg; else x.proteinePeKg = Number(v);
          setari.necesarAdaptiv = x; salveazaSetari(); deseneazaSetariNecesar();
        }, 'Proteine pe kg corp')]),
      el('p', { class: 'nota nota-mica', text: 'Ritmul e procentul din greutate cu care vrei să crești sau să scazi pe săptămână; obiectivul (masă, menținere, slăbire) îl alegi la Ținte, în Ziua mea. Estimările sunt orientative, nu recomandări medicale.' }));
  }
  zona.replaceChildren(...copii);
  const ist = curataIstoricTinte(setari.istoricTinte).slice().reverse();
  const fmt = t => (t ? `${fmtNrSetari(t.kcal)} kcal${t.proteine ? ` · P ${t.proteine}` : ''}${t.carbohidrati != null ? ` · C ${t.carbohidrati}` : ''}${t.grasimi ? ` · G ${t.grasimi}` : ''}` : 'fără ținte');
  zIst.replaceChildren(el('h2', { text: 'Istoricul țintelor' }), ist.length
    ? el('ul', { class: 'lista-istoric-tinte' }, ist.slice(0, 12).map(x => el('li', {}, [
      el('strong', { text: afiseazaData(x.data) }),
      el('span', { text: `${fmt(x.vechi)} → ${fmt(x.noi)}` }),
      x.necesar ? el('span', { class: 'nota nota-mica', text: `necesar estimat ${fmtNrSetari(x.necesar)} kcal` }) : null,
    ])))
    : el('p', { class: 'nota', text: 'Aici apar țintele aplicate din „Verificarea săptămânii”, cu valorile de dinainte.' }));
}
const fmtNrSetari = v => Math.round(v).toLocaleString('ro-RO');

// Setări → Aspect: tema (Întunecată / Deschisă / Ca sistemul).
function deseneazaSetareTema() {
  const zona = $('set-tema');
  if (!zona) return;
  zona.replaceChildren(...Object.entries(NUME_TEME).map(([id, nume]) => el('button', {
    type: 'button', role: 'radio', class: 'chip' + (setari.tema === id ? ' activ' : ''), 'aria-checked': String(setari.tema === id), text: nume,
    onclick: () => { setari.tema = id; salveazaSetari(); schimbaTema(id); deseneazaSetareTema(); },
  })));
}
let categorieSetari = '';

// Rândurile de stare din lista categoriilor.
function stariSetari() {
  const u = typeof sinc !== 'undefined' && sinc.utilizator;
  let ultim = null;
  try { ultim = localStorage.getItem(CHEIE_ULTIM_BACKUP); } catch (_) { /* ignorat */ }
  const zile = ultim ? Math.floor((Date.now() - Date.parse(ultim)) / 86400000) : null;
  const poze = { nu: 'pozele nu se păstrează', 30: 'pozele: 30 de zile', 90: 'pozele: 90 de zile', mereu: 'pozele: păstrate' }[setari.pozeScanare] || '';
  return {
    cont: u ? `Conectat ca ${u.email || 'contul tău'}` : 'Neconectat',
    antrenament: `Odihnă ${formatDurata(setari.pauzaSec)}${setari.pauzaAutomata ? ', automată' : ''}`,
    progresie: `${setari.minRep}–${setari.maxRep} repetări · +${String(setari.pasKg).replace('.', ',')} kg · ${plural(setari.obiectivSaptamanal, 'antrenament', 'antrenamente')} pe săptămână`,
    scanare: `${setari.limitaScanari ? `${plural(setari.limitaScanari, 'scanare', 'scanări')} pe zi` : 'limita serverului'} · ${poze}`,
    date: zile === null ? 'Ultimul backup: niciodată' : `Ultimul backup: ${zile === 0 ? 'azi' : `acum ${plural(zile, 'zi', 'zile')}`}`,
    nutritie: (() => { const n = curataNecesarAdaptiv(setari.necesarAdaptiv); return n.pornit ? `Necesar adaptiv pornit · verificarea ${ZILE_SAPTAMANA_NUME[n.ziVerificare]}` : 'Necesar adaptiv oprit'; })(),
    aspect: `Temă: ${(NUME_TEME[setari.tema] || NUME_TEME.intunecata).toLowerCase()}`,
    despre: `Versiunea ${document.body.dataset.versiune || ''}`,
  };
}

function afiseazaCategorieSetari() {
  const cat = CATEGORII_SETARI[categorieSetari] ? categorieSetari : '';
  $('setari-lista').hidden = Boolean(cat);
  document.querySelectorAll('.setari-categorie').forEach(c => { c.hidden = c.dataset.categorie !== cat; });
  if (!cat) {
    const st = stariSetari();
    for (const k of Object.keys(CATEGORII_SETARI)) { const e = $(`stare-set-${k}`); if (e) e.textContent = st[k]; }
  }
  if (ecranCurent === 'ecran-setari') $('titlu-ecran').textContent = cat ? CATEGORII_SETARI[cat] : 'Setări';
}

function deschideCategorieSetari(cat) {
  categorieSetari = cat;
  afiseazaCategorieSetari();
  window.scrollTo({ top: 0 });
  if (typeof navigareDupaEcran === 'function') navigareDupaEcran();
}

let ecranCurent = 'ecran-acasa';

// Ecranele modului Nutriție au nevoie de modulele încărcate la cerere (incarcare.js).
const ECRANE_NUTRITIE = ['ecran-nutritie', 'ecran-masa'];

function arataEcran(id) {
  asiguraModulEcranului(id);
  const asteaptaNutritia = ECRANE_NUTRITIE.includes(id) && !nutritiePornita;
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
  $('titlu-ecran').textContent = id === 'ecran-nutritie' && !asteaptaNutritia ? TITLU_GRUP_NUTRITIE[grupFilaNutritie(filaNutritie)] : (TITLURI_ECRANE[id] || 'Jurnal');
  $('btn-setari').classList.toggle('activ', id === 'ecran-setari');
  // Setările au „Înapoi” în antet (în locul semnului mărcii).
  $('btn-inapoi').hidden = id !== 'ecran-setari';
  document.querySelector('.marca-semn').hidden = id === 'ecran-setari';
  if (schimbat) window.scrollTo({ top: 0 });

  if (asteaptaNutritia) {
    // Prima intrare în Nutriție: încărcăm modulele (din cache, de obicei sub o secundă), apoi desenăm ecranul.
    const sectiune = $(id);
    sectiune.setAttribute('aria-busy', 'true');
    incarcaNutritia().then(() => {
      sectiune.removeAttribute('aria-busy');
      if (ecranCurent === id) arataEcran(id);
    }).catch(err => {
      sectiune.removeAttribute('aria-busy');
      console.error(err);
      notifica('Nutriția nu a putut fi încărcată. Verifică internetul și încearcă din nou.', 'eroare', 6000,
        { text: 'Reîncearcă', onclick: () => arataEcran(id) });
    });
    actualizeazaButonAdaugare();
    if (typeof navigareDupaEcran === 'function') navigareDupaEcran();
    return;
  }
  // Ecranele cu date se reîncarcă la fiecare deschidere (graficele au nevoie de dimensiunea reală).
  if (id === 'ecran-acasa') randeazaAcasa();
  if (id === 'ecran-masa') randeazaAcasaMasa();
  if (id === 'ecran-biblioteca') { deseneazaFiltre(); randeazaBiblioteca(); }
  if (id === 'ecran-nutritie') randeazaNutritie();
  if (id === 'ecran-progres') arataFilaProgres(!$('progres-realizari').hidden ? 'realizari' : $('progres-istoric').hidden ? 'grafice' : 'istoric');
  if (id === 'ecran-masuratori') reincarcaMasuratori();
  if (id === 'ecran-setari') {
    afiseazaCategorieSetari();
    deseneazaSetareTema();
    deseneazaSetariNecesar();
    deseneazaSetareEchipament();
    deseneazaCardCont();
    actualizeazaInfoBackup();
    deseneazaInstantanee();
    deseneazaStareStocare();
  }
  actualizeazaButonAdaugare();
  if (typeof navigareDupaEcran === 'function') navigareDupaEcran(); // istoricul pentru „Înapoi”
}

// Butonul plutitor „+” apare pe Acasă (Nutriție) și pe Ziua mea.
function actualizeazaButonAdaugare() {
  const b = $('btn-adauga-rapid');
  if (!b) return;
  const fila = typeof filaNutritie !== 'undefined' ? filaNutritie : null;
  b.hidden = !nutritiePornita || !(ecranCurent === 'ecran-masa' || (ecranCurent === 'ecran-nutritie' && fila === 'zi'));
}

// Ieșirea din Setări: înapoi în istoric dacă se poate, altfel ecranul de dinainte (sau Acasă al modului).
function iesiDinSetari() {
  if (typeof poateMergeInapoi === 'function' && poateMergeInapoi()) { mergiInapoi(); return; }
  if (categorieSetari) { deschideCategorieSetari(''); return; } // fără istoric: din categorie înapoi la listă
  const inapoi = ecranInainteDeSetari && ECRANE_MOD[ecranInainteDeSetari] === modCurent ? ecranInainteDeSetari : MODURI[modCurent].acasa;
  arataEcran(inapoi);
}

async function initializeaza() {
  // Subsolul din Setări: versiunea publicată (aceeași cu cea din sw.js și styles.css).
  const v = $('versiune-app');
  if (v && document.body.dataset.versiune) v.textContent = `Gym App 3.0 · versiunea ${document.body.dataset.versiune}`;
  document.querySelectorAll('.navigatie button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.grup) { const g = b.dataset.grup; dupaIncarcareNutritie(() => arataFilaNutritie(filaDinGrup(g), { randeaza: false })); }
    arataEcran(b.dataset.ecran);
  }));
  document.querySelectorAll('[data-mod-tinta]').forEach(b => b.addEventListener('click', () => schimbaMod(b.dataset.modTinta)));
  $('btn-setari').addEventListener('click', () => {
    if (ecranCurent !== 'ecran-setari') { categorieSetari = ''; arataEcran('ecran-setari'); }
    else iesiDinSetari();
  });
  document.querySelectorAll('.setari-rand').forEach(b => b.addEventListener('click', () => deschideCategorieSetari(b.dataset.categorie)));
  $('btn-inapoi').addEventListener('click', iesiDinSetari);
  $('btn-adauga-rapid').addEventListener('click', () => { if (typeof deschideAdaugareRapida === 'function') deschideAdaugareRapida(); });

  // Înălțimea antetului (pe telefon are două rânduri): bara antrenamentului în curs se lipește sub el.
  const antet = document.querySelector('.topbar');
  const masoaraAntet = () => document.documentElement.style.setProperty('--topbar-h', `${antet.offsetHeight}px`);
  masoaraAntet();
  if (typeof ResizeObserver === 'function') new ResizeObserver(masoaraAntet).observe(antet);
  else window.addEventListener('resize', masoaraAntet);

  citesteSetari();
  actualizeazaTexteConfidentialitate();
  // tema.js a rulat înaintea butoanelor din antet: acum le marcăm și pe ele.
  if (setari.mod !== modCurent) modCurent = modValid(setari.mod);
  temaCurenta = setari.tema || 'intunecata';
  aplicaTema(modCurent);
  initSetari();
  initTimer();
  initSesiune();
  initCorp();
  initProgres();
  initIstoric();
  initBiblioteca();
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
  // Modul Nutriție la pornire: modulele lui se încarcă acum (în modul Sală, abia la prima intrare în Nutriție).
  if (modCurent === 'mealprep') await incarcaNutritia().catch(err => console.warn('Nutriția nu a putut fi încărcată', err));
  await incarcaCiorna();
  await restaureazaTimerul(); // odihna dintre serii continuă după o reîncărcare (iOS închide aplicația din fundal)
  deseneazaGrupe();
  deseneazaFiltre();
  randeazaBiblioteca();
  deseneazaExercitii();
  tineEcranulAprins();
  // Cu un antrenament în curs, aplicația se deschide direct pe el (în sală contează fiecare secundă).
  // Altfel, pe ecranul Acasă al modului ales ultima dată (Sală sau Nutriție).
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
// Versiunea nouă se instalează în fundal și așteaptă. La pornire (primele secunde, fără antrenament în curs) o
// activăm imediat și reîncărcăm; mai târziu doar o anunțăm discret, cu „Reîncarcă” — niciodată forțat.
const PORNIRE_APLICATIE = Date.now();
let reincarcaLaActivare = false;
function activeazaVersiuneaNoua(sw) {
  reincarcaLaActivare = true;
  sw.postMessage({ tip: 'activeaza' });
}
function laVersiuneNoua(sw) {
  const laPornire = Date.now() - PORNIRE_APLICATIE < 8000;
  const inAntrenament = typeof stare !== 'undefined' && stare.exercitii && stare.exercitii.length > 0;
  if (laPornire && !inAntrenament) { activeazaVersiuneaNoua(sw); return; }
  notifica(inAntrenament ? 'Versiune nouă disponibilă. Antrenamentul e salvat; poți reîncărca oricând.' : 'Versiune nouă disponibilă.',
    'info', 20000, { text: 'Reîncarcă', onclick: () => activeazaVersiuneaNoua(sw) });
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) laVersiuneNoua(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nou = reg.installing;
      if (!nou) return;
      nou.addEventListener('statechange', () => {
        if (nou.state === 'installed' && navigator.serviceWorker.controller) laVersiuneNoua(nou);
      });
    });
  }).catch(() => { /* fără offline, aplicația merge oricum */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reincarcaLaActivare) return;
    reincarcaLaActivare = false;
    Promise.resolve(typeof salveazaCiornaAcum === 'function' ? salveazaCiornaAcum() : null).finally(() => location.reload());
  });
}
