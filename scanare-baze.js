// Scanarea meselor, etapa 2 — valorile nutriționale (fără DOM; testat în tests/scanare-baze.test.js).
// Ordinea: 1) alimentele și rețetele din aplicație, 2) USDA FoodData Central / Open Food Facts (prin funcția Supabase),
// 3) valori scrise de tine. AI-ul nu dă niciodată valori: dacă nu există o potrivire sigură, alegi tu.
// Calculul folosește calculatorul existent (valoriAliment / valoriPortie / adunaValori din nutritie-calcul.js).

function calculScanareBaze() {
  if (typeof valoriAliment === 'function') return { valoriAliment, adunaValori, inmultesteValori, valoriGoale, valoriPortie, normalizeazaText, rotunjesteValori };
  return require('./nutritie-calcul.js');
}

const PRAG_LOCAL_SCANARE = 0.75;     // potrivire locală acceptată automat
const PRAG_RETETA_SCANARE = 0.6;     // rețetă propusă (ex. „Sarmale”)
const PRAG_EXTERN_SCANARE = 0.55;    // rezultat USDA/OFF ales automat, dacă e clar în față
const CHEIE_CACHE_CAUTARI = 'cautariNutritie';

// Cuvinte care nu deosebesc alimentele între ele (legături, preparare — preparea e verificată separat).
const NEUTRE_SCANARE = new Set(('de cu si in la din pe pentru fara sau a al ale un o the and with or of in on for without a an ' +
  'gratar fiert fierte fiarta prajit prajite prajita copt coapta cuptor abur crud cruda crude rumenit fript friptura ' +
  'grilled boiled fried baked roasted steamed raw cooked broiled braised stewed sauteed poached toasted fresh plain').split(' '));
const GATIT_EN = /\b(cooked|boiled|roasted|grilled|broiled|fried|baked|steamed|braised|stewed|stir fried|sauteed|poached|microwaved|toasted)\b/;
const CRUD_EN = /\b(raw|uncooked|unprepared|dry|dried)\b/;

function tokeniScanare(t) {
  const { normalizeazaText } = calculScanareBaze();
  return normalizeazaText(t).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length > 1 && !NEUTRE_SCANARE.has(w));
}
// Același cuvânt sau o formă apropiată („burger”/„burgeri”, „ou”/„oua”, „tomato”/„tomatoes”), dar nu
// „cheeseburger” ≈ „cheese” (prefix scurt dintr-un cuvânt mult mai lung).
function cuvinteEgaleScanare(x, y) {
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return s.length >= 3 && l.startsWith(s) && l.length - s.length <= 3;
}

// 0–1: cât din întrebare se regăsește în țintă (70%) și cât din țintă e acoperit (30%).
function detaliiAsemanareScanare(intrebare, tinta) {
  const q = [...new Set(tokeniScanare(intrebare))];
  const t = [...new Set(tokeniScanare(tinta))];
  if (!q.length || !t.length) return { scor: 0, acoperire: 0, precizie: 0 };
  const comuneQ = q.filter(w => t.some(v => cuvinteEgaleScanare(w, v))).length;
  const comuneT = t.filter(v => q.some(w => cuvinteEgaleScanare(w, v))).length;
  const acoperire = comuneQ / q.length, precizie = comuneT / t.length;
  return { scor: acoperire * 0.7 + precizie * 0.3, acoperire, precizie };
}
function asemanareScanare(intrebare, tinta) { return detaliiAsemanareScanare(intrebare, tinta).scor; }

function stareDinTextScanare(t) {
  const s = calculScanareBaze().normalizeazaText(t).replace(/[^a-z]+/g, ' ');
  if (GATIT_EN.test(s)) return 'gatit';
  if (CRUD_EN.test(s)) return 'crud';
  return null;
}
function stareArticolScanare(a) {
  if (a.preparare === 'crud') return 'crud';
  if (a.preparare && a.preparare !== 'necunoscut') return 'gatit';
  return stareDinTextScanare(a.numeEn || '');
}

const TEXT_STARE = { crud: 'crud', gatit: 'gătit' };
function avertizareStare(a, stareSursa) {
  const st = stareArticolScanare(a);
  if (!st || !stareSursa || st === stareSursa) return '';
  return `Valorile sunt pentru alimentul ${TEXT_STARE[stareSursa]}, iar cel din poză pare ${TEXT_STARE[st]}. Alege altă potrivire dacă există.`;
}

// Kcal trebuie să se potrivească aproximativ cu 4/4/9 din macronutrienți (carbohidrații USDA includ fibrele, de aici toleranța).
function plauzibilScanare(v) {
  if (!v || !(v.kcal >= 0) || v.kcal > 902) return false;
  if (v.proteine + v.carbohidrati + v.grasimi > 101) return false;
  const calc = 4 * v.proteine + 4 * v.carbohidrati + 9 * v.grasimi;
  return Math.abs(calc - v.kcal) <= Math.max(40, 0.3 * v.kcal);
}

const nrSigur = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
function per100Curat(v) {
  if (!v) return null;
  const r = {};
  for (const c of ['kcal', 'proteine', 'carbohidrati', 'grasimi']) { r[c] = nrSigur(v[c]); if (r[c] == null) return null; }
  for (const c of ['fibre', 'zahar', 'saturate']) r[c] = nrSigur(v[c]);
  return r;
}

// ---------- Potriviri ----------
function potrivireDinAliment(al, a) {
  const stare = stareDinTextScanare(al.sursa || '');
  const p = {
    tip: 'local', id: al.id, nume: al.nume,
    eticheta: String(al.id).startsWith('u-') ? 'Alimentele tale' : 'Din aplicație · USDA SR28',
    detaliu: al.sursa || '', per100: { kcal: al.kcal, proteine: al.proteine, carbohidrati: al.carbohidrati, grasimi: al.grasimi, fibre: al.fibre, zahar: null, saturate: null },
    portii: Array.isArray(al.buc) && al.buc[0] > 0 ? [{ nume: al.buc[2] || 'bucăți', grame: al.buc[0] }] : [],
    stare,
  };
  const av = a ? avertizareStare(a, stare) : '';
  p.avertizari = av ? [av] : [];
  return p;
}

function potrivireDinReteta(r, idx) {
  const { valoriPortie } = calculScanareBaze();
  const v = valoriPortie(r, idx);
  if (v.lipsa && v.lipsa.length) return null; // rețetă cu ingrediente lipsă: nu o folosim (totalul ar fi incomplet)
  return {
    tip: 'reteta', id: r.id, nume: r.nume, eticheta: 'Rețetă din aplicație',
    detaliu: `${r.portii > 1 ? `din ${r.portii} porții` : '1 porție'}; ingrediente crude ~${Math.round(v.grame)} g pe porție`,
    valoriPortie: { kcal: v.kcal, proteine: v.proteine, carbohidrati: v.carbohidrati, grasimi: v.grasimi, fibre: v.fibre },
    gramePortie: v.grame, avertizari: ['Rețeta se măsoară în porții: alege câte porții ai mâncat (greutatea gătită diferă de cea a ingredientelor crude).'],
  };
}

function potrivireDinExtern(c, a) {
  const per100 = per100Curat(c && c.per100);
  if (!per100) return null;
  const off = c.sursa === 'off';
  const stare = stareDinTextScanare(c.nume);
  const av = [];
  const s = a ? avertizareStare(a, stare) : '';
  if (s) av.push(s);
  if (!plauzibilScanare(per100)) av.push('Caloriile nu se potrivesc cu macronutrienții din sursă; verifică înregistrarea.');
  return {
    tip: off ? 'off' : 'usda', id: String(c.id), nume: String(c.nume || '').slice(0, 160),
    eticheta: off ? `Open Food Facts · ${c.id}` : `USDA FoodData Central · #${c.id}`,
    detaliu: [c.marca, off ? 'date Open Food Facts (licență ODbL)' : c.tipDate].filter(Boolean).join(' · '),
    url: typeof c.url === 'string' && /^https:\/\/(fdc\.nal\.usda\.gov|world\.openfoodfacts\.org)\//.test(c.url) ? c.url : '',
    preluat: /^\d{4}-\d{2}-\d{2}$/.test(c.preluat || '') ? c.preluat : '', marca: c.marca || '', tipDate: c.tipDate || '',
    per100, portii: (Array.isArray(c.portii) ? c.portii : []).filter(p => p && p.nume && p.grame > 0 && p.grame <= 3000).slice(0, 6),
    stare, avertizari: av,
  };
}

// Valori scrise de tine (per 100 g). null = valori invalide.
function potrivireManualaScanare(v) {
  const n = x => { const y = parseFloat(String(x).replace(',', '.')); return Number.isFinite(y) && y >= 0 ? y : null; };
  const per100 = { kcal: n(v.kcal), proteine: n(v.proteine), carbohidrati: n(v.carbohidrati), grasimi: n(v.grasimi), fibre: n(v.fibre) ?? 0, zahar: null, saturate: null };
  if ([per100.kcal, per100.proteine, per100.carbohidrati, per100.grasimi].some(x => x == null)) return null;
  if (per100.kcal > 900 || per100.proteine + per100.carbohidrati + per100.grasimi > 100) return null;
  return { tip: 'manual', id: 'manual', nume: 'Valori scrise de tine', eticheta: 'Scris de tine', detaliu: 'la 100 g', per100, portii: [], stare: null, avertizari: [] };
}

// Alimentele și rețetele din aplicație, ordonate după asemănare (cele cu altă stare — crud/gătit — sunt penalizate).
function candidatiLocaliScanare(a, alimente, retete, idx, max = 6) {
  const st = stareArticolScanare(a);
  const scoruri = [];
  for (const al of alimente || []) {
    if (!al || !al.id || !(al.kcal >= 0)) continue;
    const ro = detaliiAsemanareScanare(a.nume, al.nume);
    const en = a.numeEn ? detaliiAsemanareScanare(a.numeEn, al.sursa || '') : { scor: 0, acoperire: 0, precizie: 0 };
    const d = ro.scor >= en.scor ? ro : en;
    const s = d.scor;
    if (s < 0.4) continue;
    const stare = stareDinTextScanare(al.sursa || '');
    scoruri.push({ s: s - (st && stare && st !== stare ? 0.3 : 0), sBrut: s, acoperire: d.acoperire, tip: 'aliment', ob: al });
  }
  for (const r of retete || []) {
    if (!r || !r.id) continue;
    const d = detaliiAsemanareScanare(a.nume, r.nume);
    // Rețetele trec după alimente la scor egal (un aliment simplu e o potrivire mai sigură decât un fel compus).
    if (d.scor >= PRAG_RETETA_SCANARE) scoruri.push({ s: d.scor - 0.05, sBrut: d.scor, precizie: d.precizie, acoperire: d.acoperire, tip: 'reteta', ob: r });
  }
  scoruri.sort((x, y) => y.s - x.s);
  const rez = [];
  for (const x of scoruri) {
    const p = x.tip === 'aliment' ? potrivireDinAliment(x.ob, a) : potrivireDinReteta(x.ob, idx);
    if (p) rez.push({ ...p, scor: Math.round(x.s * 100) / 100, scorBrut: x.sBrut, precizie: x.precizie, acoperire: x.acoperire });
    if (rez.length >= max) break;
  }
  return rez;
}

// Potrivirea locală se acceptă automat doar dacă e foarte asemănătoare și starea (crud/gătit) nu se contrazice.
// O rețetă se alege automat doar dacă numele aproape coincide (ex. „Ciorbă de perișoare” → „Ciorbă de perișoare de curcan”)
// și nu există un aliment simplu asemănător; „Sarmale” cu trei rețete posibile rămâne la alegerea ta.
function alegeLocalScanare(candidati) {
  const alimente = candidati.filter(c => c.tip === 'local');
  const a = alimente[0];
  if (a && a.scorBrut >= PRAG_LOCAL_SCANARE && a.acoperire >= 0.999 && !a.avertizari.length && a === candidati.find(c => c.tip === 'local' || c.scorBrut >= a.scorBrut)) return a;
  if (a && a.scorBrut >= 0.6) return null;
  const r = candidati.find(c => c.tip === 'reteta');
  if (r && r.scorBrut >= 0.85 && r.acoperire >= 0.999 && r.precizie >= 0.66) return r;
  return null;
}

function scorExternScanare(a, p) {
  let s = asemanareScanare(a.numeEn || a.nume, p.nume);
  if (detaliiAsemanareScanare(a.numeEn || a.nume, p.nume).acoperire < 0.999) s -= 0.15;
  const st = stareArticolScanare(a);
  if (st && p.stare) s += st === p.stare ? 0.1 : -0.35;
  const deMarca = p.tip === 'off' || p.tipDate === 'Branded';
  if (deMarca && !a.ambalat) s -= 0.3;
  if (deMarca && a.marca && p.marca && asemanareScanare(a.marca, p.marca) >= 0.5) s += 0.25;
  if (p.tipDate === 'Foundation' || p.tipDate === 'SR Legacy') s += 0.05;
  if (!plauzibilScanare(p.per100)) s -= 0.8;
  return Math.round(s * 100) / 100;
}

// Rezultatele externe, ordonate. „ales” = cel ales automat (doar dacă e clar în față); altfel tu alegi.
function ordoneazaExterneScanare(a, candidatiServer) {
  const lista = [];
  const vazute = new Set();
  for (const c of candidatiServer || []) {
    const p = potrivireDinExtern(c, a);
    if (!p || vazute.has(p.tip + p.id)) continue;
    // Variantele care au în comun cu numele căutat doar un cuvânt secundar („platter”, „cold”) nu se arată.
    const d = detaliiAsemanareScanare(a.numeEn || a.nume, p.nume);
    const marcaPotrivita = a.marca && p.marca && asemanareScanare(a.marca, p.marca) >= 0.5;
    if (d.acoperire < 0.5 && !marcaPotrivita) continue;
    vazute.add(p.tip + p.id);
    lista.push({ ...p, scor: scorExternScanare(a, p) });
  }
  lista.sort((x, y) => y.scor - x.scor);
  const [p1, p2] = lista;
  const ales = p1 && p1.scor >= PRAG_EXTERN_SCANARE && !p1.avertizari.length && (!p2 || p1.scor - p2.scor >= 0.1) ? p1 : null;
  return { candidati: lista.slice(0, 8), ales };
}

// Avertizările afișate pentru potrivirea curentă, recalculate (dacă schimbi prepararea, se schimbă și ele).
function avertizariPotrivireScanare(a) {
  const p = a.potrivire;
  if (!p) return [];
  const rez = [];
  if (p.tip === 'reteta') rez.push('Rețeta se măsoară în porții: alege câte porții ai mâncat (greutatea gătită diferă de cea a ingredientelor crude).');
  const s = avertizareStare(a, p.stare);
  if (s) rez.push(s);
  if (p.per100 && p.tip !== 'manual' && !plauzibilScanare(p.per100)) rez.push('Caloriile nu se potrivesc cu macronutrienții din sursă; verifică înregistrarea.');
  return rez;
}

// Căutare locală după un text scris de tine (alimente și rețete, fără prag de stare).
function cautaLocalScanare(text, a, alimente, retete, idx) {
  return candidatiLocaliScanare({ ...a, nume: text, numeEn: text }, alimente, retete, idx, 8);
}

// ---------- Cantitate, unități, calcul ----------
const rotunjeste1 = x => Math.round(x * 10) / 10;

function unitatiArticolScanare(a) {
  const p = a.potrivire;
  if (p && p.tip === 'reteta') return [{ id: 'portie', nume: 'porții', grame: null }];
  const u = [{ id: 'g', nume: 'g', grame: 1 }];
  if (a.bucati > 1 && a.grameEstimat > 0) u.push({ id: 'buc', nume: 'bucăți (greutate estimată din poză)', grame: rotunjeste1(a.grameEstimat / a.bucati) });
  (p && p.portii ? p.portii : []).forEach((x, i) => u.push({ id: `p${i}`, nume: `${x.nume} (${rotunjeste1(x.grame)} g, ${p.tip === 'local' ? 'din aplicație' : 'din sursă'})`, grame: x.grame }));
  u.push({ id: 'ml', nume: 'ml (presupus 1 ml = 1 g)', grame: 1 });
  return u;
}

// Pregătește un aliment recunoscut pentru etapa 2: cantitatea pornește în bucăți dacă AI-ul a numărat bucăți identice.
function initializeazaCantitateScanare(a) {
  if (a.grame == null) return { ...a, unitate: 'g', cantitate: null };
  if (a.bucati > 1) return { ...a, unitate: 'buc', cantitate: a.bucati };
  return { ...a, unitate: 'g', cantitate: a.grame };
}

function grameDinCantitate(a, unitate, cantitate) {
  const u = unitatiArticolScanare(a).find(x => x.id === unitate);
  if (!u || u.grame == null || cantitate == null) return null;
  return rotunjeste1(cantitate * u.grame);
}

function marcheazaSursaGramaj(a) {
  const est = a.grameEstimat != null && a.grame != null && Math.abs(a.grame - a.grameEstimat) < 0.6;
  return { ...a, sursaGramaj: est ? 'estimat' : 'manual' };
}

function seteazaCantitateScanare(a, valoare) {
  const v = parseFloat(String(valoare).replace(',', '.'));
  const cantitate = Number.isFinite(v) && v > 0 && v <= 3000 ? Math.round(v * 10) / 10 : null;
  const b = { ...a, cantitate };
  b.grame = a.unitate === 'portie' ? null : grameDinCantitate(b, a.unitate, cantitate);
  return marcheazaSursaGramaj(b);
}

// Schimbarea unității păstrează greutatea (1200 g → 6 bucăți de 200 g).
function seteazaUnitateScanare(a, unitate) {
  const u = unitatiArticolScanare(a).find(x => x.id === unitate);
  if (!u) return a;
  if (u.grame == null) return { ...a, unitate, cantitate: a.unitate === unitate ? a.cantitate : 1, grame: null };
  const cantitate = a.grame != null ? Math.round((a.grame / u.grame) * 10) / 10 : null;
  return marcheazaSursaGramaj({ ...a, unitate, cantitate, grame: cantitate != null ? rotunjeste1(cantitate * u.grame) : null });
}

// Alegerea unei potriviri: rețetele trec pe porții; restul păstrează gramajul.
function aplicaPotrivireScanare(a, p) {
  let b = { ...a, potrivire: p, stareCautare: 'gata' };
  if (p && p.tip === 'reteta') return { ...b, unitate: 'portie', cantitate: a.unitate === 'portie' && a.cantitate ? a.cantitate : 1, grame: null };
  if (a.unitate === 'portie') {
    const g = a.grameEstimat;
    b = { ...b, unitate: 'g', cantitate: g, grame: g };
  }
  if (!unitatiArticolScanare(b).some(u => u.id === b.unitate)) b = { ...b, unitate: 'g', cantitate: b.grame };
  return marcheazaSursaGramaj(b);
}

// Valorile unui aliment: null dacă lipsesc potrivirea sau cantitatea (nu se ghicește nimic).
function valoriArticolScanare(a) {
  const C = calculScanareBaze();
  const p = a.potrivire;
  if (!p) return null;
  if (p.tip === 'reteta') {
    if (!(a.cantitate > 0) || !p.valoriPortie) return null;
    return { ...C.inmultesteValori(p.valoriPortie, a.cantitate), zahar: null, saturate: null };
  }
  if (!(a.grame > 0) || !p.per100) return null;
  const v = C.valoriAliment(p.per100, a.grame);
  const f = a.grame / 100;
  return { ...v, zahar: p.per100.zahar != null ? p.per100.zahar * f : null, saturate: p.per100.saturate != null ? p.per100.saturate * f : null };
}

// Totalul mesei: doar alimentele cu valori; „lipsa” = câte nu au încă valori.
// Zahărul și grăsimile saturate apar doar dacă le au TOATE alimentele numărate.
function totalScanare(articole) {
  const C = calculScanareBaze();
  let total = C.valoriGoale();
  let zahar = 0, saturate = 0, cuZahar = true, cuSaturate = true, numarate = 0, lipsa = 0;
  for (const a of articole) {
    const v = valoriArticolScanare(a);
    if (!v) { lipsa++; continue; }
    numarate++;
    total = C.adunaValori(total, v);
    if (v.zahar == null) cuZahar = false; else zahar += v.zahar;
    if (v.saturate == null) cuSaturate = false; else saturate += v.saturate;
  }
  return {
    valori: C.rotunjesteValori(total), numarate, lipsa,
    zahar: numarate && cuZahar ? rotunjeste1(zahar) : null,
    saturate: numarate && cuSaturate ? rotunjeste1(saturate) : null,
  };
}

function textValoriScanare(v) {
  const f = x => String(rotunjeste1(x)).replace('.', ',');
  return `${Math.round(v.kcal)} kcal · P ${f(v.proteine)} g · C ${f(v.carbohidrati)} g · G ${f(v.grasimi)} g`;
}

// ---------- Un aliment care conține de fapt mai multe („cartofi prăjiți cu morcov”) ----------
// Despărțit după „cu”, „și”, „+”, „,” (și „with”, „and” în numele englezesc). Butonul „Împarte” apare doar la cerere;
// gramajul se împarte egal și rămâne „estimat”, ca să-l corectezi.
const SEPARATOR_ALIMENTE = /\s*(?:,|\+|\s(?:și|si|cu|with|and|&)\s)\s*/i;
function partiNumeScanare(nume) {
  const p = String(nume || '').split(SEPARATOR_ALIMENTE).map(x => x.trim()).filter(x => x.length >= 2);
  return p.length >= 2 && p.length <= 5 ? p : null;
}

function imparteArticolScanare(a, idNou) {
  const parti = partiNumeScanare(a.nume);
  if (!parti) return null;
  const en = partiNumeScanare(a.numeEn || '');
  const n = parti.length;
  const imp = x => (x == null ? null : Math.max(1, Math.round(x / n)));
  return parti.map((nume, k) => {
    const g = imp(a.grame);
    const b = {
      ...a, id: idNou(), nume, numeEn: en && en.length === n ? en[k] : '', alternative: [],
      grame: g, grameEstimat: imp(a.grameEstimat), grameMin: imp(a.grameMin), grameMax: imp(a.grameMax), sursaGramaj: 'estimat',
      incredere: a.incredere === 'ridicata' ? 'medie' : a.incredere, bucati: null, vizibile: [], ascunse: k === 0 ? a.ascunse : [],
      note: `Împărțit din „${a.nume}”: gramajul total s-a împărțit în ${n} părți egale; corectează-l după ce vezi în poză.`,
      potrivire: null, candidatiLocali: [], candidatiExterni: [], stareCautare: 'cauta', salvatInBiblioteca: null,
    };
    return { ...b, unitate: 'g', cantitate: g };
  });
}

// ---------- Salvarea în zi (etapa 3) ----------
const r1 = x => Math.round(x * 10) / 10;

// Copia unui aliment pentru ziua ta: valorile de acum + sursa; valorile la 100 g / pe porție ca să poți corecta cantitatea mai târziu.
function instantaneuArticolScanare(a) {
  const v = valoriArticolScanare(a);
  if (!v) return null;
  const p = a.potrivire;
  const u = unitatiArticolScanare(a).find(x => x.id === a.unitate);
  const valori = { kcal: r1(v.kcal), proteine: r1(v.proteine), carbohidrati: r1(v.carbohidrati), grasimi: r1(v.grasimi), fibre: r1(v.fibre || 0) };
  if (v.zahar != null) valori.zahar = r1(v.zahar);
  if (v.saturate != null) valori.saturate = r1(v.saturate);
  const r = {
    nume: a.nume.trim(), cantitate: a.cantitate, unitate: u ? (u.id === 'g' ? 'g' : u.nume) : a.unitate, grame: p.tip === 'reteta' ? null : a.grame,
    estimat: a.sursaGramaj === 'estimat', valori,
    sursa: { tip: p.tip, eticheta: p.eticheta, nume: p.nume, id: p.tip === 'manual' ? '' : String(p.id), url: p.url || '', preluat: p.preluat || '' },
  };
  if (p.tip === 'reteta') r.valoriPortie = { ...p.valoriPortie };
  else if (p.per100) {
    r.per100 = { kcal: p.per100.kcal, proteine: p.per100.proteine, carbohidrati: p.per100.carbohidrati, grasimi: p.per100.grasimi, fibre: p.per100.fibre || 0 };
    if (p.per100.zahar != null) r.per100.zahar = p.per100.zahar;
    if (p.per100.saturate != null) r.per100.saturate = p.per100.saturate;
  }
  return r;
}

// Ce împiedică salvarea: fiecare aliment trebuie să aibă nume, cantitate și valori (nimic nu se salvează pe jumătate).
function problemeSalvareScanare(articole) {
  if (!articole.length) return ['Lista e goală. Adaugă cel puțin un aliment.'];
  const p = [];
  for (const a of articole) {
    const nume = a.nume.trim() || 'Un aliment fără nume';
    if (!a.nume.trim()) p.push('Un aliment nu are nume.');
    else if (!(a.cantitate > 0)) p.push(`„${nume}” nu are cantitate.`);
    else if (!valoriArticolScanare(a)) p.push(`„${nume}” nu are valori: alege sursa sau șterge-l.`);
  }
  return p;
}

// Masa propusă după oră (o poți schimba).
function masaImplicitaScanare(ora) {
  const [h, m] = String(ora || '12:00').split(':').map(Number);
  const t = h * 60 + (m || 0);
  if (t < 10 * 60 + 30) return 'mic-dejun';
  if (t < 12 * 60) return 'gustare-1';
  if (t < 15 * 60 + 30) return 'pranz';
  if (t < 18 * 60) return 'gustare-2';
  return 'cina';
}

function numeImplicitScanare(articole) {
  const n = articole.map(a => a.nume.trim()).filter(Boolean);
  if (!n.length) return 'Masă din poză';
  const t = n.length > 3 ? `${n.slice(0, 3).join(', ')} +${n.length - 3}` : n.join(', ');
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 80);
}

// ---------- Biblioteca ta de alimente (etapa 3) ----------
// Doar alimentele cu valori dintr-o bază de date (USDA / Open Food Facts) sau scrise de tine; niciodată estimări AI.
function poateIntraInBibliotecaScanare(a) { return Boolean(a.potrivire && ['usda', 'off', 'manual'].includes(a.potrivire.tip)); }

function duplicatAlimentScanare(alimenteMele, a) {
  const p = a.potrivire;
  if (!p) return null;
  const { normalizeazaText } = calculScanareBaze();
  return (alimenteMele || []).find(x => x.provenienta && p.tip !== 'manual' && x.provenienta.tip === p.tip && String(x.provenienta.id) === String(p.id))
    || (alimenteMele || []).find(x => normalizeazaText(x.nume) === normalizeazaText(a.nume)) || null;
}

function alimentDinScanare(a, id, acum = Date.now()) {
  const p = a.potrivire;
  if (!poateIntraInBibliotecaScanare(a)) throw new Error('Doar alimentele cu valori din USDA, Open Food Facts sau scrise de tine se pot salva.');
  const v = p.per100;
  const al = {
    id, nume: a.nume.trim().slice(0, 80), cat: 'altele', alergeni: [], urme: [], animal: null, culoare: '#C2B9A5', aspect: 'bile',
    kcal: v.kcal, proteine: v.proteine, carbohidrati: v.carbohidrati, grasimi: v.grasimi, fibre: v.fibre != null ? v.fibre : 0,
    sursa: p.tip === 'manual' ? 'Valori scrise de tine' : p.nume,
    provenienta: { tip: p.tip, id: p.tip === 'manual' ? '' : String(p.id), url: p.url || '', preluat: p.preluat || '', verificat: p.tip !== 'manual', numeSursa: p.nume },
    creat: acum, modificat: acum,
  };
  if (v.fibre == null) al.provenienta.faraFibre = true;
  if (p.marca) al.marca = String(p.marca).slice(0, 80);
  return al;
}

// ---------- Cache local pentru căutările externe (30 de zile, max. 80) ----------
function cheieCautareScanare(c) { return `${c.ambalat ? 'a' : 'g'}|${(c.marca || '').toLowerCase()}|${c.text.toLowerCase()}`; }
function citesteCacheCautari(stocare, cheie, acum = Date.now()) {
  try {
    const c = JSON.parse(stocare.getItem(CHEIE_CACHE_CAUTARI) || '{}');
    const i = c && c[cheie];
    return i && acum - i.timp < 30 * 86400000 && Array.isArray(i.candidati) ? i.candidati : null;
  } catch (_) { return null; }
}
function scrieCacheCautari(stocare, cheie, candidati, acum = Date.now()) {
  try {
    let c = {};
    try { c = JSON.parse(stocare.getItem(CHEIE_CACHE_CAUTARI) || '{}') || {}; } catch (_) { c = {}; }
    c[cheie] = { timp: acum, candidati };
    const chei = Object.keys(c).filter(k => c[k] && acum - c[k].timp < 30 * 86400000).sort((x, y) => c[y].timp - c[x].timp).slice(0, 80);
    const nou = {};
    for (const k of chei) nou[k] = c[k];
    stocare.setItem(CHEIE_CACHE_CAUTARI, JSON.stringify(nou));
  } catch (_) { /* fără cache, căutarea merge la fel */ }
}

if (typeof module !== 'undefined') module.exports = {
  PRAG_LOCAL_SCANARE, PRAG_EXTERN_SCANARE, tokeniScanare, asemanareScanare, stareDinTextScanare, stareArticolScanare, plauzibilScanare,
  potrivireDinAliment, potrivireDinReteta, potrivireDinExtern, potrivireManualaScanare, candidatiLocaliScanare, alegeLocalScanare,
  scorExternScanare, ordoneazaExterneScanare, unitatiArticolScanare, initializeazaCantitateScanare, seteazaCantitateScanare,
  seteazaUnitateScanare, aplicaPotrivireScanare, avertizariPotrivireScanare, cautaLocalScanare, valoriArticolScanare, totalScanare, textValoriScanare,
  cheieCautareScanare, citesteCacheCautari, scrieCacheCautari,
  instantaneuArticolScanare, problemeSalvareScanare, masaImplicitaScanare, numeImplicitScanare,
  poateIntraInBibliotecaScanare, duplicatAlimentScanare, alimentDinScanare, partiNumeScanare, imparteArticolScanare,
};
