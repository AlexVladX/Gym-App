// Ecranul Corp (etapa 6): greutatea corporală (medie pe 7 zile, tendință, IMC, obiectiv), măsurătorile
// cu unități, măsurarea completă, corectarea valorilor, compararea a două date și pozele de progres.
// Calculele sunt în corp-calcul.js și analiza.js; aici doar afișarea și salvarea.

const TIPURI_IMPLICITE = ['Greutate', 'Talie'];
let masuratoriCache = [];
let pozeCache = [];
let urlPoze = [];
const corpStare = { perioadaGreutate: '3l', unghiCompara: 'fata' };
const PERIOADE_GREUTATE = [
  { cheie: '1l', nume: '1 lună', zile: 30 },
  { cheie: '3l', nume: '3 luni', zile: 91 },
  { cheie: '6l', nume: '6 luni', zile: 182 },
  { cheie: '1a', nume: '1 an', zile: 365 },
  { cheie: 'tot', nume: 'Tot', zile: null },
];

const faraDiacritice = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cuUnitate = (v, unitate) => `${formatNumar(v)}${unitate ? (unitate === '%' ? '%' : ` ${unitate}`) : ''}`;
const cuSemn = (d, unitate) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${cuUnitate(Math.abs(d), unitate)}`;

// ---------- Greutatea corporală ----------
function deseneazaGreutate() {
  const greutati = masuratoriCache.filter(m => m.tip === 'Greutate');
  const t = tendintaGreutate(greutati);
  const info = $('greutate-info');
  const azi = dataLocala();

  if (!t) {
    info.replaceChildren(el('p', { class: 'nota', text: 'Cântărește-te de 2–3 ori pe săptămână, dimineața, ca să vezi tendința.' }));
    $('greutate-obiectiv').replaceChildren();
    $('greutate-grafic-bloc').hidden = true;
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
  for (const zile of [30, 90]) {
    const s = schimbareGreutate(greutati, azi, zile);
    if (s) placute.push(placuta(`Schimbare ${zile} zile`, cuSemn(s.diferenta, 'kg'), `${formatNumar(s.de)} → ${formatNumar(s.la)} kg`));
  }
  const i = imc(t.media7, profilDinSetari(setari).inaltimeCm);
  placute.push(i
    ? placuta('IMC', formatNumar(i.valoare), i.categorie)
    : placuta('IMC', '—', 'adaugă înălțimea mai jos'));
  info.replaceChildren(el('div', { class: 'placute' }, placute));

  deseneazaObiectiv(t, azi);

  const zilnice = valoriZilnice(greutati, 'Greutate');
  $('greutate-grafic-bloc').hidden = zilnice.length < 2;
  if (zilnice.length >= 2) deseneazaGraficGreutate(zilnice);
}

function deseneazaObiectiv(t, azi) {
  const cont = $('greutate-obiectiv');
  const o = setari.obiectiv;
  if (!o) { cont.replaceChildren(); return; }
  const p = progresObiectiv(o, t.media7, t.kgPeSaptamana, azi);
  if (!p) { cont.replaceChildren(); return; }
  const verb = p.directie === 'slabire' ? 'slăbit' : 'pus';
  const facut = Math.abs(t.media7 - o.start);
  const detaliu = p.atins
    ? `Obiectiv atins (de la ${formatNumar(o.start)} kg, ${afiseazaData(o.dela)}).`
    : `Ai ${verb} ${formatNumar(facut)} kg din ${formatNumar(Math.abs(o.start - o.tinta))} kg (de la ${afiseazaData(o.dela)}). Mai ai ${formatNumar(p.ramas)} kg.` +
      (p.estimare ? ` În ritmul de acum: în jur de ${afiseazaData(p.estimare)}.` : ' Estimarea apare când tendința merge spre obiectiv.');
  cont.replaceChildren(el('div', { class: 'obiectiv' }, [
    el('div', { class: 'obiectiv-cap' }, [
      el('span', { class: 'placuta-eticheta', text: 'Obiectiv' }),
      el('strong', { text: `${formatNumar(o.tinta)} kg` }),
    ]),
    el('div', { class: 'obiectiv-bara', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(p.progres * 100)) }, [
      el('div', { class: 'obiectiv-umplere', style: `width:${p.progres * 100}%` }),
    ]),
    el('p', { class: 'nota', text: detaliu }),
  ]));
}

function deseneazaGraficGreutate(zilnice) {
  chipuriCorp($('greutate-perioada'), PERIOADE_GREUTATE, corpStare.perioadaGreutate, cheie => {
    corpStare.perioadaGreutate = cheie; deseneazaGraficGreutate(zilnice);
  });
  const p = PERIOADE_GREUTATE.find(x => x.cheie === corpStare.perioadaGreutate);
  const start = p.zile === null ? '0000-00-00' : dataDinZi(ziDinData(dataLocala()) - p.zile + 1);
  // media se calculează pe tot istoricul (corectă și la începutul perioadei), apoi se taie
  const medie = mediaMobila(zilnice, 7).filter(x => x.data >= start);
  const brute = zilnice.filter(x => x.data >= start);
  deseneazaGrafic($('grafic-greutate'),
    medie.map(x => ({ x: timpDinData(x.data), y: Math.round(x.valoare * 10) / 10, data: x.data })),
    v => `${formatNumar(v)} kg`,
    { brute: brute.map(x => ({ x: timpDinData(x.data), y: x.valoare })) });
}

function chipuriCorp(container, optiuni, activ, laAlegere) {
  container.replaceChildren(...optiuni.map(o => el('button', {
    type: 'button', class: 'chip' + (o.cheie === activ ? ' activ' : ''), text: o.nume,
    'aria-pressed': String(o.cheie === activ), onclick: () => laAlegere(o.cheie),
  })));
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
    notifica(mesajEroareSalvare(err, 'Greutatea nu a putut fi salvată.'), 'eroare');
    return;
  }
  $('greutate-valoare').value = '';
  $('greutate-valoare').blur();
  await reincarcaMasuratori();
  notifica(`Greutate salvată: ${formatNumar(valoare)} kg.`, 'succes');
}

// ---------- Profil și obiectiv ----------
// Sexul ales în card (până la salvare).
let sexProfilAles = null;
function deseneazaSexProfil() {
  $('profil-sex').replaceChildren(...[['m', 'Bărbat'], ['f', 'Femeie']].map(([id, n]) => el('button', {
    type: 'button', class: 'chip chip-mic' + (sexProfilAles === id ? ' activ' : ''), 'aria-pressed': String(sexProfilAles === id), text: n,
    onclick: () => { sexProfilAles = sexProfilAles === id ? null : id; deseneazaSexProfil(); },
  })));
}

function afiseazaProfil() {
  const p = profilDinSetari(setari);
  $('profil-inaltime').value = p.inaltimeCm ?? '';
  $('profil-an').value = p.anNastere ?? '';
  $('profil-an').max = String(new Date().getFullYear() - 10);
  sexProfilAles = p.sex || null;
  deseneazaSexProfil();
  $('profil-activitate').replaceChildren(el('option', { value: '', text: 'Alege…' }),
    ...NIVELURI_ACTIVITATE.map(a => el('option', { value: a.id, text: `${a.nume} — ${a.detaliu}`, selected: a.id === p.activitate })));
  $('profil-tinta').value = setari.obiectiv ? setari.obiectiv.tinta : '';
  const o = setari.obiectiv;
  $('profil-nota').textContent = o
    ? `Obiectiv setat pe ${afiseazaData(o.dela)}, de la ${formatNumar(o.start)} kg. Golește câmpul ca să-l ștergi.`
    : 'Profilul se folosește pentru IMC și pentru estimarea țintelor de nutriție. Obiectivul pornește de la greutatea ta de acum (media pe 7 zile).';
}

function salveazaProfil() {
  const hText = $('profil-inaltime').value.trim(), tText = $('profil-tinta').value.trim(), aText = $('profil-an').value.trim();
  const h = hText === '' ? null : parseFloat(hText.replace(',', '.'));
  const tinta = tText === '' ? null : parseFloat(tText.replace(',', '.'));
  const an = aText === '' ? null : Number(aText);
  if (h !== null && !(h >= 100 && h <= 250)) { notifica('Înălțimea trebuie să fie între 100 și 250 cm.', 'eroare'); return; }
  if (an !== null && !(Number.isInteger(an) && an >= 1900 && an <= new Date().getFullYear() - 10)) { notifica(`Anul nașterii trebuie să fie între 1900 și ${new Date().getFullYear() - 10}.`, 'eroare'); return; }
  if (tinta !== null && !(tinta >= 20 && tinta <= 300)) { notifica('Greutatea țintă trebuie să fie între 20 și 300 kg.', 'eroare'); return; }
  let obiectiv = setari.obiectiv;
  if (tinta === null) obiectiv = null;
  else if (!obiectiv || obiectiv.tinta !== tinta) {
    const t = tendintaGreutate(masuratoriCache.filter(m => m.tip === 'Greutate'));
    if (!t) { notifica('Notează întâi greutatea de azi, ca obiectivul să aibă un punct de plecare.', 'eroare'); return; }
    obiectiv = { tinta, start: Math.round(t.media7 * 10) / 10, dela: dataLocala() };
  }
  const activitate = $('profil-activitate').value || null;
  Object.assign(setari, setariCuProfil(setari, { inaltimeCm: h, anNastere: an, sex: sexProfilAles, activitate }));
  setari.obiectiv = obiectiv;
  salveazaSetari();
  afiseazaProfil();
  deseneazaGreutate();
  notifica('Profil salvat.', 'succes');
}

// ---------- Măsurători ----------
// Tipul scris se potrivește cu unul existent fără să conteze literele mari/mici sau diacriticele,
// ca „talie", „Talie" și „solduri"/„Șolduri" să nu devină tipuri diferite.
function tipCanonic(text) {
  const curat = text.trim().replace(/\s+/g, ' ');
  const existente = [...TIPURI_MASURATORI.map(d => d.tip), ...TIPURI_IMPLICITE, ...masuratoriCache.map(m => m.tip)];
  for (const t of existente) if (faraDiacritice(t) === faraDiacritice(curat)) return t;
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

  const tipuri = new Set([...TIPURI_IMPLICITE, ...TIPURI_MASURATORI.map(d => d.tip)]);
  masuratoriCache.forEach(m => tipuri.add(m.tip));
  const ordine = t => { const i = TIPURI_MASURATORI.findIndex(d => d.tip === t); return i < 0 ? 100 : i; };
  const lista = [...tipuri].sort((a, b) => ordine(a) - ordine(b) || a.localeCompare(b, 'ro'));

  $('tipuri').replaceChildren(...lista.map(t => el('option', { value: t })));

  // în graficul de evoluție: tipurile cu date întâi
  const cuDate = lista.filter(t => masuratoriCache.some(m => m.tip === t));
  const selector = $('masuratoare-grafic-tip');
  const anterior = selector.value;
  const optiuni = cuDate.length ? [...cuDate, ...lista.filter(t => !cuDate.includes(t))] : lista;
  selector.replaceChildren(...optiuni.map(t => el('option', { value: t, text: masuratoriCache.some(m => m.tip === t) ? t : `${t} (fără date)` })));
  if (optiuni.includes(anterior)) selector.value = anterior;

  if (!$('masuratoare-data').value) $('masuratoare-data').value = dataLocala();
  afiseazaUnitate();
  afiseazaProfil();
  deseneazaGreutate();
  deseneazaRezumatMasuratori();
  deseneazaMasuratori();
  deseneazaComparatia();
}

function afiseazaUnitate() {
  const u = unitateTip(tipCanonic($('masuratoare-tip').value || ''));
  $('masuratoare-unitate').textContent = u ? `(${u})` : '';
}

function deseneazaRezumatMasuratori() {
  const valori = ultimeleValori(masuratoriCache).filter(v => v.tip !== 'Greutate');
  const cont = $('masuratori-rezumat');
  if (!valori.length) {
    cont.replaceChildren(el('p', { class: 'nota', text: 'Încă nu ai măsurători. Cu „Măsurare completă" le notezi pe toate deodată (talie, piept, brațe…), o dată la 2–4 săptămâni, dimineața.' }));
    return;
  }
  cont.replaceChildren(...valori.map(v => el('button', { type: 'button', class: 'placuta placuta-apasabila', onclick: () => arataEvolutia(v.tip) }, [
    el('span', { class: 'placuta-eticheta', text: v.tip }),
    el('strong', { text: cuUnitate(v.ultima, v.unitate) }),
    el('span', { class: 'placuta-detaliu', text: v.fataDeAnterioara !== null ? `${cuSemn(v.fataDeAnterioara, v.unitate)} față de ${afiseazaData(v.dataAnterioara)}` : afiseazaData(v.dataUltima) }),
  ])));
}

function arataEvolutia(tip) {
  $('masuratoare-grafic-tip').value = tip;
  deseneazaMasuratori();
  $('card-evolutie-corp').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deseneazaMasuratori() {
  const tip = $('masuratoare-grafic-tip').value;
  const unitate = unitateTip(tip);
  const intrari = masuratoriCache
    .filter(m => m.tip === tip)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.creat || 0) - (b.creat || 0));
  const zilnice = valoriZilnice(intrari, tip);

  deseneazaGrafic($('grafic-masuratori'), zilnice.map(m => ({ x: timpDinData(m.data), y: Math.round(m.valoare * 10) / 10, data: m.data })), v => cuUnitate(v, unitate));
  $('masuratoare-sumar').textContent = zilnice.length > 1
    ? `${plural(intrari.length, 'înregistrare', 'înregistrări')}. De la ${afiseazaData(zilnice[0].data)}: ${cuSemn(zilnice[zilnice.length - 1].valoare - zilnice[0].valoare, unitate)}.`
    : '';

  if (intrari.length === 0) {
    $('masuratori-lista').replaceChildren(stareGoala({
      icon: 'corp', titlu: `Nicio înregistrare pentru „${tip}"`, text: 'Adaugă prima valoare din formularul de mai sus.',
    }));
    return;
  }
  $('masuratori-lista').replaceChildren(...[...intrari].reverse().map(m =>
    el('div', { class: 'rand-lista' }, [
      el('span', { text: afiseazaData(m.data) }),
      el('div', { class: 'rand-actiuni' }, [
        el('strong', { class: 'valoare', text: cuUnitate(m.valoare, unitate) }),
        buton({ icon: 'editeaza', tip: 'fantoma', eticheta: `Corectează valoarea din ${afiseazaData(m.data)}`, onclick: () => corecteazaIntrarea(m) }),
        buton({ icon: 'cos', tip: 'fantoma', eticheta: `Șterge valoarea din ${afiseazaData(m.data)}`, onclick: () => stergeIntrarea(m) }),
      ]),
    ])));
}

async function stergeIntrarea(m) {
  const da = await confirma({
    titlu: 'Ștergi înregistrarea?',
    text: `${m.tip}: ${cuUnitate(m.valoare, unitateTip(m.tip))}, din ${afiseazaData(m.data)}.`,
    ok: 'Șterge', pericol: true,
  });
  if (!da) return;
  let idCos;
  try {
    idCos = await stergeMasuratoare(m.id);
  } catch (err) {
    console.error(err);
    notifica('Înregistrarea nu a putut fi ștearsă.', 'eroare');
    return;
  }
  await reincarcaMasuratori();
  deseneazaCos().catch(() => {});
  notificaStergere('Înregistrare ștearsă.', idCos, () => dupaRestaurareDinCos('masuratori'));
}

// Corectarea valorii sau a datei unei înregistrări.
function corecteazaIntrarea(m) {
  const unitate = unitateTip(m.tip);
  const valoare = el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(m.valoare), 'aria-label': `Valoare${unitate ? ` (${unitate})` : ''}` });
  const data = el('input', { type: 'date', value: m.data, max: dataLocala(), 'aria-label': 'Data' });
  const continut = el('div', {}, [
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: `Valoare${unitate ? ` (${unitate})` : ''}` }), valoare]),
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Data' }), data]),
  ]);
  const d = deschideDialog({
    titlu: `Corectează: ${m.tip}`, continut,
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        const v = parseFloat(valoare.value);
        if (!valoarePlauzibila(m.tip, v)) { notifica(`Valoarea nu pare corectă pentru ${m.tip.toLowerCase()}.`, 'eroare'); return; }
        if (!data.value || data.value > dataLocala()) { notifica('Alege o dată validă, cel târziu azi.', 'eroare'); return; }
        try {
          await actualizeazaMasuratoare({ ...m, valoare: v, data: data.value });
        } catch (err) {
          console.error(err);
          notifica('Corectarea nu a putut fi salvată.', 'eroare');
          return;
        }
        d.inchide();
        await reincarcaMasuratori();
        notifica('Valoare corectată.', 'succes');
      } }),
    ],
  });
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
  if (!valoarePlauzibila(tip, valoare)) {
    const d = definitieTip(tip);
    notifica(d ? `${tip}: introdu o valoare între ${d.min} și ${d.max} ${d.unitate}.` : 'Introdu o valoare pozitivă.', 'eroare');
    return;
  }
  try {
    await salveazaMasuratoare({ data, tip, valoare, creat: Date.now() });
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Măsurătoarea nu a putut fi salvată.'), 'eroare');
    return;
  }
  $('masuratoare-valoare').value = '';
  $('masuratoare-tip').value = tip;
  await reincarcaMasuratori();
  $('masuratoare-grafic-tip').value = tip;
  deseneazaMasuratori();
  notifica('Măsurătoare salvată.', 'succes');
}

// Măsurarea completă: toate măsurătorile într-un singur formular, cu valorile de data trecută ca indiciu.
function deschideMasurareaCompleta() {
  const ultime = new Map(ultimeleValori(masuratoriCache).map(v => [v.tip, v]));
  const proprii = [...new Set(masuratoriCache.map(m => m.tip))].filter(t => !definitieTip(t));
  const tipuri = [...TIPURI_MASURATORI.map(d => d.tip), ...proprii];
  const data = el('input', { type: 'date', value: dataLocala(), max: dataLocala(), 'aria-label': 'Data măsurării' });
  const campuri = tipuri.map(tip => {
    const u = unitateTip(tip), ult = ultime.get(tip);
    const input = el('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: ult ? `ultima: ${formatNumar(ult.ultima)}` : '', 'aria-label': `${tip}${u ? ` (${u})` : ''}` });
    return { tip, input, rand: el('label', { class: 'rand-masurare' }, [el('span', { text: tip }), input, el('span', { class: 'nota', text: u })]) };
  });
  const continut = el('div', {}, [
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Data' }), data]),
    el('div', { class: 'formular-masurare' }, campuri.map(c => c.rand)),
    el('p', { class: 'nota', text: 'Completează doar ce ai măsurat. Talia: la nivelul buricului, relaxat; brațul și coapsa: în punctul cel mai gros.' }),
  ]);
  const d = deschideDialog({
    titlu: 'Măsurare completă', continut,
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        if (!data.value || data.value > dataLocala()) { notifica('Alege o dată validă, cel târziu azi.', 'eroare'); return; }
        const deSalvat = [];
        const gresite = [];
        for (const c of campuri) {
          if (c.input.value.trim() === '') continue;
          const v = parseFloat(c.input.value);
          if (valoarePlauzibila(c.tip, v)) deSalvat.push({ data: data.value, tip: c.tip, valoare: v, creat: Date.now() });
          else gresite.push(c.tip);
        }
        if (gresite.length) { notifica(`Verifică: ${gresite.join(', ')}.`, 'eroare'); return; }
        if (!deSalvat.length) { notifica('Completează cel puțin o măsurătoare.', 'eroare'); return; }
        try {
          for (const m of deSalvat) await salveazaMasuratoare(m);
        } catch (err) {
          console.error(err);
          notifica(mesajEroareSalvare(err, 'Măsurătorile nu au putut fi salvate.'), 'eroare');
          await reincarcaMasuratori();
          return;
        }
        d.inchide();
        await reincarcaMasuratori();
        notifica(`${plural(deSalvat.length, 'măsurătoare salvată', 'măsurători salvate')}.`, 'succes');
      } }),
    ],
  });
}

// ---------- Compararea a două date ----------
function deseneazaComparatia() {
  const date = dateCuMasuratori(masuratoriCache);
  const a = $('compara-a'), b = $('compara-b');
  const cont = $('compara-rezultat');
  if (date.length < 2) {
    a.closest('.rand').hidden = true;
    cont.replaceChildren(el('p', { class: 'nota', text: 'Ai nevoie de măsurători din cel puțin două date diferite (în afară de greutate).' }));
    return;
  }
  a.closest('.rand').hidden = false;
  const va = a.value, vb = b.value;
  const optiuni = () => date.map(d => el('option', { value: d, text: afiseazaData(d) }));
  a.replaceChildren(...optiuni());
  b.replaceChildren(...optiuni());
  a.value = date.includes(va) ? va : date[date.length - 1];
  b.value = date.includes(vb) ? vb : date[0];
  const rez = comparaDate(masuratoriCache, a.value, b.value);
  cont.replaceChildren(el('div', { class: 'tabel-compara' }, [
    el('div', { class: 'tabel-compara-rand antet' }, [el('span', { text: '' }), el('span', { text: afiseazaData(a.value) }), el('span', { text: afiseazaData(b.value) }), el('span', { text: 'Diferență' })]),
    ...rez.map(r => el('div', { class: 'tabel-compara-rand' }, [
      el('span', { text: r.tip }),
      el('span', { text: r.a !== null ? cuUnitate(r.a, r.unitate) : '—' }),
      el('span', { text: r.b !== null ? cuUnitate(r.b, r.unitate) : '—' }),
      el('strong', { text: r.diferenta !== null ? cuSemn(r.diferenta, r.unitate) : '—' }),
    ])),
  ]), el('p', { class: 'nota', text: 'Greutatea: cântărirea cea mai apropiată de fiecare dată (cel mult 3 zile distanță).' }));
}

// ---------- Poze de progres ----------
async function reincarcaPoze() {
  try {
    pozeCache = await toatePozele();
  } catch (err) {
    console.error(err);
    pozeCache = [];
  }
  deseneazaPoze();
}

function urlPoza(p) {
  const u = URL.createObjectURL(p.imagine);
  urlPoze.push(u);
  return u;
}
const numeUnghi = u => (UNGHIURI_POZA.find(x => x.cheie === u) || UNGHIURI_POZA[0]).nume;

function deseneazaPoze() {
  for (const u of urlPoze) URL.revokeObjectURL(u);
  urlPoze = [];
  const grupe = pozePeDate(pozeCache);
  const galerie = $('poze-galerie');
  if (!grupe.length) {
    galerie.replaceChildren(el('p', { class: 'nota', text: 'Nicio poză încă. Fă-le în aceleași condiții (lumină, loc, ora din zi), față, profil și spate, o dată la 2–4 săptămâni.' }));
    $('poze-compara-bloc').hidden = true;
    return;
  }
  galerie.replaceChildren(...grupe.map(g => el('div', { class: 'poze-zi' }, [
    el('p', { class: 'poze-zi-data', text: afiseazaData(g.data) }),
    el('div', { class: 'poze-rand' }, g.poze.map(p => el('button', { type: 'button', class: 'poza-miniatura', 'aria-label': `Poza ${numeUnghi(p.unghi).toLowerCase()} din ${afiseazaData(p.data)}`, onclick: () => arataPoza(p) }, [
      el('img', { src: urlPoza(p), alt: '', loading: 'lazy', decoding: 'async' }),
      el('span', { text: numeUnghi(p.unghi) }),
    ]))),
  ])));
  deseneazaComparatiaPoze(grupe);
}

function deseneazaComparatiaPoze(grupe) {
  const bloc = $('poze-compara-bloc');
  bloc.hidden = grupe.length < 2;
  if (grupe.length < 2) return;
  const a = $('poze-a'), b = $('poze-b');
  const va = a.value, vb = b.value;
  const date = grupe.map(g => g.data);
  const optiuni = () => date.map(d => el('option', { value: d, text: afiseazaData(d) }));
  a.replaceChildren(...optiuni());
  b.replaceChildren(...optiuni());
  a.value = date.includes(va) ? va : date[date.length - 1];
  b.value = date.includes(vb) ? vb : date[0];
  const ga = grupe.find(g => g.data === a.value), gb = grupe.find(g => g.data === b.value);
  const unghiuri = UNGHIURI_POZA.filter(u => ga.poze.some(p => p.unghi === u.cheie) || gb.poze.some(p => p.unghi === u.cheie));
  if (!unghiuri.some(u => u.cheie === corpStare.unghiCompara)) corpStare.unghiCompara = unghiuri[0].cheie;
  chipuriCorp($('poze-unghi'), unghiuri, corpStare.unghiCompara, cheie => { corpStare.unghiCompara = cheie; deseneazaPoze(); });
  const coloana = g => {
    const p = g.poze.filter(x => x.unghi === corpStare.unghiCompara).pop();
    return el('figure', { class: 'poza-compara' }, [
      p ? el('img', { src: urlPoza(p), alt: `${numeUnghi(p.unghi)}, ${afiseazaData(g.data)}`, decoding: 'async' }) : el('div', { class: 'poza-lipsa', text: 'Fără poză din acest unghi' }),
      el('figcaption', { text: afiseazaData(g.data) }),
    ]);
  };
  $('poze-compara').replaceChildren(coloana(ga), coloana(gb));
}

function arataPoza(p) {
  const url = URL.createObjectURL(p.imagine);
  const continut = el('figure', { class: 'poza-mare' }, [el('img', { src: url, alt: `${numeUnghi(p.unghi)}, ${afiseazaData(p.data)}` })]);
  const d = deschideDialog({
    titlu: `${numeUnghi(p.unghi)} · ${afiseazaData(p.data)}`, continut,
    laAnulare: () => URL.revokeObjectURL(url),
    butoane: [
      buton({ text: 'Șterge', icon: 'cos', tip: 'pericol', onclick: () => d.inchide(async () => {
        URL.revokeObjectURL(url);
        const da = await confirma({ titlu: 'Ștergi poza?', text: `Poza ${numeUnghi(p.unghi).toLowerCase()} din ${afiseazaData(p.data)} se mută în „Șterse recent" (Setări), unde rămâne 30 de zile.`, ok: 'Șterge', pericol: true });
        if (!da) return;
        let idCos;
        try { idCos = await stergePoza(p.id, `${numeUnghi(p.unghi).toLowerCase()} din ${afiseazaData(p.data)}`); } catch (err) { console.error(err); notifica('Poza nu a putut fi ștearsă.', 'eroare'); return; }
        await reincarcaPoze();
        deseneazaCos().catch(() => {});
        notificaStergere('Poză ștearsă.', idCos, () => dupaRestaurareDinCos('poze'));
      }) }),
      buton({ text: 'Închide', tip: 'principal', onclick: () => d.inchide(() => URL.revokeObjectURL(url)) }),
    ],
  });
}

// Micșorează poza (latura mare de cel mult `max` px) și o salvează ca JPEG. Orientarea din cameră e aplicată de browser.
function micsoreazaImagine(fisier, max = 1280, calitate = 0.82) {
  return new Promise((rezolva, respinge) => {
    const url = URL.createObjectURL(fisier);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(blob => (blob ? rezolva({ blob, latime: w, inaltime: h }) : respinge(new Error('conversie'))), 'image/jpeg', calitate);
    };
    img.onerror = () => { URL.revokeObjectURL(url); respinge(new Error('imagine')); };
    img.src = url;
  });
}

let pozaInAsteptare = null;
function deschideAdaugarePoza() {
  const data = el('input', { type: 'date', value: dataLocala(), max: dataLocala(), 'aria-label': 'Data pozei' });
  let unghi = 'fata';
  const chipuriUnghi = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Unghiul' });
  const deseneazaChipuri = () => chipuriCorp(chipuriUnghi, UNGHIURI_POZA, unghi, c => { unghi = c; deseneazaChipuri(); });
  deseneazaChipuri();
  const d = deschideDialog({
    titlu: 'Adaugă o poză de progres',
    continut: el('div', {}, [
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Data' }), data]),
      el('p', { class: 'camp-eticheta', text: 'Unghi' }), chipuriUnghi,
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Alege poza', icon: 'plus', tip: 'principal', onclick: () => {
        if (!data.value || data.value > dataLocala()) { notifica('Alege o dată validă, cel târziu azi.', 'eroare'); return; }
        pozaInAsteptare = { data: data.value, unghi };
        $('fisier-poza').click();
        d.inchide();
      } }),
    ],
  });
}

async function pozaAleasa(e) {
  const fisier = e.target.files[0];
  e.target.value = '';
  const info = pozaInAsteptare;
  pozaInAsteptare = null;
  if (!fisier || !info) return;
  if (!fisier.type.startsWith('image/')) { notifica('Alege o imagine (JPEG, PNG sau HEIC din galerie).', 'eroare'); return; }
  let rez;
  try {
    rez = await micsoreazaImagine(fisier);
  } catch (err) {
    console.error(err);
    notifica('Poza nu a putut fi citită. Încearcă altă imagine.', 'eroare');
    return;
  }
  try {
    await salveazaPoza({ data: info.data, unghi: info.unghi, imagine: rez.blob, latime: rez.latime, inaltime: rez.inaltime, creat: Date.now() });
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Poza nu a putut fi salvată.'), 'eroare');
    return;
  }
  await reincarcaPoze();
  notifica(`Poză salvată (${Math.round(rez.blob.size / 1024)} KB).`, 'succes');
}

function initCorp() {
  $('btn-greutate').addEventListener('click', salveazaGreutatea);
  $('greutate-valoare').addEventListener('keydown', e => { if (e.key === 'Enter') salveazaGreutatea(); });
  $('btn-masuratoare').addEventListener('click', salveazaMasuratoarea);
  $('masuratoare-tip').addEventListener('input', afiseazaUnitate);
  $('masuratoare-grafic-tip').addEventListener('change', deseneazaMasuratori);
  $('masuratoare-data').max = dataLocala();
  $('btn-profil').addEventListener('click', salveazaProfil);
  $('btn-masurare-completa').addEventListener('click', deschideMasurareaCompleta);
  $('compara-a').addEventListener('change', deseneazaComparatia);
  $('compara-b').addEventListener('change', deseneazaComparatia);
  $('btn-poza').addEventListener('click', deschideAdaugarePoza);
  $('fisier-poza').addEventListener('change', pozaAleasa);
  $('poze-a').addEventListener('change', deseneazaPoze);
  $('poze-b').addEventListener('change', deseneazaPoze);
  reincarcaPoze();
}
