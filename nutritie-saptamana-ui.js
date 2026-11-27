// Nutriție → fila „Săptămâna” (etapa 8): cele 7 zile (luni–duminică), totaluri pe săptămână, generarea săptămânii
// sau a unei zile, copierea meselor și a zilelor, săptămânile salvate.
// Zilele trecute nu se generează și nu primesc copii (istoricul nu se schimbă). Acțiunile pe o masă folosesc
// funcțiile din fila „Ziua mea” (nutritie-zi-ui.js), după ce ziua respectivă e încărcată.

let dataSaptamana = dataLocala();
let zileSapt = {}; // data → zi

const ZILE_SCURT = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum'];
const ZILE_LUNG = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const LUNI_ANULUI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

function zileCurente() { return zileSaptamana(dataSaptamana); }
function esteTrecuta(data) { return data < dataLocala(); }
function ziSapt(data) { return zileSapt[data] || { data, mese: [] }; }

function titluSaptamana(zile) {
  const [a1, l1, z1] = zile[0].split('-').map(Number);
  const [a2, l2, z2] = zile[6].split('-').map(Number);
  if (l1 === l2) return `${z1}–${z2} ${LUNI_ANULUI[l1 - 1]}`;
  return `${z1} ${LUNI_ANULUI[l1 - 1].slice(0, 3)} – ${z2} ${LUNI_ANULUI[l2 - 1].slice(0, 3)}${a1 !== a2 ? ` ${a2}` : ''}`;
}

async function incarcaSaptamana() {
  const zile = zileCurente();
  const rez = {};
  try {
    for (const d of zile) rez[d] = await citesteZiNutritie(d);
  } catch (err) {
    console.error(err);
    notifica('Zilele săptămânii nu au putut fi citite.', 'eroare');
  }
  zileSapt = rez;
  await reincarcaPlanurile();
}

let randareSaptInCurs = null;
async function randeazaSaptamana() {
  // Randări suprapuse (ex. după o acțiune) se unesc: ultima câștigă.
  const token = {};
  randareSaptInCurs = token;
  await incarcaSaptamana();
  if (randareSaptInCurs !== token) return;
  deseneazaNavSapt();
  deseneazaSumarSapt();
  deseneazaActiuniSapt();
  deseneazaZileSapt();
}

// ---------- Navigare ----------
function deseneazaNavSapt() {
  const zile = zileCurente();
  const curenta = zile.includes(dataLocala());
  const muta = async delta => { dataSaptamana = mutaData(dataSaptamana, 7 * delta); await randeazaSaptamana(); };
  $('sapt-nav').replaceChildren(...[
    buton({ icon: 'sageata', tip: 'fantoma', mic: true, clasa: 'zi-inapoi', eticheta: 'Săptămâna anterioară', onclick: () => muta(-1) }),
    el('div', { class: 'zi-titlu' }, [
      el('strong', { text: curenta ? 'Săptămâna aceasta' : titluSaptamana(zile) }),
      el('span', { class: 'nota', text: curenta ? titluSaptamana(zile) : `${afiseazaData(zile[0])} – ${afiseazaData(zile[6])}` }),
    ]),
    curenta ? null : buton({ text: 'Acum', tip: 'secundar', mic: true, onclick: async () => { dataSaptamana = dataLocala(); await randeazaSaptamana(); } }),
    buton({ icon: 'sageata', tip: 'fantoma', mic: true, eticheta: 'Săptămâna următoare', onclick: () => muta(1) }),
  ].filter(Boolean));
}

// ---------- Totaluri ----------
function deseneazaSumarSapt() {
  const zile = zileCurente();
  const tinte = setari.tinteNutritie;
  const t = totaluriSaptamana(zile.map(ziSapt), tinte);
  const copii = [titluCard('Totaluri pe săptămână')];
  if (!t.zileCuMese) {
    copii.push(el('p', { class: 'nota', text: 'Săptămâna nu are încă mese planificate. Generează săptămâna sau adaugă mese zi cu zi.' }));
    $('sapt-sumar').replaceChildren(...copii);
    return;
  }
  copii.push(el('div', { class: 'placute placute-nutri' }, [
    placuta('Planificat', fmtNr(t.planificat.kcal), `kcal în ${plural(t.zileCuMese, 'zi', 'zile')}`),
    placuta('Medie pe zi', fmtNr(t.mediePlanificat.kcal), tinte ? `țintă ${fmtNr(tinte.kcal)}` : 'kcal'),
    placuta('Mâncat', fmtNr(t.mancat.kcal), `kcal · ${t.terminate}/${t.intrari} mese`),
  ]));
  const NUME = { proteine: 'Proteine', carbohidrati: 'Carbo', grasimi: 'Grăsimi', fibre: 'Fibre' };
  const TOL = { proteine: 10, carbohidrati: 15, grasimi: 10, fibre: 5 };
  copii.push(el('p', { class: 'sectiune-eticheta mt', text: 'Media zilnică planificată' }));
  copii.push(el('div', { class: 'raport-abateri' }, [
    (() => {
      const ok = tinte ? Math.abs(t.mediePlanificat.kcal - tinte.kcal) <= tinte.kcal * 0.1 : null;
      return el('span', { class: 'raport-abatere' + (ok === false ? '' : ' in-tinta') }, [el('i', { text: ok === false ? '!' : ok ? '✓' : '·' }),
        `Calorii ${fmtNr(t.mediePlanificat.kcal)}${tinte ? `/${fmtNr(tinte.kcal)}` : ''}`]);
    })(),
    ...Object.keys(NUME).map(c => {
      const tg = tinte && tinte[c];
      const ok = tg ? Math.abs(t.mediePlanificat[c] - tg) <= TOL[c] : null;
      return el('span', { class: 'raport-abatere' + (ok === false ? '' : ' in-tinta') }, [el('i', { text: ok === false ? '!' : ok ? '✓' : '·' }),
        `${NUME[c]} ${fmtNr(t.mediePlanificat[c])}${tg ? `/${tg}` : ''} g`]);
    }),
  ]));
  copii.push(el('p', { class: 'nota nota-mica', text: `${plural(t.reteteDiferite, 'rețetă diferită', 'rețete diferite')}${t.reteteRepetate ? `, ${plural(t.reteteRepetate, 'se repetă', 'se repetă')}` : ', fără repetări'}. Media se calculează pe zilele cu mese.` }));
  $('sapt-sumar').replaceChildren(...copii);
}

// ---------- Acțiuni pe săptămână ----------
function datePentruGenerare() {
  return zileCurente().filter(d => !esteTrecuta(d));
}

function deseneazaActiuniSapt() {
  const viitoare = datePentruGenerare();
  $('sapt-actiuni').replaceChildren(...[
    buton({ text: 'Generează săptămâna', icon: 'zar', tip: 'principal', lat: true, clasa: 'btn-mare', onclick: genereazaSaptamanaUI }),
    el('p', { class: 'nota nota-mica', text: viitoare.length
      ? `Generează ${viitoare.length === 7 ? 'toate cele 7 zile' : `${plural(viitoare.length, 'zi rămasă', 'zile rămase')} (de azi încolo)`} cu aceleași ținte și preferințe ca ziua, evitând repetările de la o zi la alta. Mesele blocate sau începute rămân.`
      : 'Săptămâna a trecut: zilele ei rămân cum le-ai notat. Poți salva săptămâna ca plan sau o poți copia într-o săptămână viitoare.' }),
    el('button', { type: 'button', class: 'preferinte-rezumat', onclick: deschidePreferinteGenerator }, [iconita('filtru'), el('span', { text: textPreferinte() }), el('b', { text: 'Preferințe' })]),
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Copiază săpt. trecută', icon: 'copiaza', tip: 'secundar', mic: true, onclick: copiazaSaptamanaTrecuta }),
      buton({ text: 'Cumpărături', icon: 'lista', tip: 'secundar', mic: true, eticheta: 'Lista de cumpărături pentru săptămâna afișată', onclick: () => {
        const z = zileCurente();
        perioadaLista = z.includes(dataLocala()) ? 'restul' : z[0] === zileSaptamana(mutaData(dataLocala(), 7))[0] ? 'urmatoare' : 'restul';
        arataFilaNutritie('lista');
      } }),
    ]),
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Salvează', icon: 'descarca', tip: 'secundar', mic: true, eticheta: 'Salvează săptămâna', onclick: deschideSalvareSaptamana }),
      buton({ text: `Salvate${planuriSaptamani.length ? ` (${planuriSaptamani.length})` : ''}`, icon: 'lista', tip: 'secundar', mic: true,
        eticheta: `Săptămânile salvate${planuriSaptamani.length ? ` (${planuriSaptamani.length})` : ''}`, onclick: deschideSaptamaniSalvate }),
    ]),
  ]);
}

async function salveazaZileSapt(zileNoi) {
  for (const zi of Object.values(zileNoi)) await salveazaZiNutritie(zi);
}

// Anularea unei operații pe mai multe zile: rescrie zilele cum erau.
function notificaCuAnulare(text, inainte, tip = 'succes') {
  notifica(text, tip, 6000, { text: 'Anulează', onclick: async () => {
    try { await salveazaZileSapt(inainte); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut anula.'), 'eroare'); return; }
    await randeazaSaptamana();
  } });
}

async function confirmaInlocuireZile(date, text) {
  const deInlocuit = date.reduce((s, d) => s + ziSapt(d).mese.filter(intrareModificabila).length, 0);
  if (!deInlocuit) return true;
  return confirma({ titlu: text, ok: 'Continuă',
    text: `${plural(deInlocuit, 'rețetă neîncepută și neblocată va fi înlocuită', 'rețete neîncepute și neblocate vor fi înlocuite')}. Mesele blocate sau începute rămân. Poți anula imediat după.` });
}

async function genereazaZileSapt(date, titluConfirmare) {
  if (!date.length) { notifica('Zilele trecute nu se generează: istoricul rămâne cum l-ai notat.', 'eroare'); return; }
  if (!(await confirmaInlocuireZile(date, titluConfirmare))) return;
  const toate = zileCurente();
  // pentru repetări contează și ultimele 2 zile dinaintea săptămânii
  const existente = { ...zileSapt };
  for (const k of [1, 2]) { const d = mutaData(toate[0], -k); try { existente[d] = await citesteZiNutritie(d); } catch (_) { /* fără */ } }
  const inainte = Object.fromEntries(date.map(d => [d, ziSapt(d)]));
  $('sapt-actiuni').classList.add('se-genereaza');
  await new Promise(r => setTimeout(r, 30)); // lasă interfața să arate starea de încărcare
  let rez;
  try {
    rez = genereazaSaptamana({ date, zileExistente: existente, retete: toateRetetele(), idx: indexNutritie, tinte: setari.tinteNutritie,
      scop: setari.scopNutritie || 'mentinere', pref: prefNutritie(), preferateReteta: new Set(setari.retetePreferate || []), idNou: idNutritieNou });
    await salveazaZileSapt(Object.fromEntries(date.map(d => [d, rez.zile[d]])));
  } catch (err) {
    console.error(err);
    $('sapt-actiuni').classList.remove('se-genereaza');
    notifica(mesajEroareSalvare(err, 'Săptămâna nu a putut fi generată.'), 'eroare');
    return;
  }
  $('sapt-actiuni').classList.remove('se-genereaza');
  raporteSapt = rez.rapoarte;
  await randeazaSaptamana();
  const goale = Object.values(rez.rapoarte).filter(r => r.mesaje.some(m => m.tip === 'eroare')).length;
  const inafara = Object.values(rez.rapoarte).filter(r => r.abateri.length && !r.inTinta).length;
  notificaCuAnulare(goale ? `Generat, dar în ${plural(goale, 'zi', 'zile')} unele mese au rămas goale (vezi ziua).`
    : inafara ? `Generat. ${plural(inafara, 'zi nu atinge', 'zile nu ating')} toate țintele (vezi ziua).` : `${date.length === 1 ? 'Ziua a fost generată' : `${date.length} zile generate`}.`,
  inainte, goale ? 'eroare' : 'succes');
}
let raporteSapt = {};

function genereazaSaptamanaUI() { return genereazaZileSapt(datePentruGenerare(), 'Generezi săptămâna?'); }

async function copiazaSaptamanaTrecuta() {
  const zile = zileCurente();
  const trecute = zileSaptamana(mutaData(zile[0], -7));
  const surse = [];
  for (const d of trecute) surse.push(await citesteZiNutritie(d));
  if (!surse.some(z => z.mese.length)) { notifica('Săptămâna trecută nu are mese de copiat.', 'eroare'); return; }
  const tinte = zile.map((d, k) => [d, surse[k]]).filter(([d, s]) => !esteTrecuta(d) && s.mese.length);
  if (!tinte.length) { notifica('Zilele acestei săptămâni au trecut; copiază într-o săptămână viitoare.', 'eroare'); return; }
  await aplicaPlanuriInZile(tinte.map(([d, s]) => [d, planDinZi(s, { id: 'x', nume: 'x' })]), 'Copiezi săptămâna trecută?',
    n => `${plural(n, 'zi copiată', 'zile copiate')} din săptămâna trecută.`);
}

// perechi: [[data, plan de o zi]]
async function aplicaPlanuriInZile(perechi, titlu, mesaj) {
  if (!(await confirmaInlocuireZile(perechi.map(([d]) => d), titlu))) return;
  const inainte = {}, noi = {};
  const sarite = [];
  for (const [d, plan] of perechi) {
    const zi = zileSapt[d] || await citesteZiNutritie(d);
    inainte[d] = zi;
    const rez = aplicaPlan({ zi, plan, idNou: idNutritieNou });
    noi[d] = { ...zi, mese: rez.mese };
    if (rez.sarite.length) sarite.push(d);
  }
  try { await salveazaZileSapt(noi); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut salva.'), 'eroare'); return; }
  await randeazaSaptamana();
  notificaCuAnulare(mesaj(perechi.length) + (sarite.length ? ` Mesele blocate sau începute din ${plural(sarite.length, 'zi', 'zile')} au rămas.` : ''), inainte);
}

function deschideSalvareSaptamana() {
  const zile = zileCurente();
  if (!zile.some(d => ziSapt(d).mese.length)) { notifica('Săptămâna nu are mese. Generează sau adaugă mese, apoi salvează.', 'eroare'); return; }
  const input = el('input', { type: 'text', maxlength: '60', value: `Săptămâna ${titluSaptamana(zile)}`, 'aria-label': 'Numele săptămânii' });
  const fav = el('input', { type: 'checkbox', role: 'switch' });
  const t = totaluriSaptamana(zile.map(ziSapt), setari.tinteNutritie);
  const d = deschideDialog({
    titlu: 'Salvează săptămâna',
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: `${plural(t.intrari, 'rețetă', 'rețete')} în ${plural(t.zileCuMese, 'zi', 'zile')} · medie ${fmtNr(t.mediePlanificat.kcal)} kcal/zi. Se salvează rețetele, porțiile și cantitățile, fără stări.` }),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Nume' }), input]),
      el('label', { class: 'rand aliniat comutator' }, [el('span', { text: 'Săptămână favorită (apare prima)' }), fav]),
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        const nume = input.value.trim();
        if (!nume) { notifica('Scrie un nume.', 'eroare'); input.focus(); return; }
        const plan = planSaptamanaDinZile(zile.map(ziSapt), { id: idNutritieNou(), nume, favorit: fav.checked });
        try { await salveazaPlanNutritie(plan); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut salva.'), 'eroare'); return; }
        d.inchide();
        await reincarcaPlanurile();
        deseneazaActiuniSapt();
        notifica(`Săptămână salvată: ${nume}.`, 'succes');
      } }),
    ],
  });
}

async function deschideSaptamaniSalvate() {
  await reincarcaPlanurile();
  const lista = el('div', { class: 'lista-planuri' });
  const deseneaza = () => {
    if (!planuriSaptamani.length) {
      lista.replaceChildren(el('p', { class: 'nota', text: 'Nu ai săptămâni salvate. Planifică o săptămână, apoi apasă „Salvează săptămâna”.' }));
      return;
    }
    lista.replaceChildren(...planuriSaptamani.map(p => {
      const t = totaluriSaptamana(p.zile.map(mese => ({ mese: mese.map(m => ({ ...m, stare: 'neinceput' })) })), null);
      return el('article', { class: 'plan-salvat' }, [
        el('div', { class: 'plan-cap' }, [
          el('strong', { text: p.nume }),
          el('button', { type: 'button', class: 'btn btn-fantoma btn-icon btn-mic favorit' + (p.favorit ? ' activ' : ''), 'aria-pressed': String(p.favorit),
            'aria-label': p.favorit ? `Scoate ${p.nume} de la favorite` : `Marchează ${p.nume} ca favorit`, onclick: async () => {
              try { await salveazaPlanNutritie({ ...p, favorit: !p.favorit, modificat: Date.now() }); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut salva.'), 'eroare'); return; }
              await reincarcaPlanurile(); deseneaza();
            } }, [iconita('stea')]),
        ]),
        el('span', { class: 'nota', text: `${plural(t.zileCuMese, 'zi', 'zile')} cu mese · medie ${fmtNr(t.mediePlanificat.kcal)} kcal · P ${fmtNr(t.mediePlanificat.proteine)} g pe zi` }),
        el('ul', { class: 'plan-mese' }, p.zile.map((mese, k) => el('li', {}, [el('span', { class: 'nota', text: ZILE_LUNG[k] }),
          el('span', { text: mese.length ? `${mese.length} rețete · ${fmtNr(mese.reduce((s, m) => s + m.valoriPortie.kcal * m.portii, 0))} kcal` : '—' })]))),
        el('div', { class: 'rand-butoane' }, [
          buton({ text: 'Încarcă în săptămâna afișată', tip: 'principal', mic: true, onclick: () => d.inchide(() => incarcaSaptamanaSalvata(p)) }),
          buton({ icon: 'cos', tip: 'fantoma', mic: true, eticheta: `Șterge ${p.nume}`, onclick: async () => {
            let idCos;
            try { idCos = await stergePlanNutritie(p.id, p.nume); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut șterge.'), 'eroare'); return; }
            await reincarcaPlanurile(); deseneaza(); deseneazaActiuniSapt();
            notificaStergere(`„${p.nume}” a fost ștearsă.`, idCos, async () => { await reincarcaPlanurile(); deseneazaActiuniSapt(); });
          } }),
        ]),
      ]);
    }));
  };
  deseneaza();
  const d = deschideDialog({ titlu: 'Săptămâni salvate', continut: lista, butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })] });
}

async function incarcaSaptamanaSalvata(p) {
  const zile = zileCurente();
  const perechi = zile.map((d, k) => [d, { mese: p.zile[k] }]).filter(([d, plan]) => !esteTrecuta(d) && plan.mese.length);
  if (!perechi.length) { notifica('Nu există zile de azi încolo în săptămâna afișată. Mergi la o săptămână viitoare.', 'eroare'); return; }
  const trecute = zile.filter(esteTrecuta).length;
  await aplicaPlanuriInZile(perechi, `Încarci „${p.nume}”?`,
    n => `${plural(n, 'zi încărcată', 'zile încărcate')}${trecute ? ` (zilele trecute au rămas neschimbate)` : ''}.`);
}

// ---------- Zilele ----------
function deseneazaZileSapt() {
  const azi = dataLocala();
  const tinte = setari.tinteNutritie;
  $('sapt-zile').replaceChildren(...zileCurente().map((data, k) => {
    const zi = ziSapt(data);
    const t = totaluriZi(zi);
    const trecuta = esteTrecuta(data);
    const [, l, z] = data.split('-').map(Number);
    const rap = raporteSapt[data];
    const mese = MESE_TOATE.filter(m => m.id !== 'alta' || zi.mese.some(i => i.masa === 'alta')).map(m => {
      const intrari = zi.mese.filter(i => i.masa === m.id);
      if (!intrari.length) return el('li', { class: 'sapt-masa goala' }, [el('span', { class: 'acasa-masa-nume', text: m.scurt }), el('span', { class: 'nota', text: '—' })]);
      return intrari.map(i => el('li', { class: `sapt-masa stare-${i.stare}` }, [
        el('span', { class: 'acasa-masa-nume', text: m.scurt }),
        el('button', { type: 'button', class: 'sapt-masa-btn', onclick: () => deschideMasaSapt(data, i), 'aria-label': `${m.nume}: ${i.nume}, ${fmtNr(valoriPlanificateIntrare(i).kcal)} kcal. Opțiuni` }, [
          i.blocat ? iconita('lacat', 'iconita mica') : null,
          el('span', { class: 'acasa-masa-reteta', text: i.nume }),
        ]),
        el('span', { class: 'acasa-masa-kcal', text: fmtNr(valoriPlanificateIntrare(i).kcal) }),
        el('i', { class: `sapt-stare stare-${i.stare}`, title: STARI_MASA.find(s => s.id === i.stare).nume }),
      ]));
    }).flat();
    return el('section', { class: 'card sapt-zi' + (data === azi ? ' azi' : '') + (trecuta ? ' trecuta' : ''), 'aria-label': `${ZILE_LUNG[k]} ${z} ${LUNI_ANULUI[l - 1]}` }, [
      t.numar ? el('button', { type: 'button', class: 'btn-sterge-rapid', 'aria-label': `Șterge toate felurile de mâncare din ${ZILE_LUNG[k].toLowerCase()}`, title: 'Golește ziua',
        onclick: () => golesteZiSapt(data, ZILE_LUNG[k]) }, [el('span', { 'aria-hidden': 'true', text: '−' })]) : null,
      el('div', { class: 'card-cap' }, [
        el('h2', {}, [`${ZILE_LUNG[k]} `, el('span', { class: 'nota', text: `${z} ${LUNI_ANULUI[l - 1].slice(0, 3)}` }), data === azi ? el('span', { class: 'eticheta-tip', text: 'azi' }) : null]),
        el('span', { class: 'nota sapt-kcal', text: t.numar ? `${fmtNr(t.planificat.kcal)}${tinte ? ` / ${fmtNr(tinte.kcal)}` : ''} kcal` : '' }),
      ]),
      t.numar && tinte ? baraDubla(t.mancat.kcal, t.planificat.kcal, tinte.kcal, 'nutri-c') : null,
      t.numar ? el('p', { class: 'nota nota-mica sapt-macro', text: `P ${fmtNr(t.planificat.proteine)} · C ${fmtNr(t.planificat.carbohidrati)} · G ${fmtNr(t.planificat.grasimi)} g${t.numar ? ` · mâncate ${t.terminate}/${t.numar}` : ''}` }) : null,
      rap && rap.mesaje.some(m => m.tip !== 'info') ? el('p', { class: 'nota nota-mica raport-avertizare', text: rap.mesaje.find(m => m.tip !== 'info').text }) : null,
      el('ul', { class: 'acasa-mese sapt-mese' }, mese),
      el('div', { class: 'rand-butoane' }, [
        trecuta ? null : buton({ text: t.numar ? 'Regenerează' : 'Generează', icon: 'zar', eticheta: t.numar ? `Generează din nou ${ZILE_LUNG[k].toLowerCase()}` : `Generează ${ZILE_LUNG[k].toLowerCase()}`, tip: 'secundar', mic: true, onclick: () => genereazaZileSapt([data], `Generezi ${ZILE_LUNG[k].toLowerCase()}?`) }),
        t.numar ? buton({ text: 'Copiază', icon: 'copiaza', tip: 'fantoma', mic: true, eticheta: `Copiază ${ZILE_LUNG[k].toLowerCase()} în altă zi`, onclick: () => copiazaZiua(data) }) : null,
        buton({ text: 'Deschide', tip: 'fantoma', mic: true, eticheta: `Deschide ${ZILE_LUNG[k].toLowerCase()} în Ziua mea`, onclick: () => { dataZiNutritie = data; arataFilaNutritie('zi'); } }),
      ].filter(Boolean)),
    ]);
  }));
}

// Golește o zi: șterge toate felurile de mâncare (cafelele rămân). Cu confirmare, apoi „Anulează” câteva secunde.
async function golesteZiSapt(data, numeZi) {
  const zi = ziSapt(data);
  const n = zi.mese.length;
  if (!n) return;
  const mancate = zi.mese.filter(i => i.stare !== 'neinceput').length;
  const ok = await confirma({
    titlu: `Golești ${numeZi.toLowerCase()}?`, ok: 'Șterge tot', pericol: true,
    text: `Se ${n === 1 ? 'șterge felul de mâncare' : `șterg toate cele ${numarDe(n)} feluri de mâncare`} din ${numeZi.toLowerCase()}${mancate ? `, inclusiv ${mancate === 1 ? (n === 1 ? 'deși e notat ca mâncat' : 'unul notat ca mâncat') : `${mancate} notate ca mâncate`}` : ''}. Cafelele rămân. Poți anula imediat după.`,
  });
  if (!ok) return;
  try { await salveazaZileSapt({ [data]: { ...zi, mese: [] } }); }
  catch (err) { notifica(mesajEroareSalvare(err, 'Ziua nu a putut fi golită.'), 'eroare'); return; }
  await randeazaSaptamana();
  notificaCuAnulare(`${numeZi}: ${plural(n, 'fel de mâncare șters', 'feluri de mâncare șterse')}.`, { [data]: zi }, 'info');
}

// Zilele în care se poate copia: din săptămâna afișată și cea următoare, de azi încolo, fără ziua sursă.
function zileDestinatie(exceptie) {
  const zile = [...zileCurente(), ...zileSaptamana(mutaData(zileCurente()[0], 7))];
  return zile.filter(d => !esteTrecuta(d) && d !== exceptie);
}

function alegeZiua(titlu, exceptie, laAlegere) {
  const lista = zileDestinatie(exceptie);
  if (!lista.length) { notifica('Nu există zile viitoare în care să copiezi.', 'eroare'); return; }
  const d = deschideDialog({
    titlu,
    continut: el('div', { class: 'chipuri alege-zi' }, lista.map(data => {
      const [a, l, z] = data.split('-').map(Number);
      const k = (new Date(a, l - 1, z).getDay() + 6) % 7;
      return el('button', { type: 'button', class: 'chip', text: `${data === dataLocala() ? 'Azi' : ZILE_SCURT[k]} ${z}.${String(l).padStart(2, '0')}`,
        onclick: () => d.inchide(() => laAlegere(data)) });
    })),
    butoane: [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() })],
  });
}

function copiazaZiua(data) {
  alegeZiua(`Copiază ziua de ${afiseazaData(data)} în…`, data, async tinta => {
    await aplicaPlanuriInZile([[tinta, planDinZi(ziSapt(data), { id: 'x', nume: 'x' })]], 'Copiezi ziua?', () => `Ziua a fost copiată în ${afiseazaData(tinta)}.`);
  });
}

async function copiazaMasa(data, i) {
  alegeZiua(`Copiază „${i.nume}” în…`, null, async tinta => {
    let zi;
    try { zi = await citesteZiNutritie(tinta); } catch (err) { notifica('Ziua nu a putut fi citită.', 'eroare'); return; }
    if (tinta === data || zi.mese.some(x => x.idReteta === i.idReteta)) {
      const da = await confirma({ titlu: 'Rețeta e deja în ziua aceea', text: 'O adaug totuși? Ziua va avea aceeași rețetă de două ori.', ok: 'Adaug' });
      if (!da) return;
    }
    const noua = { ...zi, mese: [...zi.mese, copiazaIntrarea(i, { id: idNutritieNou() })] };
    try { await salveazaZiNutritie(noua); } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut copia.'), 'eroare'); return; }
    await randeazaSaptamana();
    notificaCuAnulare(`${i.nume} copiată la ${numeMasa(i.masa).toLowerCase()}, ${afiseazaData(tinta)}.`, { [tinta]: zi });
  });
}

// Meniul unei mese din vederea săptămânii: aceleași acțiuni ca în Ziua mea.
async function deschideMasaSapt(data, i) {
  await incarcaZiNutritie(data);
  const curenta = ziNutritie.mese.find(x => x.id === i.id) || i;
  const modificabila = intrareModificabila(curenta);
  const v = valoriPlanificateIntrare(curenta);
  const d = deschideDialog({
    titlu: curenta.nume,
    continut: el('div', {}, [
      el('p', { class: 'nota', text: `${numeMasa(curenta.masa)}, ${afiseazaData(data)} · ${fmtPortii(curenta.portii)} · ${fmtNr(v.kcal)} kcal · P ${fmtNr(v.proteine)} g · ${STARI_MASA.find(s => s.id === curenta.stare).nume}${curenta.blocat ? ' · blocată' : ''}` }),
      el('div', { class: 'meniu-masa' }, [
        modificabila ? buton({ text: 'Înlocuiește cu una asemănătoare', icon: 'schimba', tip: 'secundar', lat: true, onclick: () => d.inchide(() => deschideInlocuire(curenta)) }) : null,
        modificabila ? buton({ text: 'Altă rețetă la întâmplare', icon: 'zar', tip: 'secundar', lat: true, onclick: () => d.inchide(() => regenereazaMasa(curenta)) }) : null,
        esteTrecuta(data) && !curenta.blocat ? null : buton({ text: curenta.blocat ? 'Deblochează' : 'Blochează (rămâne la generare)', icon: curenta.blocat ? 'lacat-deschis' : 'lacat', tip: 'secundar', lat: true,
          onclick: () => d.inchide(() => comutaBlocarea(curenta)) }),
        buton({ text: 'Copiază în altă zi', icon: 'copiaza', tip: 'secundar', lat: true, onclick: () => d.inchide(() => copiazaMasa(data, curenta)) }),
        buton({ text: 'Deschide ziua', icon: 'carte', tip: 'fantoma', lat: true, onclick: () => d.inchide(() => { dataZiNutritie = data; arataFilaNutritie('zi'); }) }),
        modificabila ? null : el('p', { class: 'nota nota-mica', text: curenta.blocat ? 'Masa e blocată: deblocheaz-o ca s-o poți schimba.' : 'Masa a fost mâncată (sau parțial), așa că nu se mai schimbă.' }),
      ]),
    ]),
    butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })],
  });
}
