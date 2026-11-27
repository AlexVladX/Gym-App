// Ecranul Acasă: panoul cu rezumatul antrenamentelor, calculat din datele salvate.
// Calculele sunt în analiza.js (testate în tests/panou.test.js); aici doar se afișează.

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const INITIALE_ZILE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ETICHETE_PR = { greutate: 'Greutate maximă', forta: '1RM estimat', repetari: 'Repetări', durata: 'Timp', distanta: 'Distanță' };

let modActivitate = 'antrenamente'; // 'antrenamente' | 'volum' | 'serii'
let perioadaGrupe = 30;             // 7 | 30 zile
let intervalAcasa = null;

function dataScurta(data) {
  const [, l, z] = data.split('-').map(Number);
  return `${z} ${LUNI_SCURT[l - 1]}`;
}

function salut() {
  const ora = new Date().getHours();
  return ora >= 5 && ora < 12 ? 'Bună dimineața' : ora >= 12 && ora < 18 ? 'Bună ziua' : 'Bună seara';
}

function textZile(zile) {
  return zile === 0 ? 'azi' : zile === 1 ? 'ieri' : `acum ${plural(zile, 'zi', 'zile')}`;
}

// Diferența față de săptămâna trecută, ca text scurt: „+2 față de săpt. trecută".
function comparatie(acum, inainte, format = v => String(v)) {
  if (inainte === 0 && acum === 0) return 'nimic săptămâna trecută';
  if (inainte === 0) return 'săptămâna trecută: 0';
  const d = acum - inainte;
  if (d === 0) return 'la fel ca săpt. trecută';
  return `${d > 0 ? '+' : '−'}${format(Math.abs(d))} față de săpt. trecută`;
}

function titluCard(text, actiune) {
  return el('div', { class: 'card-cap' }, [el('h2', { text }), actiune || null]);
}

// ---------- Cardul principal: salut + ce faci azi ----------
function cardAzi(azi, sesiuni) {
  const dataLunga = new Date(timpDinData(azi)).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' });
  const copii = [
    el('p', { class: 'acasa-data', text: dataLunga.charAt(0).toUpperCase() + dataLunga.slice(1) }),
    el('h2', { class: 'acasa-salut', text: sesiuni.length ? salut() : 'Bine ai venit!' }),
  ];

  const inCurs = stare.exercitii.length > 0;
  const deAzi = sesiuni.filter(s => s.data === azi);

  if (inCurs) {
    const { serii } = seriiCompletate();
    copii.push(
      el('div', { class: 'acasa-stare' }, [
        el('span', { class: 'punct-viu', 'aria-hidden': 'true' }),
        el('div', {}, [
          el('strong', { text: 'Antrenament în curs' }),
          el('p', { class: 'nota', id: 'acasa-durata', text: textInCurs(serii) }),
        ]),
      ]),
      buton({ text: 'Continuă antrenamentul', icon: 'gantera', tip: 'principal', lat: true, clasa: 'btn-mare', onclick: () => arataEcran('ecran-sesiune') }),
    );
  } else if (deAzi.length > 0) {
    const st = totaluri(deAzi);
    const durata = deAzi.reduce((t, s) => t + (durataSesiuneMin(s) || 0) * 60000, 0);
    const exercitii = deAzi.reduce((t, s) => t + s.exercitii.length, 0);
    copii.push(
      el('div', { class: 'acasa-stare gata' }, [
        el('span', { class: 'acasa-bifa' }, [iconita('bifa')]),
        el('div', {}, [
          el('strong', { text: deAzi.length > 1 ? `${deAzi.length} antrenamente azi` : 'Antrenamentul de azi e gata' }),
          el('p', { class: 'nota', text: [plural(exercitii, 'exercițiu', 'exerciții'), plural(st.serii, 'serie', 'serii'),
            durata ? `${Math.max(1, Math.round(durata / 60000))} min` : null].filter(Boolean).join(' · ') }),
        ]),
      ]),
      buton({ text: 'Începe încă un antrenament', icon: 'plus', tip: 'secundar', lat: true, onclick: incepeAntrenament }),
    );
  } else {
    copii.push(
      el('p', { class: 'nota acasa-indemn', text: sesiuni.length ? 'Nu te-ai antrenat încă azi.' : 'Notează-ți antrenamentele, urmărește-ți progresul și recordurile. Totul rămâne pe telefon.' }),
      buton({ text: 'Începe antrenamentul', icon: 'gantera', tip: 'principal', lat: true, clasa: 'btn-mare', onclick: incepeAntrenament }),
    );
  }
  return el('div', { class: 'card card-erou acasa-erou' }, copii);
}

function textInCurs(serii) {
  const durata = formatDurata(durataCurentaMs() / 1000);
  return `${pePauza() ? 'pe pauză · ' : ''}${durata} · ${plural(stare.exercitii.length, 'exercițiu', 'exerciții')} · ${plural(serii, 'serie bifată', 'serii bifate')}`;
}

function incepeAntrenament() {
  arataEcran('ecran-sesiune');
  // Pe telefon fără focus automat: tastatura ar acoperi cele trei acțiuni de start.
  if (!ecranTactil()) setTimeout(() => $('exercitiu-nume').focus(), 250);
}

// ---------- Repetă ultimul antrenament (etapa 2) ----------
// Sub „Începe antrenamentul”: ultimul antrenament cu „Repetă” și primele rutine ca acțiuni rapide.
// Nu apare cât timp un antrenament e în curs (cardul principal arată atunci „Continuă antrenamentul”).
function cardRepeta(sesiuni, rutine) {
  if (stare.exercitii.length > 0) return null;
  const ultima = ultimaSesiune(sesiuni);
  const rapide = [...(rutine || [])].reverse().slice(0, 3);
  if (!ultima && !rapide.length) return null;
  const copii = [titluCard(ultima ? 'Ultimul antrenament' : 'Rutinele tale')];
  if (ultima) {
    const zile = Math.round((ziDinData(dataLocala()) - ziDinData(ultima.data)));
    const nume = ultima.exercitii.map(e => e.nume);
    const scurt = nume.slice(0, 4).join(' · ') + (nume.length > 4 ? ` · +${nume.length - 4}` : '');
    copii.push(
      el('p', { class: 'nota', text: `${textZile(zile).replace(/^./, c => c.toUpperCase())} (${afiseazaData(ultima.data)}) · ${plural(nume.length, 'exercițiu', 'exerciții')} · ${plural(ultima.serii ?? totaluri([ultima]).serii, 'serie', 'serii')}` }),
      el('p', { class: 'descriere', text: scurt }),
      buton({ text: 'Repetă', icon: 'gantera', tip: 'principal', lat: true, onclick: () => repetaAntrenamentul(ultima) }),
    );
  }
  if (rapide.length) {
    copii.push(
      ultima ? el('p', { class: 'sectiune-eticheta mt', text: 'Sau din rutină' }) : null,
      el('div', { class: 'rand-butoane acasa-rutine-rapide' }, rapide.map(r => buton({
        text: r.nume, icon: 'lista', tip: 'secundar', eticheta: `Începe rutina „${r.nume}”`, onclick: () => adaugaInSesiune(r.exercitii, r.grupe || []),
      }))),
    );
  }
  return el('div', { class: 'card acasa-repeta' }, copii);
}

// ---------- Următorul antrenament ----------
function cardUrmator(urmator) {
  if (!urmator) return null;
  if (urmator.tip === 'rutina') {
    const r = urmator.rutina;
    return el('div', { class: 'card' }, [
      titluCard('Următorul antrenament'),
      el('p', { class: 'acasa-rutina', text: r.nume }),
      el('p', { class: 'nota', text: urmator.ultimaData
        ? `Ultima dată ${textZile(urmator.zile)} (${afiseazaData(urmator.ultimaData)}). E rutina ta făcută cel mai demult.`
        : 'Încă nu ai făcut această rutină.' }),
      el('p', { class: 'descriere', text: r.exercitii.join(' · ') }),
      buton({ text: `Începe „${r.nume}"`, icon: 'gantera', tip: 'secundar', lat: true, onclick: () => adaugaInSesiune(r.exercitii, r.grupe || []) }),
    ]);
  }
  return el('div', { class: 'card' }, [
    titluCard('Următorul antrenament'),
    el('p', { class: 'nota', text: 'Grupele lucrate cel mai demult. Salvează o rutină ca să primești sugestii de antrenament complet.' }),
    el('div', { class: 'acasa-grupe' }, urmator.grupe.map(g => el('button', {
      class: 'acasa-grupa', type: 'button', 'aria-label': `${g.grupa}, ultima dată ${textZile(g.zile)}. Deschide exercițiile pentru ${g.grupa}`,
      onclick: () => deschideBibliotecaPeGrupa(g.grupa),
    }, [
      el('strong', { text: g.grupa }),
      el('span', { text: textZile(g.zile) }),
    ]))),
  ]);
}

// ---------- Săptămâna aceasta ----------
function cardSaptamana(azi, sesiuni, saptamani) {
  const curenta = saptamani[saptamani.length - 1];
  const trecuta = saptamani[saptamani.length - 2];
  const zile = zileActiveSaptamana(sesiuni, azi);
  const indexAzi = ziDinData(azi) - ziDinData(cheieSaptamana(azi));
  const serie = serieSaptamani(sesiuni, azi);

  const benzi = el('div', { class: 'zile-saptamana', role: 'list', 'aria-label': 'Zilele cu antrenament din săptămâna aceasta' },
    INITIALE_ZILE.map((z, i) => el('div', {
      class: 'zi' + (zile[i] ? ' activa' : '') + (i === indexAzi ? ' azi' : '') + (i > indexAzi ? ' viitor' : ''),
      role: 'listitem', 'aria-label': `${ZILE[(i + 1) % 7]}${zile[i] ? ', antrenament' : ''}`,
    }, [el('span', { text: z }), el('i', {}, [zile[i] ? iconita('bifa', 'iconita mica') : null])])));

  const textSerie = serie.saptamani === 0
    ? 'începe una azi'
    : serie.curentaActiva ? 'inclusiv săptămâna aceasta' : 'antrenează-te săptămâna aceasta ca s-o continui';

  return el('div', { class: 'card' }, [
    titluCard('Săptămâna aceasta'),
    benzi,
    el('div', { class: 'placute mt' }, [
      placuta('Antrenamente', String(curenta.antrenamente), comparatie(curenta.antrenamente, trecuta.antrenamente)),
      placuta('Serie', plural(serie.saptamani, 'săptămână', 'săptămâni'), textSerie, serie.saptamani > 0 ? 'pozitiv' : ''),
      placuta('Volum', `${formatMare(curenta.volum)} kg`, comparatie(curenta.volum, trecuta.volum, v => `${formatMare(v)} kg`)),
      placuta('Serii complete', String(curenta.serii), comparatie(curenta.serii, trecuta.serii)),
    ]),
  ]);
}

// ---------- Total ----------
function cardTotal(sesiuni) {
  const t = totaluri(sesiuni);
  const prima = sesiuni[0];
  return el('div', { class: 'card' }, [
    titluCard('De la început'),
    el('div', { class: 'placute' }, [
      placuta('Antrenamente', formatMare(t.antrenamente), prima ? `din ${afiseazaData(prima.data)}` : null),
      placuta('Serii complete', formatMare(t.serii)),
      placuta('Volum total', `${formatMare(t.volum)} kg`),
    ]),
    el('p', { class: 'nota', text: 'Volum = kg × repetări pe seriile de lucru (fără încălzire). La exercițiile cu greutatea corpului se adună greutatea ta din Corp.' }),
  ]);
}

// ---------- Activitate: ultimele 8 săptămâni ----------
function cardActivitate(saptamani) {
  const canvas = el('canvas', { class: 'grafic', 'aria-label': 'Activitatea din ultimele 8 săptămâni' });
  const optiuni = [['antrenamente', 'Antrenamente'], ['volum', 'Volum'], ['serii', 'Serii']];
  const segment = el('div', { class: 'segment segment-mic', role: 'tablist' }, optiuni.map(([cheie, text]) => el('button', {
    type: 'button', role: 'tab', class: modActivitate === cheie ? 'activ' : '', 'aria-selected': String(modActivitate === cheie), text,
    onclick: () => { modActivitate = cheie; randeazaAcasa(); },
  })));
  const card = el('div', { class: 'card' }, [titluCard('Activitate, ultimele 8 săptămâni'), segment, canvas,
    el('p', { class: 'nota', text: 'Atinge o bară ca să vezi valoarea. Bara deschisă e săptămâna aceasta.' })]);
  // Graficul se desenează după ce cardul e în pagină (are nevoie de lățimea reală).
  card.deseneaza = () => deseneazaBare(canvas, saptamani.map((s, i) => ({
    eticheta: dataScurta(s.luni).replace(' ', ' '),
    valoare: s[modActivitate],
    detaliu: `săpt. din ${dataScurta(s.luni)}`,
    evidentiata: i === saptamani.length - 1,
  })), modActivitate === 'volum' ? v => `${formatMare(v)} kg` : v => String(Math.round(v)));
  return card;
}

// ---------- Distribuția pe grupe ----------
function cardGrupe(azi, sesiuni) {
  const serii = seriiPeGrupa(sesiuniRecente(sesiuni, azi, perioadaGrupe), grupaExercitiu);
  const total = Object.values(serii).reduce((a, b) => a + b, 0);
  const randuri = Object.entries(serii).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ro'));
  const max = randuri.length ? randuri[0][1] : 0;
  const neantrenate = GRUPE.filter(g => !serii[g]);

  const segment = el('div', { class: 'segment segment-mic', role: 'tablist' }, [[7, '7 zile'], [30, '30 de zile']].map(([z, text]) => el('button', {
    type: 'button', role: 'tab', class: perioadaGrupe === z ? 'activ' : '', 'aria-selected': String(perioadaGrupe === z), text,
    onclick: () => { perioadaGrupe = z; randeazaAcasa(); },
  })));

  const continut = total === 0
    ? [el('p', { class: 'nota', text: `Nicio serie în ultimele ${perioadaGrupe} zile.` })]
    : [
      ...randuri.map(([g, n]) => el('div', { class: 'bara-rand bara-procent' }, [
        el('span', { class: 'bara-nume', text: g }),
        el('div', { class: 'bara-fundal' }, [el('div', { class: 'bara in-zona', style: `width:${n / max * 100}%` })]),
        el('span', { class: 'bara-valoare', text: `${n} · ${Math.round(n / total * 100)}%` }),
      ])),
      neantrenate.length && neantrenate.length < GRUPE.length
        ? el('p', { class: 'nota mt', text: `Fără serii: ${neantrenate.join(', ')}.` }) : null,
    ];

  return el('div', { class: 'card' }, [
    titluCard('Grupe musculare lucrate'),
    segment,
    ...continut,
    el('p', { class: 'nota', text: 'Serii complete pe grupa principală a fiecărui exercițiu.' }),
  ]);
}

// ---------- Recorduri ----------
function textRecord(e) {
  if (e.tip === 'greutate') return `${formatNumar(e.kg)} kg × ${e.repetari}`;
  if (e.tip === 'forta') return `${formatNumar(e.e1rm)} kg (${formatNumar(e.kg)} × ${e.repetari})`;
  if (e.tip === 'durata') return `${formatNumar(e.durataSec)} s`;
  if (e.tip === 'distanta') return `${formatNumar(e.distantaM)} m`;
  return `${e.repetari} repetări`;
}

function cardRecorduri(azi, sesiuni) {
  const limita = ziDinData(azi) - 29;
  const recente = recorduriNoi(sesiuni).filter(e => ziDinData(e.data) >= limita).reverse().slice(0, 5);
  let titlu = 'Recorduri recente';
  let randuri;
  if (recente.length) {
    randuri = recente.map(e => el('div', { class: 'rand-record' }, [
      el('span', { class: 'record-icon' }, [iconita('trofeu', 'iconita mica')]),
      el('div', {}, [el('strong', { text: e.nume }), el('p', { class: 'nota', text: `${ETICHETE_PR[e.tip]} · ${dataScurta(e.data)}` })]),
      el('span', { class: 'valoare', text: textRecord(e) }),
    ]));
  } else {
    // Fără recorduri în ultimele 30 de zile: cele mai bune ridicări de până acum.
    const top = [...recorduri.values()].filter(r => r.e1rm > 0).sort((a, b) => b.e1rm - a.e1rm).slice(0, 3);
    if (top.length === 0) return null;
    titlu = 'Cele mai bune ridicări';
    randuri = [
      el('p', { class: 'nota', text: 'Niciun record nou în ultimele 30 de zile. Iată cele mai mari valori de 1RM estimat de până acum:' }),
      ...top.map(r => el('div', { class: 'rand-record' }, [
        el('span', { class: 'record-icon' }, [iconita('trofeu', 'iconita mica')]),
        el('div', {}, [el('strong', { text: r.nume }), el('p', { class: 'nota', text: `${formatNumar(r.e1rmKg)} × ${r.e1rmRepetari} · ${dataScurta(r.e1rmData)}` })]),
        el('span', { class: 'valoare', text: `${formatNumar(r.e1rm)} kg` }),
      ])),
    ];
  }
  return el('div', { class: 'card' }, [
    titluCard(titlu, buton({ text: 'Progres', tip: 'fantoma', mic: true, onclick: () => arataEcran('ecran-progres') })),
    ...randuri,
  ]);
}

// ---------- Ultimele antrenamente ----------
function cardRecente(sesiuni) {
  const ultimele = sesiuni.slice(-3).reverse();
  return el('div', { class: 'card' }, [
    titluCard('Ultimele antrenamente', buton({ text: 'Tot istoricul', tip: 'fantoma', mic: true, onclick: deschideIstoricul })),
    ...ultimele.map(s => {
      const st = statisticiSesiune(s);
      const durata = durataSesiuneMin(s);
      return el('button', { class: 'rand-sesiune', type: 'button', onclick: deschideIstoricul,
        'aria-label': `${ziuaSaptamanii(s.data)}, ${afiseazaData(s.data)}. Deschide istoricul` }, [
        el('div', { class: 'rand-sesiune-data' }, [el('strong', { text: String(Number(s.data.slice(8))) }), el('span', { text: LUNI_SCURT[Number(s.data.slice(5, 7)) - 1] })]),
        el('div', { class: 'rand-sesiune-text' }, [
          el('strong', { text: s.grupe?.length ? s.grupe.join(', ') : s.exercitii.map(e => e.nume).slice(0, 2).join(', ') }),
          el('span', { class: 'nota', text: [ziuaSaptamanii(s.data), plural(s.exercitii.length, 'exercițiu', 'exerciții'),
            plural(st.serii, 'serie', 'serii'), durata ? `${durata} min` : null].filter(Boolean).join(' · ') }),
        ]),
        el('span', { class: 'valoare', text: `${formatMare(st.volum)} kg` }),
      ]);
    }),
  ]);
}

function deschideIstoricul() {
  arataEcran('ecran-progres');
  arataFilaProgres('istoric');
}

// ---------- Greutate corporală ----------
function cardGreutate(azi, masuratori) {
  const greutati = masuratori.filter(m => m.tip === 'Greutate').sort((a, b) => a.data.localeCompare(b.data));
  const adauga = buton({ text: 'Adaugă greutatea', icon: 'plus', tip: 'secundar', lat: true, onclick: deschideGreutatea });
  if (greutati.length === 0) {
    return el('div', { class: 'card' }, [
      titluCard('Greutate corporală'),
      el('p', { class: 'nota', text: 'Încă nu ai notat greutatea. Cântărește-te de 2–3 ori pe săptămână, dimineața, ca să vezi tendința.' }),
      adauga,
    ]);
  }
  const t = tendintaGreutate(greutati);
  const s = schimbareGreutate(greutati, azi, 30);
  const placute = [placuta('Media 7 zile', `${formatNumar(t.media7)} kg`, `ultima: ${formatNumar(t.ultima)} kg, ${dataScurta(t.dataUltima)}`)];
  if (t.kgPeSaptamana !== null) {
    const v = t.kgPeSaptamana;
    placute.push(placuta('Tendință', `${v > 0.05 ? '↑ +' : v < -0.05 ? '↓ ' : '→ '}${formatNumar(v)} kg`, 'pe săptămână'));
  }
  if (s) {
    placute.push(placuta('30 de zile', `${s.diferenta > 0 ? '+' : s.diferenta < 0 ? '−' : ''}${formatNumar(Math.abs(s.diferenta))} kg`,
      `de la ${formatNumar(s.de)} kg (${dataScurta(s.dela)})`));
  }
  const limita = ziDinData(azi) - 89;
  const puncte = greutati.filter(m => ziDinData(m.data) >= limita).map(m => ({ x: timpDinData(m.data), y: m.valoare }));
  const canvas = puncte.length >= 2 ? el('canvas', { class: 'grafic grafic-mic', 'aria-label': 'Greutatea din ultimele 90 de zile' }) : null;
  const card = el('div', { class: 'card' }, [
    titluCard('Greutate corporală'),
    el('div', { class: 'placute' }, placute),
    canvas,
    t.kgPeSaptamana === null ? el('p', { class: 'nota', text: 'Tendința apare după minimum 3 cântăriri pe cel puțin 7 zile.' }) : null,
    adauga,
  ]);
  if (canvas) card.deseneaza = () => deseneazaGrafic(canvas, puncte, formatNumar, { inaltime: 120 });
  return card;
}

function deschideGreutatea() {
  arataEcran('ecran-masuratori');
  setTimeout(() => $('greutate-valoare').focus(), 250);
}

// ---------- Nutriția de azi (etapa 7 nutriție) ----------
// Un singur card, compact: caloriile (țintă, planificat, mâncat, rămas), macro, cele 5 mese cu starea lor.
// Se redesenează la fiecare deschidere a ecranului Acasă, deci reflectă imediat generarea, înlocuirea sau marcarea meselor.
function deschideZiuaNutritie() {
  dupaIncarcareNutritie(() => { dataZiNutritie = dataLocala(); arataFilaNutritie('zi', { randeaza: false }); });
  arataEcran('ecran-nutritie');
}

async function comutaMancataAcasa(idIntrare) {
  try {
    const zi = await citesteZiNutritie(dataLocala());
    const i = zi.mese.find(x => x.id === idIntrare);
    if (!i) return;
    const noua = schimbaStareIntrare(i, i.stare === 'complet' ? 'neinceput' : 'complet');
    await salveazaZiNutritie({ ...zi, mese: zi.mese.map(x => (x.id === i.id ? noua : x)) });
    notifica(noua.stare === 'complet' ? `${i.nume}: mâncată.` : `${i.nume}: neîncepută.`, 'succes', 2500);
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Starea mesei nu a putut fi salvată.'), 'eroare');
  }
  if (ecranCurent === 'ecran-masa') { if (nutritiePornita) randeazaAcasaMasa(); } else randeazaAcasa();
}

// ---------- Primii pași (utilizator nou) ----------
function cardPrimiiPasi(sesiuni, masuratori) {
  let backup = false;
  try { backup = Boolean(localStorage.getItem(CHEIE_ULTIM_BACKUP)); } catch (_) { /* ignorat */ }
  const pasi = [
    { gata: sesiuni.length > 0, text: 'Salvează primul antrenament', actiune: incepeAntrenament },
    { gata: masuratori.some(m => m.tip === 'Greutate'), text: 'Notează-ți greutatea', actiune: deschideGreutatea },
    { gata: backup, text: 'Exportă un backup', actiune: () => arataEcran('ecran-setari') },
  ];
  if (pasi.every(p => p.gata) || sesiuni.length >= 5) return null;
  return el('div', { class: 'card' }, [
    titluCard('Primii pași'),
    ...pasi.map(p => el('button', { class: 'pas' + (p.gata ? ' gata' : ''), type: 'button', onclick: p.actiune, disabled: p.gata }, [
      el('span', { class: 'pas-bifa' }, [p.gata ? iconita('bifa', 'iconita mica') : null]),
      el('span', { text: p.text }),
      p.gata ? null : iconita('sageata', 'iconita mica'),
    ])),
  ]);
}

// ---------- Desenarea ecranului ----------
async function randeazaAcasa() {
  const zona = $('acasa-continut');
  if (!zona.childElementCount) zona.replaceChildren(stareIncarcare(3));
  let masuratori = [];
  let rutine = [];
  let ctxRealizari = null;
  try {
    await reincarcaIstoric();
    [masuratori, rutine] = await Promise.all([toateMasuratorile(), toateRutinele()]);
    ctxRealizari = await contextRealizari().catch(err => { console.warn(err); return null; });
  } catch (err) {
    console.error(err);
    zona.replaceChildren(stareGoala({ icon: 'avertizare', titlu: 'Datele nu au putut fi citite', text: 'Reîncarcă aplicația. Dacă problema persistă, restaurează un backup din Setări.' }));
    return;
  }
  if (ecranCurent !== 'ecran-acasa') return;

  const azi = dataLocala();
  const sesiuni = istoric;
  const carduri = [cardAzi(azi, sesiuni), cardRepeta(sesiuni, rutine), cardMementoBackup(sesiuni), cardPrimiiPasi(sesiuni, masuratori)];
  if (sesiuni.length > 0) {
    const saptamani = rezumatSaptamani(sesiuni, azi, 8);
    carduri.push(
      cardUrmator(urmatorulAntrenament(rutine, sesiuni, grupaExercitiu, azi)),
      cardSaptamana(azi, sesiuni, saptamani),
      ctxRealizari ? cardRealizari(azi, ctxRealizari) : null,
      cardRecorduri(azi, sesiuni),
      cardActivitate(saptamani),
      cardGrupe(azi, sesiuni),
      cardRecente(sesiuni),
      cardGreutate(azi, masuratori),
      cardTotal(sesiuni),
    );
  } else {
    carduri.push(cardUrmator(urmatorulAntrenament(rutine, sesiuni, grupaExercitiu, azi)), cardGreutate(azi, masuratori));
  }
  const vizibile = carduri.filter(Boolean);
  zona.replaceChildren(...vizibile);
  for (const c of vizibile) if (c.deseneaza) c.deseneaza();

  // Durata antrenamentului în curs se actualizează cât timp ecranul e deschis.
  clearInterval(intervalAcasa);
  if (stare.exercitii.length > 0) {
    intervalAcasa = setInterval(() => {
      const t = $('acasa-durata');
      if (!t || ecranCurent !== 'ecran-acasa') { clearInterval(intervalAcasa); return; }
      t.textContent = textInCurs(seriiCompletate().serii);
    }, 1000);
  }
}
