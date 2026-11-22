// Progres → fila „Nutriție” (etapa 9): analiza și istoricul meselor. Calculele sunt în nutritie-analiza.js.

const analizaStare = { perioada: '30', nutrient: 'kcal', de: '', pana: '' };
try {
  const s = JSON.parse(localStorage.getItem('nutritie-analiza') || '{}');
  if (PERIOADE_NUTRITIE.some(p => p.cheie === s.perioada)) analizaStare.perioada = s.perioada;
  if (['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre'].includes(s.nutrient)) analizaStare.nutrient = s.nutrient;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.de || '')) analizaStare.de = s.de;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.pana || '')) analizaStare.pana = s.pana;
} catch { /* fără preferințe salvate */ }
function salveazaAnalizaStare() {
  try { localStorage.setItem('nutritie-analiza', JSON.stringify(analizaStare)); } catch { /* nu e grav */ }
}

const NUTRIENTI_ANALIZA = [
  { id: 'kcal', nume: 'Calorii', u: ' kcal' }, { id: 'proteine', nume: 'Proteine', u: ' g' }, { id: 'carbohidrati', nume: 'Carbo', u: ' g' },
  { id: 'grasimi', nume: 'Grăsimi', u: ' g' }, { id: 'fibre', nume: 'Fibre', u: ' g' },
];
const fmtProc = v => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
const dataScurtaAnaliza = d => { const [, l, z] = d.split('-'); return `${Number(z)}.${l}`; };
const NUME_LUNI_AN = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

async function randeazaAnalizaNutritie() {
  const cont = $('nutritie-analiza');
  if (!cont.childElementCount) cont.replaceChildren(stareIncarcare(3));
  let zile;
  try {
    zile = await toateZileleNutritie();
  } catch (err) {
    console.error(err);
    cont.replaceChildren(stareGoala({ icon: 'avertizare', titlu: 'Datele nu au putut fi citite', text: 'Reîncarcă aplicația. Dacă problema persistă, restaurează un backup din Setări.' }));
    return;
  }
  const azi = dataLocala();
  const iv = intervalNutritie(analizaStare.perioada, azi, { de: analizaStare.de, pana: analizaStare.pana });
  const tinte = setari.tinteNutritie;
  const a = analizaNutritie(zile, { ...iv, tinte });

  const perioade = el('div', { class: 'chipuri chipuri-defilare perioade', role: 'group', 'aria-label': 'Perioada analizată' },
    PERIOADE_NUTRITIE.map(p => el('button', { type: 'button', class: 'chip' + (p.cheie === analizaStare.perioada ? ' activ' : ''), text: p.nume,
      'aria-pressed': String(p.cheie === analizaStare.perioada), onclick: () => {
        analizaStare.perioada = p.cheie;
        if (p.cheie === 'personalizat' && !analizaStare.de) { analizaStare.de = dataPlusZile(azi, -13); analizaStare.pana = azi; }
        salveazaAnalizaStare(); randeazaAnalizaNutritie();
      } })));
  const copii = [perioade];
  if (analizaStare.perioada === 'personalizat') {
    const inDe = el('input', { type: 'date', value: iv.de, max: azi, 'aria-label': 'De la' });
    const inPana = el('input', { type: 'date', value: iv.pana, max: azi, 'aria-label': 'Până la' });
    const aplica = () => { if (inDe.value && inPana.value) { analizaStare.de = inDe.value; analizaStare.pana = inPana.value; salveazaAnalizaStare(); randeazaAnalizaNutritie(); } };
    inDe.addEventListener('change', aplica);
    inPana.addEventListener('change', aplica);
    copii.push(el('div', { class: 'card' }, [el('div', { class: 'grila-2' }, [
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'De la' }), inDe]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Până la' }), inPana]),
    ])]));
  }

  if (!a.zileCuMancare && !a.zileCuPlan) {
    const fara = !zile.some(z => z.mese.length);
    copii.push(el('div', { class: 'card' }, [stareGoala({ icon: 'nutritie',
      titlu: fara ? 'Încă nu ai notat mese' : 'Nimic în această perioadă',
      text: fara ? 'Planifică și bifează mesele în Nutriție → Ziua mea; aici vei vedea caloriile, macronutrienții și cât de des îți atingi țintele.'
        : `Între ${afiseazaData(iv.de)} și ${afiseazaData(iv.pana)} nu există mese planificate sau notate. Alege altă perioadă.`,
      actiune: buton({ text: 'Deschide Nutriție', icon: 'nutritie', tip: 'secundar', onclick: deschideZiuaNutritie }) })]));
    $('nutritie-analiza').replaceChildren(...copii);
    return;
  }

  copii.push(cardRezumatAnaliza(a, tinte), cardZilnicAnaliza(a, tinte), cardMacroAnaliza(a, tinte), cardSaptamaniAnaliza(a, tinte),
    cardObiectiveAnaliza(a, tinte), cardConsecventaAnaliza(a));
  copii.push(el('p', { class: 'nota nota-sursa', text: 'Fiecare masă păstrează valorile din momentul în care a fost adăugată, așa că istoricul nu se schimbă dacă editezi sau ștergi rețeta. Mediile de „mâncat” se fac pe zilele în care ai notat ceva. Estimări, nu recomandări medicale.' }));
  const vizibile = copii.filter(Boolean);
  $('nutritie-analiza').replaceChildren(...vizibile);
  for (const c of vizibile) if (c.deseneaza) c.deseneaza();
}

function cardRezumatAnaliza(a, tinte) {
  const m = a.medieMancat;
  return el('div', { class: 'card' }, [
    titluCard('Rezumat', el('span', { class: 'nota', text: `${afiseazaData(a.de)} – ${afiseazaData(a.pana)}` })),
    el('div', { class: 'placute' }, [
      placuta('Mâncat pe zi', a.zileCuMancare ? `${fmtNr(m.kcal)} kcal` : '—', tinte ? `țintă ${fmtNr(tinte.kcal)}` : 'medie'),
      placuta('Proteine pe zi', a.zileCuMancare ? `${fmtNr(m.proteine)} g` : '—', tinte && tinte.proteine ? `țintă ${tinte.proteine} g` : 'medie'),
      placuta('Zile notate', `${a.zileCuMancare} / ${a.zileInterval}`, a.zileCuPlan ? `${a.zileCuPlan} cu plan` : 'fără plan'),
      placuta('Zile în țintă', a.obiective && a.obiective.zile ? fmtProc(a.obiective.procentKcal) : '—', a.obiective ? 'calorii ±10%' : 'setează ținte'),
    ]),
    a.zileCuMancare ? null : el('p', { class: 'nota', text: 'Ai mese planificate, dar niciuna bifată ca mâncată în perioada asta. Bifează-le (Acasă sau Nutriție) ca să apară aici ce ai mâncat.' }),
  ]);
}

function cardZilnicAnaliza(a, tinte) {
  const n = NUTRIENTI_ANALIZA.find(x => x.id === analizaStare.nutrient) || NUTRIENTI_ANALIZA[0];
  const canvas = el('canvas', { class: 'grafic', 'aria-label': `${n.nume} pe zi: mâncat (bare) și planificat (în spate)` });
  const alegeri = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Ce arată graficul' },
    NUTRIENTI_ANALIZA.map(x => el('button', { type: 'button', class: 'chip chip-mic' + (x.id === n.id ? ' activ' : ''), 'aria-pressed': String(x.id === n.id),
      text: x.nume, onclick: () => { analizaStare.nutrient = x.id; salveazaAnalizaStare(); randeazaAnalizaNutritie(); } })));
  const pv = a.planVsMancat;
  const card = el('div', { class: 'card' }, [
    titluCard('Pe zile'),
    alegeri,
    canvas,
    el('p', { class: 'nota nota-mica zi-legenda' }, [el('i', { class: 'zi-leg-mancat' }), ' mâncat  ', el('i', { class: 'zi-leg-plan' }), ' planificat',
      tinte && tinte[n.id] ? '  · linia: ținta' : '']),
    pv.zile ? el('p', { class: 'nota', text: `Planificat vs mâncat: în ${plural(pv.zile, 'ziua', 'zilele')} cu plan și notări ai mâncat ${fmtProc(pv.raport)} din caloriile planificate (${fmtNr(pv.mancat)} din ${fmtNr(pv.planificat)} kcal).` }) : null,
  ]);
  card.deseneaza = () => deseneazaBare(canvas, a.pe.map(z => ({
    eticheta: dataScurtaAnaliza(z.data), valoare: z.mancat[n.id], umbra: z.planificat[n.id], evidentiata: z.data === dataLocala(),
    detaliu: `${dataScurtaAnaliza(z.data)} · plan ${fmtNr(z.planificat[n.id])}${n.u}`,
  })), v => `${fmtNr(v)}${n.u}`, { inaltime: 190, referinta: tinte && tinte[n.id] ? { valoare: tinte[n.id], eticheta: 'țintă' } : null, gol: 'Nimic notat în această perioadă' });
  return card;
}

function cardMacroAnaliza(a, tinte) {
  const d = a.distributie;
  const m = a.medieMancat, p = a.mediePlanificat;
  const rand = (nume, camp, clasa) => {
    const t = tinte && tinte[camp];
    return el('div', { class: 'zi-macro' }, [
      el('span', { class: 'nutri-nume' }, [el('i', { class: `nutri-punct ${clasa}` }), nume]),
      el('span', { class: 'zi-macro-valori' }, [el('b', { text: fmtNr(m[camp]) }), t ? ` / ${fmtNr(t)} g` : ' g', el('span', { class: 'nota', text: ` · plan ${fmtNr(p[camp])} g` })]),
      baraDubla(m[camp], p[camp], t, clasa),
    ]);
  };
  return el('div', { class: 'card' }, [
    titluCard('Macronutrienți', el('span', { class: 'nota', text: 'media pe zi' })),
    a.zileCuMancare ? el('div', { class: 'distributie-macro', role: 'img',
      'aria-label': `Energia din mâncare: proteine ${fmtProc(d.proteine)}, carbohidrați ${fmtProc(d.carbohidrati)}, grăsimi ${fmtProc(d.grasimi)}` }, [
      el('i', { class: 'nutri-p', style: `width:${d.proteine * 100}%` }),
      el('i', { class: 'nutri-c', style: `width:${d.carbohidrati * 100}%` }),
      el('i', { class: 'nutri-g', style: `width:${d.grasimi * 100}%` }),
    ]) : null,
    a.zileCuMancare ? el('p', { class: 'nota nota-mica', text: `Energia din ce ai mâncat: proteine ${fmtProc(d.proteine)} · carbohidrați ${fmtProc(d.carbohidrati)} · grăsimi ${fmtProc(d.grasimi)}` }) : null,
    el('div', { class: 'zi-macrouri' }, [rand('Proteine', 'proteine', 'nutri-p'), rand('Carbohidrați', 'carbohidrati', 'nutri-c'), rand('Grăsimi', 'grasimi', 'nutri-g'), rand('Fibre', 'fibre', 'nutri-f')]),
  ]);
}

function cardSaptamaniAnaliza(a, tinte) {
  const canvas = el('canvas', { class: 'grafic grafic-mic', 'aria-label': 'Media caloriilor mâncate pe zi, pe săptămâni' });
  const luni = a.luni.filter(l => l.zileNotate || l.mediePlanificat.kcal);
  const card = el('div', { class: 'card' }, [
    titluCard('Medii pe săptămână', el('span', { class: 'nota', text: 'kcal mâncate pe zi' })),
    canvas,
    luni.length ? el('p', { class: 'sectiune-eticheta mt', text: 'Medii pe lună' }) : null,
    luni.length ? el('div', { class: 'lista-luni' }, luni.map(l => {
      const [an, luna] = l.cheie.split('-').map(Number);
      return el('div', { class: 'rand-luna' }, [
        el('span', { text: `${NUME_LUNI_AN[luna - 1]} ${an}` }),
        el('strong', { text: l.zileNotate ? `${fmtNr(l.medieMancat.kcal)} kcal` : '—' }),
        el('span', { class: 'nota', text: l.zileNotate ? `P ${fmtNr(l.medieMancat.proteine)} g · ${plural(l.zileNotate, 'zi notată', 'zile notate')}` : 'nicio zi notată' }),
      ]);
    })) : null,
  ]);
  card.deseneaza = () => deseneazaBare(canvas, a.saptamani.map(s => ({
    eticheta: dataScurtaAnaliza(s.cheie), valoare: s.medieMancat.kcal, umbra: s.mediePlanificat.kcal,
    detaliu: `săpt. ${dataScurtaAnaliza(s.de)}–${dataScurtaAnaliza(s.pana)} · ${plural(s.zileNotate, 'zi notată', 'zile notate')}`,
  })), v => `${fmtNr(v)} kcal`, { inaltime: 150, referinta: tinte ? { valoare: tinte.kcal, eticheta: 'țintă' } : null, gol: 'Nimic notat' });
  return card;
}

function cardObiectiveAnaliza(a, tinte) {
  if (!tinte) {
    return el('div', { class: 'card' }, [titluCard('Obiective'), el('p', { class: 'nota', text: 'Setează-ți țintele în Nutriție → Ziua mea ca să vezi cât de des le atingi.' })]);
  }
  const o = a.obiective;
  const canvas = el('canvas', { class: 'grafic grafic-mic', 'aria-label': 'Procentul zilelor notate în ținta de calorii, pe săptămâni' });
  const card = el('div', { class: 'card' }, [
    titluCard('Obiective', el('span', { class: 'nota', text: `din ${plural(o.zile, 'zi notată', 'zile notate')}` })),
    el('div', { class: 'placute' }, [
      placuta('Calorii în țintă', fmtProc(o.procentKcal), `${o.kcalInTinta} zile (±10%)`),
      placuta('Sub țintă', String(o.kcalSub), 'zile'),
      placuta('Peste țintă', String(o.kcalPeste), 'zile'),
      o.proteineAtinse !== null ? placuta('Proteine atinse', fmtProc(o.procentProteine), `${o.proteineAtinse} zile`) : null,
    ].filter(Boolean)),
    el('p', { class: 'sectiune-eticheta mt', text: 'Zile în ținta de calorii, pe săptămâni' }),
    canvas,
  ]);
  card.deseneaza = () => deseneazaBare(canvas, a.saptamani.map(s => ({
    eticheta: dataScurtaAnaliza(s.cheie), valoare: s.zileNotate ? Math.round(s.zileInTinta / s.zileNotate * 100) : 0,
    detaliu: s.zileNotate ? `${s.zileInTinta} din ${s.zileNotate} zile` : 'nicio zi notată',
  })), v => `${Math.round(v)}%`, { inaltime: 130, gol: 'Nicio zi notată' });
  return card;
}

function cardConsecventaAnaliza(a) {
  const c = a.consecventa;
  return el('div', { class: 'card' }, [
    titluCard('Consecvență'),
    el('div', { class: 'placute' }, [
      placuta('Zile notate', fmtProc(c.zileNotate / c.zileInterval), `${c.zileNotate} din ${c.zileInterval}`),
      placuta('Mese mâncate', fmtProc(c.procentMese), c.intrariPlan ? `${c.intrariTerminate} din ${c.intrariPlan} planificate` : 'fără plan'),
      placuta('Serie actuală', plural(c.serie, 'zi', 'zile'), 'zile la rând cu notări'),
      placuta('Cea mai lungă', plural(c.serieMax, 'zi', 'zile'), 'în perioadă'),
    ]),
  ]);
}
