// Necesarul caloric adaptiv (etapa 7) — interfața: cardul „Verificarea săptămânii” de pe Acasă (Nutriție),
// „Cum s-a calculat?”, aplicarea țintelor (cu istoric), graficele din Analiză și g/kg lângă grame.
// Calculele sunt în necesar-adaptiv.js. Țintele NU se schimbă niciodată fără „Aplică”.

const AVERTISMENT_NECESAR = 'Estimările sunt orientative, nu recomandări medicale. Creatina, sarea, carbohidrații sau ciclurile de antrenament pot muta greutatea pe termen scurt (apă), fără legătură cu caloriile.';

// Greutatea de referință pentru g/kg și pentru ținte: tendința de acum (sau ultima cântărire). Se actualizează la randare.
let kgReferintaNutritie = null;
async function actualizeazaKgReferinta() {
  try {
    const m = await toateMasuratorile();
    const s = serieGreutate(m, dataLocala());
    const ult = s.zile[s.zile.length - 1];
    kgReferintaNutritie = ult ? Math.round(ult.tendinta * 10) / 10 : null;
  } catch (err) { console.warn(err); }
  return kgReferintaNutritie;
}

// „495 g · 7,0 g/kg” (fără greutate cunoscută: doar gramele)
function textGPeKg(g, kg = kgReferintaNutritie) {
  if (!(kg > 0) || typeof g !== 'number') return '';
  return `${(Math.round(g / kg * 10) / 10).toFixed(1).replace('.', ',')} g/kg`;
}

function setareNecesar() { return curataNecesarAdaptiv(setari.necesarAdaptiv); }
function ritmSetat(s, scop) { return scop === 'masa' ? s.ritmMasa : scop === 'slabire' ? s.ritmSlabire : 0; }

// Tot ce trebuie cardului și analizei: istoricul săptămânal, estimarea de acum, ținta propusă.
async function stareNecesarAdaptiv(azi = dataLocala()) {
  const [zile, masuratori] = await Promise.all([toateZileleNutritie(), toateMasuratorile()]);
  const s = setareNecesar();
  const p = profilDinSetari(setari);
  const scop = setari.scopNutritie || 'mentinere';
  const serie = serieGreutate(masuratori, azi);
  const ult = serie.zile[serie.zile.length - 1];
  const kg = ult ? Math.round(ult.tendinta * 10) / 10 : null;
  const varsta = p.anNastere ? varstaDinAn(p.anNastere) : null;
  const formula = kg ? estimeazaTinte({ kg, inaltimeCm: p.inaltimeCm, varsta, sex: p.sex, activitate: p.activitate || 'moderat', scop, proteinePeKg: s.proteinePeKg }) : null;
  const tintaKcal = setari.tinteNutritie ? setari.tinteNutritie.kcal : 0;
  const istoric = istoricNecesar({ zileNutritie: zile, masuratori, azi, ziVerificare: s.ziVerificare, tintaKcal,
    necesarFormula: formula ? formula.detalii.necesar : null });
  const curent = istoric[istoric.length - 1] || null;
  const okuri = istoric.filter(x => x.stare === 'ok');
  const anterior = curent && curent.stare === 'ok' ? okuri[okuri.length - 2] || null : okuri[okuri.length - 1] || null;
  const tinta = curent && curent.stare === 'ok' && kg
    ? tintaDinNecesar({ necesar: curent.afisat, kg, scop, ritmProcent: ritmSetat(s, scop), sex: p.sex, proteinePeKg: s.proteinePeKg })
    : null;
  return { zile, masuratori, serie, kg, scop, istoric, curent, anterior, tinta, setare: s, azi };
}

// ---------- Cardul de pe Acasă ----------

function cardVerificareNecesar(dataVerificare) {
  const card = el('div', { class: 'card card-necesar' }, [el('h2', { text: 'Verificarea săptămânii' }), stareIncarcare(1)]);
  card.deseneaza = async () => {
    let st;
    try { st = await stareNecesarAdaptiv(); } catch (err) { console.error(err); card.remove(); return; }
    card.replaceChildren(...continutVerificare(st, dataVerificare, card));
  };
  return card;
}

function raspundeVerificarii(data) {
  setari.necesarAdaptiv = { ...setareNecesar(), raspunsLa: data };
  salveazaSetari();
}

function randTintaPropusa(nume, camp, propusa, actuala, kg, unitate = 'g') {
  const dif = actuala && typeof actuala[camp] === 'number' ? propusa[camp] - actuala[camp] : null;
  return el('div', { class: 'necesar-rand' }, [
    el('span', { text: nume }),
    el('b', { text: `${fmtNr(propusa[camp])} ${unitate}` }),
    el('span', { class: 'nota', text: [unitate === 'g' ? textGPeKg(propusa[camp], kg) : '', dif ? `${dif > 0 ? '+' : '−'}${fmtNr(Math.abs(dif))}` : (dif === 0 ? 'la fel' : '')].filter(Boolean).join(' · ') }),
  ]);
}

function continutVerificare(st, data, card) {
  const titlu = el('h2', { text: 'Verificarea săptămânii' });
  const c = st.curent;
  if (!c || c.stare !== 'ok') {
    const lipsa = [];
    if (c && c.lipsaZile) lipsa.push(plural(c.lipsaZile, 'zi notată complet', 'zile notate complet'));
    if (c && c.lipsaCantariri) lipsa.push(plural(c.lipsaCantariri, 'cântărire', 'cântăriri'));
    const text = lipsa.length ? `Mai trebuie ${lipsa.join(' și ')} în ultimele 4 săptămâni ca să-ți calculez necesarul real.`
      : 'Cântăririle trebuie să acopere cel puțin o săptămână ca să-ți calculez necesarul real.';
    const zv = c ? c.zileValide : 0, cv = c ? c.cantariri : 0;
    return [titlu,
      el('p', { text }),
      el('div', { class: 'necesar-progres' }, [
        el('span', { text: `Zile notate: ${zv} din ${NECESAR.MIN_ZILE}` }), el('span', { class: 'bara-fundal' }, [el('span', { class: 'bara in-zona', style: `width:${Math.min(100, zv / NECESAR.MIN_ZILE * 100)}%` })]),
        el('span', { text: `Cântăriri: ${cv} din ${NECESAR.MIN_CANTARIRI}` }), el('span', { class: 'bara-fundal' }, [el('span', { class: 'bara in-zona', style: `width:${Math.min(100, cv / NECESAR.MIN_CANTARIRI * 100)}%` })]),
      ]),
      el('p', { class: 'nota nota-mica', text: 'Contează doar ce bifezi ca mâncat. O zi pe care n-ai notat-o toată o poți marca în Ziua mea: „Ziua nu e notată complet”.' }),
      el('div', { class: 'rand-butoane' }, [buton({ text: 'Bine', tip: 'secundar', mic: true, onclick: () => { raspundeVerificarii(data); card.remove(); } })]),
    ];
  }
  const actuale = setari.tinteNutritie;
  const t = st.tinta;
  const anterior = st.anterior;
  const difNec = anterior ? c.afisat - anterior.afisat : null;
  const copii = [titlu,
    el('div', { class: 'necesar-cifra' }, [
      el('strong', { text: `${fmtNr(c.afisat)} kcal` }),
      el('span', { text: anterior ? `necesarul estimat · săpt. trecută ${fmtNr(anterior.afisat)}${difNec ? ` (${difNec > 0 ? '+' : '−'}${fmtNr(Math.abs(difNec))})` : ''}` : 'necesarul estimat' }),
    ]),
    el('p', { class: 'nota', text: `Ai mâncat în medie ${fmtNr(Math.round(c.mediaKcal))} kcal pe zi (${plural(c.zileValide, 'zi notată', 'zile notate')}). ${textRitm(c.kgPeSapt, t ? t.ritmKgSapt : null)}` }),
  ];
  if (c.avertizari.length) copii.push(el('p', { class: 'nota necesar-avertizare', text: c.avertizari.includes('aberante')
    ? `Am ignorat ${plural(c.aberante.length, 'cântărire care sare', 'cântăriri care sar')} față de zilele vecine. Verifică-le în Corp.`
    : 'Datele au dat un rezultat neobișnuit și l-am plafonat. Verifică cântăririle și zilele notate.' }));
  if (t) {
    copii.push(el('p', { class: 'sectiune-eticheta', text: `Ținta propusă (${(SCOPURI_NUTRITIE.find(s => s.id === st.scop) || {}).nume.toLowerCase()})` }),
      el('div', { class: 'necesar-tinte' }, [
        randTintaPropusa('Calorii', 'kcal', t, actuale, st.kg, 'kcal'),
        randTintaPropusa('Proteine', 'proteine', t, actuale, st.kg),
        randTintaPropusa('Carbohidrați', 'carbohidrati', t, actuale, st.kg),
        randTintaPropusa('Grăsimi', 'grasimi', t, actuale, st.kg),
      ]));
  }
  const aceleasi = t && actuale && ['kcal', 'proteine', 'carbohidrati', 'grasimi'].every(k => actuale[k] === t[k]);
  copii.push(el('div', { class: 'rand-butoane rand-flexibil' }, [
    t && !aceleasi ? buton({ text: 'Aplică', tip: 'principal', onclick: () => aplicaTintaPropusa(st, data, card) }) : null,
    buton({ text: aceleasi ? 'Bine' : 'Păstrez țintele actuale', tip: 'secundar', onclick: () => { raspundeVerificarii(data); card.remove(); notifica('Țintele rămân cum erau.', 'info'); } }),
  ].filter(Boolean)));
  copii.push(el('button', { type: 'button', class: 'link-discret', text: 'Cum s-a calculat?', onclick: () => deschideExplicatieNecesar(st) }));
  copii.push(el('p', { class: 'nota nota-mica', text: AVERTISMENT_NECESAR }));
  return copii;
}

function aplicaTintaPropusa(st, data, card) {
  const vechi = setari.tinteNutritie ? { ...setari.tinteNutritie } : null;
  const t = st.tinta;
  const noi = curataTinte({ kcal: t.kcal, proteine: t.proteine, carbohidrati: t.carbohidrati, grasimi: t.grasimi, fibre: t.fibre, estimat: true });
  if (!noi) { notifica('Ținta propusă nu e validă.', 'eroare'); return; }
  const istoricVechi = setari.istoricTinte;
  setari.tinteNutritie = noi;
  setari.istoricTinte = adaugaInIstoricTinte(setari.istoricTinte, { data: dataLocala(), vechi, noi, necesar: st.curent.afisat });
  raspundeVerificarii(data);
  if (card) card.remove();
  if (typeof dupaSalvareTinte === 'function') dupaSalvareTinte();
  notifica(`Țintă nouă: ${fmtNr(noi.kcal)} kcal.`, 'succes', 7000, { text: 'Anulează', onclick: () => {
    setari.tinteNutritie = vechi;
    setari.istoricTinte = istoricVechi;
    setari.necesarAdaptiv = { ...setareNecesar() };
    delete setari.necesarAdaptiv.raspunsLa;
    salveazaSetari();
    if (typeof dupaSalvareTinte === 'function') dupaSalvareTinte();
  } });
}

function deschideExplicatieNecesar(st) {
  const pasi = pasiCalcul(st.curent, st.tinta);
  const d = deschideDialog({
    titlu: 'Cum s-a calculat?',
    continut: el('div', { class: 'formular' }, [
      el('ol', { class: 'necesar-pasi' }, pasi.map(p => el('li', { text: p }))),
      el('p', { class: 'nota nota-mica', text: '7.700 kcal pe kg e o aproximare: energia dintr-un kg de grăsime corporală (cu apa ei). La creșterea în masă musculară sau când se schimbă apa din corp, raportul real diferă; de aceea rezultatul se combină cu formula și se mișcă încet.' }),
      el('p', { class: 'nota nota-mica', text: AVERTISMENT_NECESAR }),
    ]),
    butoane: [buton({ text: 'Închide', tip: 'principal', onclick: () => d.inchide() })],
  });
}

// ---------- Analiză: necesarul în timp, peste caloriile mâncate; tendința greutății peste cântăriri ----------

function cardNecesarAnaliza() {
  if (!setareNecesar().pornit) return null;
  const card = el('div', { class: 'card' }, [el('h2', { text: 'Necesarul adaptiv' }), stareIncarcare(1)]);
  card.deseneaza = async () => {
    let st;
    try { st = await stareNecesarAdaptiv(); } catch (err) { console.error(err); card.remove(); return; }
    const okuri = st.istoric.filter(x => x.stare === 'ok');
    const h = el('h2', { text: 'Necesarul adaptiv' });
    if (!okuri.length) {
      const c = st.curent;
      card.replaceChildren(h, el('p', { class: 'nota', text: `Încă nu am destule date: ${c ? `${c.zileValide} din ${NECESAR.MIN_ZILE} zile notate complet și ${c.cantariri} din ${NECESAR.MIN_CANTARIRI} cântăriri` : 'nicio zi notată'} în ultimele 4 săptămâni.` }));
      return;
    }
    const start = okuri[0].data < plusZileNecesar(st.azi, -84) ? plusZileNecesar(st.azi, -84) : plusZileNecesar(okuri[0].data, -28);
    const kcalZile = st.zile.filter(z => z.data >= start && z.data < st.azi && !z.incompleta)
      .map(z => ({ data: z.data, kcal: totaluriZi(z, st.azi).mancat.kcal })).filter(x => x.kcal > 0);
    const c1 = el('canvas', { class: 'grafic', 'aria-label': 'Necesarul estimat pe săptămâni și caloriile mâncate pe zile' });
    const c2 = el('canvas', { class: 'grafic', 'aria-label': 'Tendința greutății și cântăririle' });
    const serie = st.serie.zile.filter(z => z.data >= start);
    const ultim = st.curent && st.curent.stare === 'ok' ? st.curent : okuri[okuri.length - 1];
    card.replaceChildren(h,
      el('p', { class: 'nota', text: `Acum: ${fmtNr(ultim.afisat)} kcal pe zi. ${textRitm(ultim.kgPeSapt, st.tinta ? st.tinta.ritmKgSapt : null)}` }),
      el('p', { class: 'sectiune-eticheta', text: 'Necesar estimat (linia) și calorii mâncate (punctele)' }), c1,
      el('p', { class: 'sectiune-eticheta', text: 'Tendința greutății (linia) și cântăririle (punctele)' }), c2,
      el('button', { type: 'button', class: 'link-discret', text: 'Cum s-a calculat?', onclick: () => deschideExplicatieNecesar({ ...st, curent: ultim }) }),
      el('p', { class: 'nota nota-mica', text: AVERTISMENT_NECESAR }));
    deseneazaGrafic(c1, okuri.filter(x => x.data >= start).map(x => ({ x: timpDinData(x.data), y: x.afisat, data: x.data })), v => `${fmtNr(Math.round(v))} kcal`,
      { brute: kcalZile.map(x => ({ x: timpDinData(x.data), y: Math.round(x.kcal) })) });
    deseneazaGrafic(c2, serie.map(z => ({ x: timpDinData(z.data), y: Math.round(z.tendinta * 100) / 100, data: z.data })), v => `${formatNumar(v)} kg`,
      { brute: serie.filter(z => z.cantarit).map(z => ({ x: timpDinData(z.data), y: z.kg })) });
  };
  return card;
}

// ---------- Ziua mea: „Ziua nu e notată complet” ----------

function bifaZiIncompleta() {
  if (!setareNecesar().pornit || dataZiNutritie > dataLocala()) return null;
  const input = el('input', { type: 'checkbox', checked: Boolean(ziNutritie.incompleta), onchange: async () => {
    const zi = { ...ziNutritie, modificat: Date.now() };
    if (input.checked) zi.incompleta = true; else delete zi.incompleta;
    if (await salveazaZiua(zi)) notifica(input.checked ? 'Ziua nu intră în calculul necesarului.' : 'Ziua intră din nou în calculul necesarului.', 'info');
    else input.checked = !input.checked;
  } });
  // ca celelalte comutatoare din aplicație (stilul .comutator; o căsuță simplă ar lua stilul câmpurilor de text)
  return el('label', { class: 'rand comutator bifa-zi-incompleta' }, [
    el('span', {}, ['Ziua nu e notată complet', el('span', { class: 'nota nota-mica', text: ' — nu intră în necesarul adaptiv' })]), input]);
}
