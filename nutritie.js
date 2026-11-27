// Ecranul Nutriție: biblioteca de rețete și de alimente, rețetele și alimentele tale, favoritele și pozele rețetelor.
// Calculele sunt în nutritie-calcul.js, imaginile (fotografii, rezervă) în nutritie-imagini.js, datele de bază în
// nutritie-alimente.js (USDA SR28) și nutritie-retete.js.

let alimenteMele = [];
let reteteMele = [];
let indexNutritie = indexAlimente(ALIMENTE_BAZA);
const pozeRetetaUrl = new Map(); // id rețetă → URL al pozei tale (object URL)
let filaNutritie = 'zi';
const filtreRetete = { cautare: '', masa: '', etichete: new Set(), favorite: false, proprii: false, romanesti: false };
const filtreAlimente = { cautare: '', cat: '' };

// Filtrele de etichete oferite în listă (ordinea contează: cele mai cerute întâi).
const ETICHETE_FILTRU = ['proteic', 'putine-calorii', 'vegetarian', 'vegan', 'fara-gluten', 'fara-lactate',
  'rapid', 'meal-prep', 'buget', 'sarac-carbo', 'bogat-carbo', 'echilibrat'];
const NUME_SCURT_ETICHETA = { proteic: 'Proteic', 'putine-calorii': 'Puține calorii', vegetarian: 'Vegetarian', vegan: 'Vegan',
  'fara-gluten': 'Fără gluten', 'fara-lactate': 'Fără lactate', rapid: 'Rapid', 'meal-prep': 'Meal prep', buget: 'Buget redus',
  'sarac-carbo': 'Sărac în carbo', 'bogat-carbo': 'Bogat în carbo', echilibrat: 'Echilibrat' };
const ORIGINI_TEXT = { '': 'Vegetal (fără produse animale)', carne: 'Carne', peste: 'Pește sau fructe de mare', lactate: 'Lactate', oua: 'Ouă', miere: 'Miere' };
const VASE_TEXT = { farfurie: 'Farfurie', bol: 'Bol', pahar: 'Pahar', borcan: 'Borcan', tocator: 'Tocător (sandviș, toast, wrap)' };

function idNutritieNou() {
  return `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function numeMasa(id) { return (MESE_TOATE.find(m => m.id === id) || { nume: id }).nume; }
function numeAlergen(id) { return (ALERGENI.find(a => a.id === id) || { nume: id }).nume; }
function numeCategorieAliment(id) { return (CATEGORII_ALIMENTE.find(c => c.id === id) || { nume: id }).nume; }
const fmtG = v => `${String(Math.round(v * 10) / 10).replace('.', ',')} g`;
const fmtKcal = v => `${Math.round(v)} kcal`;

// ---------- Date ----------
async function reincarcaNutritie() {
  const [alimente, retete, poze] = await Promise.all([
    toateAlimenteleMele().catch(err => { console.warn(err); return alimenteMele; }),
    toateReteteleMele().catch(err => { console.warn(err); return reteteMele; }),
    toatePozeleRetetelor().catch(err => { console.warn(err); return null; }),
  ]);
  alimenteMele = alimente;
  reteteMele = retete;
  indexNutritie = indexAlimente(ALIMENTE_BAZA, alimenteMele);
  if (poze) {
    for (const url of pozeRetetaUrl.values()) URL.revokeObjectURL(url);
    pozeRetetaUrl.clear();
    for (const p of poze) pozeRetetaUrl.set(p.id, URL.createObjectURL(p.imagine));
  }
  if (typeof ecranCurent !== 'undefined' && ecranCurent === 'ecran-nutritie') randeazaNutritie();
}

function toateRetetele() {
  return [...RETETE_BAZA, ...reteteMele.map(r => ({ ...r, propriu: true }))];
}
function retetaDupaId(id) {
  return toateRetetele().find(r => r.id === id) || null;
}
function toateAlimentele() {
  return [...ALIMENTE_BAZA, ...alimenteMele.map(a => ({ ...a, propriu: true }))];
}

function estePreferata(id) { return (setari.retetePreferate || []).includes(id); }
function comutaPreferata(id) {
  const lista = setari.retetePreferate || [];
  const acum = !lista.includes(id);
  setari.retetePreferate = acum ? [...lista, id] : lista.filter(x => x !== id);
  salveazaSetari();
  return acum;
}

// Imaginea unei rețete: poza ta, dacă ai pus una; altfel fotografia din bibliotecă; altfel imaginea de rezervă.
// Fotografiile se încarcă doar când ajung aproape de ecran (loading="lazy"); până atunci cadrul are o
// animație de încărcare. Dacă fișierul nu se poate încărca (ex. offline, înainte să fi fost văzut o dată),
// se afișează imaginea de rezervă, nu un spațiu gol.
function imagineReteta(r, clasa = 'reteta-imagine') {
  const rezerva = () => urlImagineRezerva(numeMasa(r.masa));
  const poza = pozeRetetaUrl.get(r.id);
  const f = fotoReteta(r);
  const img = el('img', { class: clasa, alt: f ? r.nume : '', decoding: 'async', loading: 'lazy',
    width: String(FOTO_LATIME), height: String(FOTO_INALTIME) });
  if (poza) { img.src = poza; img.classList.add('poza-proprie'); return img; }
  if (!f) { img.src = rezerva(); img.classList.add('imagine-rezerva'); return img; }
  img.classList.add('se-incarca');
  img.addEventListener('load', () => img.classList.remove('se-incarca'), { once: true });
  img.addEventListener('error', () => {
    img.classList.remove('se-incarca');
    img.classList.add('imagine-rezerva');
    img.alt = '';
    img.src = rezerva();
  }, { once: true });
  // Versiunea din adresă e fotografia (id-ul sursei), nu versiunea aplicației: așa, copia offline rămâne valabilă după actualizări.
  img.src = `./${f.fisier}?v=${f.idSursa || versiuneIlustratii()}`;
  return img;
}

// ---------- File (Rețete / Alimente) ----------
// Fiecare buton din navigarea MEAL PREP deschide un grup de file; filele grupului apar sus doar dacă sunt mai multe.
const GRUPURI_NUTRITIE = { nutritie: ['zi', 'analiza'], saptamana: ['saptamana'], lista: ['lista'], retete: ['retete', 'alimente'] };
const ultimaFilaGrup = { nutritie: 'zi', saptamana: 'saptamana', lista: 'lista', retete: 'retete' };
function grupFilaNutritie(fila) {
  return Object.keys(GRUPURI_NUTRITIE).find(g => GRUPURI_NUTRITIE[g].includes(fila)) || 'nutritie';
}
function filaDinGrup(grup) { return ultimaFilaGrup[grup] || GRUPURI_NUTRITIE[grup][0]; }

function arataFilaNutritie(fila, { randeaza = true } = {}) {
  filaNutritie = fila;
  const grup = grupFilaNutritie(fila);
  ultimaFilaGrup[grup] = fila;
  let vizibile = 0;
  for (const [id, f] of [['tab-zi', 'zi'], ['tab-analiza', 'analiza'], ['tab-saptamana', 'saptamana'], ['tab-lista', 'lista'], ['tab-retete', 'retete'], ['tab-alimente', 'alimente']]) {
    $(id).classList.toggle('activ', f === fila);
    $(id).setAttribute('aria-selected', String(f === fila));
    $(id).hidden = grupFilaNutritie(f) !== grup;
    if (!$(id).hidden) vizibile++;
  }
  $('tab-zi').parentElement.hidden = vizibile < 2;
  $('nutritie-analiza').hidden = fila !== 'analiza';
  if (typeof actualizeazaNavigatia === 'function') actualizeazaNavigatia();
  if (typeof TITLURI_ECRANE !== 'undefined' && ecranCurent === 'ecran-nutritie') $('titlu-ecran').textContent = TITLU_GRUP_NUTRITIE[grup];
  $('nutritie-zi').hidden = fila !== 'zi';
  $('nutritie-saptamana').hidden = fila !== 'saptamana';
  $('nutritie-lista').hidden = fila !== 'lista';
  $('nutritie-retete').hidden = fila !== 'retete';
  $('nutritie-alimente').hidden = fila !== 'alimente';
  if (randeaza) randeazaNutritie();
}
const TITLU_GRUP_NUTRITIE = { nutritie: 'Nutriție', saptamana: 'Planificator mese', lista: 'Listă de cumpărături', retete: 'Rețete' };

function randeazaNutritie() {
  if (filaNutritie === 'zi') { randeazaZiNutritie({ reincarca: true }); return; }
  if (filaNutritie === 'saptamana') { randeazaSaptamana(); return; }
  if (filaNutritie === 'lista') { randeazaListaCumparaturi(); return; }
  if (filaNutritie === 'analiza') { randeazaAnalizaNutritie().catch(err => { console.error(err); notifica('Analiza nutriției nu a putut fi încărcată.', 'eroare'); }); return; }
  if (filaNutritie === 'alimente') { deseneazaFiltreAlimente(); randeazaAlimente(); } else { deseneazaFiltreRetete(); randeazaRetete(); }
}

// ---------- Lista de rețete ----------
function chip(text, activ, onclick, eticheta) {
  return el('button', { class: 'chip chip-mic' + (activ ? ' activ' : ''), type: 'button', 'aria-pressed': String(activ), text,
    'aria-label': eticheta || null, onclick });
}

function deseneazaFiltreRetete() {
  $('retete-mese').replaceChildren(
    chip('Toate', !filtreRetete.masa, () => { filtreRetete.masa = ''; deseneazaFiltreRetete(); randeazaRetete(); }),
    ...MESE.map(m => chip(m.nume, filtreRetete.masa === m.id, () => {
      filtreRetete.masa = filtreRetete.masa === m.id ? '' : m.id;
      deseneazaFiltreRetete(); randeazaRetete();
    })));
  $('retete-etichete').replaceChildren(
    el('button', { class: 'chip chip-mic chip-icon' + (filtreRetete.favorite ? ' activ' : ''), type: 'button', 'aria-pressed': String(filtreRetete.favorite),
      'aria-label': 'Doar favoritele', onclick: () => { filtreRetete.favorite = !filtreRetete.favorite; deseneazaFiltreRetete(); randeazaRetete(); } }, [iconita('stea'), el('span', { text: 'Favorite' })]),
    chip('Ale mele', filtreRetete.proprii, () => { filtreRetete.proprii = !filtreRetete.proprii; deseneazaFiltreRetete(); randeazaRetete(); }),
    chip('Românești', filtreRetete.romanesti, () => { filtreRetete.romanesti = !filtreRetete.romanesti; deseneazaFiltreRetete(); randeazaRetete(); }, 'Doar rețetele românești'),
    ...ETICHETE_FILTRU.map(t => chip(NUME_SCURT_ETICHETA[t], filtreRetete.etichete.has(t), () => {
      if (filtreRetete.etichete.has(t)) filtreRetete.etichete.delete(t); else filtreRetete.etichete.add(t);
      deseneazaFiltreRetete(); randeazaRetete();
    })));
}

function areFiltreRetete() {
  return Boolean(filtreRetete.cautare || filtreRetete.masa || filtreRetete.etichete.size || filtreRetete.favorite || filtreRetete.proprii || filtreRetete.romanesti);
}

function reseteazaFiltreRetete() {
  Object.assign(filtreRetete, { cautare: '', masa: '', favorite: false, proprii: false, romanesti: false });
  filtreRetete.etichete.clear();
  $('retete-cautare').value = '';
  deseneazaFiltreRetete();
  randeazaRetete();
}

// Fiecare cuvânt căutat trebuie să apară în nume, descriere sau ingrediente (fără diacritice).
function textCautareReteta(r) {
  const ing = (r.ingrediente || []).map(([id]) => (indexNutritie.get(id) || {}).nume || '').join(' ');
  return normalizeazaText(`${r.nume} ${r.numeEn || ''} ${r.descriere || ''} ${ing}`);
}

function infoReteta(r) {
  const v = valoriPortie(r, indexNutritie);
  return { v, etichete: eticheteReteta(r, indexNutritie) };
}

function randeazaRetete() {
  const cuvinte = normalizeazaText(filtreRetete.cautare).split(/\s+/).filter(Boolean);
  const ordineMese = MESE.map(m => m.id);
  const potrivite = [];
  for (const r of toateRetetele()) {
    if (filtreRetete.masa && r.masa !== filtreRetete.masa) continue;
    if (filtreRetete.proprii && !r.propriu) continue;
    if (filtreRetete.favorite && !estePreferata(r.id)) continue;
    if (filtreRetete.romanesti && r.bucatarie !== 'romaneasca') continue;
    if (cuvinte.length) {
      const t = textCautareReteta(r);
      if (!cuvinte.every(c => t.includes(c))) continue;
    }
    const info = infoReteta(r);
    if ([...filtreRetete.etichete].some(e => !info.etichete.includes(e))) continue;
    potrivite.push({ r, info });
  }
  potrivite.sort((a, b) => ordineMese.indexOf(a.r.masa) - ordineMese.indexOf(b.r.masa) ||
    Number(Boolean(b.r.propriu)) - Number(Boolean(a.r.propriu)) || a.r.nume.localeCompare(b.r.nume, 'ro'));

  $('retete-numar').textContent = plural(potrivite.length, 'rețetă', 'rețete');
  $('btn-retete-filtre').hidden = !areFiltreRetete();
  const lista = $('retete-lista');
  if (!potrivite.length) {
    const doarFavorite = filtreRetete.favorite && !filtreRetete.cautare && !filtreRetete.masa && !filtreRetete.etichete.size && !filtreRetete.proprii;
    const doarProprii = filtreRetete.proprii && !filtreRetete.cautare && !filtreRetete.masa && !filtreRetete.etichete.size && !filtreRetete.favorite;
    lista.replaceChildren(stareGoala({
      icon: doarFavorite ? 'stea' : 'cauta',
      titlu: doarFavorite ? 'Nicio rețetă favorită' : doarProprii ? 'Nu ai încă rețete proprii' : 'Nicio rețetă găsită',
      text: doarFavorite ? 'Deschide o rețetă și apasă steaua ca s-o găsești repede.'
        : doarProprii ? 'Creează o rețetă de la zero sau duplică una din bibliotecă și modific-o.'
          : 'Nicio rețetă nu îndeplinește toate filtrele alese. Scoate unul dintre ele sau caută altfel.',
      actiune: el('div', { class: 'rand-butoane' }, [
        areFiltreRetete() ? buton({ text: 'Șterge filtrele', tip: 'secundar', onclick: reseteazaFiltreRetete }) : null,
        buton({ text: 'Rețetă nouă', icon: 'plus', tip: 'principal', onclick: () => deschideEditorReteta(null) }),
      ]),
    }));
    return;
  }
  const cuTitluri = !filtreRetete.masa && !cuvinte.length;
  const copii = [];
  let masa = null;
  for (const { r, info } of potrivite) {
    if (cuTitluri && r.masa !== masa) {
      masa = r.masa;
      copii.push(el('h3', { class: 'lista-titlu grila-titlu', text: numeMasa(masa) }));
    }
    copii.push(cardReteta(r, info));
  }
  lista.replaceChildren(...copii);
}

function macroScurt(v) {
  return `P ${Math.round(v.proteine)} · C ${Math.round(v.carbohidrati)} · G ${Math.round(v.grasimi)}`;
}

function cardReteta(r, info) {
  const pref = estePreferata(r.id);
  return el('article', { class: 'card-reteta' }, [
    el('button', { class: 'card-reteta-principal', type: 'button', onclick: () => arataReteta(r.id),
      'aria-label': `${r.nume}. ${numeMasa(r.masa)}, ${fmtKcal(info.v.kcal)} pe porție, ${r.timp} minute. Deschide rețeta` }, [
      el('div', { class: 'card-reteta-imagine' }, [imagineReteta(r)]),
      el('div', { class: 'card-reteta-text' }, [
        el('strong', { text: r.nume }),
        el('span', { class: 'card-reteta-kcal' }, [el('b', { text: String(Math.round(info.v.kcal)) }), ' kcal · ', `${r.timp} min`]),
        el('span', { class: 'nota', text: macroScurt(info.v) }),
        r.propriu ? el('span', { class: 'eticheta-tip', text: 'A mea' }) : null,
      ]),
    ]),
    el('button', { class: 'btn btn-fantoma btn-icon btn-mic favorit card-reteta-stea' + (pref ? ' activ' : ''), type: 'button',
      'aria-pressed': String(pref), 'aria-label': pref ? `Scoate ${r.nume} de la favorite` : `Adaugă ${r.nume} la favorite`,
      onclick: e => {
        e.stopPropagation();
        const acum = comutaPreferata(r.id);
        const b = e.currentTarget;
        b.classList.toggle('activ', acum);
        b.setAttribute('aria-pressed', String(acum));
        b.setAttribute('aria-label', acum ? `Scoate ${r.nume} de la favorite` : `Adaugă ${r.nume} la favorite`);
        if (filtreRetete.favorite && !acum) randeazaRetete();
      } }, [iconita('stea')]),
  ]);
}

// ---------- Panoul nutrițional ----------
function panouNutritional(v, titlu) {
  const d = distributieEnergie(v);
  const rand = (nume, grame, pondere, clasa) => el('div', { class: 'nutri-rand' }, [
    el('span', { class: 'nutri-nume' }, [el('i', { class: `nutri-punct ${clasa}` }), nume]),
    el('strong', { text: fmtG(grame) }),
    pondere === null ? el('span', { class: 'nota', text: '' })
      : el('span', { class: 'nutri-bara', title: `${Math.round(pondere * 100)}% din energie` }, [
        el('i', { class: clasa, style: `width:${Math.round(pondere * 100)}%` }),
      ]),
    el('span', { class: 'nota', text: pondere === null ? '' : `${Math.round(pondere * 100)}%` }),
  ]);
  return el('div', { class: 'nutri-panou' }, [
    el('div', { class: 'nutri-kcal' }, [el('strong', { text: String(Math.round(v.kcal)) }), el('span', { text: ` kcal ${titlu}` })]),
    rand('Proteine', v.proteine, d.proteine, 'nutri-p'),
    rand('Carbohidrați', v.carbohidrati, d.carbohidrati, 'nutri-c'),
    rand('Grăsimi', v.grasimi, d.grasimi, 'nutri-g'),
    rand('Fibre', v.fibre, null, 'nutri-f'),
  ]);
}

function cipEticheta(id) {
  const e = ETICHETE.find(x => x.id === id);
  return el('span', { class: 'eticheta-tip eticheta-nutri', title: e ? e.regula : '', text: NUME_SCURT_ETICHETA[id] || (e && e.nume) || id });
}

// ---------- Detaliile unei rețete ----------
const NUME_FEL = { 'fel-principal': 'Fel principal', ciorba: 'Ciorbă', patiserie: 'Patiserie', desert: 'Desert' };
function gramePortie(r) { return r.gatit && r.gatit.greutateGatita > 0 ? Math.round(r.gatit.greutateGatita / r.portii / 5) * 5 : null; }
// Primele 3 ingrediente după greutate, fără condimente, sare, ulei și altele de același fel (categoria „altele”).
function ingredientePrincipale(r) {
  return (r.ingrediente || []).map(([id, g]) => [indexNutritie.get(id), g]).filter(([a]) => a && a.cat !== 'altele')
    .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([a]) => a.nume.toLowerCase());
}
function arataReteta(id, portiiAlese) {
  const r = retetaDupaId(id);
  if (!r) { notifica('Rețeta nu mai există.', 'eroare'); return; }
  const info = infoReteta(r);
  const al = alergeniReteta(r, indexNutritie);
  let portii = portiiAlese || r.portii;

  const listaIngrediente = el('ul', { class: 'lista-ingrediente' });
  const titluIngrediente = el('h3', { class: 'detaliu-titlu' });
  const deseneazaIngrediente = () => {
    const f = portii / r.portii;
    titluIngrediente.textContent = `Ingrediente pentru ${plural(portii, 'porție', 'porții')}`;
    listaIngrediente.replaceChildren(...r.ingrediente.map(([idA, g]) => {
      const a = indexNutritie.get(idA);
      if (!a) return el('li', { class: 'ingredient-lipsa' }, [el('span', { text: 'Aliment șters din bibliotecă' }), el('strong', { text: fmtG(g * f) })]);
      return el('li', {}, [
        el('span', { text: a.nume }),
        el('strong', { text: textCantitate(a, g * f) }),
        el('span', { class: 'nota', text: fmtKcal(a.kcal * g * f / 100) }),
      ]);
    }));
  };
  deseneazaIngrediente();
  const textPortii = el('strong', { class: 'portii-valoare', text: String(portii) });
  const schimbaPortii = delta => {
    portii = Math.max(1, Math.min(20, portii + delta));
    textPortii.textContent = String(portii);
    deseneazaIngrediente();
  };

  const note = [...new Set(r.ingrediente.map(([idA]) => indexNutritie.get(idA)).filter(a => a && a.nota).map(a => `${a.nume}: ${a.nota}`))];
  const variante = r.varianta ? toateRetetele().filter(x => x.varianta && x.varianta.grup === r.varianta.grup) : [];
  const principale = ingredientePrincipale(r);
  const pref = estePreferata(r.id);
  const butonStea = el('button', { class: 'btn btn-fantoma btn-icon favorit' + (pref ? ' activ' : ''), type: 'button', 'aria-pressed': String(pref),
    'aria-label': pref ? 'Scoate de la favorite' : 'Adaugă la favorite', onclick: e => {
      const acum = comutaPreferata(r.id);
      e.currentTarget.classList.toggle('activ', acum);
      e.currentTarget.setAttribute('aria-pressed', String(acum));
      e.currentTarget.setAttribute('aria-label', acum ? 'Scoate de la favorite' : 'Adaugă la favorite');
      notifica(acum ? 'Adăugată la favorite.' : 'Scoasă de la favorite.', 'succes', 1800);
      randeazaNutritie();
    } }, [iconita('stea')]);

  const continut = el('div', { class: 'detaliu-reteta' }, [
    el('div', { class: 'reteta-imagine-mare' }, [imagineReteta(r, 'reteta-imagine')]),
    !pozeRetetaUrl.has(r.id) && fotoReteta(r)
      ? el('p', { class: 'nota nota-mica atribuire-foto' }, [
        el('a', { href: fotoReteta(r).pagina, target: '_blank', rel: 'noopener', text: textAtribuire(fotoReteta(r)).replace(/ · [^·]+$/, '') }),
        fotoReteta(r).licenta ? ' · ' : null,
        fotoReteta(r).licenta ? el('a', { href: fotoReteta(r).linkLicenta, target: '_blank', rel: 'noopener license', text: fotoReteta(r).licenta }) : null])
      : null,
    // Rețetă fără fotografie: invitație vizibilă chiar sub imaginea de rezervă să pui poza ta.
    !pozeRetetaUrl.has(r.id) && !fotoReteta(r)
      ? el('div', { class: 'fara-foto' }, [
        el('p', { class: 'nota nota-mica', text: 'Rețeta nu are încă fotografie. Poți pune o poză făcută de tine.' }),
        buton({ text: 'Adaugă poza ta', icon: 'incarca', tip: 'principal', mic: true, onclick: () => d.inchide(() => alegePozaReteta(r.id)) })])
      : null,
    el('div', { class: 'detaliu-cap' }, [
      el('div', { class: 'detaliu-etichete' }, [
        el('span', { class: 'eticheta-grupa', text: numeMasa(r.masa) }),
        r.fel ? el('span', { class: 'eticheta-tip', text: NUME_FEL[r.fel] || r.fel }) : null,
        r.bucatarie === 'romaneasca' ? el('span', { class: 'eticheta-tip', text: 'Românească' }) : null,
        r.propriu ? el('span', { class: 'eticheta-tip', text: 'Rețeta mea' }) : null,
      ]),
      butonStea,
    ]),
    r.numeEn ? el('p', { class: 'nume-en', lang: 'en', text: r.numeEn }) : null,
    r.descriere ? el('p', { class: 'descriere', text: r.descriere }) : null,
    el('div', { class: 'reteta-fapte' }, [
      placuta('Timp', `${r.timp} min`, r.timpPregatire !== undefined ? `pregătire ${r.timpPregatire} · gătire ${r.timpGatire}` : null),
      placuta('Porții', String(r.portii), r.gatit ? `≈${gramePortie(r)} g (estimat)` : null),
      placuta('Dificultate', DIFICULTATI[r.dificultate] || '—', null),
    ]),
    variante.length > 1 ? el('div', { class: 'variante-reteta' }, [
      el('span', { class: 'camp-eticheta', text: 'Variante' }),
      el('div', { class: 'chipuri chipuri-mici' }, variante.map(v => chip(v.varianta.nume, v.id === r.id, () => { if (v.id !== r.id) d.inchide(() => arataReteta(v.id)); },
        `${v.nume}${v.id === r.id ? ' (deschisă)' : ''}`))),
    ]) : null,
    principale.length ? el('p', { class: 'nota ingrediente-principale' }, [el('strong', { text: 'Ingrediente principale: ' }), principale.join(', ')]) : null,
    buton({ text: `Adaugă în ziua mea${dataZiNutritie === dataLocala() ? '' : ` (${afiseazaData(dataZiNutritie)})`}`, icon: 'plus', tip: 'principal', lat: true, clasa: 'mt',
      onclick: () => d.inchide(() => deschideAdaugareInZi(r, { masa: r.masa, data: dataZiNutritie })) }),
    info.etichete.length ? el('div', { class: 'chipuri chipuri-mici mt' }, info.etichete.map(cipEticheta)) : null,
    el('h3', { class: 'detaliu-titlu', text: 'Valori nutriționale pe porție' }),
    panouNutritional(info.v, 'pe porție'),
    info.v.lipsa.length ? el('p', { class: 'nota nota-avertizare', text: `${plural(info.v.lipsa.length, 'ingredient nu mai există', 'ingrediente nu mai există')} în bibliotecă și nu ${info.v.lipsa.length === 1 ? 'este inclus' : 'sunt incluse'} în valori.` }) : null,
    al.contine.length || al.urme.length
      ? el('p', { class: 'nota nota-alergeni' }, [
        al.contine.length ? el('span', {}, [el('strong', { text: 'Conține: ' }), al.contine.map(numeAlergen).join(', ') + '. ']) : null,
        al.urme.length ? el('span', {}, [el('strong', { text: 'Poate conține: ' }), al.urme.map(numeAlergen).join(', ') + '.']) : null,
      ])
      : el('p', { class: 'nota', text: 'Niciun alergen major din lista UE în ingrediente.' }),
    el('div', { class: 'rand aliniat portii-rand' }, [
      titluIngrediente,
      el('div', { class: 'stepper' }, [
        buton({ icon: 'minus', tip: 'secundar', mic: true, eticheta: 'Mai puține porții', onclick: () => schimbaPortii(-1) }),
        textPortii,
        buton({ icon: 'plus', tip: 'secundar', mic: true, eticheta: 'Mai multe porții', onclick: () => schimbaPortii(1) }),
      ]),
    ]),
    listaIngrediente,
    el('h3', { class: 'detaliu-titlu', text: 'Preparare' }),
    r.pasi.length ? el('ol', { class: 'pasi-reteta' }, r.pasi.map(p => el('li', { text: p }))) : el('p', { class: 'nota', text: 'Fără pași scriși.' }),
    r.gatit || (r.estimari && r.estimari.length) ? el('div', { class: 'estimari-reteta' }, [
      el('strong', { text: 'Ce e estimat' }),
      el('ul', {}, [
        r.gatit ? el('li', { text: `Greutatea porției: ${r.gatit.nota}` }) : null,
        ...(r.estimari || []).map(t => el('li', { text: t })),
      ].filter(Boolean)),
      el('p', { class: 'nota nota-mica', text: 'Caloriile și macronutrienții de mai sus sunt calculați din cantitățile crude ale ingredientelor; doar punctele de aici sunt aproximări.' }),
    ]) : null,
    note.length ? el('details', { class: 'note-sursa' }, [el('summary', { text: 'Note despre valori' }), ...note.map(n => el('p', { class: 'nota', text: n }))]) : null,
    el('p', { class: 'nota nota-mica', text: `Valori calculate din cantitățile ingredientelor (${SURSA_NUTRITIE.scurt}${alimenteMele.length ? ' și alimentele tale' : ''}). Sunt estimări.` }),
    el('div', { class: 'rand-butoane mt' }, [
      !pozeRetetaUrl.has(r.id) && !fotoReteta(r) ? null : buton({ text: pozeRetetaUrl.has(r.id) ? 'Schimbă poza' : 'Înlocuiește cu poza ta', icon: 'incarca', tip: 'secundar', mic: true, onclick: () => d.inchide(() => alegePozaReteta(r.id)) }),
      pozeRetetaUrl.has(r.id) ? buton({ text: 'Scoate poza', icon: 'cos', tip: 'fantoma', mic: true, onclick: () => d.inchide(() => stergePozaRetetei(r)) }) : null,
    ]),
  ]);

  const butoane = [];
  if (r.propriu) {
    butoane.push(buton({ icon: 'cos', tip: 'pericol', eticheta: `Șterge rețeta ${r.nume}`, onclick: () => d.inchide(() => stergeReteta(r)) }));
    butoane.push(buton({ text: 'Editează', icon: 'editeaza', tip: 'secundar', onclick: () => d.inchide(() => deschideEditorReteta(r)) }));
  }
  butoane.push(buton({ text: 'Duplică', icon: 'copiaza', tip: r.propriu ? 'fantoma' : 'secundar', onclick: () => d.inchide(() => deschideEditorReteta(r, { copie: true })) }));
  butoane.push(buton({ text: 'Închide', tip: 'principal', onclick: () => d.inchide() }));
  const d = deschideDialog({ titlu: r.nume, continut, butoane });
}

// ---------- Poza unei rețete ----------
let pozaRetetaPentru = null;
function alegePozaReteta(id) {
  pozaRetetaPentru = id;
  $('poza-reteta-fisier').click();
}

async function pozaRetetaAleasa(e) {
  const fisier = e.target.files[0];
  e.target.value = '';
  const id = pozaRetetaPentru;
  pozaRetetaPentru = null;
  if (!fisier || !id) return;
  if (!fisier.type.startsWith('image/')) { notifica('Alege o imagine (JPEG, PNG sau HEIC din galerie).', 'eroare'); return; }
  let rez;
  try {
    rez = await micsoreazaImagine(fisier, 1024, 0.8);
  } catch (err) {
    console.error(err);
    notifica('Poza nu a putut fi citită. Încearcă altă imagine.', 'eroare');
    return;
  }
  try {
    await salveazaPozaReteta({ id, imagine: rez.blob, latime: rez.latime, inaltime: rez.inaltime, creat: Date.now() });
  } catch (err) {
    console.error(err);
    notifica(mesajEroareSalvare(err, 'Poza nu a putut fi salvată.'), 'eroare');
    return;
  }
  await reincarcaNutritie();
  notifica(`Poză salvată (${Math.round(rez.blob.size / 1024)} KB).`, 'succes');
  if (!dialogDeschis) arataReteta(id);
}

async function stergePozaRetetei(r) {
  let idCos;
  try {
    idCos = await stergePozaReteta(r.id, r.nume);
  } catch (err) {
    console.error(err);
    notifica('Poza nu a putut fi ștearsă.', 'eroare');
    return;
  }
  await reincarcaNutritie();
  notificaStergere('Poza a fost scoasă; rețeta folosește din nou ilustrația.', idCos, reincarcaNutritie);
}

// ---------- Ștergerea unei rețete proprii ----------
async function stergeReteta(r) {
  const da = await confirma({ titlu: 'Ștergi rețeta?', text: `„${r.nume}" se mută în Setări → Șterse recent, unde stă 30 de zile.`, ok: 'Șterge', pericol: true });
  if (!da) return;
  let idCos;
  try {
    idCos = await stergeRetetaMea(r.id, r.nume);
  } catch (err) {
    console.error(err);
    notifica('Rețeta nu a putut fi ștearsă.', 'eroare');
    return;
  }
  await reincarcaNutritie();
  deseneazaCos().catch(() => {});
  notificaStergere(`„${r.nume}" a fost ștearsă.`, idCos, reincarcaNutritie);
}

// ---------- Editorul de rețete ----------
// r = null: rețetă nouă; { copie: true }: duplicat (rețetă nouă, pornind de la r).
function deschideEditorReteta(r, { copie = false } = {}) {
  const editare = Boolean(r && r.propriu && !copie);
  const baza = r ? JSON.parse(JSON.stringify(r)) : { nume: '', masa: filtreRetete.masa || 'pranz', descriere: '', timp: 15, portii: 1,
    dificultate: 'usor', vas: 'farfurie', etichete: [], ingrediente: [], pasi: [] };
  if (copie) baza.nume = `${r.nume} (copie)`;
  const ingrediente = baza.ingrediente.map(([id, g]) => [id, g]);

  const camp = (eticheta, control, nota) => el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: eticheta }), control, nota || null]);
  const nume = el('input', { type: 'text', maxlength: '100', value: baza.nume, placeholder: 'ex. Omletă cu legume', 'aria-label': 'Numele rețetei' });
  const masa = el('select', { 'aria-label': 'Masa' }, MESE.map(m => el('option', { value: m.id, text: m.nume, selected: m.id === baza.masa })));
  const descriere = el('textarea', { rows: '2', maxlength: '400', placeholder: 'O propoziție despre rețetă (opțional)' });
  descriere.value = baza.descriere || '';
  const portii = el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '50', step: '1', value: String(baza.portii), class: 'camp-scurt' });
  const timp = el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '1440', step: '1', value: String(baza.timp || 15), class: 'camp-scurt' });
  const dificultate = el('select', { 'aria-label': 'Dificultate' }, Object.entries(DIFICULTATI).map(([k, t]) => el('option', { value: k, text: t, selected: k === baza.dificultate })));
  const vas = el('select', { 'aria-label': 'Cum se servește' }, Object.entries(VASE_TEXT).map(([k, t]) => el('option', { value: k, text: t, selected: k === baza.vas })));
  const declarate = new Set(baza.etichete || []);
  const chipuriDeclarate = el('div', { class: 'chipuri chipuri-mici' });
  const deseneazaDeclarate = () => chipuriDeclarate.replaceChildren(...ETICHETE_DECLARATE.map(t => chip(NUME_SCURT_ETICHETA[t], declarate.has(t), () => {
    if (declarate.has(t)) declarate.delete(t); else declarate.add(t);
    deseneazaDeclarate();
  })));
  deseneazaDeclarate();
  const pasi = el('textarea', { rows: '5', placeholder: 'Câte un pas pe rând.' });
  pasi.value = (baza.pasi || []).join('\n');

  // Ingredientele: listă editabilă + căutare cu sugestii (în același dialog, ca să nu se piardă ce ai scris).
  const listaIng = el('div', { class: 'editor-ingrediente' });
  const rezumat = el('div', { class: 'editor-rezumat' });
  const cautare = el('input', { type: 'search', placeholder: 'Caută un aliment de adăugat', autocomplete: 'off', 'aria-label': 'Caută un aliment de adăugat' });
  const sugestii = el('div', { class: 'sugestii-alimente', role: 'listbox' });

  const portiiCurente = () => {
    const n = parseInt(portii.value, 10);
    return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 1;
  };
  const actualizeazaRezumat = () => {
    const temp = { id: 'u-temp', masa: masa.value, portii: portiiCurente(), timp: parseInt(timp.value, 10) || 0, etichete: [...declarate], ingrediente };
    const v = valoriPortie(temp, indexNutritie);
    const et = ingrediente.length ? eticheteReteta(temp, indexNutritie) : [];
    rezumat.replaceChildren(
      el('div', { class: 'editor-rezumat-cifre' }, [
        el('strong', { text: fmtKcal(v.kcal) }), el('span', { class: 'nota', text: ` pe porție · ${macroScurt(v)} · fibre ${Math.round(v.fibre)} g` }),
      ]),
      et.length ? el('div', { class: 'chipuri chipuri-mici' }, et.map(cipEticheta)) : null,
    );
  };
  const deseneazaIngrediente = () => {
    if (!ingrediente.length) {
      listaIng.replaceChildren(el('p', { class: 'nota', text: 'Niciun ingredient încă. Caută mai jos și apasă pe aliment ca să-l adaugi.' }));
    } else {
      listaIng.replaceChildren(...ingrediente.map((x, i) => {
        const a = indexNutritie.get(x[0]);
        const grame = el('input', { type: 'number', inputmode: 'decimal', min: '0.1', step: 'any', value: String(x[1]), class: 'camp-grame',
          'aria-label': `Grame de ${a ? a.nume : 'aliment'}` });
        const kcal = el('span', { class: 'nota', text: a ? fmtKcal(a.kcal * x[1] / 100) : '' });
        grame.addEventListener('input', () => {
          const g = parseFloat(String(grame.value).replace(',', '.'));
          x[1] = Number.isFinite(g) ? g : 0;
          kcal.textContent = a ? fmtKcal(a.kcal * Math.max(0, x[1]) / 100) : '';
          actualizeazaRezumat();
        });
        return el('div', { class: 'rand-ingredient' + (a ? '' : ' ingredient-lipsa') }, [
          el('span', { class: 'rand-ingredient-nume', text: a ? a.nume : 'Aliment șters' }),
          el('span', { class: 'rand-ingredient-grame' }, [grame, el('span', { class: 'nota', text: 'g' })]),
          kcal,
          buton({ icon: 'x', tip: 'fantoma', mic: true, eticheta: `Scoate ${a ? a.nume : 'ingredientul'}`, onclick: () => {
            ingrediente.splice(i, 1); deseneazaIngrediente();
          } }),
        ]);
      }));
    }
    actualizeazaRezumat();
  };
  const deseneazaSugestii = () => {
    const cuv = normalizeazaText(cautare.value).split(/\s+/).filter(Boolean);
    if (!cuv.length) { sugestii.replaceChildren(); return; }
    const gasite = toateAlimentele().filter(a => cuv.every(c => normalizeazaText(a.nume).includes(c))).slice(0, 8);
    sugestii.replaceChildren(...(gasite.length ? gasite.map(a => el('button', { class: 'sugestie-aliment', type: 'button', role: 'option',
      onclick: () => {
        ingrediente.push([a.id, Array.isArray(a.buc) ? a.buc[0] : 100]);
        cautare.value = '';
        sugestii.replaceChildren();
        deseneazaIngrediente();
        const ultim = listaIng.querySelector('.rand-ingredient:last-child input');
        if (ultim) { ultim.focus(); ultim.select(); }
      } }, [el('strong', { text: a.nume }), el('span', { class: 'nota', text: `${Math.round(a.kcal)} kcal / 100 g${a.propriu ? ' · al tău' : ''}` })]))
      : [el('p', { class: 'nota', text: 'Niciun aliment găsit. Îl poți adăuga din fila Alimente → Aliment nou.' })]));
  };
  cautare.addEventListener('input', deseneazaSugestii);
  portii.addEventListener('input', actualizeazaRezumat);
  masa.addEventListener('change', actualizeazaRezumat);
  timp.addEventListener('input', actualizeazaRezumat);

  const eroare = el('p', { class: 'nota nota-avertizare', hidden: true, role: 'alert' });
  const continut = el('div', { class: 'editor-reteta' }, [
    copie ? el('p', { class: 'nota', text: 'Copia devine rețeta ta: o poți modifica oricum. Originalul rămâne neschimbat.' }) : null,
    camp('Nume', nume),
    camp('Masa', masa),
    camp('Descriere', descriere),
    el('div', { class: 'rand' }, [camp('Porții', portii), camp('Timp (min)', timp)]),
    el('div', { class: 'rand' }, [camp('Dificultate', dificultate), camp('Ilustrație', vas)]),
    el('div', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Etichete pe care le alegi tu' }), chipuriDeclarate,
      el('span', { class: 'nota nota-mica', text: 'Restul etichetelor (proteic, vegan, fără gluten…) se calculează singure din ingrediente.' })]),
    el('h3', { class: 'detaliu-titlu', text: 'Ingrediente (pentru toate porțiile)' }),
    listaIng,
    el('div', { class: 'cautare mt' }, [iconita('cauta'), cautare]),
    sugestii,
    rezumat,
    camp('Pași de preparare', pasi),
    eroare,
  ]);
  deseneazaIngrediente();

  const d = deschideDialog({
    titlu: editare ? `Editează: ${r.nume}` : copie ? 'Rețetă nouă din copie' : 'Rețetă nouă',
    continut,
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', icon: 'bifa', tip: 'principal', onclick: () => salveaza() }),
    ],
  });

  async function salveaza() {
    const arata = t => { eroare.textContent = t; eroare.hidden = false; eroare.scrollIntoView({ block: 'nearest' }); };
    const numeT = nume.value.trim();
    if (!numeT) { arata('Scrie numele rețetei.'); nume.focus(); return; }
    const alt = toateRetetele().find(x => x.nume.toLowerCase() === numeT.toLowerCase() && (!editare || x.id !== r.id));
    if (alt) { arata(`Există deja o rețetă numită „${alt.nume}". Alege alt nume.`); nume.focus(); return; }
    if (!ingrediente.length) { arata('Adaugă cel puțin un ingredient.'); cautare.focus(); return; }
    if (ingrediente.some(x => !(x[1] > 0 && x[1] <= 20000))) { arata('Fiecare ingredient trebuie să aibă o cantitate între 0,1 și 20.000 g.'); return; }
    const p = parseInt(portii.value, 10), t = parseInt(timp.value, 10);
    if (!(p >= 1 && p <= 50)) { arata('Porțiile trebuie să fie între 1 și 50.'); portii.focus(); return; }
    if (!(t >= 1 && t <= 1440)) { arata('Timpul trebuie să fie între 1 și 1440 de minute.'); timp.focus(); return; }
    const acum = Date.now();
    const brut = {
      ...(editare ? r : {}),
      id: editare ? r.id : idNutritieNou(),
      nume: numeT, masa: masa.value, descriere: descriere.value.trim(), portii: p, timp: t,
      dificultate: dificultate.value, vas: vas.value, etichete: [...declarate],
      ingrediente: ingrediente.map(([id, g]) => [id, Math.round(g * 10) / 10]),
      pasi: pasi.value.split('\n').map(x => x.trim()).filter(Boolean),
      creat: editare && r.creat ? r.creat : acum, modificat: acum,
    };
    delete brut.propriu;
    if (copie && r) brut.sursa = r.id;
    const inregistrare = curataReteta(brut);
    if (!inregistrare) { arata('Rețeta nu e validă. Verifică numele, masa și ingredientele.'); return; }
    try {
      await salveazaRetetaMea(inregistrare);
    } catch (err) {
      console.error(err);
      arata(mesajEroareSalvare(err, 'Rețeta nu a putut fi salvată. Nimic nu a fost modificat.'));
      return;
    }
    await reincarcaNutritie();
    d.inchide(() => arataReteta(inregistrare.id));
    notifica(editare ? 'Rețeta a fost actualizată.' : 'Rețeta a fost salvată.', 'succes');
  }
}

// ---------- Alimente ----------
function deseneazaFiltreAlimente() {
  $('alimente-categorii').replaceChildren(
    chip('Toate', !filtreAlimente.cat, () => { filtreAlimente.cat = ''; deseneazaFiltreAlimente(); randeazaAlimente(); }),
    chip('Ale mele', filtreAlimente.cat === 'proprii', () => { filtreAlimente.cat = filtreAlimente.cat === 'proprii' ? '' : 'proprii'; deseneazaFiltreAlimente(); randeazaAlimente(); }),
    ...CATEGORII_ALIMENTE.map(c => chip(c.nume, filtreAlimente.cat === c.id, () => {
      filtreAlimente.cat = filtreAlimente.cat === c.id ? '' : c.id;
      deseneazaFiltreAlimente(); randeazaAlimente();
    })));
}

function randeazaAlimente() {
  const cuv = normalizeazaText(filtreAlimente.cautare).split(/\s+/).filter(Boolean);
  const lista = toateAlimentele().filter(a =>
    (!filtreAlimente.cat || (filtreAlimente.cat === 'proprii' ? a.propriu : a.cat === filtreAlimente.cat)) &&
    cuv.every(c => normalizeazaText(a.nume).includes(c)))
    .sort((a, b) => Number(Boolean(b.propriu)) - Number(Boolean(a.propriu)) || a.nume.localeCompare(b.nume, 'ro'));
  $('alimente-numar').textContent = plural(lista.length, 'aliment', 'alimente');
  const cont = $('alimente-lista');
  if (!lista.length) {
    cont.replaceChildren(stareGoala({
      icon: 'cauta',
      titlu: filtreAlimente.cat === 'proprii' && !cuv.length ? 'Nu ai încă alimente proprii' : 'Niciun aliment găsit',
      text: 'Adaugă un aliment cu valorile de pe eticheta lui (la 100 g).',
      actiune: buton({ text: 'Aliment nou', icon: 'plus', tip: 'principal', onclick: () => deschideEditorAliment(null, { numeSugerat: filtreAlimente.cautare }) }),
    }));
    return;
  }
  cont.replaceChildren(el('div', { class: 'card lista-simpla' }, lista.map(a => el('button', { class: 'rand-aliment', type: 'button',
    onclick: () => arataAliment(a.id), 'aria-label': `${a.nume}, ${Math.round(a.kcal)} kcal la 100 g. Deschide` }, [
    el('i', { class: 'aliment-culoare', style: `background:${a.culoare}` }),
    el('span', { class: 'rand-aliment-text' }, [
      el('strong', { text: a.nume }),
      el('span', { class: 'nota', text: `P ${formatNumar(a.proteine)} · C ${formatNumar(a.carbohidrati)} · G ${formatNumar(a.grasimi)} g` }),
    ]),
    a.propriu ? el('span', { class: 'eticheta-tip', text: 'Al meu' }) : null,
    el('span', { class: 'rand-aliment-kcal' }, [el('strong', { text: String(Math.round(a.kcal)) }), el('span', { class: 'nota', text: 'kcal/100 g' })]),
  ]))));
}

function reteteCuAliment(id) {
  return toateRetetele().filter(r => r.ingrediente.some(([x]) => x === id));
}

function arataAliment(id) {
  const a = toateAlimentele().find(x => x.id === id);
  if (!a) { notifica('Alimentul nu mai există.', 'eroare'); return; }
  const folosit = reteteCuAliment(a.id);
  const rand = (eticheta, valoare) => el('div', { class: 'detaliu-rand' }, [el('span', { text: eticheta }), el('strong', { text: valoare })]);
  const continut = el('div', {}, [
    el('div', { class: 'detaliu-etichete' }, [
      el('span', { class: 'eticheta-grupa', text: numeCategorieAliment(a.cat) }),
      a.propriu ? el('span', { class: 'eticheta-tip', text: 'Alimentul meu' }) : null,
    ]),
    el('h3', { class: 'detaliu-titlu', text: 'La 100 g' }),
    panouNutritional(a, 'la 100 g'),
    a.buc ? el('p', { class: 'nota', text: `1 ${a.buc[1]} ≈ ${fmtG(a.buc[0])} · ${fmtKcal(a.kcal * a.buc[0] / 100)}` }) : null,
    el('div', { class: 'detaliu-lista mt' }, [
      rand('Alergeni', a.alergeni.length ? a.alergeni.map(numeAlergen).join(', ') : 'niciunul din lista UE'),
      a.urme && a.urme.length ? rand('Poate conține', a.urme.map(numeAlergen).join(', ')) : null,
      rand('Origine', ORIGINI_TEXT[a.animal || '']),
      rand('În rețete', folosit.length ? plural(folosit.length, 'rețetă', 'rețete') : 'niciuna'),
    ]),
    a.nota ? el('p', { class: 'nota', text: a.nota }) : null,
    el('p', { class: 'nota nota-mica', text: a.propriu ? 'Valori introduse de tine.'
      : `Sursa: ${SURSA_NUTRITIE.scurt}, codul ${a.ndb} („${a.sursa}"). ${SURSA_NUTRITIE.licenta}.` }),
  ]);
  const butoane = [];
  if (a.propriu) {
    butoane.push(buton({ icon: 'cos', tip: 'pericol', eticheta: `Șterge ${a.nume}`, onclick: () => d.inchide(() => stergeAliment(a)) }));
    butoane.push(buton({ text: 'Editează', icon: 'editeaza', tip: 'secundar', onclick: () => d.inchide(() => deschideEditorAliment(a)) }));
  } else {
    butoane.push(buton({ text: 'Copiază ca al meu', icon: 'copiaza', tip: 'secundar', onclick: () => d.inchide(() => deschideEditorAliment(a, { copie: true })) }));
  }
  if (folosit.length) {
    butoane.push(buton({ text: 'Vezi rețetele', icon: 'cauta', tip: 'fantoma', onclick: () => d.inchide(() => {
      reseteazaFiltreRetete();
      filtreRetete.cautare = a.nume;
      $('retete-cautare').value = a.nume;
      arataFilaNutritie('retete');
    }) }));
  }
  butoane.push(buton({ text: 'Închide', tip: 'principal', onclick: () => d.inchide() }));
  const d = deschideDialog({ titlu: a.nume, continut, butoane });
}

async function stergeAliment(a) {
  const folosit = reteteMele.filter(r => r.ingrediente.some(([x]) => x === a.id));
  if (folosit.length) {
    notifica(`„${a.nume}" e folosit în ${plural(folosit.length, 'rețeta ta', 'rețetele tale')} (${folosit.slice(0, 3).map(r => r.nume).join(', ')}${folosit.length > 3 ? '…' : ''}). Scoate-l întâi din ${folosit.length === 1 ? 'ea' : 'ele'}.`, 'eroare', 7000);
    return;
  }
  const da = await confirma({ titlu: 'Ștergi alimentul?', text: `„${a.nume}" se mută în Setări → Șterse recent, unde stă 30 de zile.`, ok: 'Șterge', pericol: true });
  if (!da) return;
  let idCos;
  try {
    idCos = await stergeAlimentMeu(a.id, a.nume);
  } catch (err) {
    console.error(err);
    notifica('Alimentul nu a putut fi șters.', 'eroare');
    return;
  }
  await reincarcaNutritie();
  deseneazaCos().catch(() => {});
  notificaStergere(`„${a.nume}" a fost șters.`, idCos, reincarcaNutritie);
}

// Diferența dintre caloriile scrise și cele estimate din macronutrienți (4/4/9 kcal pe gram).
function verificareCalorii(kcal, p, c, g) {
  const estimat = p * 4 + c * 4 + g * 9;
  if (!(kcal >= 0) || !(estimat >= 0)) return null;
  return Math.abs(kcal - estimat) > Math.max(25, estimat * 0.2) ? Math.round(estimat) : null;
}

function deschideEditorAliment(a, { copie = false, numeSugerat = '' } = {}) {
  const editare = Boolean(a && a.propriu && !copie);
  const baza = a || { nume: numeSugerat, cat: 'altele', kcal: '', proteine: '', carbohidrati: '', grasimi: '', fibre: '', alergeni: [], urme: [], animal: null };
  const numar = (val, eticheta, max) => el('input', { type: 'number', inputmode: 'decimal', min: '0', max: String(max), step: 'any',
    value: val === '' || val === undefined ? '' : String(val), 'aria-label': eticheta });
  const camp = (eticheta, control) => el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: eticheta }), control]);
  const nume = el('input', { type: 'text', maxlength: '80', value: copie ? `${baza.nume} (al meu)` : baza.nume, placeholder: 'ex. Iaurt proteic 2%', 'aria-label': 'Numele alimentului' });
  const cat = el('select', { 'aria-label': 'Categoria' }, CATEGORII_ALIMENTE.map(c => el('option', { value: c.id, text: c.nume, selected: c.id === baza.cat })));
  const kcal = numar(baza.kcal, 'Calorii la 100 g', 900);
  const p = numar(baza.proteine, 'Proteine la 100 g', 100);
  const c = numar(baza.carbohidrati, 'Carbohidrați la 100 g', 100);
  const g = numar(baza.grasimi, 'Grăsimi la 100 g', 100);
  const f = numar(baza.fibre, 'Fibre la 100 g', 100);
  const origine = el('select', { 'aria-label': 'Origine' }, Object.entries(ORIGINI_TEXT).map(([k, t]) => el('option', { value: k, text: t, selected: k === (baza.animal || '') })));
  const alergeni = new Set(baza.alergeni || []);
  const chipuriAlergeni = el('div', { class: 'chipuri chipuri-mici' });
  const deseneazaAlergeni = () => chipuriAlergeni.replaceChildren(...ALERGENI.map(x => chip(x.nume, alergeni.has(x.id), () => {
    if (alergeni.has(x.id)) alergeni.delete(x.id); else alergeni.add(x.id);
    deseneazaAlergeni();
  })));
  deseneazaAlergeni();
  const bucUnitate = el('input', { type: 'text', maxlength: '20', value: baza.buc ? baza.buc[1] : '', placeholder: 'ex. felie', 'aria-label': 'Unitatea (opțional)' });
  const bucGrame = numar(baza.buc ? baza.buc[0] : '', 'Grame într-o unitate', 5000);
  const avertizare = el('p', { class: 'nota nota-info', hidden: true });
  const eroare = el('p', { class: 'nota nota-avertizare', hidden: true, role: 'alert' });
  const citeste = x => parseFloat(String(x.value).replace(',', '.'));
  const verifica = () => {
    const est = verificareCalorii(citeste(kcal), citeste(p) || 0, citeste(c) || 0, citeste(g) || 0);
    avertizare.hidden = est === null || !(citeste(kcal) >= 0);
    if (!avertizare.hidden) avertizare.textContent = `Caloriile nu se potrivesc cu macronutrienții (estimat aproximativ ${est} kcal). Verifică eticheta; poți salva oricum.`;
  };
  [kcal, p, c, g].forEach(x => x.addEventListener('input', verifica));

  const continut = el('div', { class: 'editor-aliment' }, [
    el('p', { class: 'nota', text: 'Scrie valorile de pe eticheta produsului, la 100 g.' }),
    camp('Nume', nume),
    camp('Categorie (pentru lista de cumpărături)', cat),
    el('div', { class: 'grila-valori' }, [camp('Calorii (kcal)', kcal), camp('Proteine (g)', p), camp('Carbohidrați (g)', c), camp('Grăsimi (g)', g), camp('Fibre (g)', f)]),
    avertizare,
    camp('Origine', origine),
    el('div', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Alergeni (din lista UE)' }), chipuriAlergeni]),
    el('div', { class: 'rand' }, [camp('Unitate (opțional)', bucUnitate), camp('Grame într-o unitate', bucGrame)]),
    eroare,
  ]);
  verifica();
  const d = deschideDialog({
    titlu: editare ? `Editează: ${a.nume}` : 'Aliment nou',
    continut,
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează', icon: 'bifa', tip: 'principal', onclick: () => salveaza() }),
    ],
  });

  async function salveaza() {
    const arata = t => { eroare.textContent = t; eroare.hidden = false; eroare.scrollIntoView({ block: 'nearest' }); };
    const numeT = nume.value.trim();
    if (!numeT) { arata('Scrie numele alimentului.'); nume.focus(); return; }
    const exista = toateAlimentele().find(x => x.nume.toLowerCase() === numeT.toLowerCase() && (!editare || x.id !== a.id));
    if (exista) { arata(`Există deja un aliment numit „${exista.nume}". Alege alt nume.`); nume.focus(); return; }
    const v = { kcal: citeste(kcal), proteine: citeste(p), carbohidrati: citeste(c), grasimi: citeste(g), fibre: citeste(f) };
    if (!Number.isFinite(v.fibre) && f.value === '') v.fibre = 0;
    for (const [k, nm, max] of [['kcal', 'Caloriile', 900], ['proteine', 'Proteinele', 100], ['carbohidrati', 'Carbohidrații', 100], ['grasimi', 'Grăsimile', 100], ['fibre', 'Fibrele', 100]]) {
      if (!(v[k] >= 0 && v[k] <= max)) { arata(`${nm} trebuie să fie un număr între 0 și ${max}.`); return; }
    }
    if (v.proteine + v.carbohidrati + v.grasimi > 100.5) { arata('Proteinele, carbohidrații și grăsimile adunate nu pot depăși 100 g la 100 g de aliment.'); return; }
    if (v.fibre > v.carbohidrati + 0.5) { arata('Fibrele fac parte din carbohidrați: nu pot fi mai multe decât carbohidrații.'); return; }
    const bg = citeste(bucGrame);
    const unitate = bucUnitate.value.trim();
    if ((unitate && !(bg > 0)) || (!unitate && bucGrame.value !== '')) { arata('Pentru unitate scrie și numele (ex. felie), și câte grame are.'); return; }
    const acum = Date.now();
    const aspectImplicit = { carne: 'carne', lactate: 'crema', legume: 'cuburi', fructe: 'bile', cereale: 'boabe', nuci: 'nuci', altele: 'bile' }[cat.value];
    const brut = {
      ...(editare ? a : {}),
      id: editare ? a.id : idNutritieNou(),
      nume: numeT, cat: cat.value, ...v,
      alergeni: [...alergeni], urme: editare ? (a.urme || []) : copie ? (baza.urme || []) : [],
      animal: origine.value || null,
      aspect: (editare || copie) && baza.aspect ? baza.aspect : aspectImplicit,
      culoare: (editare || copie) && baza.culoare ? baza.culoare : '#B8C49A',
      creat: editare && a.creat ? a.creat : acum, modificat: acum,
    };
    delete brut.propriu; delete brut.ndb; delete brut.sursa;
    if (unitate) brut.buc = [bg, unitate, unitate]; else delete brut.buc;
    if (copie && a) brut.copiatDin = a.id;
    const inregistrare = curataAliment(brut);
    if (!inregistrare) { arata('Alimentul nu e valid. Verifică valorile.'); return; }
    try {
      await salveazaAlimentMeu(inregistrare);
    } catch (err) {
      console.error(err);
      arata(mesajEroareSalvare(err, 'Alimentul nu a putut fi salvat. Nimic nu a fost modificat.'));
      return;
    }
    await reincarcaNutritie();
    d.inchide(() => arataAliment(inregistrare.id));
    notifica(editare ? 'Alimentul a fost actualizat.' : 'Alimentul a fost salvat.', 'succes');
  }
}

// ---------- Pornire ----------
function initNutritie() {
  $('tab-zi').addEventListener('click', () => arataFilaNutritie('zi'));
  $('tab-analiza').addEventListener('click', () => arataFilaNutritie('analiza'));
  $('tab-saptamana').addEventListener('click', () => { dataSaptamana = dataZiNutritie; arataFilaNutritie('saptamana'); });
  $('tab-lista').addEventListener('click', () => arataFilaNutritie('lista'));
  $('tab-retete').addEventListener('click', () => arataFilaNutritie('retete'));
  $('tab-alimente').addEventListener('click', () => arataFilaNutritie('alimente'));
  $('retete-cautare').addEventListener('input', e => { filtreRetete.cautare = e.target.value; randeazaRetete(); });
  $('alimente-cautare').addEventListener('input', e => { filtreAlimente.cautare = e.target.value; randeazaAlimente(); });
  $('btn-retete-filtre').addEventListener('click', reseteazaFiltreRetete);
  $('btn-reteta-noua').addEventListener('click', () => deschideEditorReteta(null));
  $('btn-aliment-nou').addEventListener('click', () => deschideEditorAliment(null));
  $('poza-reteta-fisier').addEventListener('change', pozaRetetaAleasa);
  deseneazaFiltreRetete();
  deseneazaFiltreAlimente();
}
