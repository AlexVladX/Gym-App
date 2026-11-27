// Ecranul Exerciții: biblioteca (listă, filtre, detalii, exerciții proprii), selectorul rapid din antrenament
// și fila Rutine (rutinele tale și șabloanele).
// Datele exercițiilor vin din catalog.js (exercitiuDupaNume, toateExercitiile, alternativePentru).

let modBiblioteca = 'exercitii';
const filtre = { cautare: '', grupa: '', echipament: '', nivel: '', categorie: '', favorite: false, proprii: false };

const ORDINE_GRUPE = new Map([...GRUPE, GRUPA_VECHE].map((g, i) => [g, i]));

function ordoneaza(lista) {
  return [...lista].sort((a, b) =>
    (ORDINE_GRUPE.get(a.grupa) ?? 99) - (ORDINE_GRUPE.get(b.grupa) ?? 99) || a.nume.localeCompare(b.nume, 'ro'));
}

// Fiecare cuvânt căutat trebuie să apară în nume, grupă, mușchi sau echipament, în orice ordine.
function potrivireCautare(e, cuvinte) {
  if (!cuvinte.length) return true;
  const text = fara(`${e.nume} ${e.grupa || ''} ${e.secundari.join(' ')} ${e.echipament || ''}`);
  return cuvinte.every(c => text.includes(c));
}

function figuraExercitiu(e, clasa) {
  return creeazaFigura(e.poza, e.nume, clasa) ||
    el('div', { class: `${clasa} figura-generica`, 'aria-hidden': 'true' }, [iconita('gantera')]);
}

function metaExercitiu(e) {
  return [e.grupa, e.echipament, e.nivel].filter(Boolean).join(' · ');
}

// ---------- Lista ----------
// Exercițiile care trec de căutare și de toate filtrele (lista întreagă, nu doar ce e desenat).
function exercitiiFiltrate() {
  const cuvinte = fara(filtre.cautare).split(/\s+/).filter(Boolean);
  return ordoneaza(toateExercitiile().filter(e =>
    (!filtre.grupa || e.grupa === filtre.grupa) &&
    (!filtre.echipament || e.echipament === filtre.echipament) &&
    (!filtre.nivel || e.nivel === filtre.nivel) &&
    (!filtre.categorie || e.categorie === filtre.categorie) &&
    (!filtre.favorite || e.favorit) &&
    (!filtre.proprii || e.propriu) &&
    potrivireCautare(e, cuvinte)));
}
function numarExercitiiFiltrate() { return exercitiiFiltrate().length; }

function randeazaBiblioteca() {
  if (modBiblioteca !== 'exercitii') {
    randeazaAntrenamente().catch(err => console.error(err));
    return;
  }
  deseneazaGrupeVechi();
  const cuvinte = fara(filtre.cautare).split(/\s+/).filter(Boolean);
  const potrivite = exercitiiFiltrate();

  $('biblio-numar').textContent = plural(potrivite.length, 'exercițiu', 'exerciții');
  $('btn-sterge-filtre').hidden = !areFiltre();
  const lista = $('biblio-lista');
  if (potrivite.length === 0) {
    lista.replaceChildren(stareGoala({
      icon: filtre.favorite ? 'stea' : 'cauta',
      titlu: filtre.favorite && !areFiltre(['favorite']) ? 'Niciun exercițiu favorit' : 'Niciun exercițiu găsit',
      text: filtre.favorite && !areFiltre(['favorite'])
        ? 'Deschide un exercițiu și apasă steaua ca să-l găsești repede, aici și în timpul antrenamentului.'
        : 'Schimbă filtrele, caută altfel sau creează un exercițiu propriu.',
      actiune: el('div', { class: 'rand-butoane' }, [
        buton({ text: 'Șterge filtrele', tip: 'secundar', onclick: reseteazaFiltrele }),
        buton({ text: 'Exercițiu nou', icon: 'plus', tip: 'principal', onclick: () => deschideFormularExercitiu(null, filtre.cautare) }),
      ]),
    }));
    return;
  }
  // Titluri de grupă când lista e ordonată pe grupe (fără căutare și fără filtru de grupă).
  const cuTitluri = !cuvinte.length && !filtre.grupa;
  // Rândurile (cu ilustrație) se creează pe bucăți, pe măsură ce derulezi (118 exerciții).
  const fabrici = [];
  let grupaCurenta = null;
  for (const e of potrivite) {
    if (cuTitluri && e.grupa !== grupaCurenta) {
      grupaCurenta = e.grupa;
      const titlu = e.grupa || 'Fără grupă';
      fabrici.push(() => el('h3', { class: 'lista-titlu', text: titlu }));
    }
    fabrici.push(() => randExercitiu(e));
  }
  const card = el('div', { class: 'card lista-exercitii-biblio' });
  lista.replaceChildren(card);
  deseneazaPeBucati(card, fabrici, 30);
}

function areFiltre(ignora = []) {
  return Object.entries(filtre).some(([k, v]) => !ignora.includes(k) && Boolean(v));
}

function randExercitiu(e) {
  return el('div', { class: 'rand-biblio' }, [
    el('button', { class: 'rand-biblio-principal', type: 'button', onclick: () => arataDetaliiExercitiu(e.nume),
      'aria-label': `${e.nume}. ${metaExercitiu(e)}. Deschide detaliile` }, [
      figuraExercitiu(e, 'figura-mica'),
      el('span', { class: 'rand-biblio-text' }, [
        el('strong', { text: e.nume }),
        el('span', { class: 'nota', text: metaExercitiu(e) }),
      ]),
      e.propriu ? el('span', { class: 'eticheta-tip', text: 'Propriu' }) : null,
    ]),
    butonFavorit(e),
  ]);
}

function butonFavorit(e, mare = false) {
  return el('button', {
    class: 'btn btn-fantoma btn-icon favorit' + (e.favorit ? ' activ' : '') + (mare ? '' : ' btn-mic'),
    type: 'button', 'aria-pressed': e.favorit ? 'true' : 'false',
    'aria-label': e.favorit ? `Scoate ${e.nume} de la favorite` : `Adaugă ${e.nume} la favorite`,
    onclick: async ev => {
      ev.stopPropagation();
      const btn = ev.currentTarget;
      const nou = await comutaFavorit(e.nume);
      if (nou === null) return;
      btn.classList.toggle('activ', nou);
      btn.setAttribute('aria-pressed', String(nou));
      btn.setAttribute('aria-label', nou ? `Scoate ${e.nume} de la favorite` : `Adaugă ${e.nume} la favorite`);
    },
  }, [iconita('stea')]);
}

// Întoarce noua stare (true/false) sau null dacă nu s-a putut salva.
async function comutaFavorit(nume) {
  const e = exercitiuDupaNume(nume);
  if (!e) return null;
  try {
    await seteazaInBiblioteca(e.nume, { favorit: !e.favorit });
    await reincarcaBiblioteca();
  } catch (err) {
    console.error(err);
    notifica('Favoritul nu a putut fi salvat.', 'eroare');
    return null;
  }
  if (modBiblioteca === 'exercitii' && ecranCurent === 'ecran-biblioteca') randeazaBiblioteca();
  notifica(e.favorit ? `${e.nume} a fost scos de la favorite.` : `${e.nume} a fost adăugat la favorite.`, 'succes', 2000);
  return !e.favorit;
}

// ---------- Filtre ----------
// Etapa 4: rândul scurt = grupa; restul (favorite, proprii, echipament, nivel, categorie) în foaia „Filtre (n)”.
function chipFiltru(text, activ, onclick, extra = {}) {
  return el('button', { class: 'chip chip-mic' + (activ ? ' activ' : ''), type: 'button', 'aria-pressed': String(activ), text, onclick, ...extra });
}
function aplicaFiltre() { deseneazaFiltre(); randeazaBiblioteca(); }

function deseneazaFiltre() {
  $('biblio-grupe').replaceChildren(...['', ...GRUPE].map(g => chipFiltru(g || 'Toate', filtre.grupa === g, () => { filtre.grupa = g; aplicaFiltre(); })));
  const active = [
    filtre.favorite && { text: '★ Favorite', scoate: () => { filtre.favorite = false; aplicaFiltre(); } },
    filtre.proprii && { text: 'Proprii', scoate: () => { filtre.proprii = false; aplicaFiltre(); } },
    filtre.echipament && { text: filtre.echipament, scoate: () => { filtre.echipament = ''; aplicaFiltre(); } },
    filtre.nivel && { text: filtre.nivel, scoate: () => { filtre.nivel = ''; aplicaFiltre(); } },
    filtre.categorie && { text: filtre.categorie, scoate: () => { filtre.categorie = ''; aplicaFiltre(); } },
  ].filter(Boolean);
  deseneazaFiltreActive($('biblio-active'), active);
  etichetaButonFiltre($('btn-biblio-filtre'), active.length + (filtre.grupa ? 1 : 0));
}

function deschideFiltreExercitii() {
  const echipamente = [...new Set(toateExercitiile().map(e => e.echipament).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ro'));
  const select = (eticheta, cheie, valori, refa) => {
    const s = el('select', { 'aria-label': eticheta, onchange: () => { filtre[cheie] = s.value; aplicaFiltre(); refa(); } },
      [el('option', { value: '', text: 'Oricare' }), ...valori.map(v => el('option', { value: v, text: v, selected: filtre[cheie] === v }))]);
    return el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: eticheta }), s]);
  };
  deschideFoaieFiltre({
    titlu: 'Filtre exerciții',
    deseneaza: refa => [
      el('div', { class: 'chipuri chipuri-mici' }, [
        chipFiltru('★ Favorite', filtre.favorite, () => { filtre.favorite = !filtre.favorite; aplicaFiltre(); refa(); }),
        chipFiltru('Proprii', filtre.proprii, () => { filtre.proprii = !filtre.proprii; aplicaFiltre(); refa(); }),
      ]),
      el('span', { class: 'camp-eticheta mt', text: 'Grupa musculară' }),
      el('div', { class: 'chipuri chipuri-mici' }, ['', ...GRUPE].map(g => chipFiltru(g || 'Toate', filtre.grupa === g, () => { filtre.grupa = g; aplicaFiltre(); refa(); }))),
      el('div', { class: 'grila-2 mt' }, [select('Echipament', 'echipament', echipamente, refa), select('Nivel', 'nivel', NIVELURI, refa)]),
      select('Categorie', 'categorie', CATEGORII, refa),
      el('p', { class: 'nota', text: `${plural(numarExercitiiFiltrate(), 'exercițiu', 'exerciții')} cu filtrele alese.` }),
    ],
    reseteaza: () => { Object.assign(filtre, { grupa: '', echipament: '', nivel: '', categorie: '', favorite: false, proprii: false }); aplicaFiltre(); },
  });
}

function reseteazaFiltrele() {
  Object.assign(filtre, { cautare: '', grupa: '', echipament: '', nivel: '', categorie: '', favorite: false, proprii: false });
  $('biblio-cautare').value = '';
  deseneazaFiltre();
  randeazaBiblioteca();
}

// ---------- Exerciții proprii cu grupa veche „Picioare" ----------
// Din etapa 4 picioarele sunt împărțite în Cvadricepși și Femurali. Pentru exercițiile tale alegi tu.
function deseneazaGrupeVechi() {
  const vechi = toateExercitiile().filter(e => e.grupa === GRUPA_VECHE).sort((a, b) => a.nume.localeCompare(b.nume, 'ro'));
  const zona = $('biblio-vechi');
  if (vechi.length === 0) { zona.replaceChildren(); zona.hidden = true; return; }
  zona.hidden = false;
  zona.replaceChildren(el('div', { class: 'card card-atentie' }, [
    el('h2', { text: 'Alege grupa nouă' }),
    el('p', { class: 'nota', text: `Grupa „Picioare" a fost împărțită în Cvadricepși și Femurali. ${plural(vechi.length, 'exercițiu propriu o mai folosește', 'exerciții proprii o mai folosesc')}. Alege grupa principală pentru fiecare; istoricul se actualizează singur.` }),
    ...vechi.map(e => el('label', { class: 'rand-vechi' }, [
      el('span', { text: e.nume }),
      el('select', { 'aria-label': `Grupa nouă pentru ${e.nume}`, onchange: ev => schimbaGrupaVeche(e, ev.target.value) }, [
        el('option', { value: '', text: 'Alege…' }),
        ...['Cvadricepși', 'Femurali', 'Fese', 'Gambe'].map(g => el('option', { value: g, text: g })),
        el('option', { disabled: true, text: '──────' }),
        ...GRUPE.filter(g => !['Cvadricepși', 'Femurali', 'Fese', 'Gambe'].includes(g)).map(g => el('option', { value: g, text: g })),
      ]),
    ])),
  ]));
}

async function schimbaGrupaVeche(e, grupa) {
  if (!GRUPE.includes(grupa)) return;
  try {
    await seteazaInBiblioteca(e.nume, { grupa });
    await reincarcaBiblioteca();
  } catch (err) {
    console.error(err);
    notifica('Grupa nu a putut fi salvată.', 'eroare');
    return;
  }
  notifica(`${e.nume}: ${grupa}.`, 'succes', 2000);
  randeazaBiblioteca();
  deseneazaExercitii();
}

// ---------- Detaliile unui exercițiu ----------
function statisticiExercitiu(nume) {
  const cheie = nume.toLowerCase();
  const sesiuni = istoric.filter(s => s.exercitii.some(x => x.nume.toLowerCase() === cheie));
  return { numar: sesiuni.length, ultima: sesiuni.length ? sesiuni[sesiuni.length - 1].data : null, record: recorduri.get(cheie) || null };
}

function textRecordExercitiu(r) {
  if (!r) return null;
  if (r.kg > 0 && r.kgRepetari > 0) return `${formatNumar(r.kg)} kg × ${r.kgRepetari} · 1RM estimat ${formatNumar(r.e1rm)} kg`;
  if (r.repetari > 0) return `${r.repetari} repetări`;
  if (r.durata > 0) return `${formatNumar(r.durata)} s`;
  if (r.distanta > 0) return `${formatNumar(r.distanta)} m`;
  return null;
}

function arataDetaliiExercitiu(nume) {
  const e = exercitiuDupaNume(nume);
  if (!e) { notifica('Exercițiul nu mai există în bibliotecă.', 'eroare'); return; }
  const st = statisticiExercitiu(e.nume);
  const alt = alternativePentru(e, toateExercitiile(), 4);
  const inAntrenament = stare.exercitii.some(x => x.nume.toLowerCase() === e.nume.toLowerCase());
  const nota = el('textarea', { rows: '2', placeholder: 'Nota ta (ex. reglaj aparat, priză, ce să eviți)…', 'aria-label': `Nota ta pentru ${e.nume}` });
  nota.value = e.nota;
  const rand = (eticheta, valoare) => valoare ? el('div', { class: 'detaliu-rand' }, [el('span', { text: eticheta }), el('strong', { text: valoare })]) : null;
  const tipNume = TIPURI_EXERCITIU[e.tip]?.nume;

  const continut = el('div', { class: 'detaliu-exercitiu' }, [
    creeazaFigura(e.poza, e.nume, 'ilustratie-mare'),
    el('div', { class: 'detaliu-cap' }, [
      el('div', { class: 'detaliu-etichete' }, [
        e.grupa ? el('span', { class: 'eticheta-grupa', text: e.grupa }) : null,
        e.categorie ? el('span', { class: 'eticheta-tip', text: e.categorie }) : null,
        e.propriu ? el('span', { class: 'eticheta-tip', text: 'Propriu' }) : null,
      ]),
      butonFavorit(e, true),
    ]),
    e.instructiuni ? el('p', { class: 'descriere', text: e.instructiuni }) : null,
    el('div', { class: 'detaliu-lista' }, [
      rand('Mușchi secundari', e.secundari.length ? e.secundari.join(', ') : '—'),
      rand('Echipament', e.echipament),
      rand('Dificultate', e.nivel),
      rand('Tip', tipNume),
    ]),
    el('h3', { class: 'detaliu-titlu', text: 'Progresul tău' }),
    st.numar
      ? el('div', { class: 'detaliu-lista' }, [
        rand('Antrenamente', String(st.numar)),
        rand('Ultima dată', afiseazaData(st.ultima)),
        rand('Cel mai bun', textRecordExercitiu(st.record)),
      ])
      : el('p', { class: 'nota', text: 'Nu l-ai făcut încă.' }),
    el('label', { class: 'camp mt' }, [el('span', { class: 'camp-eticheta', text: 'Nota ta (apare la fiecare antrenament)' }), nota]),
    alt.length ? el('h3', { class: 'detaliu-titlu', text: 'Alternative' }) : null,
    alt.length ? el('div', { class: 'detaliu-alternative' }, alt.map(a => el('button', {
      class: 'alternativa', type: 'button', onclick: () => d.inchide(() => salveazaNotaApoi(e, nota.value, () => arataDetaliiExercitiu(a.nume))),
    }, [el('strong', { text: a.nume }), el('span', { text: [a.echipament, a.nivel].filter(Boolean).join(' · ') })]))) : null,
  ]);

  const d = deschideDialog({
    titlu: e.nume,
    continut,
    laAnulare: () => salveazaNotaApoi(e, nota.value),
    butoane: [
      buton({ text: 'Editează', icon: 'editeaza', tip: 'fantoma', onclick: () => d.inchide(() => salveazaNotaApoi(e, nota.value, () => deschideFormularExercitiu(e.nume))) }),
      buton({
        text: inAntrenament ? 'În antrenament' : 'Adaugă', icon: inAntrenament ? 'bifa' : 'plus', tip: 'principal',
        onclick: () => d.inchide(() => salveazaNotaApoi(e, nota.value, () => { if (!inAntrenament) adaugaInSesiune([e.nume], []); else arataEcran('ecran-sesiune'); })),
      }),
    ],
  });
}

// Salvează nota (dacă s-a schimbat), apoi continuă.
async function salveazaNotaApoi(e, text, dupa) {
  const curat = text.trim();
  if (curat !== (e.nota || '')) {
    try {
      await seteazaInBiblioteca(e.nume, { nota: curat });
      await reincarcaBiblioteca();
      notifica('Notă salvată.', 'succes', 1800);
      deseneazaExercitii();
    } catch (err) {
      console.error(err);
      notifica('Nota nu a putut fi salvată.', 'eroare');
    }
  }
  if (dupa) dupa();
}

// ---------- Formular: exercițiu nou sau editare ----------
// Pentru exercițiile din catalog poți schimba doar grupa și tipul; pentru cele proprii, tot.
function deschideFormularExercitiu(nume, numeSugerat = '', laSalvare = null) {
  const e = nume ? exercitiuDupaNume(nume) : null;
  const propriu = !e || e.propriu;
  const select = (id, valori, valoare, eticheta) => el('label', { class: 'camp' }, [
    el('span', { class: 'camp-eticheta', text: eticheta }),
    el('select', { id }, valori.map(([v, t]) => el('option', { value: v, text: t, selected: v === valoare }))),
  ]);
  const tipuri = Object.entries(TIPURI_EXERCITIU).map(([k, t]) => [k, t.nume]);
  const secundari = new Set(e ? e.secundari : []);
  const chipuriMuschi = el('div', { class: 'chipuri' }, MUSCHI.map(m => el('button', {
    class: 'chip chip-mic' + (secundari.has(m) ? ' activ' : ''), type: 'button', text: m, 'aria-pressed': String(secundari.has(m)),
    onclick: ev => {
      if (secundari.has(m)) secundari.delete(m); else secundari.add(m);
      ev.currentTarget.classList.toggle('activ', secundari.has(m));
      ev.currentTarget.setAttribute('aria-pressed', String(secundari.has(m)));
    },
  })));
  const instructiuni = el('textarea', { id: 'fx-instructiuni', rows: '3', placeholder: 'Cum se execută, pe scurt…' });
  instructiuni.value = e ? e.instructiuni : '';
  const eroare = el('p', { class: 'nota nota-avertizare', role: 'alert', hidden: true });

  const continut = el('div', { class: 'formular-exercitiu', oninput: () => {
    if (!redenumireConfirmata) return;
    redenumireConfirmata = false;
    eroare.hidden = true;
    butonSalveaza.querySelector('span').textContent = 'Salvează';
  } }, propriu ? [
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Nume' }),
      el('input', { id: 'fx-nume', type: 'text', value: e ? e.nume : numeSugerat, autocomplete: 'off', maxlength: '80' })]),
    select('fx-grupa', [['', 'Alege…'], ...GRUPE.map(g => [g, g])], e && GRUPE.includes(e.grupa) ? e.grupa : filtre.grupa, 'Grupa principală'),
    el('div', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Mușchi secundari (opțional)' }), chipuriMuschi]),
    el('div', { class: 'rand' }, [
      select('fx-echipament', ECHIPAMENTE.map(x => [x, x]), e?.echipament || 'Gantere', 'Echipament'),
      select('fx-categorie', CATEGORII.map(x => [x, x]), e?.categorie || 'Compus', 'Categorie'),
    ]),
    el('div', { class: 'rand' }, [
      select('fx-nivel', NIVELURI.map(x => [x, x]), e?.nivel || 'Începător', 'Dificultate'),
      select('fx-tip', tipuri, e?.tip || 'greutate', 'Tip'),
    ]),
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Instrucțiuni (opțional)' }), instructiuni]),
    eroare,
  ] : [
    el('p', { class: 'nota', text: 'Exercițiu din catalog: poți schimba grupa principală și tipul. Restul detaliilor rămân cele din catalog.' }),
    select('fx-grupa', GRUPE.map(g => [g, g]), e.grupa, 'Grupa principală'),
    select('fx-tip', tipuri, e.tip, 'Tip'),
    eroare,
  ]);

  const butoane = [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() })];
  if (e && e.propriu) butoane.unshift(buton({ icon: 'cos', tip: 'pericol', eticheta: `Șterge ${e.nume}`, onclick: () => d.inchide(() => stergeExercitiuPropriu(e)) }));
  butoane.push(buton({ text: 'Salvează', icon: 'bifa', tip: 'principal', onclick: () => salveaza() }));
  const d = deschideDialog({ titlu: e ? `Editează: ${e.nume}` : 'Exercițiu nou', continut, butoane });

  let redenumireConfirmata = false;
  const butonSalveaza = butoane[butoane.length - 1];

  async function salveaza() {
    const arataEroare = (text, avertizare = true) => {
      eroare.textContent = text;
      eroare.hidden = false;
      eroare.classList.toggle('nota-avertizare', avertizare);
      eroare.classList.toggle('nota-info', !avertizare);
    };
    if (!propriu) {
      const grupa = $('fx-grupa').value;
      const tip = $('fx-tip').value;
      try {
        await seteazaInBiblioteca(e.nume, { grupa, tip });
        await reincarcaBiblioteca();
      } catch (err) {
        console.error(err);
        arataEroare('Modificările nu au putut fi salvate.');
        return;
      }
      for (const x of stare.exercitii) if (x.nume.toLowerCase() === e.nume.toLowerCase() && !x.serii.some(s => s.facut)) x.tip = tip;
      d.inchide();
      dupaModificare(`${e.nume} a fost actualizat.`);
      return;
    }
    const existente = new Set(exercitiiBiblioteca.keys());
    const v = valideazaExercitiuPropriu({
      nume: $('fx-nume').value, grupa: $('fx-grupa').value, secundari: [...secundari],
      echipament: $('fx-echipament').value, categorie: $('fx-categorie').value, nivel: $('fx-nivel').value,
      tip: $('fx-tip').value, instructiuni: instructiuni.value,
    }, existente, e ? e.nume : null);
    if (!v.ok) { arataEroare(v.eroare); return; }
    const inregistrare = { ...v.date, favorit: e ? e.favorit : false, nota: e ? e.nota : '', creat: Date.now() };
    const redenumit = e && e.nume !== v.date.nume;
    try {
      if (redenumit) {
        const st = statisticiExercitiu(e.nume);
        const rutine = (await toateRutinele()).filter(r => r.exercitii.some(x => x.toLowerCase() === e.nume.toLowerCase())).length;
        if (st.numar || rutine) {
          // Confirmarea apare în formular (nu într-un dialog nou), ca datele scrise să nu se piardă.
          if (!redenumireConfirmata) {
            redenumireConfirmata = true;
            arataEroare(`„${e.nume}" va deveni „${v.date.nume}" și în ${plural(st.numar, 'antrenament salvat', 'antrenamente salvate')}${rutine ? ` și ${plural(rutine, 'rutină', 'rutine')}` : ''}. Se face automat o copie de siguranță înainte. Apasă „Redenumește" ca să confirmi.`, false);
            butonSalveaza.querySelector('span').textContent = 'Redenumește';
            return;
          }
          await salveazaInstantaneu('Înainte de redenumirea unui exercițiu', await construiesteBackup());
        }
        await redenumesteExercitiu(e.nume, inregistrare);
        for (const x of stare.exercitii) if (x.nume.toLowerCase() === e.nume.toLowerCase()) x.nume = v.date.nume;
        programeazaCiorna();
        await reincarcaIstoric();
      } else {
        await scrieInBiblioteca(inregistrare);
      }
      await reincarcaBiblioteca();
    } catch (err) {
      console.error(err);
      arataEroare('Exercițiul nu a putut fi salvat. Nimic nu a fost modificat.');
      return;
    }
    for (const x of stare.exercitii) if (x.nume.toLowerCase() === v.date.nume.toLowerCase() && !x.serii.some(s => s.facut)) x.tip = v.date.tip;
    d.inchide();
    dupaModificare(e ? `${v.date.nume} a fost actualizat.` : `${v.date.nume} a fost adăugat în bibliotecă.`);
    if (laSalvare) laSalvare(v.date.nume);
  }
}

function dupaModificare(mesaj) {
  deseneazaFiltre();
  randeazaBiblioteca();
  deseneazaExercitii();
  notifica(mesaj, 'succes');
}

async function stergeExercitiuPropriu(e) {
  const st = statisticiExercitiu(e.nume);
  const da = await confirma({
    titlu: 'Ștergi exercițiul?',
    text: st.numar
      ? `„${e.nume}" dispare din bibliotecă. ${st.numar === 1 ? 'Antrenamentul în care apare rămâne' : `Cele ${plural(st.numar, 'antrenament', 'antrenamente')} în care apare rămân`} în istoric, cu toate seriile.`
      : `„${e.nume}" dispare din bibliotecă.`,
    ok: 'Șterge', pericol: true,
  });
  if (!da) return;
  try {
    await stergeDinBiblioteca(e.nume);
    await reincarcaBiblioteca();
  } catch (err) {
    console.error(err);
    notifica('Exercițiul nu a putut fi șters.', 'eroare');
    return;
  }
  dupaModificare(`${e.nume} a fost șters din bibliotecă.`);
}

// ---------- Selectorul rapid (din antrenament) ----------
// optiuni: { titlu, unul (alegere unică), sugestii (nume), eticheteSugestii, grupaInitiala, laAlegere(nume[]) }
function deschideSelectorExercitii({ titlu, unul = false, sugestii = [], eticheteSugestii = 'Sugestii', grupaInitiala = '', laAlegere }) {
  const sel = { cautare: '', grupa: grupaInitiala, mod: sugestii.length ? 'sugestii' : (toateExercitiile().some(e => e.favorit) ? 'favorite' : (istoric.length ? 'recente' : 'toate')) };
  const alese = [];
  const inAntrenament = new Set(stare.exercitii.map(x => x.nume.toLowerCase()));
  const cautare = el('input', { type: 'search', placeholder: 'Caută exercițiu sau mușchi', 'aria-label': 'Caută exercițiu', autocomplete: 'off' });
  const chipuri = el('div', { class: 'chipuri' });
  const selectGrupa = el('select', { 'aria-label': 'Grupa musculară', onchange: ev => { sel.grupa = ev.target.value; if (sel.grupa) sel.mod = 'toate'; deseneaza(); } },
    [el('option', { value: '', text: 'Toate grupele' }), ...GRUPE.map(g => el('option', { value: g, text: g }))]);
  const lista = el('div', { class: 'selector-lista', role: 'listbox', 'aria-multiselectable': String(!unul) });
  const btnAdauga = buton({ text: 'Adaugă', icon: 'plus', tip: 'principal', onclick: () => { if (alese.length) d.inchide(() => laAlegere([...alese])); } });

  const moduri = [
    ...(sugestii.length ? [['sugestii', eticheteSugestii]] : []),
    ['favorite', '★ Favorite'], ['recente', 'Recente'], ['toate', 'Toate'],
  ];

  function deseneaza() {
    chipuri.replaceChildren(...moduri.map(([m, t]) => el('button', {
      class: 'chip chip-mic' + (sel.mod === m && !sel.grupa ? ' activ' : ''), type: 'button', text: t,
      onclick: () => { sel.mod = m; sel.grupa = ''; selectGrupa.value = ''; deseneaza(); },
    })));
    selectGrupa.value = sel.grupa;
    const cuvinte = fara(sel.cautare).split(/\s+/).filter(Boolean);
    let rezultate;
    if (cuvinte.length || sel.grupa || sel.mod === 'toate') {
      rezultate = ordoneaza(toateExercitiile().filter(e => (!sel.grupa || e.grupa === sel.grupa) && potrivireCautare(e, cuvinte)));
    } else if (sel.mod === 'sugestii') {
      rezultate = sugestii.map(exercitiuDupaNume).filter(Boolean);
    } else if (sel.mod === 'favorite') {
      rezultate = ordoneaza(toateExercitiile().filter(e => e.favorit));
    } else {
      rezultate = exercitiiRecente(20).map(exercitiuDupaNume).filter(Boolean);
    }
    const goale = {
      favorite: 'Niciun favorit încă. Apasă steaua unui exercițiu în bibliotecă.',
      recente: 'Niciun exercițiu în istoric încă.',
      sugestii: 'Nicio alternativă găsită.',
    };
    const randuri = rezultate.map(e => {
      const ales = alese.includes(e.nume);
      const deja = inAntrenament.has(e.nume.toLowerCase());
      return el('button', {
        class: 'selector-rand' + (ales ? ' ales' : ''), type: 'button', role: 'option', 'aria-selected': String(ales), disabled: deja && !unul,
        onclick: () => {
          if (unul) { d.inchide(() => laAlegere([e.nume])); return; }
          const i = alese.indexOf(e.nume);
          if (i >= 0) alese.splice(i, 1); else alese.push(e.nume);
          deseneaza();
        },
      }, [
        figuraExercitiu(e, 'figura-mica'),
        el('span', { class: 'rand-biblio-text' }, [el('strong', { text: e.nume }), el('span', { class: 'nota', text: deja ? 'Deja în antrenament' : metaExercitiu(e) })]),
        e.favorit ? iconita('stea', 'iconita mica stea-mica') : null,
        unul ? null : el('span', { class: 'selector-bifa' }, [ales ? iconita('bifa', 'iconita mica') : null]),
      ]);
    });
    if (!randuri.length) {
      randuri.push(el('p', { class: 'nota selector-gol', text: cuvinte.length ? 'Niciun exercițiu găsit.' : (goale[sel.mod] || 'Nimic aici.') }));
    }
    // Un nume care nu există poate fi adăugat direct (îi alegi grupa în antrenament) sau creat ca exercițiu propriu.
    const scris = sel.cautare.trim().replace(/\s+/g, ' ');
    if (scris.length >= 2 && !exercitiuDupaNume(scris)) {
      randuri.push(el('div', { class: 'rand-butoane' }, [
        buton({ text: `Adaugă „${scris}"`, icon: 'plus', tip: 'secundar', onclick: () => d.inchide(() => laAlegere([scris])) }),
        buton({ text: 'Creează exercițiu', tip: 'fantoma', onclick: () => d.inchide(() => deschideFormularExercitiu(null, scris, n => laAlegere([n]))) }),
      ]));
    }
    lista.replaceChildren(...randuri);
    btnAdauga.querySelector('span').textContent = alese.length ? `Adaugă (${alese.length})` : 'Adaugă';
    btnAdauga.disabled = alese.length === 0;
  }

  cautare.addEventListener('input', () => { sel.cautare = cautare.value; deseneaza(); });
  const d = deschideDialog({
    titlu,
    continut: el('div', { class: 'selector' }, [el('div', { class: 'cautare' }, [iconita('cauta'), cautare]), chipuri, selectGrupa, lista]),
    butoane: unul ? [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() })]
      : [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }), btnAdauga],
  });
  d.caseta?.classList.add('dialog-inalt');
  deseneaza();
}

// ---------- Rutine și șabloane ----------
function cardAntrenament(a) {
  return el('article', { class: 'card' }, [
    el('h3', { text: a.nume }),
    el('p', { class: 'descriere', text: a.descriere }),
    el('p', { class: 'nota', text: a.exercitii.join(' · ') }),
    buton({ text: 'Adaugă în antrenament', icon: 'plus', tip: 'principal', lat: true, onclick: () => adaugaInSesiune(a.exercitii, a.grupe) }),
  ]);
}

async function randeazaAntrenamente() {
  const rutine = await toateRutinele();
  const lista = $('biblio-lista');
  const continut = [el('h2', { class: 'titlu-sectiune', text: 'Rutinele mele' })];
  if (rutine.length === 0) {
    continut.push(stareGoala({ icon: 'lista', titlu: 'Nicio rutină salvată',
      text: 'În timpul unui antrenament apasă „Salvează ca rutină", sau fă asta dintr-o sesiune din Istoric.' }));
  } else {
    continut.push(...[...rutine].reverse().map(cardRutina));
  }
  continut.push(el('h2', { class: 'titlu-sectiune', text: 'Șabloane' }), ...ANTRENAMENTE.map(cardAntrenament));
  if (modBiblioteca === 'antrenamente') lista.replaceChildren(...continut);
}

function cardRutina(r) {
  return el('article', { class: 'card' }, [
    el('h3', { text: r.nume }),
    r.grupe?.length ? el('p', { class: 'nota', text: r.grupe.join(' · ') }) : null,
    el('p', { class: 'descriere', text: r.exercitii.join(' · ') }),
    el('div', { class: 'rand-butoane' }, [
      buton({ icon: 'cos', tip: 'fantoma', eticheta: `Șterge rutina ${r.nume}`, onclick: () => stergeRutinaConfirmat(r) }),
      buton({ text: 'Adaugă în antrenament', icon: 'plus', tip: 'principal', onclick: () => adaugaInSesiune(r.exercitii, r.grupe || []) }),
    ]),
  ]);
}

async function stergeRutinaConfirmat(r) {
  const da = await confirma({ titlu: 'Ștergi rutina?', text: `Rutina „${r.nume}" se mută în „Șterse recent" (Setări), unde rămâne 30 de zile. Istoricul antrenamentelor nu se schimbă.`, ok: 'Șterge', pericol: true });
  if (!da) return;
  let idCos;
  try {
    idCos = await stergeRutina(r.id, `„${r.nume}"`);
  } catch (err) {
    console.error(err);
    notifica('Rutina nu a putut fi ștearsă.', 'eroare');
    return;
  }
  randeazaBiblioteca();
  deseneazaCos().catch(() => {});
  notificaStergere('Rutină ștearsă.', idCos, () => dupaRestaurareDinCos('rutine'));
}

// ---------- Adăugarea în antrenament ----------
// Adaugă exercițiile în sesiunea curentă, cu grupele lor. Grupa veche „Picioare" din rutinele vechi
// e înlocuită de grupele reale ale exercițiilor.
async function adaugaInSesiune(exercitii, grupe = [], { faraNavigare = false } = {}) {
  grupe.filter(g => GRUPE.includes(g)).forEach(g => stare.grupe.add(g));

  let adaugate = 0;
  for (const nume of exercitii) {
    const exista = stare.exercitii.some(e => e.nume.toLowerCase() === nume.toLowerCase());
    if (exista) continue;
    $('exercitiu-nume').value = nume;
    await adaugaExercitiu();
    adaugate++;
  }
  $('exercitiu-nume').value = '';
  deseneazaGrupe();
  programeazaCiorna();
  if (!faraNavigare) arataEcran('ecran-sesiune');
  notifica(adaugate > 0
    ? `Adăugate în antrenament: ${plural(adaugate, 'exercițiu', 'exerciții')}.`
    : 'Exercițiile sunt deja în antrenament.', adaugate > 0 ? 'succes' : 'info');
}

// Deschide ecranul Exerciții pe fila cerută ('exercitii' sau 'antrenamente').
function deschideBiblioteca(fila) {
  arataFilaBiblioteca(fila);
  arataEcran('ecran-biblioteca');
}

function arataFilaBiblioteca(fila) {
  modBiblioteca = fila;
  const ex = fila === 'exercitii';
  $('tab-exercitii').classList.toggle('activ', ex);
  $('tab-antrenamente').classList.toggle('activ', !ex);
  $('tab-exercitii').setAttribute('aria-selected', String(ex));
  $('tab-antrenamente').setAttribute('aria-selected', String(!ex));
  $('biblio-filtre').hidden = !ex;
  $('biblio-vechi').hidden = !ex || !$('biblio-vechi').childElementCount;
  randeazaBiblioteca();
}

// Deschide biblioteca filtrată pe o grupă musculară (folosit din panoul Acasă).
function deschideBibliotecaPeGrupa(grupa) {
  Object.assign(filtre, { cautare: '', grupa: GRUPE.includes(grupa) ? grupa : '', echipament: '', nivel: '', categorie: '', favorite: false, proprii: false });
  $('biblio-cautare').value = '';
  deseneazaFiltre();
  deschideBiblioteca('exercitii');
}

function initBiblioteca() {
  $('tab-exercitii').addEventListener('click', () => arataFilaBiblioteca('exercitii'));
  $('tab-antrenamente').addEventListener('click', () => arataFilaBiblioteca('antrenamente'));
  $('biblio-cautare').addEventListener('input', e => { filtre.cautare = e.target.value.trim(); randeazaBiblioteca(); });
  $('btn-biblio-filtre').addEventListener('click', deschideFiltreExercitii);
  $('btn-sterge-filtre').addEventListener('click', reseteazaFiltrele);
  $('btn-exercitiu-nou').addEventListener('click', () => deschideFormularExercitiu(null, filtre.cautare));
  deseneazaFiltre();
  randeazaBiblioteca();
}
