// Etapa 7, funcția 2: „Copiază ziua de ieri” (și din altă zi), copierea unei mese, „Ca ieri” pe mesele goale.
// Logica e în nutritie-zi.js (copieZi, copieMasa, rezumatMeseZi, sugestieCaIeri). Copiile sunt intrări noi; ziua sursă nu
// se schimbă; după copiere, „Anulează” readuce ziua exact cum era. Mesele mâncate nu se șterg fără o confirmare separată.

let ziIeriNutritie = { data: '', mese: [] }; // ziua dinaintea celei afișate (pentru „Ca ieri” și „Copiază ziua de ieri”)

async function incarcaZiIeri() {
  const d = mutaData(dataZiNutritie, -1);
  try { ziIeriNutritie = await citesteZiNutritie(d); } catch (err) { console.warn(err); ziIeriNutritie = { data: d, mese: [] }; }
}

function textRezumatZi(zi) {
  const r = rezumatMeseZi(zi);
  return `${plural(r.numar, 'fel de mâncare', 'feluri de mâncare')} · ${fmtNr(r.kcal)} kcal · ${fmtNr(r.proteine)} g proteine`;
}
function numeZiRelativ(data) {
  if (data === dataLocala()) return 'azi';
  if (data === mutaData(dataLocala(), -1)) return 'ieri';
  if (data === mutaData(dataLocala(), 1)) return 'mâine';
  return afiseazaData(data);
}

// ---------- Ziua goală: cardul cu „Copiază ziua de ieri” ----------
function cardCopiereZiGoala() {
  const areIeri = ziIeriNutritie.mese.length > 0;
  return el('section', { class: 'card zi-copiere', 'aria-label': 'Copiază o zi' }, [
    el('h2', { text: 'Ziua e goală' }),
    areIeri ? el('p', { class: 'nota', text: `Ieri (${afiseazaData(ziIeriNutritie.data)}): ${textRezumatZi(ziIeriNutritie)}.` }) : null,
    areIeri ? buton({ text: 'Copiază ziua de ieri', icon: 'copiaza', tip: 'principal', lat: true, onclick: () => deschideCopiereZi(ziIeriNutritie.data) }) : null,
    el('button', { type: 'button', class: 'link-discret', text: areIeri ? 'Copiază din altă zi…' : 'Copiază dintr-o zi notată…', onclick: alegeZiSursa }),
  ]);
}

// Meniul „…” al zilei (lângă „Ținte”).
function meniuZiNutritie() {
  const areIeri = ziIeriNutritie.mese.length > 0;
  alegeDinLista({ titlu: titluZi(dataZiNutritie) === 'Azi' ? 'Azi' : afiseazaData(dataZiNutritie), optiuni: [
    { text: 'Copiază ziua de ieri', icon: 'copiaza', detaliu: areIeri ? textRezumatZi(ziIeriNutritie) : 'Ieri nu ai notat nimic.', dezactivat: !areIeri, actiune: () => deschideCopiereZi(ziIeriNutritie.data) },
    { text: 'Copiază din altă zi…', icon: 'calendar', actiune: alegeZiSursa },
  ] });
}

// ---------- Copierea unei zile în ziua afișată ----------
async function deschideCopiereZi(dataSursa) {
  let sursa, tinta;
  const dataTinta = dataZiNutritie;
  try { [sursa, tinta] = await Promise.all([citesteZiNutritie(dataSursa), citesteZiNutritieSalvata(dataTinta)]); }
  catch (err) { console.error(err); notifica('Zilele nu au putut fi citite.', 'eroare'); return; }
  if (!sursa.mese.length) { notifica('Ziua aleasă nu are mese de copiat.', 'eroare'); return; }
  const areTinta = Boolean(tinta && tinta.mese.length);
  const st = { mod: 'adauga', stare: 'neinceput' };
  const zona = el('div', { class: 'formular' });
  const chipuri = (optiuni, cheie, eticheta) => el('div', { class: 'chipuri chipuri-mici', role: 'radiogroup', 'aria-label': eticheta },
    optiuni.map(([v, t]) => el('button', { type: 'button', role: 'radio', class: 'chip chip-mic' + (st[cheie] === v ? ' activ' : ''), 'aria-checked': String(st[cheie] === v), text: t,
      onclick: () => { st[cheie] = v; deseneaza(); } })));
  const deseneaza = () => zona.replaceChildren(...[
    el('p', { class: 'nota', text: `${numeZiRelativ(dataSursa) === afiseazaData(dataSursa) ? afiseazaData(dataSursa) : `${numeZiRelativ(dataSursa)[0].toUpperCase()}${numeZiRelativ(dataSursa).slice(1)} (${afiseazaData(dataSursa)})`}: ${textRezumatZi(sursa)}.` }),
    el('ul', { class: 'copiere-lista' }, sursa.mese.map(i => el('li', {}, [el('span', { class: 'nota', text: `${numeMasa(i.masa)} · ` }), i.nume]))),
    areTinta ? el('p', { class: 'sectiune-eticheta', text: `${numeZiRelativ(dataTinta) === 'azi' ? 'Azi' : afiseazaData(dataTinta)} ai deja ${plural(tinta.mese.length, 'fel de mâncare', 'feluri de mâncare')}` }) : null,
    areTinta ? chipuri([['adauga', 'Adaug peste ce am'], ['inlocuieste', 'Înlocuiesc ziua']], 'mod', 'Ce faci cu ce e deja în zi') : null,
    areTinta && st.mod === 'inlocuieste' && tinta.mese.some(i => i.stare !== 'neinceput')
      ? el('p', { class: 'nota nota-mica', text: 'Mesele deja mâncate rămân; te întreb separat dacă vrei să le ștergi și pe ele.' }) : null,
    el('p', { class: 'sectiune-eticheta', text: 'Mesele copiate vin' }),
    chipuri([['neinceput', 'Ca planificate'], ['complet', 'Direct ca mâncate']], 'stare', 'Cum vin mesele copiate'),
    el('p', { class: 'nota nota-mica', text: st.stare === 'neinceput' ? 'Le bifezi pe măsură ce mănânci.' : 'Intră direct în caloriile mâncate.' }),
  ].filter(Boolean));
  deseneaza();
  const d = deschideDialog({ titlu: `Copiezi în ${numeZiRelativ(dataTinta) === 'azi' ? 'ziua de azi' : afiseazaData(dataTinta)}?`, continut: zona, butoane: [
    buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
    buton({ text: 'Copiază', icon: 'copiaza', tip: 'principal', onclick: () => d.inchide(() => aplicaCopiereZi(sursa, tinta, dataTinta, st)) }),
  ] });
}

async function aplicaCopiereZi(sursa, tinta, dataTinta, { mod, stare }) {
  let stergeMancate = false;
  const mancate = mod === 'inlocuieste' && tinta ? tinta.mese.filter(i => i.stare !== 'neinceput') : [];
  if (mancate.length) {
    stergeMancate = await confirma({ titlu: 'Ștergi și mesele mâncate?', pericol: true, ok: 'Șterge-le și pe ele', anulare: 'Păstrează-le',
      text: `${plural(mancate.length, 'fel de mâncare e notat', 'feluri de mâncare sunt notate')} ca mâncat${mancate.length === 1 ? '' : 'e'} în ziua aceasta (${mancate.map(i => i.nume).join(', ')}). Dacă le ștergi, dispar din istoricul caloriilor (le găsești 30 de zile în Șterse recent).` });
  }
  const inainte = tinta ? JSON.parse(JSON.stringify(tinta)) : null;
  const r = copieZi({ sursa, tinta, data: dataTinta, mod: tinta && tinta.mese.length ? mod : 'adauga', stare, stergeMancate, idNou: idNutritieNou });
  try {
    await salveazaZiNutritie(r.zi);
    const mancateSterse = r.sterse.filter(i => i.stare !== 'neinceput');
    if (mancateSterse.length) await puneMeseInCos(dataTinta, mancateSterse);
  } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Ziua nu a putut fi copiată.'), 'eroare'); return; }
  await dupaCopiere(dataTinta);
  notifica(`${plural(r.adaugate, 'fel de mâncare copiat', 'feluri de mâncare copiate')}${stare === 'complet' ? ', ca mâncate' : ''}.`, 'succes', 7000,
    { text: 'Anulează', onclick: () => anuleazaCopiere(dataTinta, inainte) });
}

// „Anulează”: ziua revine exact cum era (sau dispare, dacă nu exista).
async function anuleazaCopiere(data, inainte) {
  try {
    if (inainte) await salveazaZiNutritie(inainte);
    else await cere('zileNutritie', 'readwrite', st => st.delete(data));
  } catch (err) { notifica(mesajEroareSalvare(err, 'Nu s-a putut anula.'), 'eroare'); return; }
  if (typeof semnaleazaModificare === 'function') semnaleazaModificare();
  await dupaCopiere(data);
}

async function dupaCopiere(data) {
  if (typeof ecranCurent === 'undefined') return;
  if (ecranCurent === 'ecran-nutritie' && filaNutritie === 'zi' && data === dataZiNutritie) await randeazaZiNutritie({ reincarca: true });
  else if (ecranCurent === 'ecran-nutritie' && filaNutritie === 'saptamana' && typeof randeazaSaptamana === 'function') await randeazaSaptamana();
  else if (ecranCurent === 'ecran-masa') randeazaAcasaMasa();
}

// ---------- Calendar simplu: alegi ziua din care copiezi (zilele cu mese sunt marcate) ----------
async function alegeZiSursa() {
  let cuMese;
  try { cuMese = new Set((await toateZileleNutritie()).filter(z => z.mese.length).map(z => z.data)); }
  catch (err) { console.error(err); notifica('Zilele nu au putut fi citite.', 'eroare'); return; }
  cuMese.delete(dataZiNutritie);
  if (!cuMese.size) { notifica('Nu ai încă alte zile cu mese de copiat.', 'info'); return; }
  const ultima = [...cuMese].sort().pop();
  let [an, luna] = ultima.split('-').map(Number);
  const zona = el('div', { class: 'calendar-copiere' });
  const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const deseneaza = () => {
    const prima = new Date(an, luna - 1, 1);
    const zile = new Date(an, luna, 0).getDate();
    const decalaj = (prima.getDay() + 6) % 7; // luni = 0
    const celule = [];
    for (let k = 0; k < decalaj; k++) celule.push(el('span', { class: 'cal-gol', 'aria-hidden': 'true' }));
    for (let z = 1; z <= zile; z++) {
      const data = `${an}-${String(luna).padStart(2, '0')}-${String(z).padStart(2, '0')}`;
      const are = cuMese.has(data);
      celule.push(el('button', { type: 'button', class: 'cal-zi' + (are ? ' are-mese' : '') + (data === dataLocala() ? ' azi' : ''), disabled: !are,
        'aria-label': `${z} ${LUNI[luna - 1]}${are ? ', are mese' : ', fără mese'}`, text: String(z), onclick: () => d.inchide(() => deschideCopiereZi(data)) }));
    }
    const muta = delta => { luna += delta; if (luna < 1) { luna = 12; an--; } if (luna > 12) { luna = 1; an++; } deseneaza(); };
    zona.replaceChildren(
      el('div', { class: 'cal-cap' }, [
        buton({ icon: 'sageata', tip: 'fantoma', mic: true, clasa: 'zi-inapoi', eticheta: 'Luna anterioară', onclick: () => muta(-1) }),
        el('strong', { text: `${LUNI[luna - 1][0].toUpperCase()}${LUNI[luna - 1].slice(1)} ${an}` }),
        buton({ icon: 'sageata', tip: 'fantoma', mic: true, eticheta: 'Luna următoare', onclick: () => muta(1) }),
      ]),
      el('div', { class: 'cal-grila cal-antet', 'aria-hidden': 'true' }, ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(t => el('span', { text: t }))),
      el('div', { class: 'cal-grila' }, celule),
      el('p', { class: 'nota nota-mica', text: 'Zilele marcate au mese notate.' }));
  };
  const d = deschideDialog({ titlu: 'Din ce zi copiezi?', continut: zona, butoane: [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() })] });
  deseneaza();
}

// ---------- O singură masă: „Copiază masa în…” ----------
function meniuMasaZi(idMasa) {
  const n = ziNutritie.mese.filter(i => i.masa === idMasa).length;
  alegeDinLista({ titlu: numeMasa(idMasa), optiuni: [
    { text: 'Copiază masa în…', icon: 'copiaza', detaliu: plural(n, 'fel de mâncare', 'feluri de mâncare'), actiune: () => deschideCopiereMasa(idMasa) },
  ] });
}

function deschideCopiereMasa(idMasa) {
  const sursa = JSON.parse(JSON.stringify(ziNutritie));
  const st = { data: dataLocala() === sursa.data ? mutaData(dataLocala(), 1) : dataLocala(), masa: idMasa, stare: 'neinceput' };
  const zona = el('div', { class: 'formular' });
  const inData = el('input', { type: 'date', 'aria-label': 'Altă dată' });
  inData.addEventListener('change', () => { if (inData.value) { st.data = inData.value; deseneaza(); } });
  const chip = (activ, text, onclick) => el('button', { type: 'button', role: 'radio', class: 'chip chip-mic' + (activ ? ' activ' : ''), 'aria-checked': String(activ), text, onclick });
  const deseneaza = () => {
    const azi = dataLocala(), maine = mutaData(azi, 1);
    inData.value = st.data;
    zona.replaceChildren(
      el('p', { class: 'nota', text: `${numeMasa(idMasa)}, ${afiseazaData(sursa.data)}: ${sursa.mese.filter(i => i.masa === idMasa).map(i => i.nume).join(', ')}.` }),
      el('p', { class: 'sectiune-eticheta', text: 'În ziua' }),
      el('div', { class: 'chipuri chipuri-mici', role: 'radiogroup', 'aria-label': 'Ziua' }, [
        chip(st.data === azi, 'Azi', () => { st.data = azi; deseneaza(); }),
        chip(st.data === maine, 'Mâine', () => { st.data = maine; deseneaza(); }),
      ]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Sau altă dată' }), inData]),
      el('p', { class: 'sectiune-eticheta', text: 'La masa' }),
      el('div', { class: 'chipuri chipuri-mici', role: 'radiogroup', 'aria-label': 'Masa' },
        MESE.map(m => chip(st.masa === m.id, m.scurt || m.nume, () => { st.masa = m.id; deseneaza(); }))),
      el('p', { class: 'sectiune-eticheta', text: 'Vine' }),
      el('div', { class: 'chipuri chipuri-mici', role: 'radiogroup', 'aria-label': 'Cum vine' }, [
        chip(st.stare === 'neinceput', 'Ca planificată', () => { st.stare = 'neinceput'; deseneaza(); }),
        chip(st.stare === 'complet', 'Direct ca mâncată', () => { st.stare = 'complet'; deseneaza(); }),
      ]));
  };
  deseneaza();
  const d = deschideDialog({ titlu: `Copiezi ${numeMasa(idMasa).toLowerCase()}?`, continut: zona, butoane: [
    buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
    buton({ text: 'Copiază', icon: 'copiaza', tip: 'principal', onclick: () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(st.data)) { notifica('Alege ziua.', 'eroare'); return; }
      d.inchide(() => aplicaCopiereMasa(sursa, idMasa, st));
    } }),
  ] });
}

async function aplicaCopiereMasa(sursa, idMasa, { data, masa, stare }) {
  let tinta;
  try { tinta = await citesteZiNutritieSalvata(data); } catch (err) { notifica('Ziua nu a putut fi citită.', 'eroare'); return; }
  const inainte = tinta ? JSON.parse(JSON.stringify(tinta)) : null;
  const r = copieMasa({ sursa, idMasa, tinta, data, masaTinta: masa, stare, idNou: idNutritieNou });
  if (!r.adaugate) return;
  try { await salveazaZiNutritie(r.zi); } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Masa nu a putut fi copiată.'), 'eroare'); return; }
  await dupaCopiere(data);
  notifica(`${numeMasa(idMasa)} copiat${idMasa === 'cina' ? 'ă' : ''} la ${numeMasa(masa).toLowerCase()}, ${numeZiRelativ(data)}.`, 'succes', 7000, {
    text: 'Anulează', onclick: () => anuleazaCopiere(data, inainte) });
}

// ---------- „Ca ieri” pe o masă goală ----------
function sugestieMasaGoala(idMasa) {
  const s = sugestieCaIeri(ziIeriNutritie, idMasa);
  if (!s) return null;
  return el('button', { type: 'button', class: 'zi-ca-ieri', 'aria-label': `Adaugă ca ieri la ${numeMasa(idMasa).toLowerCase()}: ${s.nume.join(', ')}, ${fmtNr(s.kcal)} kcal`,
    onclick: () => adaugaCaIeri(idMasa) }, [
    el('span', { class: 'zi-ca-ieri-text' }, [el('span', { class: 'nota', text: 'Ca ieri: ' }), `${s.nume.join(', ')} · ${fmtNr(s.kcal)} kcal`]),
    el('span', { class: 'adauga-recent-plus', 'aria-hidden': 'true' }, [iconita('plus', 'iconita mica')]),
  ]);
}

async function adaugaCaIeri(idMasa) {
  let tinta;
  try { tinta = await citesteZiNutritieSalvata(dataZiNutritie); } catch (err) { notifica('Ziua nu a putut fi citită.', 'eroare'); return; }
  const inainte = tinta ? JSON.parse(JSON.stringify(tinta)) : null;
  // ca la adăugarea din „Recente”: rețetele vin planificate, alimentele și mesele din poză ca mâncate
  const copii = ziIeriNutritie.mese.filter(i => i.masa === idMasa).map(i => copieIntrareRecenta(i, { id: idNutritieNou(), masa: idMasa }));
  const zi = { ...(tinta || { data: dataZiNutritie, mese: [] }) };
  zi.mese = ordoneazaDupaMasa([...(zi.mese || []), ...copii]);
  try { await salveazaZiNutritie(zi); } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Nu s-a putut adăuga.'), 'eroare'); return; }
  const data = dataZiNutritie;
  await dupaCopiere(data);
  notifica(`${numeMasa(idMasa)}: ca ieri.`, 'succes', 6000, { text: 'Anulează', onclick: () => anuleazaCopiere(data, inainte) });
}
