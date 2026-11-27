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
  // Cafeaua zilnică (Faza 4) se scrie în istoric (zilele de până azi) o dată pe zi.
  await completeazaCafeleZilnice().catch(err => console.warn(err));
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
  deseneazaCafeaZi();
  deseneazaGeneratorZi();
  deseneazaMeseZi();
  // Acțiunile pe mese pornite din vederea săptămânii folosesc aceleași funcții; după ele, redesenăm săptămâna.
  if (filaNutritie === 'saptamana' && typeof randeazaSaptamana === 'function') randeazaSaptamana();
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
    el('div', { class: 'card-cap-actiuni' }, [
      buton({ text: tinte ? 'Ținte' : 'Setează ținte', icon: 'editeaza', tip: 'fantoma', mic: true, onclick: deschideTinteNutritie }),
    ]),
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
  // Analiza are un singur loc (fila „Analiză”); aici doar un link text discret.
  continut.push(el('button', { type: 'button', class: 'link-discret', text: 'Vezi analiza nutriției →', onclick: () => arataFilaNutritie('analiza') }));
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
  if (i.scanare) return i.scanare.articole.map(a => el('li', {}, [el('span', { text: a.nume }), el('strong', { text: a.grame != null ? fmtG(a.grame * i.portii) : `${fmtNr(a.cantitate)} ${a.unitate}` })]));
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
    el('button', { type: 'button', class: 'btn-sterge-rapid', 'aria-label': `Șterge ${i.nume} din ziua aceasta`, title: 'Șterge din zi', onclick: () => scoateIntrarea(i) }, [el('span', { 'aria-hidden': 'true', text: '−' })]),
    el('button', { class: 'zi-intrare-principal', type: 'button', onclick: () => deschideIntrarea(i),
      'aria-label': `${i.nume}, ${fmtPortii(i.portii)}, ${fmtNr(vPlan.kcal)} kcal, ${textStareIntrare(i)}. Detalii` }, [
      imagineIntrare(i),
      el('span', { class: 'zi-intrare-text' }, [
        el('strong', { text: i.nume }),
        el('span', { class: 'zi-intrare-kcal' }, [el('b', { text: fmtNr(vPlan.kcal) }), ` kcal · ${fmtPortii(i.portii)}${i.timp ? ` · ${i.timp} min` : ''}`]),
        el('span', { class: 'nota', text: `P ${fmtNr(vPlan.proteine)} g · C ${fmtNr(vPlan.carbohidrati)} g · G ${fmtNr(vPlan.grasimi)} g${i.ajustat ? ' · cantități ajustate' : ''}` }),
        i.stare === 'partial' ? el('span', { class: 'zi-partial', text: textStareIntrare(i) }) : null,
        i.scanare ? el('span', { class: 'zi-din-poza' }, [iconita(i.sursa === 'alimente' ? 'nutritie' : 'camera', 'iconita mica'), el('span', { text: ` ${i.sursa === 'alimente' ? 'alimente' : 'din poză'}${i.ora ? ` · ${i.ora}` : ''}` })]) : null,
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
  const carduri = MESE_TOATE.filter(m => m.id !== 'alta' || ziNutritie.mese.some(i => i.masa === 'alta')).map(m => {
    const intrari = ziNutritie.mese.filter(i => i.masa === m.id);
    // Masă goală: un singur rând („Gustarea 2 · + Adaugă”), care deschide foaia de adăugare pe masa respectivă.
    if (!intrari.length) {
      return el('button', { type: 'button', class: 'card zi-masa-goala', 'aria-label': `${m.nume}: nimic notat. Adaugă`,
        onclick: () => deschideAdaugareRapida({ masa: m.id, data: dataZiNutritie }) }, [
        el('span', { class: 'zi-masa-goala-nume', text: m.nume }),
        el('span', { class: 'zi-masa-goala-adauga' }, [iconita('plus', 'iconita mica'), el('span', { text: 'Adaugă' })]),
      ]);
    }
    const t = totaluriPeMasa(ziNutritie, m.id);
    return el('section', { class: 'card zi-masa', 'aria-label': m.nume }, [
      el('div', { class: 'card-cap' }, [
        el('h2', { text: m.nume }),
        el('span', { class: 'nota', text: intrari.length ? `${fmtNr(t.mancat.kcal)} / ${fmtNr(t.planificat.kcal)} kcal` : '' }),
      ]),
      intrari.length ? el('ul', { class: 'zi-intrari' }, intrari.map(randIntrare)) : null,
      el('div', { class: 'zi-adauga' }, [
        m.id !== 'alta' ? buton({ text: intrari.length ? 'Adaugă încă o rețetă' : 'Adaugă o rețetă', icon: 'plus', tip: intrari.length ? 'fantoma' : 'secundar',
          mic: true, onclick: () => alegeRetetaPentruMasa(m.id) }) : null,
        buton({ text: 'Aliment', icon: 'plus', tip: 'fantoma', mic: true, eticheta: `Adaugă un aliment la ${m.nume.toLowerCase()}`, onclick: () => deschideAdaugareAlimente({ masa: m.id, data: dataZiNutritie }) }),
        buton({ text: 'Din poză', icon: 'camera', tip: 'fantoma', mic: true, eticheta: `Fotografiază ${m.nume.toLowerCase()}`, onclick: () => deschideScanare({ masa: m.id, data: dataZiNutritie }) }),
      ]),
    ]);
  });
  $('zi-mese').replaceChildren(...carduri);
}

// ---------- Generatorul aleatoriu, planurile salvate (etapa 4) ----------
let planuriMele = [];        // planurile de o zi
let planuriSaptamani = [];   // planurile de o săptămână (etapa 8)
async function reincarcaPlanurile() {
  let toate = null;
  try { toate = await toatePlanurileNutritie(); } catch (err) { console.warn(err); }
  if (!toate) return;
  const ordine = (a, b) => (b.favorit - a.favorit) || (b.modificat || 0) - (a.modificat || 0);
  planuriMele = toate.filter(p => p.tip !== 'saptamana').sort(ordine);
  planuriSaptamani = toate.filter(p => p.tip === 'saptamana').sort(ordine);
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
    nr ? buton({ text: 'Lista de cumpărături pentru ziua asta', icon: 'lista', tip: 'fantoma', mic: true, lat: true, onclick: () => {
      perioadaLista = dataZiNutritie === dataLocala() ? 'azi' : dataZiNutritie === mutaData(dataLocala(), 1) ? 'maine' : 'zi';
      arataFilaNutritie('lista');
    } }) : null,
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
          ? `${rez.totalCandidate === 1 ? 'Singura rețetă permisă nu intră' : `Niciuna din cele ${numarDe(rez.totalCandidate)} rețete permise nu intră`} în toleranță la toate valorile, nici cu porția ajustată.${toateMesele ? '' : ' Poți căuta și în rețetele altor mese.'} Mai jos sunt cele mai apropiate, cu diferențele marcate — nu sunt echivalente.`
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
  if (i.scanare) return deschideIntrareScanata(i);
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
// direct: alegerea adaugă imediat o porție (din foaia „+”: rețeta la o masă în 3 atingeri); altfel se deschide
// dialogul cu porțiile și masa.
function alegeRetetaPentruMasa(idMasa, { data = dataZiNutritie, direct = false } = {}) {
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
      return el('button', { type: 'button', class: 'selector-reteta', onclick: () => d.inchide(() => (direct
        ? adaugaRetetaInZi(r, { masa: idMasa, portii: 1, data }).then(dupaAdaugareRapida)
        : deschideAdaugareInZi(r, { masa: idMasa, data }))) }, [
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

// ---------- „+ Adaugă” rapid (etapa 4) ----------
// Foaia: sus masa (preselectată după oră), dedesubt Din poză / Rețetă / Aliment, apoi „Recente” (o atingere).
// data: ziua din Ziua mea dacă e deschisă, altfel azi.
async function deschideAdaugareRapida({ masa = null, data = null } = {}) {
  const ziua = data || (ecranCurent === 'ecran-nutritie' && filaNutritie === 'zi' ? dataZiNutritie : dataLocala());
  let masaAleasa = MESE.some(m => m.id === masa) ? masa : masaDupaOra();
  const chipuri = el('div', { class: 'chipuri chipuri-mici adauga-mese', role: 'group', 'aria-label': 'Masa' });
  const deseneazaChipuri = () => chipuri.replaceChildren(...MESE.map(m => el('button', {
    type: 'button', class: 'chip chip-mic' + (m.id === masaAleasa ? ' activ' : ''), 'aria-pressed': String(m.id === masaAleasa), text: m.scurt || m.nume,
    onclick: () => { masaAleasa = m.id; deseneazaChipuri(); },
  })));
  deseneazaChipuri();
  const actiune = (icon, titlu, detaliu, f) => el('button', { type: 'button', class: 'adauga-actiune', onclick: () => d.inchide(() => f(masaAleasa)) }, [
    el('span', { class: 'adauga-actiune-icon' }, [iconita(icon)]), el('strong', { text: titlu }), el('span', { class: 'nota', text: detaliu })]);
  const recente = el('div', { class: 'adauga-recente' }, [stareIncarcare(2)]);
  const d = deschideDialog({
    titlu: ziua === dataLocala() ? 'Adaugă la azi' : `Adaugă la ${afiseazaData(ziua)}`,
    continut: el('div', { class: 'adauga-rapid' }, [
      chipuri,
      el('div', { class: 'adauga-actiuni' }, [
        actiune('camera', 'Din poză', 'tu verifici', m => deschideScanare({ masa: m, data: ziua })),
        actiune('carte', 'Rețetă', 'o porție', m => alegeRetetaPentruMasa(m, { data: ziua, direct: true })),
        actiune('plus', 'Aliment', 'ex. un măr', m => deschideAdaugareAlimente({ masa: m, data: ziua })),
      ]),
      el('p', { class: 'sectiune-eticheta', text: 'Recente' }),
      recente,
    ]),
    butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })],
  });
  // Ultimele 5 lucruri notate (din ultimele 14 zile), adăugabile cu o atingere la masa aleasă.
  let lista = [];
  try {
    const zile = await Promise.all(Array.from({ length: 14 }, (_, k) => citesteZiNutritie(mutaData(dataLocala(), -k))));
    lista = recenteNutritie(zile, 5);
  } catch (err) { console.warn(err); }
  if (dialogDeschis !== d) return;
  recente.replaceChildren(...(lista.length ? lista.map(i => {
    const v = valoriPlanificateIntrare(i);
    return el('button', { type: 'button', class: 'adauga-recent', onclick: () => d.inchide(() => adaugaRecent(i, masaAleasa, ziua)) }, [
      el('span', { class: 'adauga-recent-text' }, [el('strong', { text: i.nume }),
        el('span', { class: 'nota', text: `${fmtNr(v.kcal)} kcal${i.idReteta ? ` · ${fmtNumarPortiiZi(i.portii)}` : ''}` })]),
      el('span', { class: 'adauga-recent-plus', 'aria-hidden': 'true' }, [iconita('plus', 'iconita mica')]),
    ]);
  }) : [el('p', { class: 'nota', text: 'Ce notezi apare aici, ca să adaugi din nou cu o atingere.' })]));
}

function fmtNumarPortiiZi(p) {
  return `${String(Math.round(p * 100) / 100).replace('.', ',')} ${p === 1 ? 'porție' : 'porții'}`;
}

async function adaugaRecent(i, masa, data) {
  let zi;
  try { zi = await citesteZiNutritie(data); } catch (err) { notifica('Ziua nu a putut fi citită.', 'eroare'); return; }
  const copie = copieIntrareRecenta(i, { id: idNutritieNou(), masa });
  const noua = { ...zi, mese: [...zi.mese, copie] };
  try { await salveazaZiNutritie(noua); } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Nu s-a putut adăuga.'), 'eroare'); return; }
  if (data === ziNutritie.data) ziNutritie = noua;
  notifica(`${i.nume} adăugat la ${numeMasa(masa).toLowerCase()}.`, 'succes', 5000, { text: 'Anulează', onclick: async () => {
    try {
      const acum = await citesteZiNutritie(data);
      await salveazaZiNutritie({ ...acum, mese: acum.mese.filter(x => x.id !== copie.id) });
      if (data === ziNutritie.data) ziNutritie = { ...ziNutritie, mese: ziNutritie.mese.filter(x => x.id !== copie.id) };
    } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut anula.'), 'eroare'); return; }
    dupaAdaugareRapida();
  } });
  dupaAdaugareRapida();
}

// După o adăugare din foaia rapidă: se redesenează ecranul de pe care s-a pornit.
function dupaAdaugareRapida() {
  if (ecranCurent === 'ecran-masa') randeazaAcasaMasa();
  else if (ecranCurent === 'ecran-nutritie' && filaNutritie === 'zi') randeazaZiNutritie({ reincarca: true });
}

// ---------- Țintele ----------
// Țintele: fără ținte → ghidul în 3 pași; cu ținte → valorile, editabile (plus „Recalculează cu ghidul”).
function deschideTinteNutritie() {
  return setari.tinteNutritie ? deschideTinteManual() : deschideGhidTinte();
}

function dupaSalvareTinte() {
  if (typeof ecranCurent === 'undefined') return;
  if (ecranCurent === 'ecran-masa') randeazaAcasaMasa();
  else if (ecranCurent === 'ecran-nutritie' && filaNutritie === 'zi') randeazaZiNutritie();
  if (typeof afiseazaProfil === 'function') afiseazaProfil();
}

// Câmpurile celor 5 ținte (calorii obligatorii, restul opționale), cu verificarea limitelor la citire.
function campuriTinte(valori) {
  const campuri = {};
  const camp = (id, eticheta) => {
    const [min, max] = LIMITE_TINTE[id];
    const input = el('input', { type: 'number', inputmode: 'numeric', step: '1', min: String(min), max: String(max),
      value: valori && valori[id] != null ? String(valori[id]) : '', placeholder: id === 'kcal' ? 'obligatoriu' : 'opțional' });
    campuri[id] = input;
    return el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: eticheta }), input]);
  };
  const grila = el('div', { class: 'grila-2' }, [camp('kcal', 'Calorii (kcal)'), camp('proteine', 'Proteine (g)'),
    camp('carbohidrati', 'Carbohidrați (g)'), camp('grasimi', 'Grăsimi (g)'), camp('fibre', 'Fibre (g)')]);
  const citeste = () => {
    const brut = {};
    for (const [c, input] of Object.entries(campuri)) {
      const t = String(input.value).trim();
      if (t === '') continue;
      const v = Number(t.replace(',', '.'));
      const [min, max] = LIMITE_TINTE[c];
      if (!(v >= min && v <= max)) { notifica(`Valoarea pentru ${input.closest('label').textContent.trim()} trebuie să fie între ${min} și ${max}.`, 'eroare'); input.focus(); return null; }
      brut[c] = v;
    }
    if (!('kcal' in brut)) { notifica('Scrie cel puțin ținta de calorii.', 'eroare'); campuri.kcal.focus(); return null; }
    return brut;
  };
  return { grila, campuri, citeste };
}

const AVERTISMENT_TINTE = 'Estimarea e orientativă, pentru adulți sănătoși. Nu e o recomandare medicală; pentru o afecțiune, sarcină sau o dietă strictă întreabă un medic sau un nutriționist.';

// Valorile țintelor, scrise de mână („Le știu deja”) sau modificate după ghid.
function deschideTinteManual() {
  const t = setari.tinteNutritie || {};
  const f = campuriTinte(t);
  let estimat = Boolean(t.estimat);
  for (const input of Object.values(f.campuri)) input.addEventListener('input', () => { estimat = false; });
  const d = deschideDialog({
    titlu: 'Țintele zilnice',
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: 'Doar caloriile sunt obligatorii.' }),
      f.grila,
      buton({ text: 'Recalculează cu ghidul (greutate, profil, obiectiv)', icon: 'zar', tip: 'fantoma', lat: true, onclick: () => d.inchide(() => deschideGhidTinte()) }),
    ]),
    butoane: [
      setari.tinteNutritie ? buton({ text: 'Șterge', tip: 'fantoma', onclick: () => d.inchide(() => {
        setari.tinteNutritie = null; salveazaSetari(); dupaSalvareTinte(); notifica('Țintele au fost șterse.', 'info');
      }) }) : buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: () => {
        const brut = f.citeste();
        if (!brut) return;
        setari.tinteNutritie = curataTinte({ ...brut, estimat });
        salveazaSetari();
        d.inchide();
        dupaSalvareTinte();
        notifica('Ținte salvate.', 'succes');
      } }),
    ],
  });
}

// Ghidul țintelor (etapa 4), în aceeași foaie: 1. greutatea de azi (se salvează în Corp ca cântărire),
// 2. profilul (înălțime, anul nașterii, sex, activitate — profilul unic din Corp), 3. obiectivul, cu țintele
// calculate (estimeazaTinte, Mifflin-St Jeor), editabile, și „Salvează”. „Le știu deja” → valorile de mână.
async function deschideGhidTinte() {
  let greutati = [];
  try { greutati = (await toateMasuratorile()).filter(m => m.tip === 'Greutate'); } catch (err) { console.warn(err); }
  const azi = dataLocala();
  const deAzi = greutati.filter(m => m.data === azi).map(m => m.valoare);
  const kgAzi = deAzi.length ? Math.round(deAzi.reduce((a, b) => a + b, 0) / deAzi.length * 10) / 10 : null;
  const tend = tendintaGreutate(greutati);
  const p = profilDinSetari(setari);
  const st = { pas: 1, kg: kgAzi ?? (tend ? Math.round(tend.media7 * 10) / 10 : null), inaltime: p.inaltimeCm ?? null, an: p.anNastere ?? null,
    sex: p.sex || null, activitate: p.activitate || 'moderat', scop: setari.scopNutritie || 'mentinere' };
  const zona = el('div', { class: 'ghid-tinte' });
  const d = deschideDialog({ titlu: 'Țintele zilnice', continut: zona, butoane: [] });
  const butoane = (...b) => d.caseta.querySelector('.dialog-butoane').replaceChildren(...b.filter(Boolean));
  const pasi = () => el('ol', { class: 'scan-pasi', 'aria-label': 'Pașii ghidului' }, ['Greutate', 'Profil', 'Obiectiv'].map((t, k) =>
    el('li', { class: k + 1 < st.pas ? 'gata' : k + 1 === st.pas ? 'activ' : '', 'aria-current': k + 1 === st.pas ? 'step' : null, text: t })));
  const numar = (valoare, atribute) => el('input', { type: 'number', inputmode: 'decimal', value: valoare != null ? String(valoare) : '', ...atribute });
  const citesteNumar = input => { const t = String(input.value).trim().replace(',', '.'); return t === '' ? null : Number(t); };
  const chipuri = (lista, activ, laAlegere, eticheta) => el('div', { class: 'chipuri chipuri-mici', role: 'group', 'aria-label': eticheta },
    lista.map(([id, n]) => el('button', { type: 'button', class: 'chip chip-mic' + (activ === id ? ' activ' : ''), 'aria-pressed': String(activ === id), text: n, onclick: () => laAlegere(id) })));

  function pas1() {
    st.pas = 1;
    const kg = numar(st.kg, { step: '0.1', min: '30', max: '300', placeholder: 'ex. 78,5', 'aria-label': 'Greutatea de azi în kg' });
    zona.replaceChildren(pasi(),
      el('p', { class: 'nota', text: 'Câteva date ca să-ți estimăm țintele. Le poți schimba oricând.' }),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Greutatea de azi (kg)' }), kg]),
      el('p', { class: 'nota nota-mica', text: kgAzi != null ? 'Ai deja o cântărire azi; dacă o schimbi, se adaugă una nouă în Corp.' : 'Se salvează în Corp ca cântărirea de azi.' }));
    butoane(buton({ text: 'Le știu deja', tip: 'fantoma', onclick: () => d.inchide(() => deschideTinteManual()) }),
      buton({ text: 'Continuă', tip: 'principal', onclick: () => {
        const v = citesteNumar(kg);
        if (!(v >= 30 && v <= 300)) { notifica('Scrie greutatea în kg, între 30 și 300.', 'eroare'); kg.focus(); return; }
        st.kg = Math.round(v * 10) / 10; pas2();
      } }));
  }

  function pas2() {
    st.pas = 2;
    const inaltime = numar(st.inaltime, { step: '0.5', min: '120', max: '250', placeholder: 'ex. 178', 'aria-label': 'Înălțimea în cm' });
    const an = numar(st.an, { step: '1', min: '1900', max: String(new Date().getFullYear() - 15), placeholder: 'ex. 1990', inputmode: 'numeric', 'aria-label': 'Anul nașterii' });
    const sexBloc = el('div');
    const deseneazaSex = () => sexBloc.replaceChildren(chipuri([['m', 'Bărbat'], ['f', 'Femeie']], st.sex, id => { st.sex = id; deseneazaSex(); }, 'Sex'));
    deseneazaSex();
    const activitate = el('select', { 'aria-label': 'Nivel de activitate' },
      NIVELURI_ACTIVITATE.map(a => el('option', { value: a.id, text: `${a.nume} — ${a.detaliu}`, selected: a.id === st.activitate })));
    zona.replaceChildren(pasi(),
      el('div', { class: 'grila-2' }, [
        el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Înălțime (cm)' }), inaltime]),
        el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Anul nașterii' }), an]),
      ]),
      el('span', { class: 'camp-eticheta', text: 'Sex' }), sexBloc,
      el('label', { class: 'camp mt' }, [el('span', { class: 'camp-eticheta', text: 'Nivel de activitate' }), activitate]),
      el('p', { class: 'nota nota-mica', text: 'Se salvează în profilul tău (Corp → Profil), folosit și pentru IMC.' }));
    butoane(buton({ text: 'Înapoi', tip: 'fantoma', onclick: pas1 }),
      buton({ text: 'Continuă', tip: 'principal', onclick: () => {
        const h = citesteNumar(inaltime), a = citesteNumar(an);
        if (!(h >= 120 && h <= 250)) { notifica('Înălțimea trebuie să fie între 120 și 250 cm.', 'eroare'); inaltime.focus(); return; }
        const varsta = varstaDinAn(a);
        if (!Number.isInteger(a) || !(varsta >= 15 && varsta <= 100)) { notifica('Anul nașterii: vârsta trebuie să fie între 15 și 100 de ani.', 'eroare'); an.focus(); return; }
        if (!st.sex) { notifica('Alege sexul (formula de estimare diferă).', 'eroare'); return; }
        Object.assign(st, { inaltime: h, an: a, activitate: activitate.value });
        pas3();
      } }));
  }

  function pas3() {
    st.pas = 3;
    const scopBloc = el('div');
    const valori = el('div');
    const explicatie = el('p', { class: 'nota nota-mica' });
    let f = null;
    const calculeaza = () => {
      const e = estimeazaTinte({ kg: st.kg, inaltimeCm: st.inaltime, varsta: varstaDinAn(st.an), sex: st.sex, activitate: st.activitate, scop: st.scop });
      f = campuriTinte(e);
      f.estimat = true;
      for (const input of Object.values(f.campuri)) input.addEventListener('input', () => { f.estimat = false; });
      valori.replaceChildren(f.grila);
      const dt = e.detalii;
      explicatie.textContent = `Metabolism bazal ≈ ${fmtNr(dt.bmr)} kcal (Mifflin-St Jeor), necesar ≈ ${fmtNr(dt.necesar)} kcal (× ${String(dt.factor).replace('.', ',')})` +
        `${dt.ajustare ? `, ${dt.ajustare > 0 ? '+' : '−'}${Math.abs(dt.ajustare * 100)}% pentru obiectiv` : ''}. ` +
        `Proteine ${String(dt.proteinePeKg).replace('.', ',')} g/kg, grăsimi 25% din calorii, fibre 14 g la 1000 kcal, restul carbohidrați.` +
        (dt.limitat ? ' Caloriile au fost ridicate la minimul sigur pentru o estimare generală.' : '');
    };
    const deseneazaScop = () => scopBloc.replaceChildren(chipuri(SCOPURI_NUTRITIE.map(x => [x.id, x.nume]), st.scop, id => { st.scop = id; deseneazaScop(); calculeaza(); }, 'Obiectiv'));
    deseneazaScop();
    calculeaza();
    zona.replaceChildren(pasi(), el('span', { class: 'camp-eticheta', text: 'Obiectiv' }), scopBloc,
      el('p', { class: 'sectiune-eticheta mt', text: 'Țintele tale (le poți modifica)' }), valori, explicatie,
      el('p', { class: 'nota nota-mica', text: AVERTISMENT_TINTE }));
    butoane(buton({ text: 'Înapoi', tip: 'fantoma', onclick: pas2 }),
      buton({ text: 'Salvează', tip: 'principal', onclick: () => salveaza(f) }));
  }

  async function salveaza(f) {
    const brut = f.citeste();
    if (!brut) return;
    // 1. cântărirea de azi (doar dacă e nouă sau diferită de cea de azi)
    if (kgAzi == null || Math.abs(kgAzi - st.kg) > 0.05) {
      try { await salveazaMasuratoare({ data: azi, tip: 'Greutate', valoare: st.kg, creat: Date.now() }); }
      catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Greutatea nu a putut fi salvată.'), 'eroare'); return; }
    }
    // 2. profilul unic + obiectivul de nutriție, 3. țintele
    Object.assign(setari, setariCuProfil(setari, { ...profilDinSetari(setari), inaltimeCm: st.inaltime, anNastere: st.an, sex: st.sex, activitate: st.activitate }));
    setari.scopNutritie = st.scop;
    setari.tinteNutritie = curataTinte({ ...brut, estimat: f.estimat !== false });
    salveazaSetari();
    d.inchide();
    if (typeof reincarcaMasuratori === 'function') reincarcaMasuratori().catch(() => {});
    dupaSalvareTinte();
    notifica('Ținte salvate.', 'succes');
  }

  pas1();
}
