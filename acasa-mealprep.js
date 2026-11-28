// Acasă în modul Nutriție (Faza 1 din 3.0): ziua de azi pe scurt — calorii și macro față de ținte, următoarea masă,
// mesele zilei, săptămâna și scurtături. Totul vine din datele salvate (zileNutritie, setări, rețete, lista de cumpărături);
// fără ținte sau fără plan, cardurile arată ce ai de făcut, nu cifre inventate.

const numarKcal = v => Math.round(v).toLocaleString('ro-RO');


async function randeazaAcasaMasa() {
  const zona = $('masa-continut');
  if (!zona.childElementCount) zona.replaceChildren(stareIncarcare(3));
  const azi = dataLocala();
  const zile = zileSaptamana(azi);
  let ziAzi, zileSapt;
  try {
    await completeazaCafeleZilnice().catch(err => console.warn(err));
    zileSapt = await Promise.all(zile.map(d => citesteZiNutritie(d)));
    ziAzi = zileSapt[zile.indexOf(azi)];
  } catch (err) {
    console.error(err);
    zona.replaceChildren(stareGoala({ icon: 'avertizare', titlu: 'Datele nu au putut fi citite', text: 'Reîncarcă aplicația. Dacă problema persistă, restaurează un backup din Setări.' }));
    return;
  }
  if (ecranCurent !== 'ecran-masa') return;
  const tinte = setari.tinteNutritie;
  // Etapa 4: primul card e „Azi” (calorii, proteine, următoarea masă, „+ Adaugă”). Fotografierea e în foaia „+”,
  // iar Rețete / Cumpărături / Planificator / Analiză sunt în bara de jos (fără plăci dublate aici).
  const carduri = [
    cardAziMasa(ziAzi, tinte),
    cardMeseleZilei(ziAzi),
    cardCafeaAcasa(ziAzi),
    cardSaptamanaMasa(zile, zileSapt, tinte, azi),
    cardReteteRapide(),
  ].filter(Boolean);
  zona.replaceChildren(...carduri);
  for (const c of carduri) if (c.deseneaza) c.deseneaza();
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

// „Azi”: inelul caloriilor (rămase; fără ținte: mâncate), proteinele, macro, următoarea masă planificată și „+ Adaugă”.
function cardAziMasa(zi, tinte) {
  const { planificat, mancat } = totaluriZi(zi);
  const mese = (zi && zi.mese) || [];
  const urm = urmatoareaIntrare(zi);
  const dataText = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  const cap = el('div', { class: 'masa-erou-cap' }, [
    el('div', {}, [el('p', { class: 'masa-data', text: dataText.charAt(0).toUpperCase() + dataText.slice(1) }), el('h2', { text: 'Azi' })]),
    tinte ? buton({ text: 'Ținte', icon: 'editeaza', tip: 'fantoma', mic: true, eticheta: 'Modifică țintele', onclick: deschideTinteNutritie }) : null,
  ]);
  let cifre;
  if (tinte) {
    const ramas = tinte.kcal - mancat.kcal;
    const pRamas = tinte.proteine ? tinte.proteine - mancat.proteine : null;
    cifre = el('div', { class: 'masa-kcal' }, [
      el('div', { class: 'masa-inel' }, [
        inelCalorii(mancat.kcal, planificat.kcal, tinte.kcal),
        el('div', { class: 'masa-inel-text' }, [el('strong', { class: ramas < 0 ? 'peste' : '', text: numarKcal(Math.abs(ramas)) }), el('span', { text: ramas < 0 ? 'kcal peste' : 'kcal rămase' })]),
      ]),
      el('dl', { class: 'masa-kcal-cifre' }, [
        el('div', {}, [el('dt', { text: pRamas === null ? 'Proteine mâncate' : pRamas < 0 ? 'Proteine peste' : 'Proteine rămase' }),
          el('dd', { text: `${Math.round(pRamas === null ? mancat.proteine : Math.abs(pRamas))} g` })]),
        el('div', {}, [el('dt', { text: 'Mâncat' }), el('dd', { text: `${numarKcal(mancat.kcal)} din ${numarKcal(tinte.kcal)} kcal` })]),
        el('div', {}, [el('dt', { text: 'Planificat' }), el('dd', { text: `${numarKcal(planificat.kcal)} kcal` })]),
      ]),
    ]);
  } else {
    cifre = el('div', { class: 'masa-fara-tinte' }, [
      el('p', { class: 'masa-mancat' }, [el('strong', { text: numarKcal(mancat.kcal) }), el('span', { text: ' kcal mâncate' })]),
      el('p', { class: 'nota', text: `Proteine ${Math.round(mancat.proteine)} g · carbohidrați ${Math.round(mancat.carbohidrati)} g · grăsimi ${Math.round(mancat.grasimi)} g` }),
      buton({ text: 'Setează-ți țintele (3 pași)', icon: 'editeaza', tip: 'secundar', lat: true, onclick: deschideTinteNutritie }),
    ]);
  }
  const macro = (nume, camp, clasa) => {
    const t = tinte && tinte[camp];
    return el('div', { class: 'masa-macro' }, [
      el('div', { class: 'masa-macro-cap' }, [el('span', { class: 'nutri-nume' }, [el('i', { class: `nutri-punct ${clasa}` }), nume]),
        el('span', { class: 'masa-macro-val' }, [el('strong', { text: String(Math.round(mancat[camp])) }), t ? ` / ${t} g` : ' g'])]),
      baraDubla(mancat[camp], planificat[camp], t, clasa),
    ]);
  };
  // Următoarea masă planificată (prima nemâncată din ordinea zilei).
  let urmator;
  if (!mese.length) {
    urmator = el('div', { class: 'masa-azi-urm goala' }, [el('span', { class: 'nota', text: 'Nimic planificat azi.' }),
      buton({ text: 'Generează planul zilei', icon: 'zar', tip: 'fantoma', mic: true, onclick: deschideZiuaNutritie })]);
  } else if (!urm) {
    urmator = el('p', { class: 'masa-gata' }, [iconita('bifa'), el('span', { text: 'Ai bifat toate mesele de azi.' })]);
  } else {
    const v = valoriPlanificateIntrare(urm);
    const r = urm.idReteta ? retetaDupaId(urm.idReteta) : null;
    urmator = el('div', { class: 'masa-azi-urm' }, [
      el('button', { type: 'button', class: 'masa-azi-urm-text', 'aria-label': `Următoarea masă: ${numeMasa(urm.masa)}, ${urm.nume}`, onclick: () => (r ? arataReteta(r.id, urm.portii) : deschideZiuaNutritie()) }, [
        el('span', { class: 'eticheta-masa', text: `Urmează · ${numeMasa(urm.masa)}` }),
        el('strong', { text: urm.nume }),
        el('span', { class: 'nota', text: `${fmtNumarPortii(urm.portii)} · ${numarKcal(v.kcal)} kcal · P ${Math.round(v.proteine)} g` }),
      ]),
      urm.stare === 'neinceput' ? buton({ text: 'Am mâncat-o', icon: 'bifa', tip: 'secundar', mic: true, onclick: () => comutaMancataAcasa(urm.id) }) : null,
    ]);
  }
  return el('div', { class: 'card masa-erou masa-azi' }, [
    cap, cifre,
    tinte ? el('div', { class: 'masa-macrouri' }, [macro('Proteine', 'proteine', 'nutri-p'), macro('Carbohidrați', 'carbohidrati', 'nutri-c'), macro('Grăsimi', 'grasimi', 'nutri-g')]) : null,
    urmator,
    buton({ text: 'Adaugă', icon: 'plus', tip: 'principal', lat: true, clasa: 'masa-azi-adauga', onclick: () => deschideAdaugareRapida() }),
  ].filter(Boolean));
}

// Prima masă din ordinea zilei care nu e mâncată complet.
function urmatoareaIntrare(zi) {
  const mese = (zi && zi.mese) || [];
  for (const m of MESE_TOATE) {
    const i = mese.find(x => x.masa === m.id && x.stare !== 'complet');
    if (i) return i;
  }
  return null;
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
    el('ul', { class: 'acasa-mese' }, MESE_TOATE.filter(m => m.id !== 'alta' || mese.some(i => i.masa === 'alta')).map(m => {
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
