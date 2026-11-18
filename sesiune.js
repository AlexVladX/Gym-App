// Ecranul Antrenament: sesiunea în curs, exerciții, serii, recorduri, sugestii, închidere.

const GRUPE = ['Piept', 'Spate', 'Umeri', 'Biceps', 'Triceps', 'Picioare', 'Gambe', 'Fese', 'Abdomen', 'Antebrațe'];

const stare = {
  grupe: new Set(),
  exercitii: [], // { nume, serii: [{ kg, repetari }] }
  inceput: null,
};

// Istoricul și recordurile, ținute în memorie (se reîncarcă după fiecare salvare).
// Funcțiile de calcul sunt în analiza.js.
let istoric = [];
let recorduri = new Map();

async function reincarcaIstoric() {
  istoric = await toateSesiunile();
  recorduri = recorduriDin(istoric);
}

// ---------- Ciornă (sesiunea în curs) ----------
// Se salvează la 400 ms după ultima modificare și imediat când aplicația trece în fundal
// sau se închide, ca ultima modificare să nu se piardă.
let timerCiorna = null;

function dateCiorna() {
  return { grupe: [...stare.grupe], exercitii: stare.exercitii, inceput: stare.inceput };
}

function programeazaCiorna() {
  clearTimeout(timerCiorna);
  timerCiorna = setTimeout(salveazaCiornaAcum, 400);
  actualizeazaSumarSesiune();
}

function salveazaCiornaAcum() {
  if (timerCiorna === null) return Promise.resolve();
  clearTimeout(timerCiorna);
  timerCiorna = null;
  const goala = stare.exercitii.length === 0 && stare.grupe.size === 0;
  const operatie = goala ? stergeCiorna() : salveazaCiorna(dateCiorna());
  return operatie.catch(err => {
    console.warn('Ciorna nu a putut fi salvată', err);
    notifica('Antrenamentul în curs nu a putut fi salvat pe telefon. Verifică spațiul liber.', 'eroare');
  });
}

// ---------- Grupe ----------
function deseneazaGrupe() {
  $('grupe').replaceChildren(...GRUPE.map(nume => el('button', {
    class: 'chip' + (stare.grupe.has(nume) ? ' activ' : ''),
    type: 'button',
    'aria-pressed': stare.grupe.has(nume) ? 'true' : 'false',
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

// ---------- Sumarul sesiunii în curs ----------
let intervalDurata = null;

function seriiCompletate() {
  let serii = 0;
  let volum = 0;
  for (const ex of stare.exercitii) {
    for (const s of ex.serii) {
      const kg = valoareNumerica(s.kg) ?? 0;
      const rep = valoareNumerica(s.repetari) ?? 0;
      if (rep > 0) { serii++; volum += kg * rep; }
    }
  }
  return { serii, volum };
}

function actualizeazaSumarSesiune() {
  const activa = stare.inceput !== null || stare.exercitii.length > 0;
  $('sesiune-titlu').textContent = activa ? 'Antrenament în curs' : 'Antrenament nou';
  $('sesiune-subtitlu').textContent = activa
    ? 'Se salvează automat pe telefon, chiar dacă închizi aplicația.'
    : 'Alege grupele, apoi adaugă primul exercițiu.';
  $('sesiune-statistici').hidden = !activa;
  $('btn-renunta').hidden = !activa;
  $('sesiune-actiuni').hidden = stare.exercitii.length === 0;
  const { serii, volum } = seriiCompletate();
  $('stat-exercitii').textContent = String(stare.exercitii.length);
  $('stat-serii').textContent = String(serii);
  $('stat-volum').textContent = formatMare(volum);
  actualizeazaDurata();

  clearInterval(intervalDurata);
  if (stare.inceput !== null) intervalDurata = setInterval(actualizeazaDurata, 1000);
}

function actualizeazaDurata() {
  $('stat-durata').textContent = stare.inceput !== null
    ? formatDurata((Date.now() - stare.inceput) / 1000)
    : '0:00';
}

// ---------- Exerciții și serii ----------
async function adaugaExercitiu() {
  deblocheazaAudio();
  const input = $('exercitiu-nume');
  const nume = input.value.trim().replace(/\s+/g, ' ');
  if (!nume) {
    input.focus();
    return;
  }

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
  if (tip && !era) notifica(`Record nou la ${ex.nume}: ${ETICHETE_RECORD[tip]}!`, 'record');
}

function randSerie(ex, s, i) {
  const insigna = el('span', { class: 'insigna', text: 'PR' });
  const rand = el('div', { class: 'serie' });
  const camp = (cheie, eticheta, mod) => el('input', {
    type: 'number', inputmode: mod, min: '0', step: mod === 'decimal' ? 'any' : '1',
    placeholder: eticheta, value: s[cheie], 'aria-label': `${eticheta}, seria ${i + 1}`,
    onchange: e => { s[cheie] = e.target.value; programeazaCiorna(); actualizeazaRecordRand(rand, ex, s); },
  });
  rand.append(
    el('span', { class: 'serie-numar', text: String(i + 1) }),
    camp('kg', 'kg', 'decimal'),
    camp('repetari', 'rep.', 'numeric'),
    buton({
      icon: 'x', tip: 'fantoma', eticheta: `Șterge seria ${i + 1}`, clasa: 'serie-sterge',
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
    return el('p', { class: 'nota', text: 'Prima dată la acest exercițiu. Seriile de azi devin reperul.' });
  }
  const sug = sugestieProgresie(ultima, setari);
  const copii = [
    el('div', { class: 'sugestie-cap' }, [
      iconita('istoric', 'iconita mica'),
      el('span', { text: `Data trecută · ${afiseazaData(ultima.data)}` }),
    ]),
    el('p', { class: 'sugestie-serii', text: rezumatSerii(ultima.serii) }),
  ];
  if (sug) {
    copii.push(
      el('p', { class: 'sugestie-text' + (sug.crestere ? ' crestere' : ''), text: (sug.crestere ? '⬆ ' : '→ ') + sug.text }),
      buton({ text: 'Aplică sugestia', tip: 'secundar', mic: true, onclick: () => aplicaSugestia(ex, sug) }),
    );
  }
  return el('div', { class: 'sugestie' }, copii);
}

// Pentru exercițiile noi, fără grupă: o listă din care alegi grupa (o singură dată).
function alegereGrupa(ex) {
  if (grupaExercitiu(ex.nume)) return null;
  const select = el('select', {
    'aria-label': `Grupa musculară pentru ${ex.nume}`,
    onchange: e => { if (e.target.value) seteazaGrupa(ex.nume, e.target.value); },
  }, [
    el('option', { value: '', text: 'Alege grupa musculară principală…' }),
    ...GRUPE.map(g => el('option', { value: g, text: g })),
  ]);
  return el('div', { class: 'grupa-noua' }, [
    el('p', { class: 'nota', text: 'Exercițiu nou: ce grupă lucrează în principal? (pentru seriile pe săptămână)' }),
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

async function scoateExercitiul(ex) {
  if (ex.serii.length) {
    const da = await confirma({
      titlu: 'Scoți exercițiul?',
      text: `${ex.nume} și ${plural(ex.serii.length, 'serie', 'serii')} vor fi scoase din antrenamentul de azi.`,
      ok: 'Scoate', pericol: true,
    });
    if (!da) return;
  }
  const i = stare.exercitii.indexOf(ex);
  if (i >= 0) stare.exercitii.splice(i, 1);
  deseneazaExercitii();
  programeazaCiorna();
}

function deseneazaExercitii() {
  const lista = $('exercitii');
  if (stare.exercitii.length === 0) {
    lista.replaceChildren(stareGoala({
      icon: 'gantera',
      titlu: 'Niciun exercițiu încă',
      text: 'Scrie numele unui exercițiu mai sus, sau pornește de la bibliotecă ori de la o rutină salvată.',
      actiune: el('div', { class: 'rand-butoane' }, [
        buton({ text: 'Bibliotecă', icon: 'carte', onclick: () => deschideBiblioteca('exercitii') }),
        buton({ text: 'Rutine', icon: 'lista', onclick: () => deschideBiblioteca('antrenamente') }),
      ]),
    }));
    actualizeazaSumarSesiune();
    return;
  }
  lista.replaceChildren(...stare.exercitii.map(ex => {
    const grupa = grupaExercitiu(ex.nume);
    return el('article', { class: 'card exercitiu' }, [
      el('div', { class: 'exercitiu-cap' }, [
        miniatura(ex.nume, 'figura-mica'),
        el('div', { class: 'exercitiu-titlu' }, [
          el('h3', { text: ex.nume }),
          grupa ? el('span', { class: 'eticheta-grupa', text: grupa }) : null,
        ]),
        buton({ icon: 'cos', tip: 'fantoma', eticheta: `Scoate ${ex.nume}`, onclick: () => scoateExercitiul(ex) }),
      ]),
      alegereGrupa(ex),
      casetaSugestie(ex),
      ex.serii.length ? el('div', { class: 'serie serie-antet', 'aria-hidden': 'true' }, [
        el('span', { text: 'Serie' }), el('span', { text: 'kg' }), el('span', { text: 'Repetări' }), el('span'),
      ]) : null,
      ...ex.serii.map((s, i) => randSerie(ex, s, i)),
      buton({ text: 'Adaugă serie', icon: 'plus', tip: 'secundar', lat: true, onclick: () => adaugaSerie(ex) }),
    ]);
  }));
  actualizeazaSumarSesiune();
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
    notifica('Grupa nu a putut fi salvată.', 'eroare');
    return;
  }
  grupeProprii.set(nume.toLowerCase(), grupa);
  stare.grupe.add(grupa);
  deseneazaGrupe();
  deseneazaExercitii();
  programeazaCiorna();
}

// ---------- Închiderea sesiunii ----------
function exercitiiDeSalvat() {
  return stare.exercitii
    .map(ex => ({
      nume: ex.nume,
      serii: ex.serii
        .filter(s => s.kg !== '' || s.repetari !== '')
        .map(s => ({ kg: Number(s.kg) || 0, repetari: Number(s.repetari) || 0 })),
    }))
    .filter(ex => ex.serii.length > 0);
}

async function inchideSesiunea() {
  const exercitii = exercitiiDeSalvat();
  if (exercitii.length === 0) {
    notifica('Adaugă cel puțin o serie înainte să închei antrenamentul.', 'eroare');
    return;
  }

  const sfarsit = Date.now();
  const numarSerii = exercitii.reduce((t, ex) => t + ex.serii.length, 0);
  const volum = exercitii.reduce((t, ex) =>
    t + ex.serii.reduce((v, s) => v + s.kg * s.repetari, 0), 0);
  const durataMin = Math.max(1, Math.round((sfarsit - (stare.inceput ?? sfarsit)) / 60000));

  const da = await confirma({
    titlu: 'Închei antrenamentul?',
    text: `${plural(exercitii.length, 'exercițiu', 'exerciții')} · ${plural(numarSerii, 'serie', 'serii')} · ${durataMin} min · ${formatMare(volum)} kg volum. Seriile goale nu se salvează.`,
    ok: 'Salvează antrenamentul',
  });
  if (!da) return;

  // Recordurile se numără înainte de salvare, față de istoricul de până acum.
  let numarRecorduri = 0;
  for (const ex of exercitii) {
    if (ex.serii.some(s => esteRecord(recorduri, ex.nume, s.kg, s.repetari))) numarRecorduri++;
  }

  try {
    await salveazaSesiune({
      data: dataLocala(),
      inceput: stare.inceput ?? sfarsit,
      sfarsit,
      grupe: [...stare.grupe],
      exercitii,
    });
    for (const ex of exercitii) await adaugaInBiblioteca(ex.nume);
    clearTimeout(timerCiorna);
    timerCiorna = null;
    await stergeCiorna();
  } catch (err) {
    console.error(err);
    notifica('Antrenamentul nu a putut fi salvat. Încearcă din nou; datele introduse sunt păstrate.', 'eroare');
    return;
  }

  golesteSesiunea();
  await reincarcaIstoric().catch(err => console.warn(err));
  deseneazaExercitii();
  reincarcaBiblioteca().catch(() => {});
  notifica(`Antrenament salvat: ${plural(exercitii.length, 'exercițiu', 'exerciții')}, ${plural(numarSerii, 'serie', 'serii')}, ${durataMin} min.`, 'succes');
  if (numarRecorduri) notifica(`Recorduri noi la ${plural(numarRecorduri, 'exercițiu', 'exerciții')}!`, 'record');
}

function golesteSesiunea() {
  stare.grupe.clear();
  stare.exercitii = [];
  stare.inceput = null;
  opresteTimerul();
  elibereazaEcranul();
  deseneazaGrupe();
}

async function renuntaLaSesiune() {
  const { serii } = seriiCompletate();
  const da = await confirma({
    titlu: 'Renunți la antrenament?',
    text: serii
      ? `Cele ${plural(serii, 'serie', 'serii')} introduse azi se vor pierde. Istoricul salvat nu se schimbă.`
      : 'Antrenamentul în curs se golește. Istoricul salvat nu se schimbă.',
    ok: 'Renunță la antrenament', anulare: 'Continuă', pericol: true,
  });
  if (!da) return;
  clearTimeout(timerCiorna);
  timerCiorna = null;
  try {
    await stergeCiorna();
  } catch (err) {
    console.error(err);
    notifica('Antrenamentul nu a putut fi golit. Încearcă din nou.', 'eroare');
    return;
  }
  golesteSesiunea();
  deseneazaExercitii();
  notifica('Antrenamentul a fost golit.', 'info');
}

// ---------- Rutine proprii ----------
// Salvează lista de exerciții (fără greutăți) ca rutină reutilizabilă.
async function salveazaCaRutina(exercitii, grupe, numeImplicit) {
  const nume = await cereText({
    titlu: 'Salvează ca rutină',
    text: `${plural(new Set(exercitii).size, 'exercițiu', 'exerciții')}, fără greutăți. O găsești în Exerciții → Rutine.`,
    eticheta: 'Numele rutinei',
    valoare: numeImplicit,
  });
  if (!nume) return false;
  try {
    await salveazaRutina({ nume, grupe: [...new Set(grupe)], exercitii: [...new Set(exercitii)], creat: Date.now() });
  } catch (err) {
    console.error(err);
    notifica('Rutina nu a putut fi salvată.', 'eroare');
    return false;
  }
  notifica(`Rutina „${nume}" a fost salvată.`, 'succes');
  return true;
}

// ---------- Inițializare ----------
function initSesiune() {
  $('btn-exercitiu').addEventListener('click', adaugaExercitiu);
  $('exercitiu-nume').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adaugaExercitiu(); }
  });
  $('btn-inchide').addEventListener('click', inchideSesiunea);
  $('btn-renunta').addEventListener('click', renuntaLaSesiune);
  $('btn-rutina').addEventListener('click', () => {
    const grupe = stare.grupe.size ? [...stare.grupe] : stare.exercitii.map(e => grupaExercitiu(e.nume)).filter(Boolean);
    salveazaCaRutina(stare.exercitii.map(e => e.nume), grupe, [...stare.grupe].join(', '));
  });

  // Salvare imediată a ciornei când aplicația trece în fundal sau se închide.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') salveazaCiornaAcum();
    else {
      tineEcranulAprins();
      actualizeazaTimerul(); // recalculează imediat timpul rămas
      actualizeazaDurata();
    }
  });
  window.addEventListener('pagehide', () => { salveazaCiornaAcum(); });
  // Unele browsere cer un tap înainte de prima blocare: încercăm la orice atingere.
  document.addEventListener('click', () => tineEcranulAprins());
}

async function incarcaCiorna() {
  try {
    const ciorna = await citesteCiorna();
    if (ciorna && Array.isArray(ciorna.exercitii)) {
      stare.grupe = new Set(Array.isArray(ciorna.grupe) ? ciorna.grupe : []);
      stare.exercitii = ciorna.exercitii
        .filter(ex => ex && typeof ex.nume === 'string')
        .map(ex => ({ ...ex, serii: Array.isArray(ex.serii) ? ex.serii : [] }));
      stare.inceput = Number.isFinite(ciorna.inceput) ? ciorna.inceput : null;
    }
  } catch (err) {
    console.warn('Ciorna nu a putut fi citită', err);
  }
}
