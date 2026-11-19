// Ecranul Progres, fila Grafice: progres pe exercițiu și serii pe săptămână pe grupă.

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

  $('progres-gol').hidden = sesiuni.length > 0;
  $('progres-continut').hidden = sesiuni.length === 0;
  if (sesiuni.length === 0) return;

  deseneazaProgresExercitiu(sesiuni);
  deseneazaVolumGrupe(sesiuni);
}

function deseneazaProgresExercitiu(sesiuni) {
  const selector = $('progres-exercitiu');
  const cautat = selector.value.toLowerCase();
  deseneazaRecorduri(recorduri.get(cautat));
  const forta = [];
  const volum = [];
  for (const s of sesiuni) {
    const ex = s.exercitii.find(e => e.nume.toLowerCase() === cautat);
    if (!ex) continue;
    const t = timpDinData(s.data);
    let bestEpley = 0;
    let totalVolum = 0;
    for (const se of ex.serii) {
      if (serieDeLucru(se) && se.repetari > 0) bestEpley = Math.max(bestEpley, e1rm(se.kg, se.repetari));
      totalVolum += volumSerie(se);
    }
    forta.push({ x: t, y: Math.round(bestEpley * 10) / 10, data: s.data });
    volum.push({ x: t, y: Math.round(totalVolum), data: s.data });
  }

  deseneazaGrafic($('grafic-forta'), forta, formatNumar);
  deseneazaGrafic($('grafic-volum'), volum, v => formatMare(v));

  if (forta.length === 0) {
    $('progres-sumar').textContent = 'Nu ai sesiuni cu acest exercițiu.';
    return;
  }
  const cel = forta.reduce((b, p) => p.y > b.y ? p : b, forta[0]);
  $('progres-sumar').textContent =
    `${plural(forta.length, 'sesiune', 'sesiuni')}. Cea mai bună forță estimată: ${formatNumar(cel.y)} kg (${afiseazaData(cel.data)}). Atinge graficul ca să vezi valorile.`;
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
    : r.repetari > 0 ? [placuta('Repetări maxime', String(r.repetari), afiseazaData(r.repetariData))]
      : r.durata > 0 ? [placuta('Cel mai lung timp', `${formatNumar(r.durata)} s`, afiseazaData(r.durataData))]
        : r.distanta > 0 ? [placuta('Cea mai mare distanță', `${formatNumar(r.distanta)} m`, afiseazaData(r.distantaData))] : [];
  $('progres-recorduri').replaceChildren(...placute);
}

// Seriile pe săptămână pe fiecare grupă, cu luni-ul săptămânii în selector.
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

  const randuri = [...GRUPE];
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
  $('progres-exercitiu').addEventListener('change', () => deseneazaProgresExercitiu(istoric));
  $('saptamana').addEventListener('change', () => deseneazaVolumGrupe(istoric));
}
