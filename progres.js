// Ecranul Progres, fila Grafice: statistici pe perioadă, evoluție, grupe musculare, progres pe exercițiu,
// forță, recorduri și seriile pe săptămână. Calculele sunt în statistici.js și analiza.js; aici doar afișarea.

const progresStare = {
  perioada: '3l',
  pas: 'saptamana',
  metricaEvolutie: 'volum',
  metricaExercitiu: 'e1rm',
  sesiuniExercitiu: 8,
  recorduriAfisate: 10,
};
try {
  const salvat = JSON.parse(localStorage.getItem('progres-vedere') || '{}');
  if (PERIOADE.some(p => p.cheie === salvat.perioada)) progresStare.perioada = salvat.perioada;
  if (salvat.pas === 'luna' || salvat.pas === 'saptamana') progresStare.pas = salvat.pas;
} catch { /* fără preferințe salvate */ }
function salveazaVedereProgres() {
  try { localStorage.setItem('progres-vedere', JSON.stringify({ perioada: progresStare.perioada, pas: progresStare.pas })); } catch { /* nu e grav */ }
}

const fmtKg = v => `${formatMare(v)} kg`;
const fmtKgZ = v => `${formatNumar(v)} kg`;
function formatMinute(min) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
const dataCuAnScurt = d => { const [a, l, z] = d.split('-'); return `${z}.${l}.${a.slice(2)}`; };
const semn = d => (d > 0 ? '+' : d < 0 ? '−' : '±');

function chipuri(container, optiuni, activ, laAlegere) {
  container.replaceChildren(...optiuni.map(o => el('button', {
    type: 'button', class: 'chip' + (o.cheie === activ ? ' activ' : ''), text: o.nume,
    'aria-pressed': String(o.cheie === activ), onclick: () => laAlegere(o.cheie),
  })));
}

async function reincarcaProgres() {
  await reincarcaIstoric();
  const sesiuni = istoric;

  // Lista de exerciții care apar în sesiuni
  const nume = new Map();
  for (const s of sesiuni) {
    for (const e of s.exercitii) {
      const cheie = e.nume.toLowerCase();
      if (!nume.has(cheie)) nume.set(cheie, e.nume);
    }
  }
  const selector = $('progres-exercitiu');
  const anterior = selector.value;
  const optiuni = [...nume.values()].sort((a, b) => a.localeCompare(b, 'ro'));
  selector.replaceChildren(...optiuni.map(n => el('option', { value: n, text: n })));
  if (optiuni.includes(anterior)) selector.value = anterior;
  else if (optiuni.length) {
    // implicit: exercițiul făcut cel mai des în perioada aleasă
    const iv = intervalPerioada(progresStare.perioada, dataLocala(), sesiuni);
    const top = fortaPrincipale(sesiuni, iv, 1)[0];
    if (top && optiuni.includes(top.nume)) selector.value = top.nume;
  }

  $('progres-gol').hidden = sesiuni.length > 0;
  $('progres-continut').hidden = sesiuni.length === 0;
  if (sesiuni.length === 0) return;

  deseneazaAnaliza();
}

// Tot ce depinde de perioadă.
function deseneazaAnaliza() {
  const sesiuni = istoric;
  chipuri($('progres-perioada'), PERIOADE, progresStare.perioada, cheie => {
    progresStare.perioada = cheie; progresStare.sesiuniExercitiu = 8; salveazaVedereProgres(); deseneazaAnaliza();
  });
  const iv = intervalPerioada(progresStare.perioada, dataLocala(), sesiuni);
  deseneazaRezumat(sesiuni, iv);
  deseneazaEvolutie(sesiuni, iv);
  deseneazaDistributie(sesiuni, iv);
  deseneazaProgresExercitiu(sesiuni);
  deseneazaForta(sesiuni, iv);
  deseneazaListaRecorduri();
  deseneazaVolumGrupe(sesiuni);
}

// ---------- Rezumat ----------
function deseneazaRezumat(sesiuni, iv) {
  const r = rezumatPerioada(sesiuni, iv);
  const noi = recorduriInPerioada(sesiuni, iv).length;
  $('rezumat-interval').textContent = `${afiseazaData(iv.start)} – ${afiseazaData(iv.sfarsit)}`;
  // comparația are sens doar dacă există antrenamente înainte de perioadă
  const areTrecut = !iv.tot && sesiuni.some(s => s.data < iv.start);
  const ant = areTrecut ? rezumatPerioada(sesiuni, intervalAnterior(iv)) : null;
  const fata = (acum, inainte, format) => {
    if (!ant) return null;
    const d = acum - inainte;
    if (Math.abs(d) < 1e-9) return 'la fel ca perioada anterioară';
    return `${semn(d)}${format(Math.abs(d))} față de perioada anterioară`;
  };
  const cls = (acum, inainte) => (ant && acum > inainte ? 'pozitiv' : '');
  $('progres-rezumat').replaceChildren(
    placuta('Antrenamente', String(r.antrenamente), fata(r.antrenamente, ant?.antrenamente, String), cls(r.antrenamente, ant?.antrenamente)),
    placuta('Serii de lucru', formatMare(r.serii), fata(r.serii, ant?.serii, formatMare), cls(r.serii, ant?.serii)),
    placuta('Volum', fmtKg(r.volum), fata(r.volum, ant?.volum, fmtKg), cls(r.volum, ant?.volum)),
    placuta('Timp activ', formatMinute(r.minute), r.antrenamente ? `${formatMinute(r.minute / r.antrenamente)} / antrenament` : null),
    placuta('Pe săptămână', formatNumar(r.peSaptamana), 'antrenamente în medie'),
    placuta('Recorduri noi', String(noi), noi ? null : 'niciunul în perioadă', noi ? 'pozitiv' : ''),
  );
}

// ---------- Evoluție ----------
const METRICI_EVOLUTIE = [
  { cheie: 'volum', nume: 'Volum', format: fmtKg },
  { cheie: 'serii', nume: 'Serii', format: v => formatMare(v) },
  { cheie: 'antrenamente', nume: 'Antrenamente', format: v => String(v) },
  { cheie: 'minute', nume: 'Timp', format: formatMinute },
];

function deseneazaEvolutie(sesiuni, iv) {
  // „Lunar" pentru perioade scurte ar da 1–2 bare; săptămânal pentru „Tot" pe ani ar fi prea dens: le lăsăm pe amândouă,
  // dar alegem implicit ce se citește bine.
  chipuri($('evolutie-pas'), [{ cheie: 'saptamana', nume: 'Săptămânal' }, { cheie: 'luna', nume: 'Lunar' }], progresStare.pas, cheie => {
    progresStare.pas = cheie; salveazaVedereProgres(); deseneazaEvolutie(istoric, intervalPerioada(progresStare.perioada, dataLocala(), istoric));
  });
  chipuri($('evolutie-metrica'), METRICI_EVOLUTIE, progresStare.metricaEvolutie, cheie => {
    progresStare.metricaEvolutie = cheie; deseneazaEvolutie(istoric, intervalPerioada(progresStare.perioada, dataLocala(), istoric));
  });
  const m = METRICI_EVOLUTIE.find(x => x.cheie === progresStare.metricaEvolutie);
  const grupuri = evolutie(sesiuni, iv, progresStare.pas);
  const curenta = progresStare.pas === 'luna' ? dataLocala().slice(0, 7) : cheieSaptamana(dataLocala());
  deseneazaBare($('grafic-evolutie'), grupuri.map(g => ({
    eticheta: g.eticheta,
    valoare: g[m.cheie],
    evidentiata: g.cheie === curenta,
    detaliu: progresStare.pas === 'luna' ? etichetaLuna(g.cheie, true) : `săpt. ${afiseazaData(g.start)}`,
  })), m.format, { inaltime: 180 });
  const active = grupuri.filter(g => g.antrenamente > 0);
  const total = grupuri.reduce((t, g) => t + g[m.cheie], 0);
  const unitate = progresStare.pas === 'luna' ? 'lună' : 'săptămână';
  $('evolutie-nota').textContent = active.length
    ? `Media: ${m.format(total / grupuri.length)} pe ${unitate} (${plural(active.length, unitate === 'lună' ? 'lună activă' : 'săptămână activă', unitate === 'lună' ? 'luni active' : 'săptămâni active')} din ${grupuri.length}). Atinge o bară ca să vezi valoarea.`
    : 'Niciun antrenament în această perioadă.';
}

// ---------- Distribuția pe grupe ----------
function deseneazaDistributie(sesiuni, iv) {
  const d = distributieGrupe(sesiuni, iv, grupaExercitiu);
  const cont = $('distributie-grupe');
  if (!d.length) { cont.replaceChildren(el('p', { class: 'nota', text: 'Niciun antrenament în această perioadă.' })); return; }
  const max = Math.max(...d.map(r => r.serii));
  cont.replaceChildren(...d.map(r => el('div', { class: 'bara-rand bara-rand-lat' }, [
    el('span', { class: 'bara-nume', text: r.grupa }),
    el('div', { class: 'bara-fundal' }, [el('div', { class: 'bara in-zona', style: `width:${r.serii / max * 100}%` })]),
    el('span', { class: 'bara-valoare', text: `${r.serii} · ${Math.round(r.procent)}%` }),
  ])));
}

// ---------- Progres pe exercițiu ----------
const FORMAT_METRICA = { kg: fmtKgZ, '': v => formatNumar(v), s: v => `${formatNumar(v)} s`, m: v => `${formatNumar(v)} m` };

function deseneazaProgresExercitiu(sesiuni) {
  const nume = $('progres-exercitiu').value;
  deseneazaRecorduri(recorduri.get(nume.toLowerCase()));
  const iv = intervalPerioada(progresStare.perioada, dataLocala(), sesiuni);
  const toate = progresieExercitiu(sesiuni, nume);
  const puncte = toate.filter(p => p.data >= iv.start && p.data <= iv.sfarsit);

  // metricile pe care le are exercițiul (după toate sesiunile, ca alegerea să nu sară între perioade)
  const disponibile = metriciDisponibile(toate);
  if (!disponibile.includes(progresStare.metricaExercitiu)) progresStare.metricaExercitiu = disponibile[0] || 'e1rm';
  const cheie = progresStare.metricaExercitiu;
  chipuri($('progres-metrica'), disponibile.map(k => ({ cheie: k, nume: METRICI[k].nume })), cheie, k => {
    progresStare.metricaExercitiu = k; deseneazaProgresExercitiu(istoric);
  });
  const def = METRICI[cheie];
  const format = FORMAT_METRICA[def.unitate];
  const serie = puncte.map(p => ({ x: timpDinData(p.data), y: Math.round(def.valoare(p) * 10) / 10, data: p.data })).filter(p => p.y > 0);
  deseneazaGrafic($('grafic-forta'), serie, format);

  if (!toate.length) {
    $('progres-sumar').textContent = 'Nu ai sesiuni cu acest exercițiu.';
  } else if (!serie.length) {
    $('progres-sumar').textContent = `Niciun antrenament cu acest exercițiu în perioada aleasă. Ultima dată: ${afiseazaData(toate[toate.length - 1].data)}.`;
  } else {
    const sch = schimbareMetrica(puncte, cheie);
    const cel = serie.reduce((b, p) => (p.y > b.y ? p : b), serie[0]);
    let text = `${plural(serie.length, 'sesiune', 'sesiuni')} în perioadă. Cel mai bun: ${format(cel.y)} (${afiseazaData(cel.data)}).`;
    if (sch) text += ` De la prima la ultima sesiune: ${semn(sch.diferenta)}${format(Math.abs(sch.diferenta))}${sch.procent !== null ? ` (${semn(sch.procent)}${formatNumar(Math.abs(sch.procent))}%)` : ''}.`;
    $('progres-sumar').textContent = text;
  }

  // greutatea pe număr de repetări (doar la exercițiile cu greutate)
  const rep = recorduriPeRepetari(sesiuni, nume);
  const areRep = rep.some(r => r.kg > 0);
  $('progres-repetari-bloc').hidden = !areRep;
  if (areRep) {
    $('progres-repetari').replaceChildren(...rep.map(r => el('div', { class: 'celula-repetari' + (r.kg ? '' : ' goala') }, [
      el('span', { class: 'placuta-eticheta', text: `${r.repetari} rep.` }),
      el('strong', { text: r.kg ? formatNumar(r.kg) : '—' }),
      el('span', { class: 'placuta-detaliu', text: r.kg ? (r.repetariFacute > r.repetari ? `×${r.repetariFacute} · ${dataCuAnScurt(r.data)}` : dataCuAnScurt(r.data)) : '' }),
    ])));
  }

  // sesiunile cu exercițiul, cele mai recente întâi
  const lista = [...puncte].reverse();
  const vizibile = lista.slice(0, progresStare.sesiuniExercitiu);
  const randuri = vizibile.map(p => el('div', { class: 'rand-lista' }, [
    el('div', { class: 'rand-lista-text' }, [
      el('strong', { text: afiseazaData(p.data) }),
      el('span', { class: 'nota', text: rezumatSerii(p.seriiLucru) }),
    ]),
    el('div', { class: 'rand-lista-valoare' }, [
      p.e1rm > 0 ? el('strong', { text: fmtKgZ(p.e1rm) }) : null,
      el('span', { class: 'nota', text: p.e1rm > 0 ? `1RM est. · ${fmtKg(p.volum)}` : p.volum > 0 ? fmtKg(p.volum) : plural(p.serii, 'serie', 'serii') }),
    ]),
  ]));
  if (lista.length > vizibile.length) {
    randuri.push(buton({ text: `Arată toate (${lista.length})`, tip: 'secundar', lat: true, onclick: () => { progresStare.sesiuniExercitiu = Infinity; deseneazaProgresExercitiu(istoric); } }));
  }
  $('progres-sesiuni').replaceChildren(...(randuri.length ? randuri : [el('p', { class: 'nota', text: 'Nicio sesiune în perioada aleasă.' })]));
}

// Recordurile exercițiului ales, ca plăcuțe.
function deseneazaRecorduri(r) {
  if (!r) { $('progres-recorduri').replaceChildren(); return; }
  const placute = r.kg > 0
    ? [
      placuta('Greutate maximă', `${formatNumar(r.kg)} kg`, `× ${r.kgRepetari} · ${afiseazaData(r.kgData)}`),
      placuta('1RM estimat', `${formatNumar(r.e1rm)} kg`, `${formatNumar(r.e1rmKg)}×${r.e1rmRepetari} · ${afiseazaData(r.e1rmData)}`),
      placuta('Volum / sesiune', `${formatMare(r.volum)} kg`, afiseazaData(r.volumData)),
    ]
    : r.repetari > 0 ? [placuta('Repetări maxime', String(r.repetari), afiseazaData(r.repetariData)),
      r.volum > 0 ? placuta('Volum / sesiune', `${formatMare(r.volum)} kg`, afiseazaData(r.volumData)) : null]
      : r.durata > 0 ? [placuta('Cel mai lung timp', `${formatNumar(r.durata)} s`, afiseazaData(r.durataData))]
        : r.distanta > 0 ? [placuta('Cea mai mare distanță', `${formatNumar(r.distanta)} m`, afiseazaData(r.distantaData))] : [];
  $('progres-recorduri').replaceChildren(...placute.filter(Boolean));
}

// Alege un exercițiu în cardul de progres și derulează la el.
function arataProgresExercitiu(nume) {
  const sel = $('progres-exercitiu');
  if (![...sel.options].some(o => o.value === nume)) return;
  sel.value = nume;
  progresStare.sesiuniExercitiu = 8;
  deseneazaProgresExercitiu(istoric);
  $('card-progres-exercitiu').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Forță ----------
function deseneazaForta(sesiuni, iv) {
  const lista = fortaPrincipale(sesiuni, iv);
  const cont = $('forta-principale');
  if (!lista.length) { cont.replaceChildren(el('p', { class: 'nota', text: 'Niciun exercițiu cu greutate în această perioadă.' })); return; }
  cont.replaceChildren(...lista.map(f => el('button', { type: 'button', class: 'rand-lista rand-apasabil', onclick: () => arataProgresExercitiu(f.nume) }, [
    el('div', { class: 'rand-lista-text' }, [
      el('strong', { text: f.nume }),
      el('span', { class: 'nota', text: `${plural(f.sesiuni, 'sesiune', 'sesiuni')} · record ${fmtKgZ(f.recordAbsolut)} (${afiseazaData(f.dataRecord)})` }),
    ]),
    el('div', { class: 'rand-lista-valoare' }, [
      el('strong', { text: f.sesiuni > 1 ? `${formatNumar(f.de)} → ${formatNumar(f.la)}` : fmtKgZ(f.la) }),
      f.procent !== null
        ? el('span', { class: 'eticheta-schimbare' + (f.procent > 0.05 ? ' pozitiv' : f.procent < -0.05 ? ' negativ' : ''), text: `${semn(f.procent)}${formatNumar(Math.abs(f.procent))}%` })
        : el('span', { class: 'nota', text: 'o singură sesiune' }),
    ]),
  ])));
}

// ---------- Recorduri personale ----------
function deseneazaListaRecorduri() {
  const lista = listaRecorduri(recorduri);
  $('recorduri-numar').textContent = lista.length ? plural(lista.length, 'exercițiu', 'exerciții') : '';
  const vizibile = lista.slice(0, progresStare.recorduriAfisate);
  const text = r => r.tip === 'forta' ? [`${formatNumar(r.valoare)} kg`, `1RM est. din ${formatNumar(r.e1rmKg)}×${r.e1rmRepetari} · maxim ${formatNumar(r.kg)} kg × ${r.kgRepetari}`]
    : r.tip === 'repetari' ? [`${r.valoare} rep.`, 'repetări maxime într-o serie']
      : r.tip === 'durata' ? [`${formatNumar(r.valoare)} s`, 'cel mai lung timp']
        : [`${formatNumar(r.valoare)} m`, 'cea mai mare distanță'];
  const randuri = vizibile.map(r => {
    const [val, det] = text(r);
    return el('button', { type: 'button', class: 'rand-lista rand-apasabil', onclick: () => arataProgresExercitiu(r.nume) }, [
      el('div', { class: 'rand-lista-text' }, [el('strong', { text: r.nume }), el('span', { class: 'nota', text: det })]),
      el('div', { class: 'rand-lista-valoare' }, [el('strong', { text: val }), el('span', { class: 'nota', text: r.data ? afiseazaData(r.data) : '' })]),
    ]);
  });
  if (lista.length > vizibile.length) {
    randuri.push(buton({ text: `Arată toate (${lista.length})`, tip: 'secundar', lat: true, onclick: () => { progresStare.recorduriAfisate = Infinity; deseneazaListaRecorduri(); } }));
  }
  $('lista-recorduri').replaceChildren(...(randuri.length ? randuri : [el('p', { class: 'nota', text: 'Încă nu ai recorduri.' })]));
}

// ---------- Seriile pe săptămână pe fiecare grupă (etapa 2) ----------
const SERII_MIN = 10;
const SERII_MAX = 20;

function deseneazaVolumGrupe(sesiuni) {
  const selector = $('saptamana');
  const luniCunoscuti = new Set();
  for (const s of sesiuni) luniCunoscuti.add(luniaSaptamanii(s.data));
  luniCunoscuti.add(luniaSaptamanii(dataLocala())); // săptămâna curentă, chiar fără sesiuni

  const luni = [...luniCunoscuti].sort().reverse();
  const anterioara = selector.value;
  selector.replaceChildren(...luni.map(l => el('option', {
    value: l, text: l === luniaSaptamanii(dataLocala()) ? 'Săptămâna aceasta' : `Săptămâna din ${afiseazaData(l)}`,
  })));
  if (luni.includes(anterioara)) selector.value = anterioara;
  if (!selector.value) selector.value = luni[0];

  const saptamana = selector.value;
  const dinSaptamana = sesiuni.filter(s => luniaSaptamanii(s.data) === saptamana);
  const serii = seriiPeGrupa(dinSaptamana, grupaExercitiu);

  // Grupele de acum, apoi grupa veche „Picioare" (exerciții proprii încă nereîncadrate) și „Nealocat", dacă au serii.
  const randuri = [...GRUPE, ...Object.keys(serii).filter(g => !GRUPE.includes(g) && g !== 'Nealocat')];
  if (serii.Nealocat) randuri.push('Nealocat');
  const scala = Math.max(SERII_MAX + 4, ...Object.values(serii));

  $('volum-grupe').replaceChildren(...randuri.map(g => {
    const n = serii[g] || 0;
    const zona = n === 0 ? '' : n < SERII_MIN ? ' sub' : n > SERII_MAX ? ' peste' : ' in-zona';
    return el('div', { class: 'bara-rand' }, [
      el('span', { class: 'bara-nume', text: g }),
      el('div', { class: 'bara-fundal' }, [
        el('div', { class: 'bara-zona', style: `left:${SERII_MIN / scala * 100}%;width:${(SERII_MAX - SERII_MIN) / scala * 100}%` }),
        el('div', { class: 'bara' + zona, style: `width:${n / scala * 100}%` }),
      ]),
      el('span', { class: 'bara-valoare', text: n ? String(n) : '—' }),
    ]);
  }));
}

function initProgres() {
  $('progres-exercitiu').addEventListener('change', () => { progresStare.sesiuniExercitiu = 8; deseneazaProgresExercitiu(istoric); });
  $('saptamana').addEventListener('change', () => deseneazaVolumGrupe(istoric));
}
