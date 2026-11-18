// Istoricul sesiunilor: listă, detalii, corectare și ștergere.
// Folosește: istoric, reincarcaIstoric, grupaExercitiu, salveazaCaRutina (sesiune.js),
// el, $, buton, confirma, notifica, afiseazaData (ui.js), rezumatSerii (analiza.js),
// actualizeazaSesiune, stergeSesiune (db.js).

const PAS_ISTORIC = 20;
let afisateIstoric = PAS_ISTORIC;
const deschise = new Set();   // id-urile sesiunilor în editare
const ciorne = new Map();     // id -> copie editabilă a sesiunii

const ZILE = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];

function ziuaSaptamanii(data) {
  return ZILE[new Date(timpDinData(data)).getDay()];
}

function copieSesiune(s) {
  return { ...s, exercitii: s.exercitii.map(ex => ({ ...ex, serii: ex.serii.map(se => ({ ...se })) })) };
}

function volumSesiune(s) {
  return s.exercitii.reduce((t, ex) => t + ex.serii.reduce((v, se) => v + se.kg * se.repetari, 0), 0);
}

function randeazaIstoric() {
  const lista = $('istoric-lista');
  if (istoric.length === 0) {
    lista.replaceChildren(stareGoala({
      icon: 'istoric',
      titlu: 'Niciun antrenament salvat',
      text: 'După ce închei primul antrenament, îl găsești aici, cu toate seriile.',
      actiune: buton({ text: 'Începe un antrenament', icon: 'gantera', tip: 'principal', onclick: () => arataEcran('ecran-sesiune') }),
    }));
    return;
  }

  const recente = [...istoric].reverse().slice(0, afisateIstoric);
  const carduri = recente.map(s => deschise.has(s.id) ? cardEditare(s) : cardSesiune(s));
  if (istoric.length > afisateIstoric) {
    carduri.push(buton({
      text: `Arată mai multe (${istoric.length - afisateIstoric} rămase)`, tip: 'secundar', lat: true,
      onclick: () => { afisateIstoric += PAS_ISTORIC; randeazaIstoric(); },
    }));
  }
  lista.replaceChildren(...carduri);
}

function cardSesiune(s) {
  const durata = s.inceput && s.sfarsit ? Math.max(1, Math.round((s.sfarsit - s.inceput) / 60000)) : null;
  const serii = s.exercitii.reduce((t, ex) => t + ex.serii.length, 0);

  return el('article', { class: 'card sesiune-istoric' }, [
    el('div', { class: 'card-cap' }, [
      el('div', {}, [
        el('h3', { text: `${ziuaSaptamanii(s.data)}, ${afiseazaData(s.data)}` }),
        s.grupe?.length ? el('p', { class: 'nota', text: s.grupe.join(' · ') }) : null,
      ]),
      buton({
        icon: 'editeaza', tip: 'fantoma', eticheta: `Editează sesiunea din ${afiseazaData(s.data)}`,
        onclick: () => { deschise.add(s.id); ciorne.set(s.id, copieSesiune(s)); randeazaIstoric(); },
      }),
    ]),
    el('div', { class: 'mini-statistici' }, [
      durata ? el('span', {}, [iconita('ceas', 'iconita mica'), el('span', { text: `${durata} min` })]) : null,
      el('span', {}, [iconita('lista', 'iconita mica'), el('span', { text: plural(serii, 'serie', 'serii') })]),
      el('span', {}, [iconita('gantera', 'iconita mica'), el('span', { text: `${formatMare(volumSesiune(s))} kg` })]),
    ]),
    el('ul', { class: 'lista-exercitii' }, s.exercitii.map(ex =>
      el('li', {}, [el('span', { text: ex.nume }), el('span', { class: 'valoare', text: rezumatSerii(ex.serii) })]))),
    buton({
      text: 'Salvează ca rutină', icon: 'lista', tip: 'fantoma', mic: true,
      onclick: () => salveazaCaRutina(s.exercitii.map(e => e.nume),
        s.grupe?.length ? s.grupe : s.exercitii.map(e => grupaExercitiu(e.nume)).filter(Boolean),
        (s.grupe || []).join(', ')),
    }),
  ]);
}

function cardEditare(original) {
  const c = ciorne.get(original.id);

  const blocuri = c.exercitii.map((ex, iEx) => el('div', { class: 'editare-exercitiu' }, [
    el('div', { class: 'card-cap' }, [
      el('strong', { text: ex.nume }),
      buton({ text: 'Scoate', tip: 'fantoma', mic: true, onclick: () => { c.exercitii.splice(iEx, 1); randeazaIstoric(); } }),
    ]),
    ...ex.serii.map((se, i) => el('div', { class: 'serie' }, [
      el('span', { class: 'serie-numar', text: String(i + 1) }),
      el('input', {
        type: 'number', inputmode: 'decimal', min: '0', step: 'any', placeholder: 'kg', value: se.kg,
        'aria-label': `kg, seria ${i + 1}`,
        onchange: e => { se.kg = Math.max(0, parseFloat(e.target.value) || 0); },
      }),
      el('input', {
        type: 'number', inputmode: 'numeric', min: '0', step: '1', placeholder: 'rep.', value: se.repetari,
        'aria-label': `repetări, seria ${i + 1}`,
        onchange: e => { se.repetari = Math.max(0, parseInt(e.target.value, 10) || 0); },
      }),
      buton({
        icon: 'x', tip: 'fantoma', eticheta: `Șterge seria ${i + 1}`, clasa: 'serie-sterge',
        onclick: () => { ex.serii.splice(i, 1); randeazaIstoric(); },
      }),
    ])),
  ]));

  return el('article', { class: 'card sesiune-istoric editare' }, [
    el('h3', { text: `Editezi: ${ziuaSaptamanii(original.data)}, ${afiseazaData(original.data)}` }),
    el('label', { class: 'camp' }, [
      el('span', { class: 'camp-eticheta', text: 'Data' }),
      el('input', { type: 'date', value: c.data, max: dataLocala(), onchange: e => { if (e.target.value) c.data = e.target.value; } }),
    ]),
    ...blocuri,
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => inchideEditarea(original.id) }),
      buton({ text: 'Salvează', icon: 'bifa', tip: 'principal', onclick: () => salveazaEditarea(original.id) }),
    ]),
    buton({ text: 'Șterge sesiunea', icon: 'cos', tip: 'pericol', lat: true, onclick: () => stergeSesiuneaIstoric(original) }),
  ]);
}

function inchideEditarea(id) {
  deschise.delete(id);
  ciorne.delete(id);
  randeazaIstoric();
}

async function salveazaEditarea(id) {
  const c = ciorne.get(id);
  const curatat = {
    ...c,
    exercitii: c.exercitii
      .map(ex => ({ ...ex, serii: ex.serii.filter(se => se.repetari > 0 || se.kg > 0) }))
      .filter(ex => ex.serii.length > 0),
  };

  if (curatat.exercitii.length === 0) {
    const original = istoric.find(s => s.id === id);
    if (original) await stergeSesiuneaIstoric(original);
    return;
  }
  try {
    await actualizeazaSesiune(curatat);
    await reincarcaIstoric();
  } catch (err) {
    console.error(err);
    notifica('Modificările nu au putut fi salvate.', 'eroare');
    return;
  }
  inchideEditarea(id);
  deseneazaExercitii(); // sugestiile din sesiunea curentă depind de istoric
  notifica('Sesiune actualizată.', 'succes');
}

async function stergeSesiuneaIstoric(s) {
  const da = await confirma({
    titlu: 'Ștergi sesiunea?',
    text: `Sesiunea din ${afiseazaData(s.data)} se șterge definitiv. O poți recupera doar dintr-un backup.`,
    ok: 'Șterge definitiv', pericol: true,
  });
  if (!da) return;
  try {
    await stergeSesiune(s.id);
    await reincarcaIstoric();
  } catch (err) {
    console.error(err);
    notifica('Sesiunea nu a putut fi ștearsă.', 'eroare');
    return;
  }
  deschise.delete(s.id);
  ciorne.delete(s.id);
  randeazaIstoric();
  deseneazaExercitii();
  notifica('Sesiune ștearsă.', 'succes');
}

// ---------- File în ecranul Progres ----------
function arataFilaProgres(fila) {
  const grafice = fila === 'grafice';
  $('tab-grafice').classList.toggle('activ', grafice);
  $('tab-istoric').classList.toggle('activ', !grafice);
  $('tab-grafice').setAttribute('aria-selected', String(grafice));
  $('tab-istoric').setAttribute('aria-selected', String(!grafice));
  $('progres-grafice').hidden = !grafice;
  $('progres-istoric').hidden = grafice;
  if (grafice) {
    reincarcaProgres().catch(err => { console.error(err); notifica('Graficele nu au putut fi încărcate.', 'eroare'); });
  } else {
    if (istoric.length === 0) $('istoric-lista').replaceChildren(stareIncarcare());
    reincarcaIstoric().then(randeazaIstoric).catch(err => { console.error(err); notifica('Istoricul nu a putut fi încărcat.', 'eroare'); });
  }
}

function initIstoric() {
  $('tab-grafice').addEventListener('click', () => arataFilaProgres('grafice'));
  $('tab-istoric').addEventListener('click', () => arataFilaProgres('istoric'));
}
