// Afișarea realizărilor (etapa 7): fila Progres → Realizări, cardul de pe Acasă și sărbătorirea de la finalul
// antrenamentului. Calculele sunt în realizari.js.

const NUME_METAL = { bronz: 'bronz', argint: 'argint', aur: 'aur', platina: 'platină' };

// Datele de care au nevoie realizările, citite din bază (istoricul trebuie să fie deja încărcat).
async function contextRealizari() {
  const [masuratori, poze] = await Promise.all([
    toateMasuratorile().catch(() => []),
    toatePozele().catch(() => []),
  ]);
  const areGreutate = masuratori.some(m => m.tip === 'Greutate');
  return {
    sesiuni: istoric, masuratori, poze: poze.map(p => ({ data: p.data })), tinta: setari.obiectivSaptamanal,
    grupaDe: grupaExercitiu, greutateCorpLa: areGreutate ? functieGreutateCorp(masuratori) : null, obiectiv: setari.obiectiv,
  };
}

function medalie(metalNume, mic = false) {
  return el('span', { class: `medalie ${metalNume || 'blocata'}${mic ? ' mica' : ''}`, 'aria-hidden': 'true' }, [iconita(metalNume ? 'trofeu' : 'stea')]);
}

async function deseneazaRealizari() {
  await reincarcaIstoric();
  const ctx = await contextRealizari();
  const azi = dataLocala();

  // Nivel
  const n = nivelDin(istoric.length);
  $('nivel-titlu').textContent = `Nivelul ${n.nivel}`;
  $('nivel-numar').textContent = plural(n.antrenamente, 'antrenament', 'antrenamente');
  $('nivel-bara').style.width = `${n.progres * 100}%`;
  $('nivel-nota').textContent = n.maxim
    ? 'Ai ajuns la nivelul maxim.'
    : `Încă ${plural(n.urmator - n.antrenamente, 'antrenament', 'antrenamente')} până la nivelul ${n.nivel + 1}. Nivelul crește doar cu antrenamentele încheiate.`;

  // Obiectivul săptămânal
  const o = obiectivSaptamanal(istoric, azi, setari.obiectivSaptamanal);
  chipuriObiectiv($('obiectiv-sapt-alege'));
  $('obiectiv-sapt-text').textContent = o.atins ? 'atins săptămâna aceasta' : `${o.facute} din ${o.tinta}`;
  $('obiectiv-sapt-puncte').replaceChildren(...Array.from({ length: Math.max(o.tinta, o.facute) }, (_, i) =>
    el('span', { class: 'punct-obiectiv' + (i < o.facute ? ' facut' : '') + (i >= o.tinta ? ' extra' : '') })));
  $('obiectiv-sapt-placute').replaceChildren(
    placuta('Săptămâna aceasta', `${o.facute} / ${o.tinta}`, o.atins ? 'obiectiv atins' : `mai ai ${plural(o.tinta - o.facute, 'antrenament', 'antrenamente')}`, o.atins ? 'pozitiv' : ''),
    placuta('Serie', plural(o.serie, 'săptămână', 'săptămâni'), 'cu obiectivul atins', o.serie > 0 ? 'pozitiv' : ''),
    placuta('Cea mai lungă', plural(o.serieMaxima, 'săptămână', 'săptămâni')),
  );

  // Insigne
  const insigne = calculeazaInsigne(ctx);
  const total = insigne.reduce((t, i) => t + i.trepte.length, 0);
  const deblocate = insigne.reduce((t, i) => t + i.deblocate, 0);
  $('insigne-numar').textContent = `${deblocate} din ${total}`;
  const recente = deblocateRecent(insigne).slice(0, 6);
  $('insigne-recente').replaceChildren(...(recente.length ? recente.map(r => el('div', { class: 'insigna-recenta' }, [
    medalie(r.metal),
    el('div', { class: 'rand-lista-text' }, [el('strong', { text: `${r.nume} · ${r.eticheta}` }), el('span', { class: 'nota', text: `${NUME_METAL[r.metal]} · ${afiseazaData(r.data)}` })]),
  ])) : [el('p', { class: 'nota', text: 'Prima insignă vine cu primul antrenament încheiat.' })]));

  const categorii = [...new Set(insigne.map(i => i.categorie))];
  $('insigne-categorii').replaceChildren(...categorii.map(cat => el('div', { class: 'card' }, [
    el('h2', { text: cat }),
    el('div', { class: 'lista-simpla' }, insigne.filter(i => i.categorie === cat).map(i => {
      const ultima = [...i.trepte].reverse().find(t => t.data);
      const text = i.indisponibil ? i.indisponibil
        : i.urmatoarea ? `${i.valoareText} / ${i.urmatoarea.eticheta}` : `toate cele ${i.trepte.length} trepte`;
      return el('button', { type: 'button', class: 'rand-insigna', onclick: () => detaliiInsigna(i), 'aria-label': `${i.nume}: ${i.deblocate} din ${i.trepte.length} trepte. ${text}` }, [
        medalie(ultima ? ultima.metal : null),
        el('div', { class: 'rand-insigna-text' }, [
          el('div', { class: 'rand-insigna-cap' }, [el('strong', { text: i.nume }), el('span', { class: 'nota', text })]),
          el('div', { class: 'obiectiv-bara mica' }, [el('div', { class: 'obiectiv-umplere', style: `width:${i.indisponibil ? 0 : i.progres * 100}%` })]),
          el('div', { class: 'trepte' }, i.trepte.map(t => el('span', { class: 'treapta' + (t.data ? ` ${t.metal}` : ''), text: t.eticheta }))),
        ]),
      ]);
    })),
  ])));
}

function chipuriObiectiv(container) {
  container.replaceChildren(...[1, 2, 3, 4, 5, 6, 7].map(v => el('button', {
    type: 'button', class: 'chip' + (v === setari.obiectivSaptamanal ? ' activ' : ''), text: String(v),
    'aria-pressed': String(v === setari.obiectivSaptamanal), 'aria-label': `${plural(v, 'antrenament', 'antrenamente')} pe săptămână`,
    onclick: () => {
      setari.obiectivSaptamanal = v;
      salveazaSetari();
      afiseazaSetari();
      deseneazaRealizari().catch(err => console.error(err));
    },
  })));
}

function detaliiInsigna(i) {
  const d = deschideDialog({
    titlu: i.nume,
    text: `${i.descriere}. Acum: ${i.valoareText}.`,
    continut: el('div', { class: 'lista-simpla' }, i.trepte.map(t => el('div', { class: 'rand-lista' }, [
      el('div', { class: 'rand-insigna-cap' }, [medalie(t.data ? t.metal : null, true), el('strong', { text: t.eticheta })]),
      el('span', { class: 'nota', text: t.data ? `${NUME_METAL[t.metal]} · ${afiseazaData(t.data)}` : 'blocată' }),
    ]))),
    butoane: [buton({ text: 'Închide', tip: 'principal', onclick: () => d.inchide() })],
  });
}

// ---------- Cardul de pe Acasă ----------
// ctx vine din contextRealizari(); întoarce cardul (sau null fără antrenamente).
function cardRealizari(azi, ctx) {
  if (!ctx.sesiuni.length) return null;
  const n = nivelDin(ctx.sesiuni.length);
  const o = obiectivSaptamanal(ctx.sesiuni, azi, setari.obiectivSaptamanal);
  const urm = urmatoareaInsigna(calculeazaInsigne(ctx));
  return el('div', { class: 'card' }, [
    titluCard('Realizări', buton({ text: 'Toate', tip: 'fantoma', mic: true, onclick: () => { arataEcran('ecran-progres'); arataFilaProgres('realizari'); } })),
    el('div', { class: 'placute' }, [
      placuta(`Nivelul ${n.nivel}`, plural(n.antrenamente, 'antrenament', 'antrenamente'), n.maxim ? 'nivel maxim' : `încă ${n.urmator - n.antrenamente} până la nivelul ${n.nivel + 1}`),
      placuta('Obiectiv săptămânal', `${o.facute} / ${o.tinta}`, o.atins ? `atins · serie de ${plural(o.serie, 'săptămână', 'săptămâni')}` : `serie: ${plural(o.serie, 'săptămână', 'săptămâni')}`, o.atins ? 'pozitiv' : ''),
    ]),
    urm ? el('div', { class: 'urmatoarea-insigna' }, [
      medalie(urm.urmatoarea.metal, true),
      el('div', { class: 'rand-insigna-text' }, [
        el('div', { class: 'rand-insigna-cap' }, [el('strong', { text: `${urm.nume} · ${urm.urmatoarea.eticheta}` }), el('span', { class: 'nota', text: `${urm.valoareText} / ${urm.urmatoarea.eticheta}` })]),
        el('div', { class: 'obiectiv-bara mica' }, [el('div', { class: 'obiectiv-umplere', style: `width:${urm.progres * 100}%` })]),
      ]),
    ]) : null,
  ]);
}

// ---------- La finalul antrenamentului ----------
// Înainte de salvare: starea realizărilor; după salvare: ce s-a deblocat și dacă obiectivul săptămânal a fost atins acum.
async function stareRealizari() {
  const ctx = await contextRealizari();
  return { insigne: calculeazaInsigne(ctx), obiectiv: obiectivSaptamanal(istoric, dataLocala(), setari.obiectivSaptamanal), nivel: nivelDin(istoric.length).nivel };
}

async function sarbatoresteRealizari(inainte) {
  if (!inainte) return;
  const dupa = await stareRealizari();
  const noi = deblocateNoi(inainte.insigne, dupa.insigne);
  const mesaje = [];
  if (!inainte.obiectiv.atins && dupa.obiectiv.atins) mesaje.push(`Obiectivul săptămânal atins: ${dupa.obiectiv.facute} din ${dupa.obiectiv.tinta}!`);
  if (dupa.nivel > inainte.nivel) mesaje.push(`Ai ajuns la nivelul ${dupa.nivel}!`);
  for (const m of mesaje) notifica(m, 'record');
  if (!noi.length) return;
  const d = deschideDialog({
    titlu: noi.length === 1 ? 'Insignă nouă!' : `${noi.length} insigne noi!`,
    continut: el('div', { class: 'lista-simpla sarbatoare' }, noi.map(x => el('div', { class: 'insigna-recenta' }, [
      medalie(x.metal),
      el('div', { class: 'rand-lista-text' }, [el('strong', { text: `${x.nume} · ${x.eticheta}` }), el('span', { class: 'nota', text: NUME_METAL[x.metal] })]),
    ]))),
    butoane: [
      buton({ text: 'Vezi toate', tip: 'fantoma', onclick: () => d.inchide(() => { arataEcran('ecran-progres'); arataFilaProgres('realizari'); }) }),
      buton({ text: 'Super', tip: 'principal', onclick: () => d.inchide() }),
    ],
  });
}
