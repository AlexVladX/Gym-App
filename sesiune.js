// Ecranul Antrenament: sesiunea în curs.
// Serii bifate, tipuri de serii și de exerciții, supersets, notițe, pauza antrenamentului,
// performanța anterioară, recorduri, sugestii și închiderea antrenamentului.

// Tipurile de exerciții și câmpurile fiecăruia. Ultimul câmp e „principalul": trebuie > 0 ca seria să conteze.
const TIPURI_EXERCITIU = {
  greutate: { nume: 'Greutate × repetări', scurt: null, campuri: [
    { cheie: 'kg', eticheta: 'kg', mod: 'decimal' }, { cheie: 'repetari', eticheta: 'Rep.', mod: 'numeric' }] },
  corp: { nume: 'Greutatea corpului', detaliu: 'Repetări, cu greutate în plus opțională', scurt: 'Corp', campuri: [
    { cheie: 'kg', eticheta: '+kg', mod: 'decimal' }, { cheie: 'repetari', eticheta: 'Rep.', mod: 'numeric' }] },
  timp: { nume: 'Timp', detaliu: 'Secunde (ex. plank)', scurt: 'Timp', campuri: [
    { cheie: 'durataSec', eticheta: 'Secunde', mod: 'numeric' }] },
  distanta: { nume: 'Greutate × distanță', detaliu: 'Kg și metri (ex. mers cu greutăți)', scurt: 'Distanță', campuri: [
    { cheie: 'kg', eticheta: 'kg', mod: 'decimal' }, { cheie: 'distantaM', eticheta: 'Metri', mod: 'decimal' }] },
};

const TIPURI_SERIE = {
  normal: { nume: 'Serie normală', semn: null },
  incalzire: { nume: 'Încălzire', semn: 'Î', detaliu: 'Nu contează la recorduri și la numărul de serii' },
  drop: { nume: 'Drop set', semn: 'D', detaliu: 'Imediat după seria precedentă, cu greutate mai mică' },
  esec: { nume: 'Până la eșec', semn: 'E', detaliu: 'Ultima repetare nu mai iese' },
};

const PRAG_NETERMINAT_MS = 3 * 3600 * 1000; // după 3 ore fără activitate întrebăm ce faci cu antrenamentul

const stare = {
  grupe: new Set(),
  exercitii: [],          // { id, nume, tip, serii: [serie], nota, superset }
  inceput: null,          // timestamp
  nota: '',
  pauze: [],              // [{ start, sfarsit }]
  pauzaStart: null,       // timestamp, dacă antrenamentul e pe pauză acum
  ultimaActivitate: null, // timestamp
};
// serie: { kg, repetari, durataSec, distantaM (text din câmpuri), tip, facut }

let contorExercitii = 0;
let timerPusDeAntrenament = false; // timerul de pauză a fost oprit de pauza antrenamentului

// Istoricul și recordurile, ținute în memorie (se reîncarcă după fiecare salvare).
let istoric = [];
let recorduri = new Map();

async function reincarcaIstoric() {
  const [sesiuni, masuratori] = await Promise.all([toateSesiunile(), toateMasuratorile().catch(() => [])]);
  // volumul exercițiilor cu greutatea corpului folosește greutatea din Corp (vezi volumSerie în analiza.js)
  configureazaCalcul({
    greutateCorpLa: functieGreutateCorp(masuratori),
    tipExercitiu: nume => (typeof exercitiuDupaNume === 'function' ? exercitiuDupaNume(nume)?.tip : null) || null,
  });
  istoric = sesiuni;
  recorduri = recorduriDin(istoric);
}

// ---------- Ciornă (sesiunea în curs) ----------
// Se salvează la 400 ms după ultima modificare și imediat când aplicația trece în fundal
// sau se închide, ca ultima modificare să nu se piardă.
let timerCiorna = null;

function dateCiorna() {
  return {
    versiune: 2,
    grupe: [...stare.grupe],
    exercitii: stare.exercitii,
    inceput: stare.inceput,
    nota: stare.nota,
    pauze: stare.pauze,
    pauzaStart: stare.pauzaStart,
    ultimaActivitate: stare.ultimaActivitate,
  };
}

function programeazaCiorna() {
  stare.ultimaActivitate = Date.now();
  clearTimeout(timerCiorna);
  timerCiorna = setTimeout(salveazaCiornaAcum, 400);
  actualizeazaSumarSesiune();
}

function salveazaCiornaAcum() {
  if (timerCiorna === null) return Promise.resolve();
  clearTimeout(timerCiorna);
  timerCiorna = null;
  const goala = stare.exercitii.length === 0 && stare.grupe.size === 0 && !stare.nota;
  const operatie = goala ? stergeCiorna() : salveazaCiorna(dateCiorna());
  return operatie.catch(err => {
    console.warn('Ciorna nu a putut fi salvată', err);
    notifica('Antrenamentul în curs nu a putut fi salvat pe telefon. Verifică spațiul liber.', 'eroare');
  });
}

function campuriExercitiu(ex) {
  return (TIPURI_EXERCITIU[ex.tip] || TIPURI_EXERCITIU.greutate).campuri;
}

function campPrincipal(ex) {
  const c = campuriExercitiu(ex);
  return c[c.length - 1].cheie;
}

// ---------- Grupe ----------
// Grupele (din catalog.js), plus una veche („Picioare") dacă e încă bifată într-un antrenament început înainte.
function deseneazaGrupe() {
  const lista = [...GRUPE, ...[...stare.grupe].filter(g => !GRUPE.includes(g))];
  $('grupe').replaceChildren(...lista.map(nume => el('button', {
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

// ---------- Durata și pauza antrenamentului ----------
function durataCurentaMs(acum = Date.now()) {
  return stare.inceput === null ? 0 : durataActiva(stare.inceput, acum, stare.pauze, stare.pauzaStart);
}

function pePauza() { return stare.pauzaStart !== null; }

function puneAntrenamentulPePauza() {
  if (stare.inceput === null || pePauza()) return;
  stare.pauzaStart = Date.now();
  if (timerActiv() && !timerPePauza()) { pauzeazaTimerul(); timerPusDeAntrenament = true; }
  programeazaCiorna();
  notifica('Antrenament pus pe pauză. Durata nu mai crește până îl reiei.', 'info');
}

function reiaAntrenamentul() {
  if (!pePauza()) return;
  stare.pauze.push({ start: stare.pauzaStart, sfarsit: Date.now() });
  stare.pauzaStart = null;
  if (timerPusDeAntrenament && timerPePauza()) reiaTimerul();
  timerPusDeAntrenament = false;
  programeazaCiorna();
}

// ---------- Sumarul sesiunii în curs ----------
let intervalDurata = null;

function valoriSerie(s) {
  return {
    kg: valoareNumerica(s.kg) ?? 0,
    repetari: Math.round(valoareNumerica(s.repetari) ?? 0),
    durataSec: valoareNumerica(s.durataSec) ?? 0,
    distantaM: valoareNumerica(s.distantaM) ?? 0,
    tip: s.tip || 'normal',
  };
}

// Seriile bifate și volumul lor (aceleași reguli ca la istoric: fără încălzire; corp = greutatea ta + lest).
function seriiCompletate() {
  let serii = 0;
  let volum = 0;
  const azi = dataLocala();
  for (const ex of stare.exercitii) {
    for (const s of ex.serii) {
      if (!s.facut) continue;
      const v = valoriSerie(s);
      volum += volumSerie(v, ex, azi, { versiune: 2 });
      if (serieDeLucru(v)) serii++;
    }
  }
  return { serii, volum };
}

function actualizeazaSumarSesiune() {
  const activa = stare.inceput !== null || stare.exercitii.length > 0;
  const pauza = pePauza();
  $('sesiune-titlu').textContent = !activa ? 'Antrenament nou' : pauza ? 'Antrenament pe pauză' : 'Antrenament în curs';
  $('sesiune-subtitlu').textContent = !activa
    ? 'Alege grupele, apoi adaugă primul exercițiu.'
    : pauza ? 'Durata nu crește cât timp e pe pauză. Datele sunt salvate.'
      : 'Bifează ✓ fiecare serie făcută. Se salvează automat pe telefon.';
  $('ecran-sesiune').classList.toggle('pe-pauza', pauza);
  $('sesiune-statistici').hidden = !activa;
  $('sesiune-comenzi').hidden = stare.inceput === null;
  $('btn-renunta').hidden = !activa;
  $('sesiune-actiuni').hidden = stare.exercitii.length === 0;
  $('sesiune-nota-card').hidden = stare.exercitii.length === 0;

  const btnPauza = $('btn-pauza-antrenament');
  btnPauza.replaceChildren(iconita(pauza ? 'play' : 'pauza'), el('span', { text: pauza ? 'Reia antrenamentul' : 'Pauză antrenament' }));
  btnPauza.className = 'btn ' + (pauza ? 'btn-principal' : 'btn-secundar');

  const { serii, volum } = seriiCompletate();
  $('stat-exercitii').textContent = String(stare.exercitii.length);
  $('stat-serii').textContent = String(serii);
  $('stat-volum').textContent = formatMare(volum);
  actualizeazaDurata();

  clearInterval(intervalDurata);
  if (stare.inceput !== null && !pauza) intervalDurata = setInterval(actualizeazaDurata, 1000);
}

function actualizeazaDurata() {
  $('stat-durata').textContent = formatDurata(durataCurentaMs() / 1000);
}

// ---------- Exerciții ----------
function exercitiuNou(nume) {
  const tip = tipExercitiu(nume);
  const ultima = ultimaSesiuneCu(istoric, nume);
  // Același număr de serii ca data trecută, goale: valorile anterioare apar ca sugestie în câmpuri.
  const serii = ultima
    ? ultima.serii.filter(serieValida).map(s => serieGoala(tipSerie(s)))
    : [serieGoala()];
  return { id: ++contorExercitii, nume, tip, serii: serii.length ? serii : [serieGoala()], nota: '', superset: null };
}

function serieGoala(tip = 'normal') {
  return { kg: '', repetari: '', durataSec: '', distantaM: '', tip, facut: false };
}

async function adaugaExercitiu() {
  deblocheazaAudio();
  const input = $('exercitiu-nume');
  // Numele scris se potrivește cu cel din bibliotecă (aceleași litere), ca istoricul să nu se împartă.
  const nume = numeInBiblioteca(input.value.trim().replace(/\s+/g, ' '));
  if (!nume) {
    input.focus();
    return;
  }
  if (stare.inceput === null) stare.inceput = Date.now();
  tineEcranulAprins();

  stare.exercitii.push(exercitiuNou(nume));
  const grupa = grupaExercitiu(nume);
  if (grupa) { stare.grupe.add(grupa); deseneazaGrupe(); }
  input.value = '';
  deseneazaExercitii();
  programeazaCiorna();
}

function adaugaSerie(ex) {
  deblocheazaAudio(); // gest al utilizatorului, necesar pentru sunet pe iOS
  tineEcranulAprins();
  const ultima = ex.serii[ex.serii.length - 1];
  const noua = serieGoala(ultima && ultima.tip !== 'incalzire' ? ultima.tip : 'normal');
  // Preluăm valorile de la seria anterioară, ca să modifici doar ce s-a schimbat.
  if (ultima) for (const c of campuriExercitiu(ex)) noua[c.cheie] = ultima[c.cheie] ?? '';
  ex.serii.push(noua);
  deseneazaExercitii();
  programeazaCiorna();
}

// ---------- Supersets ----------
// Un superset = exerciții consecutive cu același cod. Un cod rămas singur se șterge.
function normalizeazaSupersets() {
  const lista = stare.exercitii;
  lista.forEach((ex, i) => {
    if (!ex.superset) return;
    const vecin = (lista[i - 1] && lista[i - 1].superset === ex.superset) || (lista[i + 1] && lista[i + 1].superset === ex.superset);
    if (!vecin) ex.superset = null;
  });
}

// Literele grupurilor (A, B, C…) în ordinea din antrenament, și poziția fiecărui exercițiu în grup.
function infoSupersets() {
  const info = new Map();
  let litera = 0;
  stare.exercitii.forEach((ex, i) => {
    if (!ex.superset) return;
    const anterior = stare.exercitii[i - 1];
    const inceputGrup = !anterior || anterior.superset !== ex.superset;
    if (inceputGrup) litera++;
    const urmator = stare.exercitii[i + 1];
    info.set(ex, {
      litera: String.fromCharCode(64 + litera),
      primul: inceputGrup,
      ultimul: !urmator || urmator.superset !== ex.superset,
    });
  });
  return info;
}

function legaInSuperset(ex) {
  const i = stare.exercitii.indexOf(ex);
  const urmator = stare.exercitii[i + 1];
  if (!urmator) return;
  const cod = ex.superset || urmator.superset || `s${Date.now().toString(36)}`;
  ex.superset = cod;
  urmator.superset = cod;
  normalizeazaSupersets();
  deseneazaExercitii();
  programeazaCiorna();
}

function scoateDinSuperset(ex) {
  ex.superset = null;
  normalizeazaSupersets();
  deseneazaExercitii();
  programeazaCiorna();
}

function mutaExercitiul(ex, directie) {
  const i = stare.exercitii.indexOf(ex);
  const j = i + directie;
  if (i < 0 || j < 0 || j >= stare.exercitii.length) return;
  [stare.exercitii[i], stare.exercitii[j]] = [stare.exercitii[j], stare.exercitii[i]];
  normalizeazaSupersets();
  deseneazaExercitii();
  programeazaCiorna();
  // Păstrăm exercițiul mutat în câmpul vizual.
  const card = document.querySelector(`[data-ex="${ex.id}"]`);
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---------- Bifarea seriilor și recorduri ----------
const ETICHETE_RECORD = {
  greutate: 'greutate maximă',
  forta: '1RM estimat',
  repetari: 'repetări',
  durata: 'cel mai lung timp',
  distanta: 'cea mai mare distanță',
};

function recordSerie(ex, s) {
  return s.facut ? recordPentruSerie(recorduri, ex.nume, valoriSerie(s)) : null;
}

function bifeazaSerie(ex, s, i) {
  deblocheazaAudio();
  if (s.facut) {
    s.facut = false;
    deseneazaExercitii();
    programeazaCiorna();
    return;
  }
  // Câmpurile goale se completează cu valorile de data trecută (afișate ca sugestie).
  const anterior = serieAnterioara(ex, i);
  for (const c of campuriExercitiu(ex)) {
    if ((s[c.cheie] === '' || s[c.cheie] === undefined || s[c.cheie] === null) && anterior && anterior[c.cheie] > 0) {
      s[c.cheie] = String(anterior[c.cheie]);
    }
  }
  const principal = campPrincipal(ex);
  if (!((valoareNumerica(s[principal]) ?? 0) > 0)) {
    const c = campuriExercitiu(ex).find(x => x.cheie === principal);
    notifica(`Completează ${c.eticheta.toLowerCase()} înainte să bifezi seria.`, 'eroare');
    const input = document.querySelector(`[data-ex="${ex.id}"] [data-serie="${i}"] [data-camp="${principal}"]`);
    if (input) input.focus();
    return;
  }
  for (const c of campuriExercitiu(ex)) {
    const v = valoareNumerica(s[c.cheie]);
    if (v !== null && v < 0) { notifica('Valorile nu pot fi negative.', 'eroare'); return; }
  }
  s.facut = true;
  const tip = recordSerie(ex, s);
  if (tip) notifica(`Record nou la ${ex.nume}: ${ETICHETE_RECORD[tip]}!`, 'record');
  deseneazaExercitii();
  programeazaCiorna();
  tineEcranulAprins();

  // Pauza automată: într-un superset pornește doar după ultimul exercițiu din grup.
  const ss = infoSupersets().get(ex);
  if (setari.pauzaAutomata && !pePauza() && (!ss || ss.ultimul)) porneshteTimerul();
}

// Seria de pe aceeași poziție din ultima sesiune cu acest exercițiu (pentru coloana „Anterior").
function serieAnterioara(ex, i) {
  const ultima = ultimaSesiuneCu(istoric, ex.nume);
  if (!ultima) return null;
  const valide = ultima.serii.filter(serieValida);
  return valide[i] || null;
}

// Eticheta seriei: număr pentru seriile de lucru, literă pentru celelalte.
function eticheteSerii(ex) {
  let n = 0;
  return ex.serii.map(s => {
    const tip = s.tip || 'normal';
    if (tip === 'incalzire') return 'Î';
    n++;
    return TIPURI_SERIE[tip]?.semn || String(n);
  });
}

function meniuSerie(ex, s, i) {
  alegeDinLista({
    titlu: `Seria ${i + 1} · ${ex.nume}`,
    optiuni: [
      ...Object.entries(TIPURI_SERIE).map(([cheie, t]) => ({
        text: t.nume, detaliu: t.detaliu, activ: (s.tip || 'normal') === cheie,
        actiune: () => { s.tip = cheie; deseneazaExercitii(); programeazaCiorna(); },
      })),
      { text: 'Șterge seria', icon: 'cos', pericol: true, actiune: () => {
        ex.serii.splice(i, 1);
        deseneazaExercitii();
        programeazaCiorna();
      } },
    ],
  });
}

function randSerie(ex, s, i, eticheta) {
  const campuri = campuriExercitiu(ex);
  const anterior = serieAnterioara(ex, i);
  const tipS = s.tip || 'normal';
  const pr = recordSerie(ex, s);
  const rand = el('div', {
    class: ['serie', `serie-${campuri.length}`, s.facut && 'facuta', pr && 'pr', tipS !== 'normal' && `tip-${tipS}`].filter(Boolean).join(' '),
    'data-serie': String(i),
  });
  rand.append(
    el('button', {
      class: 'serie-numar', type: 'button', text: eticheta,
      'aria-label': `Seria ${i + 1}, ${TIPURI_SERIE[tipS].nume}. Schimbă tipul sau șterge seria`,
      onclick: () => meniuSerie(ex, s, i),
    }),
    el('span', { class: 'serie-anterior', text: anterior ? formatSerie(anterior) : '—', 'aria-label': anterior ? `Data trecută: ${formatSerie(anterior)}` : 'Fără date anterioare' }),
    ...campuri.map(c => el('input', {
      type: 'number', inputmode: c.mod, min: '0', step: c.mod === 'decimal' ? 'any' : '1',
      placeholder: anterior && anterior[c.cheie] > 0 ? String(anterior[c.cheie]) : c.eticheta,
      value: s[c.cheie] ?? '', 'data-camp': c.cheie,
      'aria-label': `${c.eticheta}, seria ${i + 1}`,
      onchange: e => {
        s[c.cheie] = e.target.value;
        programeazaCiorna();
        if (s.facut) {
          // O serie bifată poate fi corectată; dacă valoarea principală devine goală, se debifează.
          if (!((valoareNumerica(s[campPrincipal(ex)]) ?? 0) > 0)) { s.facut = false; deseneazaExercitii(); return; }
          const tip = recordSerie(ex, s);
          const era = rand.classList.contains('pr');
          rand.classList.toggle('pr', Boolean(tip));
          if (tip && !era) notifica(`Record nou la ${ex.nume}: ${ETICHETE_RECORD[tip]}!`, 'record');
        }
      },
    })),
    el('button', {
      class: 'serie-bifa', type: 'button', 'aria-pressed': s.facut ? 'true' : 'false',
      'aria-label': s.facut ? `Debifează seria ${i + 1}` : `Bifează seria ${i + 1} ca făcută`,
      onclick: () => bifeazaSerie(ex, s, i),
    }, [iconita('bifa')]),
  );
  // append() ar scrie „null" ca text: insigna se adaugă doar dacă e record.
  if (pr) rand.append(el('span', { class: 'insigna', text: 'PR' }));
  return rand;
}

// ---------- Performanța anterioară și sugestia ----------
function casetaAnterioara(ex) {
  const ultima = ultimaSesiuneCu(istoric, ex.nume);
  if (!ultima) {
    return el('p', { class: 'nota', text: 'Prima dată la acest exercițiu. Seriile de azi devin reperul.' });
  }
  const r = recorduri.get(ex.nume.toLowerCase());
  const copii = [
    el('div', { class: 'sugestie-cap' }, [
      iconita('istoric', 'iconita mica'),
      el('span', { text: `Data trecută · ${afiseazaData(ultima.data)}` }),
    ]),
    el('p', { class: 'sugestie-serii', text: rezumatSerii(ultima.serii) }),
  ];
  if (r) {
    const cel = r.kg > 0 && r.kgRepetari > 0
      ? `${formatNumar(r.kg)} kg × ${r.kgRepetari} · 1RM estimat ${formatNumar(r.e1rm)} kg`
      : r.repetari > 0 ? `${r.repetari} repetări`
        : r.durata > 0 ? `${formatNumar(r.durata)} s`
          : r.distanta > 0 ? `${formatNumar(r.distanta)} m` : null;
    if (cel) copii.push(el('p', { class: 'sugestie-record' }, [iconita('trofeu', 'iconita mica'), el('span', { text: `Cel mai bun: ${cel}` })]));
  }
  const sug = ex.tip === 'greutate' || ex.tip === 'corp' ? sugestieProgresie(ultima, setari) : null;
  if (sug) {
    copii.push(
      el('p', { class: 'sugestie-text' + (sug.crestere ? ' crestere' : ''), text: (sug.crestere ? '⬆ ' : '→ ') + sug.text }),
      buton({ text: 'Aplică sugestia', tip: 'secundar', mic: true, onclick: () => aplicaSugestia(ex, sug) }),
    );
  }
  return el('div', { class: 'sugestie' }, copii);
}

// Completează seriile de lucru nebifate cu greutatea și repetările sugerate. Încălzirea rămâne cum e.
function aplicaSugestia(ex, sug) {
  let deLucru = ex.serii.filter(s => !s.facut && (s.tip || 'normal') !== 'incalzire');
  while (deLucru.length < sug.numarSerii - ex.serii.filter(s => s.facut && s.tip !== 'incalzire').length) {
    const noua = serieGoala();
    ex.serii.push(noua);
    deLucru.push(noua);
  }
  for (const s of deLucru) {
    s.kg = String(sug.kg);
    s.repetari = String(sug.repetari);
  }
  deseneazaExercitii();
  programeazaCiorna();
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

// Nota ta permanentă pentru exercițiu (din bibliotecă), afișată la fiecare antrenament.
function notaPersonala(ex) {
  const e = exercitiuDupaNume(ex.nume);
  if (!e || !e.nota) return null;
  return el('p', { class: 'nota-personala' }, [iconita('nota', 'iconita mica'), el('span', { text: e.nota })]);
}

// ---------- Meniul exercițiului ----------
function meniuExercitiu(ex) {
  const i = stare.exercitii.indexOf(ex);
  const urmator = stare.exercitii[i + 1];
  alegeDinLista({
    titlu: ex.nume,
    optiuni: [
      { text: ex.nota ? 'Editează nota de azi' : 'Adaugă o notă pentru azi', icon: 'nota', actiune: () => deschideNota(ex) },
      { text: 'Tipul exercițiului', icon: 'tip', detaliu: TIPURI_EXERCITIU[ex.tip].nume, actiune: () => meniuTip(ex) },
      { text: 'Înlocuiește cu o alternativă', icon: 'schimba',
        detaliu: ex.serii.some(s => s.facut) ? 'Indisponibil: are serii bifate' : 'Ex. când aparatul e ocupat',
        dezactivat: ex.serii.some(s => s.facut), actiune: () => alegeAlternativa(ex) },
      { text: 'Detalii exercițiu', icon: 'info', actiune: () => arataDetaliiExercitiu(ex.nume) },
      { text: 'Mută mai sus', icon: 'sus', dezactivat: i === 0, actiune: () => mutaExercitiul(ex, -1) },
      { text: 'Mută mai jos', icon: 'jos', dezactivat: !urmator, actiune: () => mutaExercitiul(ex, 1) },
      ex.superset
        ? { text: 'Scoate din superset', icon: 'legatura', actiune: () => scoateDinSuperset(ex) }
        : { text: 'Superset cu următorul', icon: 'legatura', dezactivat: !urmator,
          detaliu: urmator ? urmator.nume : 'Adaugă întâi alt exercițiu', actiune: () => legaInSuperset(ex) },
      { text: 'Scoate exercițiul', icon: 'cos', pericol: true, actiune: () => scoateExercitiul(ex) },
    ],
  });
}

// Înlocuiește un exercițiu fără serii bifate cu altul (alternativele întâi).
function alegeAlternativa(ex) {
  const tinta = exercitiuDupaNume(ex.nume);
  const alternative = tinta ? alternativePentru(tinta, toateExercitiile(), 6) : [];
  deschideSelectorExercitii({
    titlu: `Înlocuiește ${ex.nume}`,
    unul: true,
    sugestii: alternative.map(e => e.nume),
    eticheteSugestii: 'Alternative',
    grupaInitiala: tinta?.grupa || '',
    laAlegere: ([nume]) => {
      if (!nume || nume.toLowerCase() === ex.nume.toLowerCase()) return;
      const i = stare.exercitii.indexOf(ex);
      if (i < 0) return;
      const nou = exercitiuNou(nume);
      nou.superset = ex.superset;
      nou.nota = ex.nota;
      stare.exercitii[i] = nou;
      const grupa = grupaExercitiu(nume);
      if (grupa) { stare.grupe.add(grupa); deseneazaGrupe(); }
      deseneazaExercitii();
      programeazaCiorna();
      notifica(`${ex.nume} a fost înlocuit cu ${nume}.`, 'succes');
    },
  });
}

// Numele exact sub care e ținut exercițiul în bibliotecă (litere mari/mici ca în catalog).
function numeInBiblioteca(nume) {
  const e = exercitiuDupaNume(nume);
  return e ? e.nume : nume;
}

function meniuTip(ex) {
  alegeDinLista({
    titlu: `Tipul pentru ${ex.nume}`,
    text: 'Alegerea se păstrează și la antrenamentele următoare.',
    optiuni: Object.entries(TIPURI_EXERCITIU).map(([cheie, t]) => ({
      text: t.nume, detaliu: t.detaliu, activ: ex.tip === cheie,
      actiune: () => schimbaTipul(ex, cheie),
    })),
  });
}

async function schimbaTipul(ex, tip) {
  if (ex.tip === tip) return;
  ex.tip = tip;
  // Seriile bifate fără valoarea principală a noului tip se debifează.
  for (const s of ex.serii) if (s.facut && !((valoareNumerica(s[campPrincipal(ex)]) ?? 0) > 0)) s.facut = false;
  deseneazaExercitii();
  programeazaCiorna();
  try {
    await seteazaInBiblioteca(numeInBiblioteca(ex.nume), { tip });
    await reincarcaBiblioteca();
  } catch (err) {
    console.error(err);
    notifica('Tipul a fost schimbat doar pentru azi: nu a putut fi salvat pentru data viitoare.', 'eroare');
  }
}

function deschideNota(ex) {
  ex.notaDeschisa = true;
  deseneazaExercitii();
  const t = document.querySelector(`[data-ex="${ex.id}"] textarea`);
  if (t) t.focus();
}

async function scoateExercitiul(ex) {
  const facute = ex.serii.filter(s => s.facut).length;
  if (facute || ex.nota) {
    const da = await confirma({
      titlu: 'Scoți exercițiul?',
      text: `${ex.nume}${facute ? ` și ${plural(facute, 'serie bifată', 'serii bifate')}` : ''} vor fi scoase din antrenamentul de azi.`,
      ok: 'Scoate', pericol: true,
    });
    if (!da) return;
  }
  const i = stare.exercitii.indexOf(ex);
  if (i >= 0) stare.exercitii.splice(i, 1);
  normalizeazaSupersets();
  deseneazaExercitii();
  programeazaCiorna();
}

// ---------- Desenarea listei ----------
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
  const ss = infoSupersets();
  lista.replaceChildren(...stare.exercitii.map(ex => {
    const grupa = grupaExercitiu(ex.nume);
    const info = ss.get(ex);
    const etichete = eticheteSerii(ex);
    const campuri = campuriExercitiu(ex);
    const tipInfo = TIPURI_EXERCITIU[ex.tip];
    const facute = ex.serii.filter(s => s.facut).length;
    const arataNota = ex.nota || ex.notaDeschisa;
    return el('article', {
      class: ['card', 'exercitiu', info && 'in-superset', info?.primul && 'superset-primul', info?.ultimul && 'superset-ultimul'].filter(Boolean).join(' '),
      'data-ex': String(ex.id),
    }, [
      info?.primul ? el('div', { class: 'superset-eticheta' }, [iconita('legatura', 'iconita mica'), el('span', { text: `Superset ${info.litera}` })]) : null,
      el('div', { class: 'exercitiu-cap' }, [
        miniatura(ex.nume, 'figura-mica'),
        el('div', { class: 'exercitiu-titlu' }, [
          el('h3', { text: ex.nume }),
          el('div', { class: 'etichete' }, [
            grupa ? el('span', { class: 'eticheta-grupa', text: grupa }) : null,
            tipInfo.scurt ? el('span', { class: 'eticheta-tip', text: tipInfo.scurt }) : null,
            el('span', { class: 'eticheta-progres', text: `${facute}/${ex.serii.length}` }),
          ]),
        ]),
        buton({ icon: 'puncte', tip: 'fantoma', eticheta: `Opțiuni pentru ${ex.nume}`, onclick: () => meniuExercitiu(ex) }),
      ]),
      alegereGrupa(ex),
      notaPersonala(ex),
      arataNota ? el('textarea', {
        class: 'nota-exercitiu', rows: '2', placeholder: 'Notă pentru acest exercițiu (ex. reglaj aparat, priză)…',
        'aria-label': `Notă pentru ${ex.nume}`,
        oninput: e => { ex.nota = e.target.value; programeazaCiorna(); },
      }, []) : null,
      casetaAnterioara(ex),
      ex.serii.length ? el('div', { class: `serie serie-${campuri.length} serie-antet`, 'aria-hidden': 'true' }, [
        el('span', { text: 'Serie' }), el('span', { text: 'Anterior' }),
        ...campuri.map(c => el('span', { text: c.eticheta })), el('span', { text: '✓' }),
      ]) : null,
      ...ex.serii.map((s, i) => randSerie(ex, s, i, etichete[i])),
      buton({ text: 'Adaugă serie', icon: 'plus', tip: 'secundar', lat: true, onclick: () => adaugaSerie(ex) }),
    ]);
  }));
  // Valoarea notei se pune după creare (textarea nu are atribut „value").
  for (const ex of stare.exercitii) {
    const t = document.querySelector(`[data-ex="${ex.id}"] textarea`);
    if (t) t.value = ex.nota || '';
  }
  actualizeazaSumarSesiune();
}

async function seteazaGrupa(nume, grupa) {
  try {
    await adaugaInBiblioteca(nume, grupa);
  } catch (err) {
    console.error(err);
    notifica('Grupa nu a putut fi salvată.', 'eroare');
    return;
  }
  await reincarcaBiblioteca().catch(err => console.warn(err));
  stare.grupe.add(grupa);
  deseneazaGrupe();
  deseneazaExercitii();
  programeazaCiorna();
}

// ---------- Închiderea sesiunii ----------
// Seria salvată: doar numere, doar câmpurile folosite; tipul doar dacă nu e „normal".
function serieDeSalvat(ex, s) {
  const v = valoriSerie(s);
  const rez = { kg: v.kg, repetari: v.repetari };
  if (ex.tip === 'timp') rez.durataSec = v.durataSec;
  if (ex.tip === 'distanta') rez.distantaM = v.distantaM;
  if (v.tip !== 'normal') rez.tip = v.tip;
  return rez;
}

function areValoare(ex, s) {
  return (valoareNumerica(s[campPrincipal(ex)]) ?? 0) > 0;
}

function construiesteSesiunea(sfarsit) {
  const info = infoSupersets();
  const exercitii = stare.exercitii
    .map(ex => {
      const rez = { nume: ex.nume, serii: ex.serii.filter(s => s.facut && areValoare(ex, s)).map(s => serieDeSalvat(ex, s)) };
      if (ex.tip !== 'greutate') rez.tip = ex.tip;
      if (ex.nota && ex.nota.trim()) rez.nota = ex.nota.trim();
      if (info.has(ex)) rez.superset = info.get(ex).litera;
      return rez;
    })
    .filter(ex => ex.serii.length > 0);
  const inceput = stare.inceput ?? sfarsit;
  const pauze = [...stare.pauze];
  if (stare.pauzaStart !== null) pauze.push({ start: stare.pauzaStart, sfarsit });
  const sesiune = {
    versiune: 2,
    data: formatData(new Date(inceput)),
    inceput,
    sfarsit,
    durataActivaMs: durataActiva(inceput, sfarsit, pauze),
    grupe: [...stare.grupe],
    exercitii,
  };
  if (pauze.length) sesiune.pauze = pauze;
  if (stare.nota.trim()) sesiune.nota = stare.nota.trim();
  const st = statisticiSesiune(sesiune);
  sesiune.serii = st.serii;
  sesiune.volum = st.volum;
  return sesiune;
}

// sfarsitFortat: pentru un antrenament neterminat, salvat ulterior (sfârșitul = ultima activitate).
async function inchideSesiunea(sfarsitFortat = null) {
  const bifate = stare.exercitii.reduce((t, ex) => t + ex.serii.filter(s => s.facut && areValoare(ex, s)).length, 0);
  const nebifate = stare.exercitii.reduce((t, ex) => t + ex.serii.filter(s => !s.facut && areValoare(ex, s)).length, 0);

  if (bifate === 0 && nebifate === 0) {
    notifica('Completează și bifează ✓ cel puțin o serie înainte să închei antrenamentul.', 'eroare');
    return;
  }

  const bifeazaTot = () => {
    for (const ex of stare.exercitii) for (const s of ex.serii) if (areValoare(ex, s)) s.facut = true;
  };
  const sfarsit = sfarsitFortat ?? Date.now();
  const previzualizare = construiesteSesiunea(sfarsit);
  const durataMin = Math.max(1, Math.round(previzualizare.durataActivaMs / 60000));

  const alegere = await new Promise(rezolva => {
    const text = bifate
      ? `${plural(previzualizare.exercitii.length, 'exercițiu', 'exerciții')} · ${plural(previzualizare.serii, 'serie', 'serii')} · ${durataMin} min · ${formatMare(previzualizare.volum)} kg volum.`
      : 'Nicio serie nu e bifată.';
    const avert = nebifate
      ? ` ${plural(nebifate, 'serie completată dar nebifată nu se salvează', 'serii completate dar nebifate nu se salvează')}, decât dacă alegi „Bifează tot".`
      : '';
    const butoane = [buton({ text: 'Înapoi', tip: 'fantoma', onclick: () => d.inchide(() => rezolva(null)) })];
    if (nebifate) butoane.push(buton({ text: 'Bifează tot', tip: 'secundar', onclick: () => d.inchide(() => rezolva('tot')) }));
    if (bifate) butoane.push(buton({ text: 'Salvează', tip: 'principal', onclick: () => d.inchide(() => rezolva('bifate')) }));
    const d = deschideDialog({ titlu: 'Închei antrenamentul?', text: text + avert, butoane, laAnulare: () => rezolva(null) });
  });
  if (!alegere) return;
  if (alegere === 'tot') bifeazaTot();

  const sesiune = construiesteSesiunea(sfarsit);
  // Recordurile se numără înainte de salvare, față de istoricul de până acum.
  const numarRecorduri = sesiune.exercitii.filter(ex => ex.serii.some(s => recordPentruSerie(recorduri, ex.nume, s))).length;
  // Realizările dinainte, ca să știm ce s-a deblocat acum (etapa 7).
  const realizariInainte = await stareRealizari().catch(err => { console.warn(err); return null; });

  try {
    await salveazaSesiune(sesiune);
    for (const ex of sesiune.exercitii) await adaugaInBiblioteca(numeInBiblioteca(ex.nume));
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
  notifica(`Antrenament salvat: ${plural(sesiune.exercitii.length, 'exercițiu', 'exerciții')}, ${plural(sesiune.serii, 'serie', 'serii')}, ${Math.max(1, Math.round(sesiune.durataActivaMs / 60000))} min.`, 'succes');
  if (numarRecorduri) notifica(`Recorduri noi la ${plural(numarRecorduri, 'exercițiu', 'exerciții')}!`, 'record');
  sarbatoresteRealizari(realizariInainte).catch(err => console.warn(err));
}

function golesteSesiunea() {
  stare.grupe.clear();
  stare.exercitii = [];
  stare.inceput = null;
  stare.nota = '';
  stare.pauze = [];
  stare.pauzaStart = null;
  stare.ultimaActivitate = null;
  $('sesiune-nota').value = '';
  opresteTimerul();
  elibereazaEcranul();
  deseneazaGrupe();
}

async function renuntaLaSesiune() {
  const { serii } = seriiCompletate();
  const da = await confirma({
    titlu: 'Renunți la antrenament?',
    text: serii
      ? `Cele ${plural(serii, 'serie bifată', 'serii bifate')} de azi se vor pierde. Istoricul salvat nu se schimbă.`
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

// ---------- Antrenament neterminat ----------
// La pornire: dacă ultima activitate e mai veche de 3 ore, întrebăm ce facem cu antrenamentul.
async function verificaAntrenamentNeterminat() {
  if (stare.exercitii.length === 0) return;
  const ultima = stare.ultimaActivitate ?? stare.inceput;
  if (!ultima || Date.now() - ultima < PRAG_NETERMINAT_MS) return;
  const cand = new Date(ultima).toLocaleString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const alegere = await new Promise(rezolva => {
    const d = deschideDialog({
      titlu: 'Antrenament neterminat',
      text: `Ai un antrenament început, cu ultima modificare ${cand}. Ce faci cu el?`,
      laAnulare: () => rezolva(null),
      butoane: [
        buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide(() => rezolva('renunta')) }),
        buton({ text: 'Salvează', tip: 'secundar', onclick: () => d.inchide(() => rezolva('salveaza')) }),
        buton({ text: 'Continuă', tip: 'principal', onclick: () => d.inchide(() => rezolva('continua')) }),
      ],
    });
  });
  if (alegere === 'continua') {
    // Timpul în care aplicația a stat închisă nu intră în durata antrenamentului.
    if (stare.pauzaStart === null) stare.pauze.push({ start: ultima, sfarsit: Date.now() });
    programeazaCiorna();
    deseneazaExercitii();
  } else if (alegere === 'salveaza') {
    await inchideSesiunea(ultima);
  } else if (alegere === 'renunta') {
    await renuntaLaSesiune();
  }
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
  $('btn-alege-exercitii').addEventListener('click', () => deschideSelectorExercitii({
    titlu: 'Adaugă exerciții',
    laAlegere: nume => adaugaInSesiune(nume, [], { faraNavigare: true }),
  }));
  $('exercitiu-nume').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); adaugaExercitiu(); }
  });
  $('btn-inchide').addEventListener('click', () => inchideSesiunea());
  $('btn-renunta').addEventListener('click', renuntaLaSesiune);
  $('btn-pauza-antrenament').addEventListener('click', () => (pePauza() ? reiaAntrenamentul() : puneAntrenamentulPePauza()));
  $('btn-timer-manual').addEventListener('click', () => porneshteTimerul());
  $('sesiune-nota').addEventListener('input', e => { stare.nota = e.target.value; programeazaCiorna(); });
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
    if (!ciorna || !Array.isArray(ciorna.exercitii)) return;
    // Ciornele din versiunile vechi nu aveau bifă: seriile completate se consideră făcute (ca înainte).
    const veche = ciorna.versiune !== 2;
    stare.grupe = new Set(Array.isArray(ciorna.grupe) ? ciorna.grupe : []);
    stare.exercitii = ciorna.exercitii
      .filter(ex => ex && typeof ex.nume === 'string')
      .map(ex => {
        const tip = TIPURI_EXERCITIU[ex.tip] ? ex.tip : tipExercitiu(ex.nume);
        const rez = { id: ++contorExercitii, nume: ex.nume, tip, nota: typeof ex.nota === 'string' ? ex.nota : '',
          superset: typeof ex.superset === 'string' ? ex.superset : null, serii: [] };
        rez.serii = (Array.isArray(ex.serii) ? ex.serii : []).filter(Boolean).map(s => {
          const serie = { ...serieGoala(TIPURI_SERIE[s.tip] ? s.tip : 'normal'), ...s };
          for (const k of ['kg', 'repetari', 'durataSec', 'distantaM']) serie[k] = serie[k] === null || serie[k] === undefined ? '' : String(serie[k]);
          serie.facut = veche ? areValoare(rez, serie) : s.facut === true;
          return serie;
        });
        return rez;
      });
    stare.inceput = Number.isFinite(ciorna.inceput) ? ciorna.inceput : null;
    stare.nota = typeof ciorna.nota === 'string' ? ciorna.nota : '';
    stare.pauze = Array.isArray(ciorna.pauze) ? ciorna.pauze.filter(p => p && Number.isFinite(p.start) && Number.isFinite(p.sfarsit)) : [];
    stare.pauzaStart = Number.isFinite(ciorna.pauzaStart) ? ciorna.pauzaStart : null;
    stare.ultimaActivitate = Number.isFinite(ciorna.ultimaActivitate) ? ciorna.ultimaActivitate : null;
    normalizeazaSupersets();
    $('sesiune-nota').value = stare.nota;
  } catch (err) {
    console.warn('Ciorna nu a putut fi citită', err);
  }
}
