// Acasă în MEAL PREP (Faza 1 din 3.0): ziua de azi pe scurt — calorii și macro față de ținte, următoarea masă,
// mesele zilei, săptămâna și scurtături. Totul vine din datele salvate (zileNutritie, setări, rețete, lista de cumpărături);
// fără ținte sau fără plan, cardurile arată ce ai de făcut, nu cifre inventate.

const numarKcal = v => Math.round(v).toLocaleString('ro-RO');


async function randeazaAcasaMasa() {
  const zona = $('masa-continut');
  if (!zona.childElementCount) zona.replaceChildren(stareIncarcare(3));
  const azi = dataLocala();
  const zile = zileSaptamana(azi);
  let ziAzi, zileSapt, deCumparat = null;
  try {
    await completeazaCafeleZilnice().catch(err => console.warn(err));
    zileSapt = await Promise.all(zile.map(d => citesteZiNutritie(d)));
    ziAzi = zileSapt[zile.indexOf(azi)];
    deCumparat = await articoleDeCumparat().catch(err => { console.warn(err); return null; });
  } catch (err) {
    console.error(err);
    zona.replaceChildren(stareGoala({ icon: 'avertizare', titlu: 'Datele nu au putut fi citite', text: 'Reîncarcă aplicația. Dacă problema persistă, restaurează un backup din Setări.' }));
    return;
  }
  if (ecranCurent !== 'ecran-masa') return;
  const tinte = setari.tinteNutritie;
  const carduri = [
    cardCaloriiMasa(ziAzi, tinte),
    cardScanareAcasa(),
    cardCafeaAcasa(ziAzi),
    cardUrmatoareaMasa(ziAzi),
    cardMeseleZilei(ziAzi),
    cardSaptamanaMasa(zile, zileSapt, tinte, azi),
    cardScurtaturiMasa(deCumparat),
    cardReteteRapide(),
  ].filter(Boolean);
  zona.replaceChildren(...carduri);
  for (const c of carduri) if (c.deseneaza) c.deseneaza();
}

// Câte articole mai ai de cumpărat pentru restul săptămânii (aceeași listă ca în fila Listă).
async function articoleDeCumparat() {
  const iv = intervalLista('restul');
  const zile = [];
  for (let d = iv.de; d <= iv.pana; d = mutaData(d, 1)) zile.push(await citesteZiNutritie(d));
  const stare = await citesteListaCumparaturi(iv.de, iv.pana);
  const l = construiesteLista({ zile, idx: indexNutritie, retete: toateRetetele(), stare });
  return { ramase: l.total - l.cumparate, total: l.total };
}

// el() din ui.js face elemente HTML; inelul e SVG, deci are nevoie de namespace.
function svgEl(tag, atribute = {}, copii = []) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(atribute)) e.setAttribute(k, v);
  for (const c of copii) e.append(c);
  return e;
}

function inelCalorii(mancat, planificat, tinta) {
  const R = 52, C = 2 * Math.PI * R;
  const frac = x => Math.max(0, Math.min(1, tinta > 0 ? x / tinta : 0));
  const arc = (clasa, f) => svgEl('circle', { class: clasa, cx: '60', cy: '60', r: String(R), 'stroke-dasharray': `${(C * f).toFixed(1)} ${C.toFixed(1)}`, transform: 'rotate(-90 60 60)' });
  return svgEl('svg', { class: 'inel-kcal', viewBox: '0 0 120 120', role: 'img', 'aria-label': `Mâncat ${numarKcal(mancat)} din ${numarKcal(tinta)} kcal` }, [
    svgEl('circle', { class: 'inel-fond', cx: '60', cy: '60', r: String(R) }),
    arc('inel-plan', frac(planificat)),
    arc('inel-mancat' + (mancat > tinta ? ' peste' : ''), frac(mancat)),
  ]);
}

function cardCaloriiMasa(zi, tinte) {
  const { planificat, mancat } = totaluriZi(zi);
  if (!tinte) {
    return el('div', { class: 'card masa-erou' }, [stareGoala({ icon: 'nutritie', titlu: 'Setează-ți țintele zilnice',
      text: 'Cu o țintă de calorii și macronutrienți, aici vezi cât ai mâncat, cât ți-a mai rămas și cât de aproape e planul de ce ți-ai propus.',
      actiune: buton({ text: 'Setează țintele', icon: 'editeaza', tip: 'principal', onclick: deschideTinteNutritie }) }),
    mancat.kcal || planificat.kcal ? el('p', { class: 'nota', text: `Azi: ${numarKcal(mancat.kcal)} kcal mâncate din ${numarKcal(planificat.kcal)} planificate.` }) : null].filter(Boolean));
  }
  const ramas = tinte.kcal - mancat.kcal;
  const macro = (nume, camp, clasa) => {
    const t = tinte[camp];
    return el('div', { class: 'masa-macro' }, [
      el('div', { class: 'masa-macro-cap' }, [el('span', { class: 'nutri-nume' }, [el('i', { class: `nutri-punct ${clasa}` }), nume]),
        el('span', { class: 'masa-macro-val' }, [el('strong', { text: String(Math.round(mancat[camp])) }), t ? ` / ${t} g` : ' g'])]),
      baraDubla(mancat[camp], planificat[camp], t, clasa),
    ]);
  };
  return el('div', { class: 'card masa-erou' }, [
    el('div', { class: 'masa-erou-cap' }, [
      el('div', {}, [el('p', { class: 'masa-data', text: new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) }),
        el('h2', { text: 'Ziua de azi' })]),
      buton({ text: 'Ținte', icon: 'editeaza', tip: 'fantoma', mic: true, eticheta: 'Modifică țintele', onclick: deschideTinteNutritie }),
    ]),
    el('div', { class: 'masa-kcal' }, [
      el('div', { class: 'masa-inel' }, [
        inelCalorii(mancat.kcal, planificat.kcal, tinte.kcal),
        el('div', { class: 'masa-inel-text' }, [el('strong', { class: ramas < 0 ? 'peste' : '', text: numarKcal(Math.abs(ramas)) }), el('span', { text: ramas < 0 ? 'kcal peste' : 'kcal rămase' })]),
      ]),
      el('dl', { class: 'masa-kcal-cifre' }, [
        el('div', {}, [el('dt', { text: 'Țintă' }), el('dd', { text: `${numarKcal(tinte.kcal)} kcal` })]),
        el('div', {}, [el('dt', { text: 'Mâncat' }), el('dd', { text: `${numarKcal(mancat.kcal)} kcal` })]),
        el('div', {}, [el('dt', { text: 'Planificat' }), el('dd', { text: `${numarKcal(planificat.kcal)} kcal` })]),
      ]),
    ]),
    el('div', { class: 'masa-macrouri' }, [macro('Proteine', 'proteine', 'nutri-p'), macro('Carbohidrați', 'carbohidrati', 'nutri-c'), macro('Grăsimi', 'grasimi', 'nutri-g')]),
    el('p', { class: 'nota nota-mica zi-legenda' }, [el('i', { class: 'zi-leg-mancat' }), ' mâncat  ', el('i', { class: 'zi-leg-plan' }), ' planificat']),
  ]);
}

// Prima masă din ordinea zilei care nu e mâncată complet.
function urmatoareaIntrare(zi) {
  const mese = (zi && zi.mese) || [];
  for (const m of MESE) {
    const i = mese.find(x => x.masa === m.id && x.stare !== 'complet');
    if (i) return i;
  }
  return null;
}

function cardUrmatoareaMasa(zi) {
  const mese = (zi && zi.mese) || [];
  if (!mese.length) {
    return el('div', { class: 'card masa-urmatoare goala' }, [stareGoala({ icon: 'zar', titlu: 'Nicio masă planificată azi',
      text: 'Generează planul zilei din rețetele tale, după ținte și preferințe. Îl poți modifica apoi masă cu masă.',
      actiune: buton({ text: 'Generează planul zilei', icon: 'zar', tip: 'principal', onclick: deschideZiuaNutritie }) })]);
  }
  const i = urmatoareaIntrare(zi);
  if (!i) {
    return el('div', { class: 'card masa-urmatoare' }, [titluCard('Următoarea masă'),
      el('p', { class: 'masa-gata' }, [iconita('bifa'), el('span', { text: 'Ai bifat toate mesele de azi.' })])]);
  }
  const r = retetaDupaId(i.idReteta);
  const v = valoriPlanificateIntrare(i);
  return el('div', { class: 'card masa-urmatoare' }, [
    titluCard('Următoarea masă', el('span', { class: 'eticheta-masa', text: numeMasa(i.masa) })),
    el('div', { class: 'masa-urmatoare-corp' }, [
      r ? el('button', { type: 'button', class: 'masa-urmatoare-foto', 'aria-label': `Rețeta: ${i.nume}`, onclick: () => arataReteta(r.id, i.portii) }, [imagineReteta(r, 'masa-urmatoare-img')]) : null,
      el('div', { class: 'masa-urmatoare-text' }, [
        el('strong', { text: i.nume }),
        el('span', { class: 'nota', text: `${fmtNumarPortii(i.portii)} · ${numarKcal(v.kcal)} kcal · P ${Math.round(v.proteine)} g · C ${Math.round(v.carbohidrati)} g · G ${Math.round(v.grasimi)} g` }),
        i.stare === 'partial' ? el('span', { class: 'nota nota-avertizare', text: 'Începută (parțial).' }) : null,
      ]),
    ]),
    el('div', { class: 'rand-butoane' }, [
      i.stare === 'neinceput' ? buton({ text: 'Am mâncat-o', icon: 'bifa', tip: 'principal', onclick: () => comutaMancataAcasa(i.id) }) : null,
      buton({ text: 'Ziua mea', tip: 'secundar', onclick: deschideZiuaNutritie }),
    ].filter(Boolean)),
  ]);
}

function fmtNumarPortii(p) {
  const t = String(Math.round(p * 100) / 100).replace('.', ',');
  return `${t} ${p === 1 ? 'porție' : 'porții'}`;
}

function cardMeseleZilei(zi) {
  const mese = (zi && zi.mese) || [];
  if (!mese.length) return null;
  const { numar, terminate } = totaluriZi(zi);
  return el('div', { class: 'card' }, [
    titluCard('Mesele de azi', el('span', { class: 'nota', text: `${terminate}/${numar} mâncate` })),
    el('ul', { class: 'acasa-mese' }, MESE.map(m => {
      const intrari = mese.filter(i => i.masa === m.id);
      if (!intrari.length) return el('li', { class: 'acasa-masa goala' }, [el('span', { class: 'acasa-masa-nume', text: m.nume }), el('span', { class: 'nota', text: '—' })]);
      const i = intrari[0];
      const kcal = intrari.reduce((s, x) => s + valoriPlanificateIntrare(x).kcal, 0);
      const stareMasa = intrari.every(x => x.stare === 'complet') ? 'complet' : intrari.some(x => x.stare !== 'neinceput') ? 'partial' : 'neinceput';
      const comutabil = intrari.length === 1 && i.stare !== 'partial';
      return el('li', { class: `acasa-masa stare-${stareMasa}` }, [
        el('span', { class: 'acasa-masa-nume', text: m.nume }),
        el('span', { class: 'acasa-masa-reteta', text: i.nume + (intrari.length > 1 ? ` +${intrari.length - 1}` : '') }),
        el('span', { class: 'acasa-masa-kcal', text: `${numarKcal(kcal)} kcal` }),
        comutabil
          ? el('button', { type: 'button', class: 'acasa-bifa' + (stareMasa === 'complet' ? ' activ' : ''), 'aria-pressed': String(stareMasa === 'complet'),
            'aria-label': stareMasa === 'complet' ? `${m.nume}: mâncată. Marchează neîncepută` : `Marchează ${m.nume} ca mâncată`,
            onclick: () => comutaMancataAcasa(i.id) }, [iconita('bifa', 'iconita mica')])
          : el('button', { type: 'button', class: 'acasa-bifa partial', 'aria-label': `${m.nume}: ${stareMasa === 'partial' ? 'parțial' : 'mai multe rețete'}. Deschide ziua`, onclick: deschideZiuaNutritie }, [el('span', { text: stareMasa === 'complet' ? '✓' : '½' })]),
      ]);
    })),
  ]);
}

function cardSaptamanaMasa(zile, zileSapt, tinte, azi) {
  const cuDate = zileSapt.filter(z => z.mese.length);
  if (!cuDate.length) return null;
  const tot = zileSapt.map(z => totaluriZi(z));
  const trecute = zile.map((d, k) => ({ d, t: tot[k] })).filter(x => x.d <= azi && x.t.numar);
  const medie = trecute.length ? trecute.reduce((s, x) => s + x.t.mancat.kcal, 0) / trecute.length : 0;
  const canvas = el('canvas', { class: 'grafic', 'aria-label': 'Calorii mâncate pe zilele săptămânii' });
  const card = el('div', { class: 'card' }, [
    titluCard('Săptămâna aceasta', buton({ text: 'Planificator', tip: 'fantoma', mic: true, onclick: () => deschideGrupNutritie('saptamana') })),
    canvas,
    el('p', { class: 'nota nota-mica zi-legenda' }, [el('i', { class: 'zi-leg-mancat' }), ' mâncat  ', el('i', { class: 'zi-leg-plan' }), ' planificat', tinte ? '  · linia: ținta' : '']),
    trecute.length ? el('p', { class: 'nota', text: `Media zilelor de până azi: ${numarKcal(medie)} kcal mâncate pe zi${tinte ? ` (ținta: ${numarKcal(tinte.kcal)})` : ''}.` }) : null,
  ]);
  const nume = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
  card.deseneaza = () => deseneazaBare(canvas, zile.map((d, k) => ({
    eticheta: nume[k], valoare: tot[k].mancat.kcal, umbra: tot[k].planificat.kcal, evidentiata: d === azi,
    detaliu: `${afiseazaData(d)} · plan ${numarKcal(tot[k].planificat.kcal)} kcal`,
  })), v => `${numarKcal(v)} kcal`, { inaltime: 160, referinta: tinte ? { valoare: tinte.kcal, eticheta: 'țintă' } : null });
  return card;
}

function deschideGrupNutritie(grup) {
  arataFilaNutritie(filaDinGrup(grup), { randeaza: false });
  arataEcran('ecran-nutritie');
}

function cardScurtaturiMasa(deCumparat) {
  const scurt = (icon, titlu, detaliu, onclick) => el('button', { type: 'button', class: 'masa-scurtatura', onclick }, [
    el('span', { class: 'masa-scurtatura-icon' }, [iconita(icon)]), el('strong', { text: titlu }), el('span', { class: 'nota', text: detaliu })]);
  const fav = (setari.retetePreferate || []).length;
  return el('div', { class: 'masa-scurtaturi' }, [
    scurt('carte', 'Rețete', fav ? `${plural(fav, 'favorită', 'favorite')}` : `${toateRetetele().length} în bibliotecă`, () => deschideGrupNutritie('retete')),
    scurt('cumparaturi', 'Cumpărături', deCumparat && deCumparat.total ? `${deCumparat.ramase} de cumpărat` : 'lista săptămânii', () => { perioadaLista = 'restul'; deschideGrupNutritie('lista'); }),
    scurt('calendar', 'Planificator', 'mesele săptămânii', () => deschideGrupNutritie('saptamana')),
    scurt('grafic', 'Analiză', 'medii și obiective', () => { arataFilaNutritie('analiza', { randeaza: false }); arataEcran('ecran-nutritie'); }),
  ]);
}

// Acces rapid: rețetele favorite; fără favorite, rețete cu fotografie pentru masa care urmează (alese pe zi, nu la întâmplare la fiecare deschidere).
function cardReteteRapide() {
  const toate = toateRetetele();
  const fav = (setari.retetePreferate || []).map(retetaDupaId).filter(Boolean);
  let lista = fav, titlu = 'Rețetele tale favorite';
  if (!lista.length) {
    const cuFoto = toate.filter(r => r.foto);
    if (!cuFoto.length) return null;
    const zi = Number(dataLocala().replace(/-/g, '')) % cuFoto.length;
    lista = [...cuFoto.slice(zi), ...cuFoto.slice(0, zi)];
    titlu = 'Idei de rețete';
  }
  return el('div', { class: 'card' }, [
    titluCard(titlu, buton({ text: 'Toate', tip: 'fantoma', mic: true, onclick: () => deschideGrupNutritie('retete') })),
    el('div', { class: 'masa-retete defilare-orizontala', role: 'list', 'aria-label': 'Rețete, defilează orizontal' }, lista.slice(0, 10).map(r => {
      const v = valoriPortie(r, indexNutritie);
      return el('button', { type: 'button', class: 'masa-reteta', role: 'listitem', onclick: () => arataReteta(r.id), 'aria-label': `${r.nume}, ${numarKcal(v.kcal)} kcal pe porție` }, [
        imagineReteta(r, 'masa-reteta-img'),
        el('span', { class: 'masa-reteta-nume', text: r.nume }),
        el('span', { class: 'nota', text: `${numarKcal(v.kcal)} kcal · ${r.timp} min` }),
      ]);
    })),
  ]);
}
