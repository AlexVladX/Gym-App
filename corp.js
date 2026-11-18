// Ecranul Corp: greutatea corporală (cu tendință) și măsurătorile.

const TIPURI_IMPLICITE = ['Greutate', 'Talie'];
let masuratoriCache = [];

// ---------- Greutatea corporală ----------
function deseneazaGreutate() {
  const greutati = masuratoriCache.filter(m => m.tip === 'Greutate');
  const t = tendintaGreutate(greutati);
  const info = $('greutate-info');

  if (!t) {
    info.replaceChildren(el('p', { class: 'nota', text: 'Cântărește-te de 2–3 ori pe săptămână, dimineața, ca să vezi tendința.' }));
    return;
  }
  const placute = [
    placuta('Media 7 zile', `${formatNumar(t.media7)} kg`, `ultima: ${formatNumar(t.ultima)} kg, ${afiseazaData(t.dataUltima)}`),
  ];
  if (t.kgPeSaptamana === null) {
    placute.push(placuta('Tendință', '—', 'minimum 3 cântăriri pe 7 zile'));
  } else {
    const v = t.kgPeSaptamana;
    const semn = v > 0.05 ? '↑ +' : v < -0.05 ? '↓ ' : '→ ';
    placute.push(placuta('Tendință', `${semn}${formatNumar(v)} kg`, `pe săptămână · ultimele ${t.zile} zile`, v > 0.05 ? 'pozitiv' : ''));
  }
  info.replaceChildren(el('div', { class: 'placute' }, placute));
}

async function salveazaGreutatea() {
  const valoare = parseFloat($('greutate-valoare').value);
  if (!Number.isFinite(valoare) || valoare < 20 || valoare > 300) {
    notifica('Introdu greutatea în kg, între 20 și 300 (de exemplu 74.5).', 'eroare');
    return;
  }
  try {
    await salveazaMasuratoare({ data: dataLocala(), tip: 'Greutate', valoare, creat: Date.now() });
  } catch (err) {
    console.error(err);
    notifica('Greutatea nu a putut fi salvată.', 'eroare');
    return;
  }
  $('greutate-valoare').value = '';
  $('greutate-valoare').blur();
  await reincarcaMasuratori();
  notifica(`Greutate salvată: ${formatNumar(valoare)} kg.`, 'succes');
}

// ---------- Măsurători ----------
// Tipul scris se potrivește cu unul existent fără să conteze literele mari/mici,
// ca „talie" și „Talie" să nu devină două tipuri diferite.
function tipCanonic(text) {
  const curat = text.trim().replace(/\s+/g, ' ');
  const existente = new Set([...TIPURI_IMPLICITE, ...masuratoriCache.map(m => m.tip)]);
  for (const t of existente) if (t.toLowerCase() === curat.toLowerCase()) return t;
  return curat.charAt(0).toUpperCase() + curat.slice(1);
}

async function reincarcaMasuratori() {
  try {
    masuratoriCache = await toateMasuratorile();
  } catch (err) {
    console.error(err);
    notifica('Măsurătorile nu au putut fi citite.', 'eroare');
    return;
  }

  const tipuri = new Set(TIPURI_IMPLICITE);
  masuratoriCache.forEach(m => tipuri.add(m.tip));
  const lista = [...tipuri].sort((a, b) => a.localeCompare(b, 'ro'));

  $('tipuri').replaceChildren(...lista.map(t => el('option', { value: t })));

  const selector = $('masuratoare-grafic-tip');
  const anterior = selector.value;
  selector.replaceChildren(...lista.map(t => el('option', { value: t, text: t })));
  if (lista.includes(anterior)) selector.value = anterior;

  if (!$('masuratoare-data').value) $('masuratoare-data').value = dataLocala();

  deseneazaGreutate();
  deseneazaMasuratori();
}

function deseneazaMasuratori() {
  const tip = $('masuratoare-grafic-tip').value;
  const intrari = masuratoriCache
    .filter(m => m.tip === tip)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.creat || 0) - (b.creat || 0));

  deseneazaGrafic($('grafic-masuratori'), intrari.map(m => ({ x: timpDinData(m.data), y: m.valoare })), formatNumar);

  if (intrari.length === 0) {
    $('masuratori-lista').replaceChildren(stareGoala({
      icon: 'corp', titlu: `Nicio înregistrare pentru „${tip}"`, text: 'Adaugă prima valoare din formularul de mai sus.',
    }));
    return;
  }
  $('masuratori-lista').replaceChildren(...[...intrari].reverse().map(m =>
    el('div', { class: 'rand-lista' }, [
      el('span', { text: afiseazaData(m.data) }),
      el('span', { class: 'valoare', text: formatNumar(m.valoare) }),
      buton({ icon: 'cos', tip: 'fantoma', eticheta: `Șterge valoarea din ${afiseazaData(m.data)}`, onclick: () => stergeIntrarea(m) }),
    ])));
}

async function stergeIntrarea(m) {
  const da = await confirma({
    titlu: 'Ștergi înregistrarea?',
    text: `${m.tip}: ${formatNumar(m.valoare)}, din ${afiseazaData(m.data)}.`,
    ok: 'Șterge', pericol: true,
  });
  if (!da) return;
  try {
    await stergeMasuratoare(m.id);
  } catch (err) {
    console.error(err);
    notifica('Înregistrarea nu a putut fi ștearsă.', 'eroare');
    return;
  }
  await reincarcaMasuratori();
  notifica('Înregistrare ștearsă.', 'succes');
}

async function salveazaMasuratoarea() {
  const text = $('masuratoare-tip').value;
  const valoare = parseFloat($('masuratoare-valoare').value);
  const data = $('masuratoare-data').value || dataLocala();
  if (!text.trim() || !Number.isFinite(valoare)) {
    notifica('Completează tipul și valoarea.', 'eroare');
    return;
  }
  if (data > dataLocala()) {
    notifica('Data nu poate fi în viitor.', 'eroare');
    return;
  }
  const tip = tipCanonic(text);
  try {
    await salveazaMasuratoare({ data, tip, valoare, creat: Date.now() });
  } catch (err) {
    console.error(err);
    notifica('Măsurătoarea nu a putut fi salvată.', 'eroare');
    return;
  }
  $('masuratoare-valoare').value = '';
  $('masuratoare-tip').value = tip;
  await reincarcaMasuratori();
  $('masuratoare-grafic-tip').value = tip;
  deseneazaMasuratori();
  notifica('Măsurătoare salvată.', 'succes');
}

function initCorp() {
  $('btn-greutate').addEventListener('click', salveazaGreutatea);
  $('greutate-valoare').addEventListener('keydown', e => { if (e.key === 'Enter') salveazaGreutatea(); });
  $('btn-masuratoare').addEventListener('click', salveazaMasuratoarea);
  $('masuratoare-grafic-tip').addEventListener('change', deseneazaMasuratori);
  $('masuratoare-data').max = dataLocala();
}
