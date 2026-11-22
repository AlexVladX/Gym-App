// Nutriție → fila „Listă” (etapa 10): lista de cumpărături din mesele planificate. Calculele: nutritie-cumparaturi.js.
// Lista se reconstruiește la fiecare afișare din zilele salvate, deci urmează orice schimbare a planului.

let perioadaLista = 'restul';
let stareLista = null;   // ce ai făcut tu pe lista intervalului afișat
let listaAfisata = null; // ultima listă construită (pentru export)

function intervalLista(cheie) {
  const azi = dataLocala();
  const sapt = zileSaptamana(azi);
  if (cheie === 'azi') return { de: azi, pana: azi, nume: 'Azi' };
  if (cheie === 'maine') { const m = mutaData(azi, 1); return { de: m, pana: m, nume: 'Mâine' }; }
  if (cheie === 'urmatoare') { const u = zileSaptamana(mutaData(sapt[0], 7)); return { de: u[0], pana: u[6], nume: 'Săptămâna viitoare' }; }
  if (cheie === 'zi') return { de: dataZiNutritie, pana: dataZiNutritie, nume: afiseazaData(dataZiNutritie) };
  return { de: azi, pana: sapt[6], nume: azi === sapt[6] ? 'Azi (duminică)' : 'Restul săptămânii' };
}

function titluInterval(iv) {
  return iv.de === iv.pana ? afiseazaData(iv.de) : `${afiseazaData(iv.de)} – ${afiseazaData(iv.pana)}`;
}

async function salveazaStareaListei(mesajEroare = 'Lista nu a putut fi salvată.') {
  try { await salveazaListaCumparaturi(stareLista); return true; } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, mesajEroare), 'eroare');
    return false;
  }
}

async function randeazaListaCumparaturi() {
  const cont = $('nutritie-lista');
  if (!cont.childElementCount) cont.replaceChildren(stareIncarcare(3));
  const iv = intervalLista(perioadaLista);
  let zile;
  try {
    zile = [];
    for (let d = iv.de; d <= iv.pana; d = mutaData(d, 1)) zile.push(await citesteZiNutritie(d));
    stareLista = await citesteListaCumparaturi(iv.de, iv.pana);
  } catch (err) {
    console.error(err);
    cont.replaceChildren(stareGoala({ icon: 'avertizare', titlu: 'Lista nu a putut fi citită', text: 'Reîncarcă aplicația.' }));
    return;
  }
  const lista = construiesteLista({ zile, idx: indexNutritie, retete: toateRetetele(), stare: stareLista });
  listaAfisata = { lista, iv };

  const optiuni = [['azi', 'Azi'], ['maine', 'Mâine'], ['restul', 'Restul săptămânii'], ['urmatoare', 'Săptămâna viitoare']];
  if (![dataLocala(), mutaData(dataLocala(), 1)].includes(dataZiNutritie)) optiuni.push(['zi', `Ziua ${afiseazaData(dataZiNutritie).slice(0, 5)}`]);
  const copii = [el('div', { class: 'chipuri chipuri-defilare perioade', role: 'group', 'aria-label': 'Pentru ce zile' },
    optiuni.map(([cheie, nume]) => el('button', { type: 'button', class: 'chip' + (cheie === perioadaLista ? ' activ' : ''), 'aria-pressed': String(cheie === perioadaLista),
      text: nume, onclick: () => { perioadaLista = cheie; randeazaListaCumparaturi(); } })))];

  // Sumarul
  const procent = lista.total ? Math.round(lista.cumparate / lista.total * 100) : 0;
  copii.push(el('div', { class: 'card' }, [
    titluCard('Lista de cumpărături', el('span', { class: 'nota', text: titluInterval(iv) })),
    lista.total ? el('p', { class: 'lista-sumar' }, [el('strong', { text: `${lista.cumparate} / ${lista.total}` }), ` cumpărate · din ${plural(lista.mese, 'masă planificată', 'mese planificate')}`]) : null,
    lista.total ? el('span', { class: 'zi-bara' }, [el('i', { class: 'zi-bara-mancat nutri-c', style: `width:${procent}%` })]) : null,
    lista.excluseMancate ? el('p', { class: 'nota nota-mica', text: `${plural(lista.excluseMancate, 'masă deja mâncată (sau începută) nu intră', 'mese deja mâncate (sau începute) nu intră')} în listă.` }) : null,
    lista.faraIngrediente ? el('p', { class: 'nota nota-mica nota-avertizare', text: `${plural(lista.faraIngrediente, 'masă nu are', 'mese nu au')} ingrediente cunoscute (rețeta a fost ștearsă) și nu intră în listă.` }) : null,
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Adaugă', icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Adaugă un articol propriu', onclick: adaugaArticolPropriu }),
      buton({ text: 'Exportă', icon: 'descarca', tip: 'secundar', mic: true, eticheta: 'Exportă lista ca text', onclick: exportaLista, }),
      buton({ text: 'Copiază', icon: 'copiaza', tip: 'secundar', mic: true, eticheta: 'Copiază lista', onclick: copiazaLista }),
    ]),
  ].filter(Boolean)));

  if (!lista.total) {
    copii.push(el('div', { class: 'card' }, [stareGoala({ icon: 'lista', titlu: 'Nimic de cumpărat',
      text: lista.mese || lista.excluseMancate ? 'Toate articolele au fost scoase sau mesele sunt deja mâncate.' : `Nu ai mese planificate pentru ${iv.nume.toLowerCase()}. Generează planul zilei sau al săptămânii și lista se face singură.`,
      actiune: buton({ text: iv.de === iv.pana ? 'Planifică ziua' : 'Planifică săptămâna', icon: 'zar', tip: 'secundar', onclick: () => {
        if (iv.de === iv.pana) { dataZiNutritie = iv.de; arataFilaNutritie('zi'); } else { dataSaptamana = iv.de; arataFilaNutritie('saptamana'); }
      } }) })]));
  }

  for (const c of lista.categorii) {
    copii.push(el('section', { class: 'card lista-categorie', 'aria-label': c.nume }, [
      titluCard(c.nume, el('span', { class: 'nota', text: `${c.articole.filter(a => a.cumparat).length}/${c.articole.length}` })),
      el('ul', { class: 'lista-articole' }, c.articole.map(randArticol)),
    ]));
  }

  if (lista.eliminate) {
    copii.push(el('div', { class: 'card' }, [
      el('p', { class: 'nota', text: `${plural(lista.eliminate, 'ingredient scos', 'ingrediente scoase')} de pe listă (de exemplu, le ai deja acasă).` }),
      buton({ text: 'Pune-le înapoi', icon: 'schimba', tip: 'fantoma', mic: true, onclick: async () => {
        stareLista = { ...stareLista, eliminate: {} };
        if (await salveazaStareaListei()) randeazaListaCumparaturi();
      } }),
    ]));
  }
  copii.push(el('p', { class: 'nota nota-sursa', text: 'Cantitățile sunt ale ingredientelor crude, pentru porțiile planificate, rotunjite în sus. Lista se actualizează singură când schimbi mesele; bifele, articolele tale și cantitățile modificate rămân.' }));
  cont.replaceChildren(...copii.filter(Boolean));
}

function randArticol(a) {
  return el('li', { class: 'articol' + (a.cumparat ? ' cumparat' : '') }, [
    el('button', { type: 'button', class: 'acasa-bifa' + (a.cumparat ? ' activ' : ''), 'aria-pressed': String(a.cumparat),
      'aria-label': a.cumparat ? `${a.nume}: cumpărat. Debifează` : `Bifează ${a.nume} ca cumpărat`, onclick: () => comutaCumparat(a) }, [iconita('bifa', 'iconita mica')]),
    el('button', { type: 'button', class: 'articol-text', onclick: () => deschideArticol(a), 'aria-label': `${a.nume}, ${a.text}. Detalii` }, [
      el('span', { class: 'articol-nume', text: a.nume }),
      el('span', { class: 'articol-cantitate' + (a.editat ? ' editat' : ''), text: a.text || (a.personalizat ? 'articol adăugat de tine' : '') }),
      a.planSchimbat ? el('span', { class: 'nota nota-mica nota-avertizare', text: `planul cere acum ${a.textPlan}` }) : null,
      !a.personalizat && a.surse.length > 1 ? el('span', { class: 'nota nota-mica', text: `pentru ${plural(a.surse.length, 'masă', 'mese')}` }) : null,
    ]),
    el('button', { type: 'button', class: 'btn btn-fantoma btn-icon btn-mic', 'aria-label': `Scoate ${a.nume} de pe listă`, onclick: () => scoateArticol(a) }, [iconita('x')]),
  ]);
}

async function comutaCumparat(a) {
  if (a.personalizat) {
    stareLista = { ...stareLista, personalizate: stareLista.personalizate.map(p => (p.id === a.id ? { ...p, cumparat: !p.cumparat } : p)) };
  } else {
    const c = { ...stareLista.cumparate };
    if (c[a.id]) delete c[a.id]; else c[a.id] = true;
    stareLista = { ...stareLista, cumparate: c };
  }
  if (await salveazaStareaListei()) randeazaListaCumparaturi();
}

async function scoateArticol(a) {
  const inainte = stareLista;
  if (a.personalizat) stareLista = { ...stareLista, personalizate: stareLista.personalizate.filter(p => p.id !== a.id) };
  else stareLista = { ...stareLista, eliminate: { ...stareLista.eliminate, [a.id]: true } };
  if (!(await salveazaStareaListei())) return;
  randeazaListaCumparaturi();
  notifica(`${a.nume} a fost scos de pe listă.`, 'info', 5000, { text: 'Anulează', onclick: async () => {
    stareLista = inainte;
    if (await salveazaStareaListei()) randeazaListaCumparaturi();
  } });
}

function deschideArticol(a) {
  if (a.personalizat) { editeazaArticolPropriu(a); return; }
  const aliment = indexNutritie.get(a.id);
  const input = el('input', { type: 'number', inputmode: 'decimal', step: '5', min: '1', max: '100000', value: String(a.editat ? Math.round(a.grame) : rotunjesteCumparare(a.grame)), 'aria-label': 'Cantitatea în grame' });
  const previzualizare = el('p', { class: 'nota' });
  const actualizeaza = () => {
    const g = parseFloat(String(input.value).replace(',', '.'));
    previzualizare.textContent = g > 0 ? `Pe listă: ${textCantitateCumparare(aliment, g, { exact: true })}` : 'Scrie o cantitate mai mare ca 0.';
  };
  input.addEventListener('input', actualizeaza);
  actualizeaza();
  const d = deschideDialog({
    titlu: a.nume,
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'nota', text: `Din plan: ${a.textPlan}${a.editat ? ` · pe listă ai pus ${a.text}` : ''}` }),
      el('ul', { class: 'lista-surse' }, a.surse.map(s => el('li', {}, [
        el('span', { text: `${afiseazaData(s.data).slice(0, 5)} · ${numeMasa(s.masa)}` }),
        el('span', { class: 'nota', text: `${s.nume} — ${Math.round(s.grame)} g` }),
      ]))),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Cantitate pe listă (g)' }), input]),
      previzualizare,
    ]),
    butoane: [
      a.editat ? buton({ text: 'Ca în plan', tip: 'fantoma', onclick: async () => {
        const c = { ...stareLista.cantitati }; delete c[a.id];
        stareLista = { ...stareLista, cantitati: c };
        d.inchide();
        if (await salveazaStareaListei()) randeazaListaCumparaturi();
      } }) : buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        const g = parseFloat(String(input.value).replace(',', '.'));
        if (!(g > 0 && g <= 100000)) { notifica('Scrie o cantitate între 1 și 100.000 g.', 'eroare'); return; }
        stareLista = { ...stareLista, cantitati: { ...stareLista.cantitati, [a.id]: { grame: g, laPlan: a.grameDinPlan } } };
        d.inchide();
        if (await salveazaStareaListei()) randeazaListaCumparaturi();
      } }),
    ],
  });
}

function formularArticolPropriu(p, laSalvare, titlu) {
  const nume = el('input', { type: 'text', maxlength: '80', value: p ? p.nume : '', placeholder: 'ex. Detergent, cafea', 'aria-label': 'Nume' });
  const cantitate = el('input', { type: 'text', maxlength: '40', value: p ? p.cantitate : '', placeholder: 'ex. 2 pachete', 'aria-label': 'Cantitate' });
  const cat = el('select', { 'aria-label': 'Categorie' }, CATEGORII_CUMPARATURI.map(c => el('option', { value: c.id, text: c.nume, selected: (p ? p.cat : 'altele') === c.id })));
  const d = deschideDialog({
    titlu,
    continut: el('div', { class: 'formular' }, [
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Nume' }), nume]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Cantitate (opțional)' }), cantitate]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Categorie' }), cat]),
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', tip: 'principal', onclick: async () => {
        if (!nume.value.trim()) { notifica('Scrie numele articolului.', 'eroare'); nume.focus(); return; }
        d.inchide();
        await laSalvare({ nume: nume.value.trim(), cantitate: cantitate.value.trim(), cat: cat.value });
      } }),
    ],
  });
}

function adaugaArticolPropriu() {
  formularArticolPropriu(null, async v => {
    stareLista = { ...stareLista, personalizate: [...stareLista.personalizate, { id: idNutritieNou(), ...v, cumparat: false }] };
    if (await salveazaStareaListei()) { randeazaListaCumparaturi(); notifica(`${v.nume} adăugat pe listă.`, 'succes', 2500); }
  }, 'Adaugă pe listă');
}

function editeazaArticolPropriu(a) {
  const p = stareLista.personalizate.find(x => x.id === a.id);
  if (!p) return;
  formularArticolPropriu(p, async v => {
    stareLista = { ...stareLista, personalizate: stareLista.personalizate.map(x => (x.id === p.id ? { ...x, ...v } : x)) };
    if (await salveazaStareaListei()) randeazaListaCumparaturi();
  }, 'Modifică articolul');
}

function textListaAfisate() {
  const { lista, iv } = listaAfisata;
  return textLista(lista, `Lista de cumpărături — ${titluInterval(iv)}`);
}

async function exportaLista() {
  if (!listaAfisata || !listaAfisata.lista.total) { notifica('Lista e goală.', 'eroare'); return; }
  const rez = await trimiteFisier(new Blob([textListaAfisate()], { type: 'text/plain;charset=utf-8' }), `lista-cumparaturi-${listaAfisata.iv.de}.txt`);
  if (rez === 'descarcat') notifica('Lista a fost descărcată ca fișier text.', 'succes');
}

async function copiazaLista() {
  if (!listaAfisata || !listaAfisata.lista.total) { notifica('Lista e goală.', 'eroare'); return; }
  try {
    await navigator.clipboard.writeText(textListaAfisate());
    notifica('Lista a fost copiată. O poți lipi într-un mesaj sau în Notițe.', 'succes');
  } catch (_) {
    notifica('Copierea nu e permisă aici; folosește „Exportă”.', 'eroare');
  }
}
