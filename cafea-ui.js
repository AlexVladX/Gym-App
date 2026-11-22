// Cafeaua (Faza 4 din 3.0): cardul din „Ziua mea”, cardul de pe Acasă (MEAL PREP), formularul și cafeaua zilnică.
// Calculele sunt în cafea.js. Valorile cafelei intră în totalurile zilei (planificat, mâncat), cofeina se arată separat.

const fmtMl = v => `${String(Math.round(v * 10) / 10).replace('.', ',')}`;

function limitaCofeinaMea() { return setari.limitaCofeina || LIMITA_COFEINA_ZI; }

function textCompozitieCafea(c) {
  const t = tipCafea(c.tip);
  const parti = [`${fmtMl(c.cantitate)} ${t ? t.unitate : 'ml'}${c.tip === 'instant' ? ' praf' : ''}`];
  if (c.lapte && c.lapteMl > 0) parti.push(`${c.lapte === 'lapte-soia' ? 'soia' : 'lapte'} ${fmtMl(c.lapteMl)} ml`);
  if (c.zaharG > 0) parti.push(`zahăr ${fmtMl(c.zaharG)} g`);
  return parti.join(' · ');
}

// Bara de cofeină față de limită.
function baraCofeina(mg, plan, limita) {
  const p = x => `${Math.min(100, Math.round(x / limita * 100))}%`;
  return el('span', { class: 'zi-bara cafea-bara', role: 'presentation' }, [
    el('i', { class: 'zi-bara-plan', style: `width:${p(plan)}` }),
    el('i', { class: 'zi-bara-mancat cafea-bara-baut', style: `width:${p(mg)}` }),
    mg > limita ? el('b', { class: 'zi-bara-peste' }) : null,
  ]);
}

// Salvează o schimbare pe o zi oarecare (nu doar cea afișată) și redesenează ce e pe ecran.
async function modificaZiCafea(data, schimbare, mesajEroare = 'Cafeaua nu a putut fi salvată.') {
  try {
    const zi = await citesteZiNutritie(data);
    const noua = schimbare(zi);
    await salveazaZiNutritie(noua);
    if (typeof ziNutritie !== 'undefined' && ziNutritie.data === data) ziNutritie = noua;
    await redeseneazaDupaCafea();
    return noua;
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, mesajEroare), 'eroare');
    return null;
  }
}

async function redeseneazaDupaCafea() {
  if (ecranCurent === 'ecran-nutritie' && typeof filaNutritie !== 'undefined') {
    if (filaNutritie === 'zi') await randeazaZiNutritie({ reincarca: true });
    else if (filaNutritie === 'saptamana' && typeof randeazaSaptamana === 'function') randeazaSaptamana();
  }
  if (ecranCurent === 'ecran-masa' && typeof randeazaAcasaMasa === 'function') randeazaAcasaMasa();
}

// ---------- Cardul din „Ziua mea” ----------
function deseneazaCafeaZi() {
  const zona = $('zi-cafea');
  if (!zona) return;
  const zi = ziNutritie;
  const t = totalCafeaZi(zi);
  const limita = limitaCofeinaMea();
  const zilnice = (setari.cafeleZilnice || []).filter(z => z.activ);
  const viitor = zi.data > dataLocala();
  const continut = [
    el('div', { class: 'card-cap' }, [
      el('h2', {}, [iconita('cafea', 'iconita iconita-titlu'), 'Cafea']),
      el('div', { class: 'card-cap-actiuni' }, [
        buton({ text: 'Adaugă', icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Adaugă o cafea în ziua aceasta', onclick: () => deschideCafea({ data: zi.data }) }),
      ]),
    ]),
    el('div', { class: 'cafea-cofeina' }, [
      el('div', { class: 'cafea-cofeina-text' }, [
        el('strong', { class: t.cofeina > limita ? 'peste' : '', text: `${t.cofeina} mg` }),
        el('span', { text: ` cofeină ${zi.data === dataLocala() ? 'azi' : viitor ? 'băută' : 'în ziua aceasta'} · limita ta ${limita} mg` }),
      ]),
      t.cofeinaPlan > t.cofeina ? el('span', { class: 'nota nota-mica', text: `planificat ${t.cofeinaPlan} mg` }) : null,
    ]),
    baraCofeina(t.cofeina, t.cofeinaPlan, limita),
  ];
  for (const a of avertizariCofeina(t, limita)) continut.push(el('p', { class: `nota nota-mica cafea-avertizare cafea-${a.tip}`, role: 'status' }, [iconita('avertizare', 'iconita-mica'), ' ', a.text]));
  if (zi.cafele && zi.cafele.length) {
    continut.push(el('ul', { class: 'cafea-lista' }, zi.cafele.map(c => randCafea(c, zi.data))));
  } else {
    continut.push(el('p', { class: 'nota', text: 'Nicio cafea notată în ziua aceasta.' }));
  }
  continut.push(el('div', { class: 'cafea-zilnica-rand' }, [
    el('span', { class: 'nota nota-mica', text: zilnice.length
      ? `Cafea zilnică: ${zilnice.map(z => z.nume).join(', ')}`
      : 'Bei aceeași cafea în fiecare zi? Pune-o ca zilnică și apare singură.' }),
    buton({ text: zilnice.length ? 'Cafeaua zilnică' : 'Setează', icon: 'istoric', tip: 'fantoma', mic: true, onclick: deschideCafeleZilnice }),
  ]));
  if (t.numar) continut.push(el('p', { class: 'nota nota-mica', text: `Cafeaua intră în totalul zilei: ${fmtNr(t.baut.kcal)} kcal băute${t.planificat.kcal > t.baut.kcal ? ` din ${fmtNr(t.planificat.kcal)} planificate` : ''}.` }));
  zona.replaceChildren(...continut);
}

function randCafea(c, data) {
  const baut = cafeaBauta(c, data);
  return el('li', { class: 'cafea-rand' + (baut ? ' baut' : '') }, [
    el('button', { type: 'button', class: 'cafea-principal', onclick: () => deschideCafea({ data, cafea: c }),
      'aria-label': `${c.nume}, ${textCompozitieCafea(c)}, ${fmtNr(c.valori.kcal)} kcal, ${c.cofeina} mg cofeină${baut ? ', băută' : ''}. Editează` }, [
      el('span', { class: 'cafea-icon' }, [iconita('cafea')]),
      el('span', { class: 'cafea-text' }, [
        el('strong', { text: c.nume }),
        el('span', { class: 'nota', text: `${c.ora ? `${c.ora} · ` : ''}${textCompozitieCafea(c)}${c.idZilnica ? ' · zilnică' : ''}` }),
      ]),
      el('span', { class: 'cafea-cifre' }, [el('b', { text: `${c.cofeina} mg` }), el('span', { class: 'nota', text: `${fmtNr(c.valori.kcal)} kcal` })]),
    ]),
    el('button', { type: 'button', class: 'zi-stare-btn cafea-baut-btn' + (baut ? ' activ' : ''), 'aria-pressed': String(baut),
      text: baut ? 'Băută' : 'Nebăută', 'aria-label': `${c.nume}: ${baut ? 'băută' : 'nebăută'}. Schimbă`,
      onclick: () => modificaZiCafea(data, zi => ({ ...zi, cafele: zi.cafele.map(x => (x.id === c.id ? { ...x, baut: !baut, modificat: Date.now() } : x)) })) }),
  ]);
}

// ---------- Formularul (cafea în zi sau cafea zilnică) ----------
// data: ziua în care se adaugă. cafea: cafeaua din zi pe care o editezi. zilnica: cafeaua zilnică pe care o editezi.
function deschideCafea({ data = dataLocala(), cafea = null, zilnica = null } = {}) {
  const zilnicaNoua = Boolean(zilnica && !zilnica.valori);
  const sursa = cafea || (zilnicaNoua ? null : zilnica);
  let stare = sursa ? { tip: sursa.tip, cantitate: sursa.cantitate, lapte: sursa.lapte, lapteMl: sursa.lapteMl, zaharG: sursa.zaharG }
    : { ...PRESETURI_CAFEA[0] };
  let numeAtins = Boolean(sursa);
  const nume = el('input', { type: 'text', maxlength: '60', value: sursa ? sursa.nume : PRESETURI_CAFEA[0].nume, 'aria-label': 'Numele cafelei' });
  nume.addEventListener('input', () => { numeAtins = true; });
  const selectTip = el('select', { 'aria-label': 'Felul cafelei' }, TIPURI_CAFEA.map(t => el('option', { value: t.id, text: t.nume })));
  const cantitate = el('input', { type: 'number', inputmode: 'decimal', min: '1', step: '1', class: 'cafea-cantitate', 'aria-label': 'Cantitatea de cafea' });
  const unitate = el('span', { class: 'nota' });
  const selectLapte = el('select', { 'aria-label': 'Lapte' }, [el('option', { value: '', text: 'Fără lapte' }), ...LAPTE_CAFEA.map(l => el('option', { value: l.id, text: l.nume }))]);
  const lapteMl = el('input', { type: 'number', inputmode: 'decimal', min: '0', max: '1000', step: '10', 'aria-label': 'Mililitri de lapte' });
  const zahar = el('input', { type: 'number', inputmode: 'decimal', min: '0', max: '100', step: '1', 'aria-label': 'Grame de zahăr' });
  const ora = el('input', { type: 'time', 'aria-label': 'Ora (opțional)', value: sursa && sursa.ora ? sursa.ora : '' });
  const repeta = el('input', { type: 'checkbox', role: 'switch' });
  const previzualizare = el('div', { class: 'cafea-previzualizare', 'aria-live': 'polite' });
  const randLapte = el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Lapte (ml)' }), lapteMl]);

  const umple = () => {
    selectTip.value = stare.tip;
    cantitate.value = String(stare.cantitate);
    selectLapte.value = stare.lapte || '';
    lapteMl.value = String(stare.lapteMl || 0);
    zahar.value = String(stare.zaharG || 0);
  };
  const citeste = () => {
    const n = v => parseFloat(String(v).replace(',', '.'));
    stare = { tip: selectTip.value, cantitate: n(cantitate.value), lapte: selectLapte.value || null, lapteMl: n(lapteMl.value) || 0, zaharG: n(zahar.value) || 0 };
  };
  const actualizeaza = () => {
    citeste();
    const t = tipCafea(stare.tip);
    unitate.textContent = t ? (t.unitate === 'g' ? 'g de praf' : 'ml') : '';
    cantitate.max = t ? String(t.max) : '';
    randLapte.hidden = !stare.lapte;
    if (!numeAtins) nume.value = numeImplicitCafea(stare);
    try {
      const c = cafeaDinCompozitie({ ...stare, nume: nume.value }, indexNutritie);
      previzualizare.replaceChildren(
        el('div', { class: 'cafea-prev-mare' }, [el('strong', { text: `${c.cofeina} mg` }), el('span', { text: ' cofeină' })]),
        el('p', { class: 'nota', text: `${fmtNr(c.valori.kcal)} kcal · P ${fmtMl(c.valori.proteine)} g · C ${fmtMl(c.valori.carbohidrati)} g · G ${fmtMl(c.valori.grasimi)} g` }),
        c.cofeina > DOZA_COFEINA_UNICA ? el('p', { class: 'nota nota-mica cafea-atentie', text: `Peste ${DOZA_COFEINA_UNICA} mg într-o singură cafea.` }) : null,
      );
    } catch (err) {
      previzualizare.replaceChildren(el('p', { class: 'nota cafea-atentie', text: err.message }));
    }
  };
  for (const x of [selectTip, cantitate, selectLapte, lapteMl, zahar]) x.addEventListener('input', actualizeaza);
  selectTip.addEventListener('change', () => {
    const t = tipCafea(selectTip.value);
    if (t) cantitate.value = String(t.implicit);
    actualizeaza();
  });
  selectLapte.addEventListener('change', () => {
    if (selectLapte.value && !(parseFloat(lapteMl.value) > 0)) lapteMl.value = '50';
    actualizeaza();
  });

  const preseturi = el('div', { class: 'chipuri chipuri-defilare' }, PRESETURI_CAFEA.map(p => el('button', {
    type: 'button', class: 'chip chip-mic', text: p.nume,
    onclick: () => { stare = { tip: p.tip, cantitate: p.cantitate, lapte: p.lapte, lapteMl: p.lapteMl, zaharG: stare.zaharG || 0 }; umple(); nume.value = p.nume; numeAtins = true; actualizeaza(); },
  })));
  const zaharRapid = el('div', { class: 'chipuri chipuri-mici cafea-zahar-rapid' }, [0, 5, 10].map(g => el('button', {
    type: 'button', class: 'chip chip-mic', text: g ? `${g} g` : 'Fără',
    onclick: () => { zahar.value = String(g); actualizeaza(); },
  })));
  umple();
  actualizeaza();

  const eZilnica = Boolean(zilnica);
  const titlu = eZilnica ? 'Cafeaua zilnică' : cafea ? cafea.nume : 'Adaugă o cafea';
  const d = deschideDialog({
    titlu,
    continut: el('div', { class: 'formular' }, [
      sursa ? null : preseturi,
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Fel' }), selectTip]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Cantitate' }), el('span', { class: 'camp-grame' }, [cantitate, unitate])]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Lapte' }), selectLapte]),
      randLapte,
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Zahăr (g)' }), zahar]),
      zaharRapid,
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Nume' }), nume]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Ora (opțional)' }), ora]),
      previzualizare,
      !sursa && !zilnica ? el('label', { class: 'rand aliniat comutator' }, [el('span', { text: 'Cafea zilnică (apare singură în fiecare zi)' }), repeta]) : null,
      cafea && cafea.idZilnica ? el('p', { class: 'nota nota-mica', text: 'E cafeaua ta zilnică: schimbarea se aplică doar zilei acesteia. Pentru toate zilele, editeaz-o din „Cafeaua zilnică”.' }) : null,
      eZilnica ? el('p', { class: 'nota nota-mica', text: zilnicaNoua ? 'Apare singură în fiecare zi, începând de azi.' : 'Schimbarea se aplică de azi înainte. Zilele trecute rămân cum au fost.' }) : null,
      el('p', { class: 'nota nota-mica', text: 'Valori din USDA (cafea, lapte, zahăr); cofeina din USDA FoodData Central. Cofeina reală variază cu boabele și prepararea.' }),
      cafea ? el('div', { class: 'rand-butoane mt' }, [
        buton({ text: cafea.idZilnica ? 'Scoate din ziua aceasta' : 'Șterge', icon: 'cos', tip: 'fantoma', mic: true, onclick: () => d.inchide(() => scoateCafea(data, cafea)) }),
      ]) : null,
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        citeste();
        let c;
        try { c = cafeaDinCompozitie({ ...stare, nume: nume.value, ora: ora.value }, indexNutritie); } catch (err) { notifica(err.message, 'eroare'); return; }
        d.inchide();
        if (eZilnica) { await salveazaCafeaZilnica({ ...zilnica, ...c, ora: c.ora }); return; }
        if (cafea) {
          const noua = { ...cafea, ...c, modificat: Date.now() };
          if (!c.ora) delete noua.ora;
          await modificaZiCafea(data, zi => ({ ...zi, cafele: ordoneazaCafele(zi.cafele.map(x => (x.id === cafea.id ? noua : x))) }));
          return;
        }
        if (repeta.checked) {
          await salveazaCafeaZilnica({ id: idCafeaZilnicaNou(), ...c, dela: data < dataLocala() ? dataLocala() : data, activ: true }, data);
          return;
        }
        const noua = { id: idNutritieNou(), ...c, baut: data <= dataLocala(), adaugat: Date.now() };
        if (await modificaZiCafea(data, zi => ({ ...zi, cafele: ordoneazaCafele([...(zi.cafele || []), noua]) }))) {
          notifica(`${noua.nume} adăugată (${noua.cofeina} mg cofeină).`, 'succes');
        }
      } }),
    ],
  });
}

function idCafeaZilnicaNou() { return `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

async function scoateCafea(data, c) {
  const inainte = await citesteZiNutritie(data);
  if (!(await modificaZiCafea(data, zi => scoateCafeaDinZi(zi, c.id)))) return;
  notifica(c.idZilnica ? `${c.nume} a fost scoasă doar din ziua aceasta.` : `${c.nume} a fost ștearsă.`, 'info', 6000, {
    text: 'Anulează', onclick: () => modificaZiCafea(data, () => inainte),
  });
}

// ---------- Cafeaua zilnică ----------
// Înainte de orice schimbare a cafelei zilnice, zilele de până azi primesc cafeaua în bază,
// ca istoricul (analiza, totalurile) să nu se schimbe retroactiv.
let cafeaCompletataPentru = '';
async function completeazaCafeleZilnice({ fortat = false } = {}) {
  const zilnice = setari.cafeleZilnice || [];
  const azi = dataLocala();
  const cheie = `${azi}|${JSON.stringify(zilnice)}`;
  if (!fortat && cafeaCompletataPentru === cheie) return 0;
  let scrise = 0;
  for (const data of zileDeCompletatCafea(zilnice, azi)) {
    const salvata = await citesteZiNutritieSalvata(data);
    const { zi, schimbat } = aplicaCafeleZilnice(salvata || { data, mese: [] }, zilnice);
    if (schimbat) { await salveazaZiNutritie(zi); scrise++; }
  }
  cafeaCompletataPentru = cheie;
  return scrise;
}

async function salveazaCafeaZilnica(z, dataAdaugare = null) {
  const curata = curataCafeaZilnica(z);
  if (!curata) { notifica('Cafeaua zilnică nu e validă.', 'eroare'); return; }
  try {
    await completeazaCafeleZilnice({ fortat: true });
    const lista = setari.cafeleZilnice || [];
    const exista = lista.some(x => x.id === curata.id);
    const azi = dataLocala();
    if (exista) {
      // De azi înainte cu noile valori: scoatem din azi versiunea veche (dacă nu e editată de mână), restul zilelor o primesc din nou.
      setari.cafeleZilnice = lista.map(x => (x.id === curata.id ? curata : x));
      const ziAzi = await citesteZiNutritieSalvata(azi);
      if (ziAzi && ziAzi.cafele) {
        const id = idCafeaZilnica(curata.id, azi);
        const veche = ziAzi.cafele.find(c => c.id === id);
        if (veche && !veche.modificat) await salveazaZiNutritie({ ...ziAzi, cafele: ziAzi.cafele.filter(c => c.id !== id) });
      }
    } else {
      setari.cafeleZilnice = [...lista, curata];
    }
    salveazaSetari();
    await completeazaCafeleZilnice({ fortat: true });
    await redeseneazaDupaCafea();
    notifica(exista ? `${curata.nume}: cafeaua zilnică a fost actualizată.`
      : `${curata.nume} apare de acum în fiecare zi${dataAdaugare && dataAdaugare > azi ? ` începând cu ${afiseazaData(curata.dela)}` : ''}.`, 'succes');
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Cafeaua zilnică nu a putut fi salvată.'), 'eroare');
  }
}

async function opresteCafeaZilnica(z, { sterge = false } = {}) {
  try {
    await completeazaCafeleZilnice({ fortat: true });
    setari.cafeleZilnice = sterge
      ? (setari.cafeleZilnice || []).filter(x => x.id !== z.id)
      : (setari.cafeleZilnice || []).map(x => (x.id === z.id ? { ...x, activ: !x.activ, dela: x.activ ? x.dela : dataLocala() } : x));
    salveazaSetari();
    if (!sterge && !z.activ) await completeazaCafeleZilnice({ fortat: true });
    await redeseneazaDupaCafea();
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Schimbarea nu a putut fi salvată.'), 'eroare');
  }
}

function deschideCafeleZilnice() {
  const lista = el('ul', { class: 'cafea-lista' });
  const limita = el('input', { type: 'number', inputmode: 'numeric', min: '50', max: '1000', step: '10', value: String(limitaCofeinaMea()), 'aria-label': 'Limita de cofeină pe zi (mg)' });
  const deseneaza = () => {
    const zilnice = setari.cafeleZilnice || [];
    lista.replaceChildren(...(zilnice.length ? zilnice.map(z => el('li', { class: 'cafea-rand' + (z.activ ? ' baut' : ' oprita') }, [
      el('button', { type: 'button', class: 'cafea-principal', onclick: () => d.inchide(() => deschideCafea({ zilnica: z })), 'aria-label': `${z.nume}. Editează` }, [
        el('span', { class: 'cafea-icon' }, [iconita('cafea')]),
        el('span', { class: 'cafea-text' }, [
          el('strong', { text: z.nume }),
          el('span', { class: 'nota', text: `${z.ora ? `${z.ora} · ` : ''}${textCompozitieCafea(z)} · ${z.activ ? `din ${afiseazaData(z.dela)}` : 'oprită'}` }),
        ]),
        el('span', { class: 'cafea-cifre' }, [el('b', { text: `${z.cofeina} mg` }), el('span', { class: 'nota', text: `${fmtNr(z.valori.kcal)} kcal` })]),
      ]),
      el('div', { class: 'rand-butoane' }, [
        buton({ text: z.activ ? 'Oprește' : 'Pornește', tip: 'fantoma', mic: true, onclick: async () => { await opresteCafeaZilnica(z); deseneaza(); } }),
        buton({ icon: 'cos', tip: 'fantoma', mic: true, eticheta: `Șterge ${z.nume}`, onclick: async () => {
          const da = await confirma({ titlu: 'Ștergi cafeaua zilnică?', ok: 'Șterge', pericol: true,
            text: `${z.nume} nu mai apare în zilele de acum înainte. Zilele trecute își păstrează cafeaua.` });
          if (da) { await opresteCafeaZilnica(z, { sterge: true }); }
          deschideCafeleZilnice();
        } }),
      ]),
    ])) : [el('li', { class: 'nota', text: 'Nu ai încă nicio cafea zilnică.' })]));
  };
  deseneaza();
  const d = deschideDialog({
    titlu: 'Cafeaua zilnică',
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: 'Cafeaua zilnică apare singură în fiecare zi, de la data la care o pornești, și intră în calorii și cofeină. Dacă într-o zi n-o bei, scoate-o din ziua aceea.' }),
      lista,
      buton({ text: 'Adaugă o cafea zilnică', icon: 'plus', tip: 'secundar', mic: true, lat: true, onclick: () => d.inchide(() => deschideCafea({ data: dataLocala(), zilnica: { id: idCafeaZilnicaNou(), ...PRESETURI_CAFEA[0], valori: null, cofeina: 0, dela: dataLocala(), activ: true, nume: PRESETURI_CAFEA[0].nume } })) }),
      el('label', { class: 'camp mt' }, [el('span', { class: 'camp-eticheta', text: 'Limita ta de cofeină pe zi (mg)' }), limita]),
      el('p', { class: 'nota nota-mica', text: `Implicit ${LIMITA_COFEINA_ZI} mg: EFSA (2015) consideră că până la ${LIMITA_COFEINA_ZI} mg pe zi și până la ${DOZA_COFEINA_UNICA} mg într-o doză nu ridică probleme pentru adulții sănătoși; în sarcină, până la 200 mg pe zi. Nu e un sfat medical.` }),
    ]),
    butoane: [
      buton({ text: 'Gata', tip: 'principal', onclick: () => {
        const v = parseInt(limita.value, 10);
        if (v >= 50 && v <= 1000) { if (v !== setari.limitaCofeina) { setari.limitaCofeina = v; salveazaSetari(); } }
        else { notifica('Limita trebuie să fie între 50 și 1000 mg.', 'eroare'); return; }
        d.inchide(() => redeseneazaDupaCafea());
      } }),
    ],
  });
}

// ---------- Cardul de pe Acasă (MEAL PREP) ----------
function cardCafeaAcasa(zi) {
  const t = totalCafeaZi(zi);
  const limita = limitaCofeinaMea();
  const nebaute = (zi.cafele || []).filter(c => !cafeaBauta(c, zi.data));
  const av = avertizariCofeina(t, limita);
  return el('section', { class: 'card card-cafea-acasa', 'aria-label': 'Cafea azi' }, [
    el('div', { class: 'card-cap' }, [
      el('h2', {}, [iconita('cafea', 'iconita iconita-titlu'), 'Cafea azi']),
      buton({ text: 'Adaugă', icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Adaugă o cafea azi', onclick: () => deschideCafea({ data: zi.data }) }),
    ]),
    el('div', { class: 'cafea-cofeina' }, [
      el('div', { class: 'cafea-cofeina-text' }, [
        el('strong', { class: t.cofeina > limita ? 'peste' : '', text: `${t.cofeina} mg` }),
        el('span', { text: ` din ${limita} mg · ${t.baute ? `${t.baute} ${t.baute === 1 ? 'cafea' : 'cafele'} · ${fmtNr(t.baut.kcal)} kcal` : 'nicio cafea încă'}` }),
      ]),
    ]),
    baraCofeina(t.cofeina, t.cofeinaPlan, limita),
    ...av.map(a => el('p', { class: `nota nota-mica cafea-avertizare cafea-${a.tip}` }, [iconita('avertizare', 'iconita-mica'), ' ', a.text])),
    nebaute.length ? el('div', { class: 'rand-butoane' }, nebaute.slice(0, 3).map(c => buton({ text: `Am băut: ${c.nume}`, icon: 'bifa', tip: 'fantoma', mic: true,
      onclick: () => modificaZiCafea(zi.data, z => ({ ...z, cafele: z.cafele.map(x => (x.id === c.id ? { ...x, baut: true, modificat: Date.now() } : x)) })) }))) : null,
  ]);
}
