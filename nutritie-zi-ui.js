// Nutriție → fila „Ziua mea” (etapa 3): țintele tale, mesele zilei, planificat vs. mâncat.
// Calculele sunt în nutritie-zi.js; aici doar afișarea și dialogurile.

let dataZiNutritie = dataLocala();
let ziNutritie = { data: dataZiNutritie, mese: [] };

const fmtNr = v => Math.round(v).toLocaleString('ro-RO');
const fmtPortii = p => {
  const t = String(Math.round(p * 100) / 100).replace('.', ',');
  return `${t} ${p === 1 ? 'porție' : 'porții'}`;
};

function mutaData(data, zile) {
  const [a, l, z] = data.split('-').map(Number);
  return formatData(new Date(a, l - 1, z + zile));
}

function titluZi(data) {
  const azi = dataLocala();
  if (data === azi) return 'Azi';
  if (data === mutaData(azi, -1)) return 'Ieri';
  if (data === mutaData(azi, 1)) return 'Mâine';
  const [a, l, z] = data.split('-').map(Number);
  return new Date(a, l - 1, z).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function incarcaZiNutritie(data = dataZiNutritie) {
  dataZiNutritie = data;
  try {
    ziNutritie = await citesteZiNutritie(data);
  } catch (err) {
    console.error(err);
    ziNutritie = { data, mese: [] };
    notifica('Mesele zilei nu au putut fi citite.', 'eroare');
  }
}

async function salveazaZiua(zi, mesajEroare = 'Modificarea nu a putut fi salvată.') {
  try {
    await salveazaZiNutritie(zi);
    ziNutritie = zi;
    return true;
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, mesajEroare), 'eroare');
    return false;
  }
}

async function randeazaZiNutritie({ reincarca = false } = {}) {
  if (reincarca || ziNutritie.data !== dataZiNutritie) await incarcaZiNutritie(dataZiNutritie);
  deseneazaNavZi();
  deseneazaSumarZi();
  deseneazaMeseZi();
}

// ---------- Navigarea între zile ----------
function deseneazaNavZi() {
  const azi = dataLocala();
  const schimba = async delta => { dataZiNutritie = mutaData(dataZiNutritie, delta); await randeazaZiNutritie({ reincarca: true }); };
  $('zi-nav').replaceChildren(...[
    buton({ icon: 'sageata', tip: 'fantoma', mic: true, clasa: 'zi-inapoi', eticheta: 'Ziua anterioară', onclick: () => schimba(-1) }),
    el('div', { class: 'zi-titlu' }, [
      el('strong', { text: titluZi(dataZiNutritie) }),
      el('span', { class: 'nota', text: afiseazaData(dataZiNutritie) }),
    ]),
    dataZiNutritie !== azi
      ? buton({ text: 'Azi', tip: 'secundar', mic: true, onclick: async () => { dataZiNutritie = azi; await randeazaZiNutritie({ reincarca: true }); } })
      : null,
    buton({ icon: 'sageata', tip: 'fantoma', mic: true, eticheta: 'Ziua următoare', onclick: () => schimba(1) }),
  ].filter(Boolean));
}

// ---------- Sumarul zilei: țintă, planificat, mâncat, rămas ----------
function baraDubla(mancat, planificat, tinta, clasa) {
  // Fără țintă, bara arată mâncatul față de planificat.
  const ref = tinta > 0 ? tinta : Math.max(planificat, mancat, 1);
  const p = x => `${Math.min(100, Math.round(x / ref * 100))}%`;
  return el('span', { class: 'zi-bara', role: 'presentation' }, [
    el('i', { class: 'zi-bara-plan', style: `width:${p(planificat)}` }),
    el('i', { class: `zi-bara-mancat ${clasa}`, style: `width:${p(mancat)}` }),
    tinta > 0 && mancat > tinta ? el('b', { class: 'zi-bara-peste' }) : null,
  ]);
}

function deseneazaSumarZi() {
  const tinte = setari.tinteNutritie;
  const { planificat, mancat, numar, terminate } = totaluriZi(ziNutritie);
  const continut = [];

  const cap = el('div', { class: 'card-cap' }, [
    el('h2', { text: 'Calorii și macronutrienți' }),
    buton({ text: tinte ? 'Ținte' : 'Setează ținte', icon: 'editeaza', tip: 'fantoma', mic: true, onclick: deschideTinteNutritie }),
  ]);
  continut.push(cap);

  if (tinte) {
    const ramas = tinte.kcal - mancat.kcal;
    continut.push(el('div', { class: 'zi-kcal' }, [
      el('div', { class: 'zi-kcal-mare' }, [
        el('strong', { class: ramas < 0 ? 'peste' : '', text: fmtNr(Math.abs(ramas)) }),
        el('span', { text: ramas < 0 ? 'kcal peste țintă' : 'kcal rămase' }),
      ]),
      el('div', { class: 'zi-kcal-detalii' }, [
        el('span', {}, ['Țintă ', el('b', { text: fmtNr(tinte.kcal) })]),
        el('span', {}, ['Planificat ', el('b', { text: fmtNr(planificat.kcal) })]),
        el('span', {}, ['Mâncat ', el('b', { text: fmtNr(mancat.kcal) })]),
      ]),
    ]));
    continut.push(baraDubla(mancat.kcal, planificat.kcal, tinte.kcal, 'nutri-c zi-bara-kcal'));
  } else {
    continut.push(el('div', { class: 'zi-kcal' }, [
      el('div', { class: 'zi-kcal-mare' }, [el('strong', { text: fmtNr(mancat.kcal) }), el('span', { text: 'kcal mâncate' })]),
      el('div', { class: 'zi-kcal-detalii' }, [el('span', {}, ['Planificat ', el('b', { text: fmtNr(planificat.kcal) })])]),
    ]));
    continut.push(el('p', { class: 'nota', text: 'Setează-ți țintele (calorii, proteine, carbohidrați, grăsimi, fibre) ca să vezi cât a mai rămas. Le poți scrie tu sau le poți estima din profil.' }));
  }

  const randMacro = (nume, camp, clasa) => {
    const t = tinte && tinte[camp];
    return el('div', { class: 'zi-macro' }, [
      el('span', { class: 'nutri-nume' }, [el('i', { class: `nutri-punct ${clasa}` }), nume]),
      el('span', { class: 'zi-macro-valori' }, [
        el('b', { text: `${fmtNr(mancat[camp])}` }),
        t ? ` / ${fmtNr(t)} g` : ' g',
        el('span', { class: 'nota', text: ` · plan ${fmtNr(planificat[camp])} g` }),
      ]),
      baraDubla(mancat[camp], planificat[camp], t, clasa),
    ]);
  };
  continut.push(el('div', { class: 'zi-macrouri' }, [
    randMacro('Proteine', 'proteine', 'nutri-p'),
    randMacro('Carbohidrați', 'carbohidrati', 'nutri-c'),
    randMacro('Grăsimi', 'grasimi', 'nutri-g'),
    randMacro('Fibre', 'fibre', 'nutri-f'),
  ]));
  continut.push(el('p', { class: 'nota nota-mica zi-legenda' }, [
    el('i', { class: 'zi-leg-mancat' }), ' mâncat  ', el('i', { class: 'zi-leg-plan' }), ' planificat',
    numar ? ` · mâncate: ${terminate} din ${numar}` : '',
  ]));
  if (tinte && tinte.estimat) {
    continut.push(el('p', { class: 'nota nota-mica', text: 'Țintele sunt o estimare din profil, nu o recomandare medicală. Le poți ajusta oricând.' }));
  }
  $('zi-sumar').replaceChildren(...continut);
}

// ---------- Mesele zilei ----------
function imagineIntrare(i) {
  const r = retetaDupaId(i.idReteta);
  if (r) return imagineReteta(r, 'zi-imagine');
  return el('img', { class: 'zi-imagine imagine-rezerva', alt: '', src: urlImagineRezerva(numeMasa(i.masa)) });
}

function textStareIntrare(i) {
  if (i.stare === 'complet') return 'Mâncată';
  if (i.stare === 'partial') return `Ai mâncat ${fmtPortii(i.portiiMancate).replace(/ porți(e|i)$/, '')} din ${fmtPortii(i.portii)}`;
  return 'Neîncepută';
}

function randIntrare(i) {
  const vPlan = valoriPlanificateIntrare(i);
  const butoaneStare = STARI_MASA.map(s => el('button', {
    type: 'button', class: 'zi-stare-btn' + (i.stare === s.id ? ' activ' : '') + ` stare-${s.id}`,
    'aria-pressed': String(i.stare === s.id), text: s.nume,
    onclick: () => schimbaStarea(i, s.id),
  }));
  return el('li', { class: `zi-intrare stare-${i.stare}` }, [
    el('button', { class: 'zi-intrare-principal', type: 'button', onclick: () => deschideIntrarea(i),
      'aria-label': `${i.nume}, ${fmtPortii(i.portii)}, ${fmtNr(vPlan.kcal)} kcal, ${textStareIntrare(i)}. Detalii` }, [
      imagineIntrare(i),
      el('span', { class: 'zi-intrare-text' }, [
        el('strong', { text: i.nume }),
        el('span', { class: 'nota', text: `${fmtPortii(i.portii)} · ${fmtNr(vPlan.kcal)} kcal · P ${fmtNr(vPlan.proteine)} g` }),
        i.stare === 'partial' ? el('span', { class: 'zi-partial', text: textStareIntrare(i) }) : null,
      ]),
    ]),
    el('div', { class: 'zi-stari', role: 'group', 'aria-label': `Starea mesei ${i.nume}` }, butoaneStare),
  ]);
}

function deseneazaMeseZi() {
  const carduri = MESE.map(m => {
    const intrari = ziNutritie.mese.filter(i => i.masa === m.id);
    const t = totaluriPeMasa(ziNutritie, m.id);
    return el('section', { class: 'card zi-masa', 'aria-label': m.nume }, [
      el('div', { class: 'card-cap' }, [
        el('h2', { text: m.nume }),
        el('span', { class: 'nota', text: intrari.length ? `${fmtNr(t.mancat.kcal)} / ${fmtNr(t.planificat.kcal)} kcal` : '' }),
      ]),
      intrari.length ? el('ul', { class: 'zi-intrari' }, intrari.map(randIntrare)) : null,
      buton({ text: intrari.length ? 'Adaugă încă o rețetă' : 'Adaugă o rețetă', icon: 'plus', tip: intrari.length ? 'fantoma' : 'secundar',
        mic: true, lat: true, onclick: () => alegeRetetaPentruMasa(m.id) }),
    ]);
  });
  $('zi-mese').replaceChildren(...carduri);
}

// ---------- Acțiuni pe intrări ----------
async function inlocuiesteIntrarea(noua) {
  const zi = { ...ziNutritie, mese: ziNutritie.mese.map(x => (x.id === noua.id ? noua : x)) };
  if (await salveazaZiua(zi)) randeazaZiNutritie();
}

async function schimbaStarea(i, stare) {
  if (stare === 'partial') { deschideConsumPartial(i); return; }
  if (i.stare === stare) return;
  await inlocuiesteIntrarea(schimbaStareIntrare(i, stare));
}

function deschideConsumPartial(i) {
  const input = el('input', { type: 'number', inputmode: 'decimal', step: '0.05', min: '0.05', max: String(i.portii),
    value: i.stare === 'partial' ? String(i.portiiMancate) : String(Math.round(i.portii / 2 * 100) / 100), 'aria-label': 'Porții mâncate' });
  const previzualizare = el('p', { class: 'nota' });
  const actualizeaza = () => {
    const p = parseFloat(String(input.value).replace(',', '.'));
    if (!(p > 0 && p < i.portii)) { previzualizare.textContent = `Scrie un număr mai mare ca 0 și mai mic decât ${String(i.portii).replace('.', ',')}.`; return; }
    const v = valoriMancateIntrare({ ...i, stare: 'partial', portiiMancate: p });
    previzualizare.textContent = `≈ ${fmtNr(v.kcal)} kcal · P ${fmtNr(v.proteine)} g · C ${fmtNr(v.carbohidrati)} g · G ${fmtNr(v.grasimi)} g`;
  };
  input.addEventListener('input', actualizeaza);
  const rapide = el('div', { class: 'chipuri chipuri-mici' }, [0.25, 0.5, 0.75].map(f => el('button', {
    type: 'button', class: 'chip chip-mic', text: `${Math.round(f * 100)}%`,
    onclick: () => { input.value = String(Math.round(i.portii * f * 100) / 100); actualizeaza(); },
  })));
  actualizeaza();
  const d = deschideDialog({
    titlu: 'Cât ai mâncat?',
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: `${i.nume}: planificat ${fmtPortii(i.portii)}.` }),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Porții mâncate' }), input]),
      rapide,
      previzualizare,
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        const p = parseFloat(String(input.value).replace(',', '.'));
        let noua;
        try { noua = schimbaStareIntrare(i, 'partial', p); } catch (err) { notifica(err.message, 'eroare'); return; }
        d.inchide();
        await inlocuiesteIntrarea(noua);
      } }),
    ],
  });
}

async function scoateIntrarea(i) {
  const pozitie = ziNutritie.mese.findIndex(x => x.id === i.id);
  const zi = { ...ziNutritie, mese: ziNutritie.mese.filter(x => x.id !== i.id) };
  if (!(await salveazaZiua(zi))) return;
  randeazaZiNutritie();
  const data = zi.data;
  notifica(`${i.nume} a fost scoasă din ziua aceasta.`, 'info', 6000, { text: 'Anulează', onclick: async () => {
    const curenta = await citesteZiNutritie(data);
    if (curenta.mese.some(x => x.id === i.id)) return;
    const mese = [...curenta.mese];
    mese.splice(Math.min(Math.max(pozitie, 0), mese.length), 0, i);
    await salveazaZiNutritie({ ...curenta, mese });
    if (dataZiNutritie === data) await randeazaZiNutritie({ reincarca: true });
  } });
}

function deschideIntrarea(i) {
  let portii = i.portii;
  const valori = el('div');
  const textPortii = el('strong', { class: 'portii-valoare', text: '' });
  const deseneaza = () => {
    textPortii.textContent = String(portii).replace('.', ',');
    valori.replaceChildren(panouNutritional(valoriPlanificateIntrare({ ...i, portii }), `planificat (${fmtPortii(portii)})`));
  };
  const schimba = delta => { portii = Math.max(0.5, Math.min(10, Math.round((portii + delta) * 2) / 2)); deseneaza(); };
  deseneaza();
  const r = retetaDupaId(i.idReteta);
  const d = deschideDialog({
    titlu: i.nume,
    continut: el('div', {}, [
      el('p', { class: 'nota', text: `${numeMasa(i.masa)} · ${textStareIntrare(i)}` }),
      el('div', { class: 'rand aliniat portii-rand' }, [
        el('h3', { class: 'detaliu-titlu', text: 'Porții planificate' }),
        el('div', { class: 'stepper' }, [
          buton({ icon: 'minus', tip: 'secundar', mic: true, eticheta: 'Mai puțin', onclick: () => schimba(-0.5) }),
          textPortii,
          buton({ icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Mai mult', onclick: () => schimba(0.5) }),
        ]),
      ]),
      valori,
      el('p', { class: 'nota nota-mica', text: 'Valorile au fost salvate când ai adăugat rețeta în zi. Dacă editezi rețeta mai târziu, ziua aceasta nu se schimbă.' }),
      el('div', { class: 'rand-butoane mt' }, [
        r ? buton({ text: 'Vezi rețeta', icon: 'carte', tip: 'secundar', mic: true, onclick: () => d.inchide(() => arataReteta(r.id)) }) : null,
        buton({ text: 'Scoate din zi', icon: 'cos', tip: 'fantoma', mic: true, onclick: () => d.inchide(() => scoateIntrarea(i)) }),
      ]),
    ]),
    butoane: [
      buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        d.inchide();
        if (portii === i.portii) return;
        let noua = { ...i, portii, modificat: Date.now() };
        // Dacă ai mâncat parțial cel puțin cât ai planificat acum, masa devine „Mâncată”.
        if (noua.stare === 'partial' && noua.portiiMancate >= portii) { noua = schimbaStareIntrare(noua, 'complet'); }
        await inlocuiesteIntrarea(noua);
      } }),
    ],
  });
}

// ---------- Adăugarea unei rețete în zi ----------
function alegeRetetaPentruMasa(idMasa) {
  let doarMasa = true;
  let cautare = '';
  const lista = el('div', { class: 'selector-retete' });
  const input = el('input', { type: 'search', placeholder: 'Caută rețetă sau ingredient', autocomplete: 'off', 'aria-label': 'Caută rețetă' });
  const comutator = el('div', { class: 'chipuri chipuri-mici' });
  const deseneaza = () => {
    comutator.replaceChildren(
      el('button', { type: 'button', class: 'chip chip-mic' + (doarMasa ? ' activ' : ''), text: numeMasa(idMasa), onclick: () => { doarMasa = true; deseneaza(); } }),
      el('button', { type: 'button', class: 'chip chip-mic' + (!doarMasa ? ' activ' : ''), text: 'Toate rețetele', onclick: () => { doarMasa = false; deseneaza(); } }),
    );
    const cuvinte = normalizeazaText(cautare).split(/\s+/).filter(Boolean);
    const potrivite = toateRetetele()
      .filter(r => !doarMasa || r.masa === idMasa)
      .filter(r => { const t = textCautareReteta(r); return cuvinte.every(c => t.includes(c)); })
      .sort((a, b) => (estePreferata(b.id) - estePreferata(a.id)) || a.nume.localeCompare(b.nume, 'ro'));
    lista.replaceChildren(...(potrivite.length ? potrivite.slice(0, 80).map(r => {
      const v = valoriPortie(r, indexNutritie);
      return el('button', { type: 'button', class: 'selector-reteta', onclick: () => d.inchide(() => deschideAdaugareInZi(r, { masa: idMasa })) }, [
        imagineReteta(r, 'zi-imagine'),
        el('span', { class: 'zi-intrare-text' }, [
          el('strong', { text: (estePreferata(r.id) ? '★ ' : '') + r.nume }),
          el('span', { class: 'nota', text: `${fmtNr(v.kcal)} kcal · ${macroScurt(v)}${doarMasa ? '' : ` · ${numeMasa(r.masa)}`}` }),
        ]),
      ]);
    }) : [el('p', { class: 'nota', text: 'Nicio rețetă nu se potrivește.' })]));
  };
  input.addEventListener('input', () => { cautare = input.value; deseneaza(); });
  const d = deschideDialog({
    titlu: `Adaugă la ${numeMasa(idMasa).toLowerCase()}`,
    continut: el('div', {}, [el('div', { class: 'cautare' }, [iconita('cauta'), input]), comutator, lista]),
    butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })],
  });
  deseneaza();
}

// Dialogul de adăugare (din fila Ziua mea sau din detaliul unei rețete).
function deschideAdaugareInZi(r, { masa = r.masa, data = dataZiNutritie } = {}) {
  let masaAleasa = MESE.some(m => m.id === masa) ? masa : r.masa;
  let portii = 1;
  const vp = valoriPortie(r, indexNutritie);
  const chipuri = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Masa' });
  const valori = el('div');
  const textPortii = el('strong', { class: 'portii-valoare' });
  const deseneaza = () => {
    chipuri.replaceChildren(...MESE.map(m => el('button', { type: 'button', class: 'chip chip-mic' + (m.id === masaAleasa ? ' activ' : ''),
      'aria-pressed': String(m.id === masaAleasa), text: m.nume, onclick: () => { masaAleasa = m.id; deseneaza(); } })));
    textPortii.textContent = String(portii).replace('.', ',');
    valori.replaceChildren(panouNutritional(valoriInmultite(vp, portii), `pentru ${fmtPortii(portii)}`));
  };
  const schimba = delta => { portii = Math.max(0.5, Math.min(10, Math.round((portii + delta) * 2) / 2)); deseneaza(); };
  deseneaza();
  const lipsa = vp.lipsa && vp.lipsa.length;
  const d = deschideDialog({
    titlu: r.nume,
    continut: el('div', {}, [
      el('p', { class: 'nota', text: `Se adaugă în ziua: ${titluZi(data).toLowerCase() === 'azi' ? 'azi' : titluZi(data)} (${afiseazaData(data)}). Va apărea ca „Neîncepută” până o marchezi tu.` }),
      el('h3', { class: 'detaliu-titlu', text: 'Masa' }),
      chipuri,
      el('div', { class: 'rand aliniat portii-rand' }, [
        el('h3', { class: 'detaliu-titlu', text: 'Porții' }),
        el('div', { class: 'stepper' }, [
          buton({ icon: 'minus', tip: 'secundar', mic: true, eticheta: 'Mai puțin', onclick: () => schimba(-0.5) }),
          textPortii,
          buton({ icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Mai mult', onclick: () => schimba(0.5) }),
        ]),
      ]),
      valori,
      lipsa ? el('p', { class: 'nota nota-avertizare', text: 'Unele ingrediente nu mai există în bibliotecă și nu sunt incluse în valori.' }) : null,
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Adaugă', icon: 'plus', tip: 'principal', onclick: async () => {
        d.inchide();
        await adaugaRetetaInZi(r, { masa: masaAleasa, portii, data });
      } }),
    ],
  });
}

async function adaugaRetetaInZi(r, { masa, portii, data }) {
  const zi = data === ziNutritie.data ? ziNutritie : await citesteZiNutritie(data);
  const intrare = intrareMasa({ id: idNutritieNou(), masa, reteta: r, valoriPortieReteta: valoriPortie(r, indexNutritie), portii });
  const noua = { ...zi, mese: [...zi.mese, intrare] };
  try {
    await salveazaZiNutritie(noua);
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Rețeta nu a putut fi adăugată.'), 'eroare');
    return;
  }
  if (data === dataZiNutritie) ziNutritie = noua;
  notifica(`${r.nume} adăugată la ${numeMasa(masa).toLowerCase()} (${titluZi(data).toLowerCase() === 'azi' ? 'azi' : afiseazaData(data)}).`, 'succes', 4000,
    filaNutritie !== 'zi' ? { text: 'Vezi ziua', onclick: () => { dataZiNutritie = data; arataFilaNutritie('zi'); } } : null);
  if (filaNutritie === 'zi' && typeof ecranCurent !== 'undefined' && ecranCurent === 'ecran-nutritie') randeazaZiNutritie();
}

// ---------- Țintele ----------
async function deschideTinteNutritie() {
  const t = setari.tinteNutritie || {};
  let masuratori = [];
  try { masuratori = await toateMasuratorile(); } catch (err) { console.warn(err); }
  const tend = tendintaGreutate(masuratori.filter(m => m.tip === 'Greutate'));
  const kg = tend ? Math.round(tend.media7 * 10) / 10 : null;

  const campuri = {};
  const camp = (id, eticheta, valoare, limite) => {
    const input = el('input', { type: 'number', inputmode: 'numeric', step: '1', min: String(limite[0]), max: String(limite[1]),
      value: valoare != null ? String(valoare) : '', placeholder: id === 'kcal' ? 'obligatoriu' : 'opțional' });
    campuri[id] = input;
    return el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: eticheta }), input]);
  };
  let estimat = Boolean(t.estimat);
  let ultimaEstimare = null;
  const valoriManuale = el('div', { class: 'grila-2' }, [
    camp('kcal', 'Calorii (kcal)', t.kcal, LIMITE_TINTE.kcal),
    camp('proteine', 'Proteine (g)', t.proteine, LIMITE_TINTE.proteine),
    camp('carbohidrati', 'Carbohidrați (g)', t.carbohidrati, LIMITE_TINTE.carbohidrati),
    camp('grasimi', 'Grăsimi (g)', t.grasimi, LIMITE_TINTE.grasimi),
    camp('fibre', 'Fibre (g)', t.fibre, LIMITE_TINTE.fibre),
  ]);
  for (const input of Object.values(campuri)) input.addEventListener('input', () => { estimat = false; });

  // Profilul pentru estimare: greutatea vine din Corp; înălțimea din Corp (se poate scrie și aici).
  const anInput = el('input', { type: 'number', inputmode: 'numeric', step: '1', min: '1900', max: String(new Date().getFullYear() - 15),
    value: setari.anNastere ? String(setari.anNastere) : '', placeholder: 'ex. 1990' });
  const inaltimeInput = el('input', { type: 'number', inputmode: 'decimal', step: '0.5', min: '120', max: '250',
    value: setari.inaltimeCm ? String(setari.inaltimeCm) : '', placeholder: 'ex. 178' });
  let sex = setari.sex, activitate = setari.activitate || 'moderat', scop = setari.scopNutritie || 'mentinere';
  const chipuriSex = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Sex' });
  const chipuriScop = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Obiectiv' });
  const selectActivitate = el('select', { 'aria-label': 'Nivel de activitate' },
    NIVELURI_ACTIVITATE.map(a => el('option', { value: a.id, text: `${a.nume} — ${a.detaliu}`, selected: a.id === activitate })));
  selectActivitate.addEventListener('change', () => { activitate = selectActivitate.value; });
  const deseneazaChipuri = () => {
    chipuriSex.replaceChildren(...[['m', 'Bărbat'], ['f', 'Femeie']].map(([id, n]) => el('button', { type: 'button',
      class: 'chip chip-mic' + (sex === id ? ' activ' : ''), 'aria-pressed': String(sex === id), text: n, onclick: () => { sex = id; deseneazaChipuri(); } })));
    chipuriScop.replaceChildren(...SCOPURI_NUTRITIE.map(s => el('button', { type: 'button',
      class: 'chip chip-mic' + (scop === s.id ? ' activ' : ''), 'aria-pressed': String(scop === s.id), text: s.nume, onclick: () => { scop = s.id; deseneazaChipuri(); } })));
  };
  deseneazaChipuri();
  const rezultat = el('p', { class: 'nota' });

  const calculeaza = () => {
    const an = parseInt(anInput.value, 10);
    const h = parseFloat(String(inaltimeInput.value).replace(',', '.'));
    const varsta = varstaDinAn(an);
    if (!kg) { rezultat.textContent = 'Notează-ți greutatea în ecranul Corp ca să poți estima.'; return; }
    const e = estimeazaTinte({ kg, inaltimeCm: h, varsta, sex, activitate, scop });
    if (!e) { rezultat.textContent = 'Completează anul nașterii (vârsta 15–100), înălțimea (120–250 cm) și sexul.'; return; }
    for (const c of ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre']) campuri[c].value = String(e[c]);
    estimat = true;
    ultimaEstimare = { an, h };
    const dt = e.detalii;
    rezultat.textContent = `Metabolism bazal ≈ ${fmtNr(dt.bmr)} kcal (Mifflin-St Jeor), necesar ≈ ${fmtNr(dt.necesar)} kcal (× ${String(dt.factor).replace('.', ',')})` +
      `${dt.ajustare ? `, ${dt.ajustare > 0 ? '+' : '−'}${Math.abs(dt.ajustare * 100)}% pentru obiectiv` : ''}. ` +
      `Proteine ${String(dt.proteinePeKg).replace('.', ',')} g/kg, grăsimi 25% din calorii, fibre 14 g la 1000 kcal, restul carbohidrați.` +
      (dt.limitat ? ' Caloriile au fost ridicate la minimul sigur pentru o estimare generală.' : '') +
      ' Verifică valorile și ajustează-le dacă vrei.';
  };

  const d = deschideDialog({
    titlu: 'Țintele zilnice',
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: 'Scrie-ți țintele sau estimează-le mai jos. Doar caloriile sunt obligatorii.' }),
      valoriManuale,
      el('details', { class: 'estimare-tinte', open: !setari.tinteNutritie }, [
        el('summary', { text: 'Estimează din profil' }),
        el('p', { class: 'nota', text: kg ? `Greutatea din Corp: ${formatNumar(kg)} kg (media pe 7 zile).` : 'Nu ai nicio cântărire în Corp. Notează-ți greutatea acolo ca să poți estima.' }),
        el('div', { class: 'grila-2' }, [
          el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Anul nașterii' }), anInput]),
          el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Înălțime (cm)' }), inaltimeInput]),
        ]),
        el('span', { class: 'camp-eticheta', text: 'Sex' }), chipuriSex,
        el('label', { class: 'camp mt' }, [el('span', { class: 'camp-eticheta', text: 'Nivel de activitate' }), selectActivitate]),
        el('span', { class: 'camp-eticheta', text: 'Obiectiv' }), chipuriScop,
        buton({ text: 'Calculează estimarea', tip: 'secundar', lat: true, clasa: 'mt', onclick: calculeaza }),
        rezultat,
        el('p', { class: 'nota nota-mica', text: 'Estimarea e orientativă, pentru adulți sănătoși. Nu e o recomandare medicală; pentru o afecțiune, sarcină sau o dietă strictă întreabă un medic sau un nutriționist.' }),
      ]),
    ]),
    butoane: [
      setari.tinteNutritie ? buton({ text: 'Șterge', tip: 'fantoma', onclick: () => d.inchide(() => {
        setari.tinteNutritie = null; salveazaSetari(); randeazaZiNutritie(); notifica('Țintele au fost șterse.', 'info');
      }) }) : buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: () => {
        const brut = {};
        for (const [c, input] of Object.entries(campuri)) {
          const s = String(input.value).trim();
          if (s === '') continue;
          const v = Number(s.replace(',', '.'));
          const [min, max] = LIMITE_TINTE[c];
          if (!(v >= min && v <= max)) { notifica(`Valoarea pentru ${input.closest('label').textContent.trim()} trebuie să fie între ${min} și ${max}.`, 'eroare'); input.focus(); return; }
          brut[c] = v;
        }
        if (!('kcal' in brut)) { notifica('Scrie cel puțin ținta de calorii.', 'eroare'); campuri.kcal.focus(); return; }
        setari.tinteNutritie = curataTinte({ ...brut, estimat });
        // Profilul pentru estimare se păstrează (anul nașterii, sexul, activitatea, obiectivul); înălțimea se salvează și pentru Corp.
        const an = parseInt(anInput.value, 10);
        if (Number.isInteger(an) && an >= 1900 && an <= new Date().getFullYear() - 10) setari.anNastere = an;
        if (sex) setari.sex = sex;
        setari.activitate = activitate;
        setari.scopNutritie = scop;
        const h = parseFloat(String(inaltimeInput.value).replace(',', '.'));
        if (h >= 120 && h <= 250 && ultimaEstimare) setari.inaltimeCm = h;
        salveazaSetari();
        d.inchide();
        randeazaZiNutritie();
        if (typeof afiseazaProfil === 'function') afiseazaProfil();
        notifica('Ținte salvate.', 'succes');
      } }),
    ],
  });
}
