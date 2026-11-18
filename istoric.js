// Istoricul sesiunilor: listă, detalii, corectare și ștergere.
// Folosește: istoric, reincarcaIstoric, el, $, anunta, afiseazaData, formatNumar (app.js),
// rezumatSerii (analiza.js), actualizeazaSesiune, stergeSesiune (db.js).

const PAS_ISTORIC = 20;
let afisateIstoric = PAS_ISTORIC;
const deschise = new Set();   // id-urile sesiunilor desfăcute
const ciorne = new Map();     // id -> copie editabilă a sesiunii

const ZILE = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

function ziuaSaptamanii(data) {
  return ZILE[new Date(timpDinData(data)).getDay()];
}

function copieSesiune(s) {
  return { ...s, exercitii: s.exercitii.map(ex => ({ nume: ex.nume, serii: ex.serii.map(se => ({ ...se })) })) };
}

function volumSesiune(s) {
  return s.exercitii.reduce((t, ex) => t + ex.serii.reduce((v, se) => v + se.kg * se.repetari, 0), 0);
}

function randeazaIstoric() {
  const lista = $('istoric-lista');
  if (istoric.length === 0) {
    lista.replaceChildren(el('div', { class: 'card' }, [
      el('p', { class: 'eticheta', text: 'Nu ai nicio sesiune salvată încă.' }),
    ]));
    return;
  }

  const recente = [...istoric].reverse().slice(0, afisateIstoric);
  const carduri = recente.map(s => deschise.has(s.id) ? cardEditare(s) : cardSesiune(s));
  if (istoric.length > afisateIstoric) {
    carduri.push(el('button', {
      class: 'buton principal', type: 'button', text: `Arată mai multe (${istoric.length - afisateIstoric} rămase)`,
      onclick: () => { afisateIstoric += PAS_ISTORIC; randeazaIstoric(); },
    }));
  }
  lista.replaceChildren(...carduri);
}

function cardSesiune(s) {
  const durata = s.inceput && s.sfarsit ? Math.max(1, Math.round((s.sfarsit - s.inceput) / 60000)) : null;
  const serii = s.exercitii.reduce((t, ex) => t + ex.serii.length, 0);
  const detalii = [
    durata ? `${durata} min` : null,
    plural(s.exercitii.length, 'exercițiu', 'exerciții'),
    plural(serii, 'serie', 'serii'),
    `${Math.round(volumSesiune(s))} kg volum`,
  ].filter(Boolean).join(' · ');

  return el('div', { class: 'card sesiune-istoric' }, [
    el('div', { class: 'rand aliniat' }, [
      el('h3', { text: `${ziuaSaptamanii(s.data)}, ${afiseazaData(s.data)}` }),
      el('button', {
        class: 'buton mic', type: 'button', text: 'Editează',
        onclick: () => { deschise.add(s.id); ciorne.set(s.id, copieSesiune(s)); randeazaIstoric(); },
      }),
    ]),
    el('p', { class: 'eticheta', text: detalii }),
    s.grupe?.length ? el('p', { class: 'eticheta', text: s.grupe.join(', ') }) : el('span'),
    el('ul', { class: 'lista-exercitii' }, s.exercitii.map(ex =>
      el('li', {}, [el('span', { text: ex.nume }), el('span', { class: 'valoare', text: rezumatSerii(ex.serii) })]))),
    el('button', {
      class: 'buton mic mt', type: 'button', text: 'Salvează ca rutină',
      onclick: () => salveazaCaRutina(s.exercitii.map(e => e.nume),
        s.grupe?.length ? s.grupe : s.exercitii.map(e => grupaExercitiu(e.nume)).filter(Boolean),
        (s.grupe || []).join(', ')),
    }),
  ]);
}

function cardEditare(original) {
  const c = ciorne.get(original.id);

  const blocuri = c.exercitii.map((ex, iEx) => el('div', { class: 'editare-exercitiu' }, [
    el('div', { class: 'rand aliniat' }, [
      el('strong', { text: ex.nume }),
      el('button', {
        class: 'buton mic', type: 'button', text: 'Scoate',
        onclick: () => { c.exercitii.splice(iEx, 1); randeazaIstoric(); },
      }),
    ]),
    ...ex.serii.map((se, i) => el('div', { class: 'serie' }, [
      el('span', { class: 'numar', text: String(i + 1) }),
      el('input', {
        type: 'number', inputmode: 'decimal', placeholder: 'kg', value: se.kg,
        onchange: e => { se.kg = parseFloat(e.target.value) || 0; },
      }),
      el('input', {
        type: 'number', inputmode: 'numeric', placeholder: 'reps', value: se.repetari,
        onchange: e => { se.repetari = parseInt(e.target.value, 10) || 0; },
      }),
      el('button', {
        class: 'buton', type: 'button', text: '×', 'aria-label': 'Șterge seria',
        onclick: () => { ex.serii.splice(i, 1); randeazaIstoric(); },
      }),
    ])),
  ]));

  return el('div', { class: 'card sesiune-istoric editare' }, [
    el('h3', { text: `Editezi: ${ziuaSaptamanii(original.data)}, ${afiseazaData(original.data)}` }),
    el('label', { class: 'eticheta' }, ['Data ',
      el('input', { type: 'date', value: c.data, onchange: e => { if (e.target.value) c.data = e.target.value; } })]),
    ...blocuri,
    el('div', { class: 'rand mt' }, [
      el('button', { class: 'buton', type: 'button', text: 'Renunță', onclick: () => inchideEditarea(original.id) }),
      el('button', { class: 'buton principal', type: 'button', text: 'Salvează', onclick: () => salveazaEditarea(original.id) }),
    ]),
    el('button', { class: 'buton pericol', type: 'button', text: 'Șterge sesiunea', onclick: () => stergeSesiuneaIstoric(original) }),
  ]);
}

function inchideEditarea(id) {
  deschise.delete(id);
  ciorne.delete(id);
  randeazaIstoric();
}

async function salveazaEditarea(id) {
  const c = ciorne.get(id);
  c.exercitii = c.exercitii
    .map(ex => ({ nume: ex.nume, serii: ex.serii.filter(se => se.repetari > 0 || se.kg > 0) }))
    .filter(ex => ex.serii.length > 0);

  if (c.exercitii.length === 0) {
    const original = istoric.find(s => s.id === id);
    if (original) await stergeSesiuneaIstoric(original);
    return;
  }
  try {
    await actualizeazaSesiune(c);
    await reincarcaIstoric();
  } catch (err) {
    console.error(err);
    anunta('Modificările nu au putut fi salvate.');
    return;
  }
  inchideEditarea(id);
  deseneazaExercitii(); // sugestiile din sesiunea curentă depind de istoric
  anunta('Sesiune actualizată.');
}

async function stergeSesiuneaIstoric(s) {
  if (!confirm(`Ștergi definitiv sesiunea din ${afiseazaData(s.data)}? Nu se poate anula (doar dintr-un backup).`)) return;
  try {
    await stergeSesiune(s.id);
    await reincarcaIstoric();
  } catch (err) {
    console.error(err);
    anunta('Sesiunea nu a putut fi ștearsă.');
    return;
  }
  deschise.delete(s.id);
  ciorne.delete(s.id);
  randeazaIstoric();
  deseneazaExercitii();
  anunta('Sesiune ștearsă.');
}

// ---------- File în ecranul Progres ----------
function arataFilaProgres(fila) {
  const grafice = fila === 'grafice';
  $('tab-grafice').classList.toggle('activ', grafice);
  $('tab-istoric').classList.toggle('activ', !grafice);
  $('progres-grafice').hidden = !grafice;
  $('progres-istoric').hidden = grafice;
  if (grafice) {
    reincarcaProgres().catch(err => console.error(err));
  } else {
    reincarcaIstoric().then(randeazaIstoric).catch(err => console.error(err));
  }
}

$('tab-grafice').addEventListener('click', () => arataFilaProgres('grafice'));
$('tab-istoric').addEventListener('click', () => arataFilaProgres('istoric'));
