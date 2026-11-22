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
  await reincarcaPlanurile();
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
  deseneazaGeneratorZi();
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

function listaIngredienteIntrare(i) {
  const r = retetaDupaId(i.idReteta);
  const ing = i.ingredientePortie || (r ? r.ingrediente.map(([id, g]) => [id, g / (r.portii || 1)]) : []);
  return ing.map(([id, g]) => {
    const a = indexNutritie.get(id);
    return el('li', {}, [el('span', { text: a ? a.nume : 'Aliment șters din bibliotecă' }), el('strong', { text: a ? textCantitate(a, g * i.portii) : fmtG(g * i.portii) })]);
  });
}

function randIntrare(i) {
  const vPlan = valoriPlanificateIntrare(i);
  const modificabila = intrareModificabila(i);
  const ingrediente = listaIngredienteIntrare(i);
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
        el('span', { class: 'zi-intrare-kcal' }, [el('b', { text: fmtNr(vPlan.kcal) }), ` kcal · ${fmtPortii(i.portii)}${i.timp ? ` · ${i.timp} min` : ''}`]),
        el('span', { class: 'nota', text: `P ${fmtNr(vPlan.proteine)} g · C ${fmtNr(vPlan.carbohidrati)} g · G ${fmtNr(vPlan.grasimi)} g${i.ajustat ? ' · cantități ajustate' : ''}` }),
        i.stare === 'partial' ? el('span', { class: 'zi-partial', text: textStareIntrare(i) }) : null,
      ]),
    ]),
    el('div', { class: 'zi-intrare-actiuni' }, [
      el('button', { type: 'button', class: 'btn btn-fantoma btn-icon btn-mic zi-lacat' + (i.blocat ? ' activ' : ''), 'aria-pressed': String(Boolean(i.blocat)),
        'aria-label': i.blocat ? `Deblochează ${i.nume}` : `Blochează ${i.nume} (nu se schimbă la generare)`, title: i.blocat ? 'Blocată' : 'Blochează',
        onclick: () => comutaBlocarea(i) }, [iconita(i.blocat ? 'lacat' : 'lacat-deschis')]),
      modificabila ? buton({ text: 'Înlocuiește', icon: 'schimba', tip: 'secundar', mic: true, eticheta: `Înlocuiește ${i.nume} cu o rețetă asemănătoare`, onclick: () => deschideInlocuire(i) }) : null,
      modificabila ? buton({ text: 'Altă rețetă', icon: 'zar', tip: 'fantoma', mic: true, eticheta: `Altă rețetă la întâmplare în locul ${i.nume}`, onclick: () => regenereazaMasa(i) }) : null,
      ingrediente.length ? el('details', { class: 'zi-ingrediente' }, [
        el('summary', { text: `Ingrediente (${ingrediente.length})` }),
        el('ul', { class: 'lista-ingrediente' }, ingrediente),
      ]) : null,
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

// ---------- Generatorul aleatoriu, planurile salvate (etapa 4) ----------
let planuriMele = [];
async function reincarcaPlanurile() {
  try { planuriMele = await toatePlanurileNutritie(); } catch (err) { console.warn(err); }
  planuriMele.sort((a, b) => (b.favorit - a.favorit) || (b.modificat || 0) - (a.modificat || 0));
}

let raportGenerare = null; // { data, raport } — ultimul raport al generatorului, pentru ziua afișată

function prefNutritie() { return setari.preferinteNutritie || preferinteGoale(); }

function textPreferinte() {
  const p = prefNutritie();
  const parti = [`Obiectiv: ${(SCOPURI_NUTRITIE.find(s => s.id === (setari.scopNutritie || 'mentinere')) || {}).nume.toLowerCase()}`];
  for (const d of p.dieta) parti.push(NUME_SCURT_ETICHETA[d]);
  if (p.alergii.length) parti.push(`alergii: ${p.alergii.map(a => numeAlergen(a).split(' (')[0].toLowerCase()).join(', ')}`);
  if (p.timpMaxim) parti.push(`≤ ${p.timpMaxim} min`);
  if (p.excluse.length) parti.push(`${plural(p.excluse.length, 'aliment exclus', 'alimente excluse')}`);
  if (p.stil.length) parti.push(`prefer: ${p.stil.map(s => NUME_SCURT_ETICHETA[s].toLowerCase()).join(', ')}`);
  if (p.preferate.length) parti.push(`${plural(p.preferate.length, 'aliment preferat', 'alimente preferate')}`);
  return parti.join(' · ');
}

function deseneazaGeneratorZi() {
  const nr = ziNutritie.mese.length;
  const pastrate = ziNutritie.mese.filter(i => !intrareModificabila(i)).length;
  const tinte = setari.tinteNutritie;
  const raport = raportGenerare && raportGenerare.data === dataZiNutritie ? raportGenerare.raport : null;
  $('zi-generator').replaceChildren(...[
    buton({ text: nr ? 'Generează din nou planul zilei' : 'Generează planul meu de mese', icon: 'zar', tip: 'principal', lat: true, clasa: 'btn-mare', onclick: genereazaZiua }),
    el('p', { class: 'nota nota-mica', text: tinte
      ? `Alege rețetele și porțiile pentru cele 5 mese ca totalul să se apropie de țintele tale (${fmtNr(tinte.kcal)} kcal${tinte.proteine ? `, ${tinte.proteine} g proteine` : ''}), fără repetări.${pastrate ? ` Mesele blocate sau începute (${pastrate}) rămân și intră în calcul.` : ' Blochează o masă cu lacătul ca să o păstrezi.'}`
      : 'Fără ținte, rețetele se aleg doar după preferințe (câte o porție). Setează-ți țintele ca planul să se potrivească cu caloriile și proteinele tale.' }),
    el('button', { type: 'button', class: 'preferinte-rezumat', onclick: deschidePreferinteGenerator }, [
      iconita('filtru'), el('span', { text: textPreferinte() }), el('b', { text: 'Preferințe' })]),
    raport ? deseneazaRaport(raport) : null,
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Salvează planul', icon: 'descarca', tip: 'secundar', mic: true, onclick: deschideSalvarePlan }),
      buton({ text: `Planuri${planuriMele.length ? ` (${planuriMele.length})` : ''}`, icon: 'lista', eticheta: `Planurile mele${planuriMele.length ? ` (${planuriMele.length})` : ''}`, tip: 'secundar', mic: true, onclick: deschidePlanurile }),
    ]),
  ].filter(Boolean));
}

function deseneazaRaport(raport) {
  const NUME_C = { kcal: 'Calorii', proteine: 'Proteine', carbohidrati: 'Carbo', grasimi: 'Grăsimi' };
  return el('div', { class: 'raport-generare' }, [
    raport.abateri.length ? el('div', { class: 'raport-abateri' }, raport.abateri.map(a => el('span', { class: 'raport-abatere' + (a.inTinta ? ' in-tinta' : '') }, [
      el('i', { text: a.inTinta ? '✓' : '!' }),
      `${NUME_C[a.camp]} ${fmtNr(a.valoare)}/${fmtNr(a.tinta)}${a.camp === 'kcal' ? '' : ' g'}`,
    ]))) : null,
    ...raport.mesaje.map(m => el('p', { class: `nota nota-mica raport-${m.tip}`, text: m.text })),
    raport.inTinta ? el('p', { class: 'nota nota-mica', text: 'Planul e în toleranța țintelor (calorii ±10%, proteine ±10 g, carbohidrați ±15 g, grăsimi ±10 g).' }) : null,
  ].filter(Boolean));
}

function optiuniGenerator() {
  // „Altă rețetă” respectă și ea filtrele stricte (alergii, ingrediente excluse, dietă, timp).
  const { candidate } = filtreazaReteteGen(toateRetetele(), indexNutritie, prefNutritie());
  const retete = Object.values(candidate).flat().map(x => x.r);
  return { retete, valoriPentru: r => valoriPortie(r, indexNutritie), preferate: new Set(setari.retetePreferate || []), idNou: idNutritieNou };
}

async function genereazaZiua() {
  const deInlocuit = ziNutritie.mese.filter(intrareModificabila);
  if (deInlocuit.length) {
    const da = await confirma({ titlu: 'Generezi alt plan?', ok: 'Generează',
      text: `${plural(deInlocuit.length, 'rețetă neîncepută și neblocată va fi înlocuită', 'rețete neîncepute și neblocate vor fi înlocuite')}. Mesele blocate sau începute rămân. Poți anula imediat după.` });
    if (!da) return;
  }
  const inainte = ziNutritie;
  const zile = [];
  for (const k of [1, 2]) { try { zile.push(await citesteZiNutritie(mutaData(dataZiNutritie, -k))); } catch (_) { /* fără istoric */ } }
  const rez = genereazaInteligent({ zi: ziNutritie, retete: toateRetetele(), idx: indexNutritie, tinte: setari.tinteNutritie,
    scop: setari.scopNutritie || 'mentinere', pref: prefNutritie(), recente: reteteRecente(zile, dataZiNutritie),
    preferateReteta: new Set(setari.retetePreferate || []), idNou: idNutritieNou });
  if (!(await salveazaZiua({ ...ziNutritie, mese: rez.mese }, 'Planul nu a putut fi salvat.'))) return;
  raportGenerare = { data: dataZiNutritie, raport: rez.raport };
  randeazaZiNutritie();
  const probleme = rez.raport.mesaje.filter(m => m.tip !== 'info').length;
  notifica(rez.lipsa.length ? 'Plan generat, dar unele mese au rămas goale. Vezi explicația de sub buton.'
    : probleme ? 'Plan generat. Nu toate țintele au putut fi atinse; vezi explicația de sub buton.' : 'Plan generat.',
  rez.lipsa.length ? 'eroare' : 'succes', 5000,
  { text: 'Anulează', onclick: async () => { raportGenerare = null; if (await salveazaZiua(inainte)) randeazaZiNutritie(); } });
}

async function regenereazaMasa(i) {
  const noua = regenereazaIntrare({ zi: ziNutritie, idIntrare: i.id, ...optiuniGenerator() });
  if (!noua) { notifica(`Nu mai există altă rețetă pentru ${numeMasa(i.masa).toLowerCase()} care să respecte preferințele stricte și să nu fie deja în ziua aceasta.`, 'eroare'); return; }
  const inainte = ziNutritie;
  if (!(await salveazaZiua(noua))) return;
  randeazaZiNutritie();
  notifica(`${i.nume} → ${noua.mese.find(x => x.masa === i.masa && !inainte.mese.some(y => y.id === x.id)).nume}`, 'info', 4000,
    { text: 'Anulează', onclick: async () => { if (await salveazaZiua(inainte)) randeazaZiNutritie(); } });
}

async function comutaBlocarea(i) {
  const noua = { ...i, modificat: Date.now() };
  if (i.blocat) delete noua.blocat; else noua.blocat = true;
  await inlocuiesteIntrarea(noua);
}

function deschideSalvarePlan() {
  if (!ziNutritie.mese.length) { notifica('Ziua nu are încă nicio rețetă. Generează sau adaugă mese, apoi salvează planul.', 'eroare'); return; }
  const input = el('input', { type: 'text', maxlength: '60', value: `Plan ${afiseazaData(dataZiNutritie)}`, 'aria-label': 'Numele planului' });
  const fav = el('input', { type: 'checkbox', role: 'switch' });
  const t = totaluriZi(ziNutritie).planificat;
  const d = deschideDialog({
    titlu: 'Salvează planul',
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: `${plural(ziNutritie.mese.length, 'rețetă', 'rețete')} · ${fmtNr(t.kcal)} kcal · P ${fmtNr(t.proteine)} g · C ${fmtNr(t.carbohidrati)} g · G ${fmtNr(t.grasimi)} g. Se salvează rețetele, porțiile și cantitățile ajustate, fără stări.` }),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Nume' }), input]),
      el('label', { class: 'rand aliniat comutator' }, [el('span', { text: 'Combinație favorită (apare prima)' }), fav]),
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        const nume = input.value.trim();
        if (!nume) { notifica('Scrie un nume pentru plan.', 'eroare'); input.focus(); return; }
        const plan = planDinZi(ziNutritie, { id: idNutritieNou(), nume, favorit: fav.checked });
        try { await salveazaPlanNutritie(plan); } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Planul nu a putut fi salvat.'), 'eroare'); return; }
        d.inchide();
        await reincarcaPlanurile();
        deseneazaGeneratorZi();
        notifica(`Plan salvat: ${nume}.`, 'succes');
      } }),
    ],
  });
}

async function deschidePlanurile() {
  await reincarcaPlanurile();
  const lista = el('div', { class: 'lista-planuri' });
  const deseneaza = () => {
    if (!planuriMele.length) {
      lista.replaceChildren(el('p', { class: 'nota', text: 'Nu ai încă planuri salvate. Generează sau compune o zi, apoi apasă „Salvează planul”.' }));
      return;
    }
    lista.replaceChildren(...planuriMele.map(p => {
      const t = totaluriZi({ mese: p.mese.map(m => ({ ...m, stare: 'neinceput' })) }).planificat;
      return el('article', { class: 'plan-salvat' }, [
        el('div', { class: 'plan-cap' }, [
          el('strong', { text: p.nume }),
          el('button', { type: 'button', class: 'btn btn-fantoma btn-icon btn-mic favorit' + (p.favorit ? ' activ' : ''), 'aria-pressed': String(p.favorit),
            'aria-label': p.favorit ? `Scoate ${p.nume} de la favorite` : `Marchează ${p.nume} ca favorit`, onclick: async () => {
              try { await salveazaPlanNutritie({ ...p, favorit: !p.favorit, modificat: Date.now() }); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut salva.'), 'eroare'); return; }
              await reincarcaPlanurile(); deseneaza();
            } }, [iconita('stea')]),
        ]),
        el('span', { class: 'nota', text: `${fmtNr(t.kcal)} kcal · P ${fmtNr(t.proteine)} g · C ${fmtNr(t.carbohidrati)} g · G ${fmtNr(t.grasimi)} g` }),
        el('ul', { class: 'plan-mese' }, p.mese.map(m => el('li', {}, [el('span', { class: 'nota', text: numeMasa(m.masa) }), el('span', { text: `${m.nume}${m.portii !== 1 ? ` × ${String(m.portii).replace('.', ',')}` : ''}` })]))),
        el('div', { class: 'rand-butoane' }, [
          buton({ text: 'Încarcă în zi', tip: 'principal', mic: true, onclick: () => d.inchide(() => incarcaPlanInZi(p)) }),
          buton({ icon: 'cos', tip: 'fantoma', mic: true, eticheta: `Șterge planul ${p.nume}`, onclick: async () => {
            let idCos;
            try { idCos = await stergePlanNutritie(p.id, p.nume); } catch (err) { notifica(mesajEroareSalvare(err, 'Planul nu a putut fi șters.'), 'eroare'); return; }
            await reincarcaPlanurile(); deseneaza(); deseneazaGeneratorZi();
            notificaStergere(`Planul „${p.nume}” a fost șters.`, idCos, async () => { await reincarcaPlanurile(); deseneazaGeneratorZi(); });
          } }),
        ]),
      ]);
    }));
  };
  deseneaza();
  const d = deschideDialog({ titlu: 'Planurile mele', continut: lista, butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })] });
}

async function incarcaPlanInZi(p) {
  const deInlocuit = ziNutritie.mese.filter(intrareModificabila);
  if (deInlocuit.length) {
    const da = await confirma({ titlu: `Încarci „${p.nume}”?`, ok: 'Încarcă',
      text: `${plural(deInlocuit.length, 'rețetă neîncepută și neblocată va fi înlocuită', 'rețete neîncepute și neblocate vor fi înlocuite')}. Mesele blocate sau începute rămân.` });
    if (!da) return;
  }
  const inainte = ziNutritie;
  const rez = aplicaPlan({ zi: ziNutritie, plan: p, idNou: idNutritieNou });
  if (!(await salveazaZiua({ ...ziNutritie, mese: rez.mese }))) return;
  randeazaZiNutritie();
  notifica(`Plan încărcat${rez.sarite.length ? ` (păstrate: ${rez.sarite.map(numeMasa).join(', ')})` : ''}.`, 'succes', 5000,
    { text: 'Anulează', onclick: async () => { if (await salveazaZiua(inainte)) randeazaZiNutritie(); } });
}

// Avertisment la adăugarea manuală: rețeta încalcă o alergie sau o regulă strictă (adăugarea rămâne decizia ta).
function avertismentConflicte(r) {
  const c = conflicteReteta(r, indexNutritie, prefNutritie());
  const parti = [];
  if (c.alergii.length) parti.push(`conține sau poate conține ${c.alergii.map(a => numeAlergen(a).split(' (')[0].toLowerCase()).join(', ')} (alergie declarată)`);
  if (c.excluse.length) parti.push(`are ${c.excluse.map(id => (indexNutritie.get(id) || {}).nume || id).join(', ')} (exclus)`);
  if (c.dieta.length) parti.push(`nu e ${c.dieta.map(d => NUME_SCURT_ETICHETA[d].toLowerCase()).join(', ')}`);
  if (c.timp) parti.push(`durează peste ${prefNutritie().timpMaxim} minute`);
  if (!parti.length) return null;
  return el('p', { class: 'nota ' + (c.alergii.length ? 'nota-pericol' : 'nota-avertizare'), text: `Atenție: rețeta ${parti.join('; ')}.` });
}

// ---------- Înlocuirea inteligentă (etapa 6) ----------
const NUME_CAMP_POTRIVIRE = { kcal: 'Calorii', proteine: 'Proteine', carbohidrati: 'Carbohidrați', grasimi: 'Grăsimi' };
const fmtDif = (v, u) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmtNr(Math.abs(v))}${u}`;

function tabelComparatie(tinta, alt, timpOriginal, timpAlt) {
  const rand = (nume, a, b, dif, ok, u) => el('div', { class: 'cmp-rand' + (ok === false ? ' cmp-in-afara' : '') }, [
    el('span', { text: nume }), el('span', { class: 'cmp-orig', text: `${fmtNr(a)}${u}` }), el('strong', { text: `${fmtNr(b)}${u}` }),
    el('span', { class: 'cmp-dif', text: dif === null ? '' : `${fmtDif(dif, u)}${ok ? ' ✓' : ''}` }),
  ]);
  return el('div', { class: 'cmp-tabel' }, [
    el('div', { class: 'cmp-rand cmp-cap' }, [el('span'), el('span', { text: 'acum' }), el('span', { text: 'nou' }), el('span', { text: 'diferență' })]),
    ...Object.keys(NUME_CAMP_POTRIVIRE).map(c => rand(NUME_CAMP_POTRIVIRE[c], tinta[c], alt.valori[c], alt.dif[c], alt.inToleranta[c], c === 'kcal' ? '' : ' g')),
    rand('Timp', timpOriginal || 0, timpAlt || 0, timpOriginal && timpAlt ? timpAlt - timpOriginal : null, null, ' min'),
  ]);
}

function deschideInlocuire(i) {
  let toateMesele = false;
  let arata = 5;
  let decalaj = 0;
  const lista = el('div', { class: 'lista-alternative' });
  const comutator = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Unde caut' });
  const sus = el('div');
  const deseneaza = () => {
    const rez = alternativeInlocuire({ intrare: i, zi: ziNutritie, retete: toateRetetele(), idx: indexNutritie, pref: prefNutritie(), toateMesele });
    comutator.replaceChildren(
      el('button', { type: 'button', class: 'chip chip-mic' + (!toateMesele ? ' activ' : ''), 'aria-pressed': String(!toateMesele), text: `Doar ${numeMasa(i.masa).toLowerCase()}`, onclick: () => { toateMesele = false; decalaj = 0; arata = 5; deseneaza(); } }),
      el('button', { type: 'button', class: 'chip chip-mic' + (toateMesele ? ' activ' : ''), 'aria-pressed': String(toateMesele), text: 'Și din alte mese', onclick: () => { toateMesele = true; decalaj = 0; arata = 5; deseneaza(); } }),
    );
    const t = rez.tinta;
    sus.replaceChildren(el('p', { class: 'nota', text: `Acum: ${fmtPortii(i.portii)} · ${fmtNr(t.kcal)} kcal · P ${fmtNr(t.proteine)} g · C ${fmtNr(t.carbohidrati)} g · G ${fmtNr(t.grasimi)} g${i.timp ? ` · ${i.timp} min` : ''}` }));
    const card = alt => el('article', { class: 'alternativa' + (alt.toate ? '' : ' alternativa-slaba') }, [
      el('div', { class: 'alternativa-cap' }, [
        imagineReteta(alt.r, 'zi-imagine'),
        el('div', { class: 'zi-intrare-text' }, [
          el('strong', { text: alt.r.nume }),
          el('span', { class: 'nota', text: `${fmtPortii(alt.portii)} sugerate${alt.aceeasiMasa ? '' : ` · rețetă de ${numeMasa(alt.r.masa).toLowerCase()}`}` }),
        ]),
        el('span', { class: 'asemanare' + (alt.toate ? '' : ' slaba'), title: 'Asemănarea nutrițională', text: `${alt.scor}%` }),
      ]),
      tabelComparatie(t, alt, i.timp, alt.r.timp),
      buton({ text: 'Alege', tip: alt.toate ? 'principal' : 'secundar', mic: true, lat: true, onclick: () => d.inchide(() => confirmaInlocuirea(i, alt)) }),
    ]);
    const parti = [];
    if (rez.potrivite.length) {
      const total = rez.potrivite.length;
      const start = total > arata ? decalaj % total : 0;
      const vizibile = [...rez.potrivite.slice(start), ...rez.potrivite.slice(0, start)].slice(0, arata);
      parti.push(el('p', { class: 'nota', text: `${plural(total, 'rețetă se potrivește', 'rețete se potrivesc')} (calorii ±10%, proteine ±10 g, carbohidrați ±15 g, grăsimi ±10 g), ordonate după asemănare.` }));
      parti.push(...vizibile.map(card));
      if (total > arata) {
        parti.push(el('div', { class: 'rand-butoane' }, [
          buton({ text: 'Arată mai multe', icon: 'plus', tip: 'fantoma', mic: true, onclick: () => { arata += 5; deseneaza(); } }),
          buton({ text: 'Alte sugestii', icon: 'schimba', tip: 'fantoma', mic: true, onclick: () => { decalaj += arata; deseneaza(); lista.scrollTop = 0; } }),
        ]));
      }
    } else {
      parti.push(el('div', { class: 'nota nota-avertizare fara-potrivire' }, [
        el('strong', { text: 'Nicio rețetă nu are valori suficient de apropiate. ' }),
        rez.totalCandidate
          ? `Niciuna din cele ${rez.totalCandidate} rețete permise nu intră în toleranță la toate valorile, nici cu porția ajustată.${toateMesele ? '' : ' Poți căuta și în rețetele altor mese.'} Mai jos sunt cele mai apropiate, cu diferențele marcate — nu sunt echivalente.`
          : `Nu există altă rețetă${toateMesele ? '' : ` de ${numeMasa(i.masa).toLowerCase()}`} care să respecte preferințele stricte și să nu fie deja în zi${rez.excluseFiltre ? ` (${rez.excluseFiltre} excluse de filtre)` : ''}.`,
      ]));
      parti.push(...rez.apropiate.filter(a => a.scor >= 40).slice(0, 3).map(card));
    }
    lista.replaceChildren(...parti);
  };
  deseneaza();
  const d = deschideDialog({
    titlu: `Înlocuiește: ${i.nume}`,
    continut: el('div', {}, [sus, comutator, lista]),
    butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })],
  });
}

function confirmaInlocuirea(i, alt) {
  let portii = alt.portii;
  const info = alt.info;
  const tinta = {};
  for (const c of ['kcal', 'proteine', 'carbohidrati', 'grasimi', 'fibre']) tinta[c] = (i.valoriPortie[c] || 0) * i.portii;
  const tabel = el('div');
  const textPortii = el('strong', { class: 'portii-valoare' });
  const deseneaza = () => {
    textPortii.textContent = String(portii).replace('.', ',');
    tabel.replaceChildren(tabelComparatie(tinta, potrivireLaPortie(info, portii, tinta), i.timp, alt.r.timp));
  };
  const schimba = delta => { portii = Math.max(0.25, Math.min(10, Math.round((portii + delta) * 4) / 4)); deseneaza(); };
  deseneaza();
  const d = deschideDialog({
    titlu: alt.r.nume,
    continut: el('div', {}, [
      el('p', { class: 'nota', text: `Înlocuiește ${i.nume} la ${numeMasa(i.masa).toLowerCase()}. Celelalte mese rămân neschimbate.` }),
      el('div', { class: 'rand aliniat portii-rand' }, [
        el('h3', { class: 'detaliu-titlu', text: 'Porții' }),
        el('div', { class: 'stepper' }, [
          buton({ icon: 'minus', tip: 'secundar', mic: true, eticheta: 'Mai puțin', onclick: () => schimba(-0.25) }),
          textPortii,
          buton({ icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Mai mult', onclick: () => schimba(0.25) }),
        ]),
      ]),
      tabel,
      avertismentConflicte(alt.r),
    ]),
    butoane: [
      buton({ text: 'Înapoi', tip: 'fantoma', onclick: () => d.inchide(() => deschideInlocuire(i)) }),
      buton({ text: 'Înlocuiește', icon: 'schimba', tip: 'principal', onclick: async () => {
        d.inchide();
        await aplicaInlocuirea(i, alt.r, portii);
      } }),
    ],
  });
}

async function aplicaInlocuirea(i, r, portii) {
  const curenta = ziNutritie.mese.find(x => x.id === i.id);
  if (!curenta || !intrareModificabila(curenta)) { notifica('Masa s-a schimbat între timp (blocată sau începută), așa că nu am înlocuit-o.', 'eroare'); return; }
  const noua = intrareMasa({ id: idNutritieNou(), masa: i.masa, reteta: r, valoriPortieReteta: valoriPortie(r, indexNutritie), portii });
  const inainte = ziNutritie;
  if (!(await salveazaZiua({ ...ziNutritie, mese: ziNutritie.mese.map(x => (x.id === i.id ? noua : x)) }))) return;
  randeazaZiNutritie();
  notifica(`${i.nume} → ${r.nume}.`, 'succes', 5000, { text: 'Anulează', onclick: async () => { if (await salveazaZiua(inainte)) randeazaZiNutritie(); } });
}

// ---------- Preferințele generatorului (etapa 5) ----------
function selectorAlimente(lista, eticheta, laSchimbare) {
  const cont = el('div', { class: 'selector-alimente' });
  const input = el('input', { type: 'search', placeholder: 'Caută aliment', autocomplete: 'off', 'aria-label': eticheta });
  const alese = el('div', { class: 'chipuri chipuri-mici' });
  const sugestii = el('div', { class: 'chipuri chipuri-mici' });
  const deseneaza = () => {
    alese.replaceChildren(...lista.map(id => el('button', { type: 'button', class: 'chip chip-mic activ chip-icon', 'aria-label': `Scoate ${(indexNutritie.get(id) || {}).nume || id}`,
      onclick: () => { lista.splice(lista.indexOf(id), 1); laSchimbare(); deseneaza(); } }, [el('span', { text: (indexNutritie.get(id) || {}).nume || 'aliment șters' }), iconita('x', 'iconita iconita-mica')])));
    const cuv = normalizeazaText(input.value).split(/\s+/).filter(Boolean);
    const potrivite = cuv.length ? toateAlimentele().filter(a => !lista.includes(a.id) && cuv.every(c => normalizeazaText(a.nume).includes(c))).slice(0, 8) : [];
    sugestii.replaceChildren(...potrivite.map(a => el('button', { type: 'button', class: 'chip chip-mic chip-icon', onclick: () => {
      lista.push(a.id); input.value = ''; laSchimbare(); deseneaza(); input.focus();
    } }, [iconita('plus', 'iconita iconita-mica'), el('span', { text: a.nume })])));
  };
  input.addEventListener('input', deseneaza);
  deseneaza();
  cont.append(alese, el('div', { class: 'cautare mt' }, [iconita('cauta'), input]), sugestii);
  return cont;
}

function deschidePreferinteGenerator() {
  const p = JSON.parse(JSON.stringify(prefNutritie()));
  let scop = setari.scopNutritie || 'mentinere';
  const sectiune = (titlu, nota, continut) => el('section', { class: 'pref-sectiune' }, [el('h3', { class: 'detaliu-titlu', text: titlu }), nota ? el('p', { class: 'nota nota-mica', text: nota }) : null, continut]);
  const grupChip = (optiuni, lista, eticheta) => {
    const g = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': eticheta });
    const d = () => g.replaceChildren(...optiuni.map(([id, nume]) => el('button', { type: 'button', class: 'chip chip-mic' + (lista.includes(id) ? ' activ' : ''),
      'aria-pressed': String(lista.includes(id)), text: nume, onclick: () => {
        if (lista.includes(id)) lista.splice(lista.indexOf(id), 1); else lista.push(id);
        d();
      } })));
    d();
    return g;
  };
  const chipuriScop = el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': 'Obiectiv' });
  const dScop = () => chipuriScop.replaceChildren(...SCOPURI_NUTRITIE.map(s => el('button', { type: 'button', class: 'chip chip-mic' + (scop === s.id ? ' activ' : ''),
    'aria-pressed': String(scop === s.id), text: s.nume, onclick: () => { scop = s.id; dScop(); } })));
  dScop();
  const selectTimp = el('select', { 'aria-label': 'Timp maxim de preparare' }, [
    el('option', { value: '', text: 'Oricât', selected: !p.timpMaxim }),
    ...TIMPI_MAXIMI.map(t => el('option', { value: String(t), text: `Cel mult ${t} minute`, selected: p.timpMaxim === t })),
  ]);
  const numarEl = el('p', { class: 'nota pref-numar' });
  const actualizeazaNumar = () => {
    const pr = curataPreferinteNutritie({ ...p, timpMaxim: selectTimp.value ? Number(selectTimp.value) : null });
    const { candidate } = filtreazaReteteGen(toateRetetele(), indexNutritie, pr);
    const n = MESE.map(m => `${numeMasa(m.id)}: ${candidate[m.id].length}`);
    numarEl.textContent = `Rețete disponibile după filtrele stricte — ${n.join(' · ')}`;
    numarEl.classList.toggle('nota-avertizare', MESE.some(m => candidate[m.id].length === 0));
  };
  selectTimp.addEventListener('change', actualizeazaNumar);
  const cont = el('div', { class: 'formular preferinte-generator' });
  const observa = () => actualizeazaNumar();
  cont.addEventListener('click', () => setTimeout(observa, 0));
  cont.append(
    sectiune('Obiectiv', 'Masă musculară: prioritate proteinelor. Slăbire: nu depășește caloriile, păstrând proteinele. Menținere: echilibrat.', chipuriScop),
    sectiune('Alergii (reguli stricte)', 'Rețetele care conțin sau „pot conține” un alergen bifat nu apar niciodată în planurile generate, nici dacă nu se ating țintele.',
      grupChip(ALERGENI.map(a => [a.id, a.nume.split(' (')[0]]), p.alergii, 'Alergii')),
    sectiune('Dietă (reguli stricte)', null, grupChip(DIETE_STRICTE.map(d => [d, NUME_SCURT_ETICHETA[d]]), p.dieta, 'Dietă')),
    sectiune('Timp maxim de preparare (regulă strictă)', null, el('label', { class: 'camp' }, [selectTimp])),
    sectiune('Ingrediente excluse (reguli stricte)', 'Pentru gusturi, nu pentru alergii: alergiile se bifează mai sus.', selectorAlimente(p.excluse, 'Caută aliment de exclus', observa)),
    sectiune('Preferințe (contează, dar pot fi încălcate)', null, grupChip(PREFERINTE_STIL.map(s => [s, NUME_SCURT_ETICHETA[s]]), p.stil, 'Preferințe')),
    sectiune('Alimente preferate', 'Rețetele cu aceste alimente au șanse mai mari.', selectorAlimente(p.preferate, 'Caută aliment preferat', observa)),
    numarEl,
    el('p', { class: 'nota nota-mica', text: 'Generatorul potrivește rețete cu ținte; nu e o dietă recomandată medical. Pentru alergii severe verifică mereu eticheta produselor folosite.' }),
  );
  actualizeazaNumar();
  const d = deschideDialog({
    titlu: 'Preferințe pentru plan',
    continut: cont,
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: () => {
        setari.preferinteNutritie = curataPreferinteNutritie({ ...p, timpMaxim: selectTimp.value ? Number(selectTimp.value) : null });
        setari.scopNutritie = scop;
        salveazaSetari();
        d.inchide();
        deseneazaGeneratorZi();
        notifica('Preferințe salvate. Se aplică la următoarea generare.', 'succes');
      } }),
    ],
  });
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
  const editabila = i.stare === 'neinceput';
  let portii = i.portii;
  // Cantitățile pe porție: cele salvate în zi; pentru intrările vechi (etapa 3), cele din rețeta de acum.
  const r = retetaDupaId(i.idReteta);
  let ingrediente = (i.ingredientePortie || (r ? r.ingrediente.map(([id, g]) => [id, Math.round(g / (r.portii || 1) * 10) / 10]) : [])).map(x => [...x]);
  let cantitatiSchimbate = false;
  const valori = el('div');
  const textPortii = el('strong', { class: 'portii-valoare', text: '' });
  const valoriPortieAcum = () => (cantitatiSchimbate
    ? valoriIngrediente(ingrediente.filter(([, g]) => g > 0), indexNutritie).total
    : i.valoriPortie);
  const deseneaza = () => {
    textPortii.textContent = String(portii).replace('.', ',');
    valori.replaceChildren(panouNutritional(valoriInmultite(valoriPortieAcum(), portii), `planificat (${fmtPortii(portii)})`));
  };
  const schimba = delta => { portii = Math.max(0.5, Math.min(10, Math.round((portii + delta) * 2) / 2)); deseneaza(); };

  const randuriIngrediente = ingrediente.map((x, k) => {
    const a = indexNutritie.get(x[0]);
    const input = el('input', { type: 'number', inputmode: 'decimal', step: '1', min: '0', max: '5000', value: String(x[1]),
      disabled: !editabila || !a, 'aria-label': `Grame pe porție: ${a ? a.nume : 'aliment șters'}` });
    input.addEventListener('input', () => {
      const g = parseFloat(String(input.value).replace(',', '.'));
      ingrediente[k][1] = g >= 0 && g <= 5000 ? g : 0;
      cantitatiSchimbate = true;
      deseneaza();
    });
    return el('li', { class: 'rand-ajustare' }, [el('span', { text: a ? a.nume : 'Aliment șters din bibliotecă' }), el('span', { class: 'camp-grame' }, [input, el('span', { class: 'nota', text: 'g' })])]);
  });
  deseneaza();

  const d = deschideDialog({
    titlu: i.nume,
    continut: el('div', {}, [
      el('p', { class: 'nota', text: `${numeMasa(i.masa)} · ${textStareIntrare(i)}${i.timp ? ` · ${i.timp} min` : ''}${i.blocat ? ' · blocată' : ''}` }),
      el('div', { class: 'rand aliniat portii-rand' }, [
        el('h3', { class: 'detaliu-titlu', text: 'Porții planificate' }),
        editabila ? el('div', { class: 'stepper' }, [
          buton({ icon: 'minus', tip: 'secundar', mic: true, eticheta: 'Mai puțin', onclick: () => schimba(-0.5) }),
          textPortii,
          buton({ icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Mai mult', onclick: () => schimba(0.5) }),
        ]) : textPortii,
      ]),
      valori,
      randuriIngrediente.length ? el('details', { class: 'ajustare-cantitati', open: false }, [
        el('summary', { text: 'Ajustează cantitățile (grame pe porție)' }),
        el('ul', { class: 'lista-ajustare' }, randuriIngrediente),
        el('p', { class: 'nota nota-mica', text: 'Schimbarea se aplică doar acestei mese din zi, nu rețetei din bibliotecă. Pune 0 ca să scoți un ingredient.' }),
      ]) : null,
      editabila ? null : el('p', { class: 'nota nota-mica', text: 'Masa e marcată ca mâncată (sau parțial), așa că porțiile și cantitățile nu se mai schimbă. Pune-o pe „Neîncepută” dacă vrei s-o modifici.' }),
      el('p', { class: 'nota nota-mica', text: 'Valorile au fost salvate când ai adăugat rețeta în zi. Dacă editezi rețeta mai târziu, ziua aceasta nu se schimbă.' }),
      el('div', { class: 'rand-butoane mt' }, [
        r ? buton({ text: 'Vezi rețeta', icon: 'carte', tip: 'secundar', mic: true, onclick: () => d.inchide(() => arataReteta(r.id)) }) : null,
        buton({ text: 'Scoate din zi', icon: 'cos', tip: 'fantoma', mic: true, onclick: () => d.inchide(() => scoateIntrarea(i)) }),
      ]),
    ]),
    butoane: [
      buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() }),
      editabila ? buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        let noua = { ...i, portii, modificat: Date.now() };
        if (cantitatiSchimbate) {
          try {
            noua = ajusteazaIngredienteIntrare(noua, ingrediente, ing => valoriIngrediente(ing, indexNutritie));
          } catch (err) { notifica(err.message, 'eroare'); return; }
        }
        d.inchide();
        if (portii === i.portii && !cantitatiSchimbate) return;
        await inlocuiesteIntrarea(noua);
      } }) : null,
    ].filter(Boolean),
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
      avertismentConflicte(r),
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
