// Nutriție — generarea inteligentă a planului zilei (etapa 5). Fără DOM, testabil în Node (tests/nutritie-generator.test.js).
//
// Pași:
// 1. Filtrele stricte (nu se relaxează niciodată): alergiile declarate (inclusiv „poate conține”), ingredientele excluse,
//    dieta aleasă (vegetarian, vegan, fără gluten, fără lactate) și timpul maxim. Rețetele cu un ingredient necunoscut
//    (aliment șters) se scot și ele: nu putem garanta ce conțin.
// 2. Preferințele (contează la alegere, dar pot fi încălcate): bogat în proteine, puține calorii, buget redus, rapid,
//    meal prep, alimentele preferate, rețetele favorite. Rețetele din ultimele zile sunt penalizate (nu interzise).
// 3. Optimizarea întregii zile: rețeta și porțiile fiecărei mese se aleg împreună, ca totalul să se apropie de ținte
//    (calorii, proteine, carbohidrați, grăsimi) și caloriile să fie împărțite rezonabil pe cele 5 mese.
//    Mai multe porniri aleatorii + îmbunătățire masă cu masă; la final se alege la întâmplare unul dintre planurile
//    aproape la fel de bune, ca apăsările repetate să dea planuri diferite.
// 4. Raportul spune cât de aproape e planul de ținte și de ce nu se pot atinge (dacă e cazul).
//
// Nu e o recomandare medicală: e o potrivire matematică pe rețetele din bibliotecă.

function calculeNutritieGen() {
  if (typeof valoriPortie === 'function') return { valoriPortie, eticheteReteta, alergeniReteta };
  return require('./nutritie-calcul.js');
}
function ziNutritieGen() {
  if (typeof intrareMasa === 'function') return { intrareMasa, intrareModificabila };
  return require('./nutritie-zi.js');
}

// Cât din caloriile zilei revine fiecărei mese (orientativ).
const PONDERI_MESE = { 'mic-dejun': 0.25, 'gustare-1': 0.10, pranz: 0.30, 'gustare-2': 0.10, cina: 0.25 };
const ORDINE_MESE_GEN = ['mic-dejun', 'gustare-1', 'pranz', 'gustare-2', 'cina'];
const PORTII_GEN = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const DIETE_STRICTE = ['vegetarian', 'vegan', 'fara-gluten', 'fara-lactate'];
const PREFERINTE_STIL = ['proteic', 'putine-calorii', 'buget', 'rapid', 'meal-prep'];
const TIMPI_MAXIMI = [10, 15, 20, 30, 45, 60];
const ALERGENI_GEN = ['gluten', 'crustacee', 'oua', 'peste', 'arahide', 'soia', 'lapte', 'nuci', 'telina', 'mustar', 'susan', 'sulfiti', 'lupin', 'moluste'];
const ZILE_FARA_REPETARE = 2;

// Toleranțele pentru „în țintă” (aceleași ca la înlocuirea meselor din specificație).
const TOLERANTE_GEN = { kcalProcent: 0.10, proteine: 10, carbohidrati: 15, grasimi: 10 };

function preferinteGoale() {
  return { dieta: [], alergii: [], stil: [], excluse: [], preferate: [], timpMaxim: null };
}

function curataPreferinteNutritie(p) {
  if (!p || typeof p !== 'object') return null;
  const lista = (v, valide) => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && (valide ? valide.includes(x) : x.length > 0 && x.length <= 80)))] : []);
  const rez = {
    dieta: lista(p.dieta, DIETE_STRICTE),
    alergii: lista(p.alergii, ALERGENI_GEN),
    stil: lista(p.stil, PREFERINTE_STIL),
    excluse: lista(p.excluse).slice(0, 200),
    preferate: lista(p.preferate).slice(0, 200),
    timpMaxim: TIMPI_MAXIMI.includes(p.timpMaxim) ? p.timpMaxim : null,
  };
  // Un aliment nu poate fi și exclus, și preferat: excluderea are prioritate.
  rez.preferate = rez.preferate.filter(x => !rez.excluse.includes(x));
  return rez;
}

// Informațiile unei rețete pentru generator, calculate o singură dată.
function infoGenerator(r, idx) {
  const C = calculeNutritieGen();
  const v = C.valoriPortie(r, idx);
  const al = C.alergeniReteta(r, idx);
  return { r, v, etichete: new Set(C.eticheteReteta(r, idx)), alergeni: new Set([...al.contine, ...al.urme]),
    ingrediente: new Set((r.ingrediente || []).map(([id]) => id)), lipsa: v.lipsa.length > 0 };
}

// Împarte rețetele pe mese, după filtrele stricte. Întoarce { candidate: { masa: [info] }, excluse: { masa: { motiv: nr } } }.
function filtreazaReteteGen(retete, idx, pref) {
  const p = pref || preferinteGoale();
  const candidate = {}, excluse = {};
  for (const m of ORDINE_MESE_GEN) { candidate[m] = []; excluse[m] = { alergii: 0, excluse: 0, dieta: 0, timp: 0, necunoscut: 0 }; }
  for (const r of retete) {
    if (!candidate[r.masa]) continue;
    const info = infoGenerator(r, idx);
    const e = excluse[r.masa];
    if (info.lipsa) { e.necunoscut++; continue; }
    if (p.alergii.some(a => info.alergeni.has(a))) { e.alergii++; continue; }
    if (p.excluse.some(id => info.ingrediente.has(id))) { e.excluse++; continue; }
    if (p.dieta.some(d => !info.etichete.has(d))) { e.dieta++; continue; }
    if (p.timpMaxim && !(r.timp <= p.timpMaxim)) { e.timp++; continue; }
    candidate[r.masa].push(info);
  }
  return { candidate, excluse };
}

// Verifică o singură rețetă (folosit și la adăugarea manuală, ca avertisment).
function conflicteReteta(r, idx, pref) {
  const p = pref || preferinteGoale();
  const info = infoGenerator(r, idx);
  return {
    alergii: p.alergii.filter(a => info.alergeni.has(a)),
    excluse: p.excluse.filter(id => info.ingrediente.has(id)),
    dieta: info.lipsa ? [...p.dieta] : p.dieta.filter(d => !info.etichete.has(d)),
    timp: Boolean(p.timpMaxim && !(r.timp <= p.timpMaxim)),
    necunoscut: info.lipsa,
  };
}

// Rețetele folosite în zilele dinaintea datei (implicit ultimele 2).
function reteteRecente(zile, data, nr = ZILE_FARA_REPETARE) {
  const [a, l, z] = data.split('-').map(Number);
  const de = new Set();
  for (let k = 1; k <= nr; k++) {
    const d = new Date(a, l - 1, z - k);
    de.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const rez = new Set();
  for (const zi of zile || []) if (de.has(zi.data)) for (const i of zi.mese || []) rez.add(i.idReteta);
  return rez;
}

// ---------- Scorul unui plan (mai mic = mai bun) ----------
function scorPlanGen(sel, ctx) {
  const { tinte, fix, scop, pref, recente, preferateReteta } = ctx;
  let k = fix.kcal, p = fix.proteine, c = fix.carbohidrati, g = fix.grasimi;
  for (const s of sel) { k += s.info.v.kcal * s.portii; p += s.info.v.proteine * s.portii; c += s.info.v.carbohidrati * s.portii; g += s.info.v.grasimi * s.portii; }
  let scor = 0;
  if (tinte && tinte.kcal) {
    const d = (k - tinte.kcal) / tinte.kcal;
    const wk = scop === 'slabire' && d > 0 ? 8 : scop === 'masa' && d < 0 ? 6 : 4;
    scor += d * d * 100 * wk;
    // caloriile pe mese, față de ponderile orientative
    for (const s of sel) {
      const dm = (s.info.v.kcal * s.portii - PONDERI_MESE[s.masa] * tinte.kcal) / tinte.kcal;
      scor += dm * dm * 100 * 0.6;
    }
  }
  if (tinte && tinte.proteine) {
    const d = (p - tinte.proteine) / tinte.proteine;
    if (d < 0) scor += d * d * 100 * (scop === 'mentinere' ? 2.5 : 4);
    else if (d > 0.04) scor += (d - 0.04) * (d - 0.04) * 100 * 2;
  }
  if (tinte && tinte.carbohidrati) { const d = (c - tinte.carbohidrati) / tinte.carbohidrati; scor += d * d * 100 * 0.8; }
  if (tinte && tinte.grasimi) { const d = (g - tinte.grasimi) / tinte.grasimi; scor += d * d * 100 * 0.8; }
  for (const s of sel) {
    scor += Math.abs(s.portii - 1) * 0.35;
    for (const st of pref.stil) if (s.info.etichete.has(st)) scor -= 0.8;
    // la masă musculară proteinele contează mai mult și la nivelul fiecărei rețete
    if (scop === 'masa' && s.info.etichete.has('proteic')) scor -= 0.4;
    if (scop === 'slabire' && s.info.etichete.has('putine-calorii')) scor -= 0.4;
    for (const id of pref.preferate) if (s.info.ingrediente.has(id)) { scor -= 0.6; break; }
    if (preferateReteta.has(s.info.r.id)) scor -= 0.5;
    if (recente.has(s.info.r.id)) scor += 4;
  }
  return scor;
}

// Cea mai bună porție pentru o rețetă într-o masă, cu restul planului fix.
function celMaiBunPas(sel, poz, info, ctx) {
  let best = null;
  for (const portii of PORTII_GEN) {
    const incercare = sel.map((s, k) => (k === poz ? { ...s, info, portii } : s));
    const sc = scorPlanGen(incercare, ctx);
    if (!best || sc < best.scor) best = { portii, scor: sc };
  }
  return best;
}

function alegeAleatorGen(lista, rng) { return lista[Math.floor(rng() * lista.length)]; }

// zi: ziua curentă (mesele blocate sau începute rămân). retete: toate rețetele (bibliotecă + ale tale).
// tinte: setari.tinteNutritie (poate lipsi: atunci se aleg doar după preferințe, cu porția 1).
function genereazaInteligent({ zi, retete, idx, tinte, scop = 'mentinere', pref, recente = new Set(), preferateReteta = new Set(),
  rng = Math.random, idNou, acum = Date.now(), porniri = 24 }) {
  const Z = ziNutritieGen();
  const p = pref || preferinteGoale();
  const existente = (zi && zi.mese) || [];
  const pastrate = existente.filter(i => !Z.intrareModificabila(i));
  const meseCuPastrate = new Set(pastrate.map(i => i.masa));
  const fix = { kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0 };
  for (const i of pastrate) for (const c of Object.keys(fix)) fix[c] += (i.valoriPortie[c] || 0) * i.portii;
  const { candidate, excluse } = filtreazaReteteGen(retete, idx, p);
  const folositePastrate = new Set(pastrate.map(i => i.idReteta));
  const deGenerat = ORDINE_MESE_GEN.filter(m => !meseCuPastrate.has(m));
  const lipsa = deGenerat.filter(m => !candidate[m].some(x => !folositePastrate.has(x.r.id)));
  const sloturi = deGenerat.filter(m => !lipsa.includes(m));
  const ctx = { tinte: tinte && tinte.kcal ? tinte : null, fix, scop, pref: p, recente, preferateReteta };

  const rezultate = [];
  if (sloturi.length) {
    for (let pornire = 0; pornire < porniri; pornire++) {
      // pornire aleatorie, fără repetări în zi
      const folosite = new Set(folositePastrate);
      let sel = sloturi.map(m => {
        const libere = candidate[m].filter(x => !folosite.has(x.r.id));
        const info = alegeAleatorGen(libere, rng);
        folosite.add(info.r.id);
        return { masa: m, info, portii: 1 };
      });
      if (!ctx.tinte) { rezultate.push({ sel, scor: scorPlanGen(sel, ctx) + rng() * 2 }); continue; }
      sel = sel.map((s, k) => ({ ...s, portii: celMaiBunPas(sel, k, s.info, ctx).portii }));
      let scor = scorPlanGen(sel, ctx);
      // îmbunătățire masă cu masă până nu se mai câștigă nimic
      for (let trecere = 0; trecere < 6; trecere++) {
        let schimbat = false;
        const ordine = sloturi.map((_, k) => k).sort(() => rng() - 0.5);
        for (const poz of ordine) {
          const alte = new Set(sel.filter((_, k) => k !== poz).map(s => s.info.r.id));
          for (const id of folositePastrate) alte.add(id);
          let best = { info: sel[poz].info, portii: sel[poz].portii, scor };
          for (const info of candidate[sel[poz].masa]) {
            if (alte.has(info.r.id)) continue;
            const b = celMaiBunPas(sel, poz, info, ctx);
            if (b.scor < best.scor - 1e-9) best = { info, portii: b.portii, scor: b.scor };
          }
          if (best.info !== sel[poz].info || best.portii !== sel[poz].portii) {
            sel = sel.map((s, k) => (k === poz ? { ...s, info: best.info, portii: best.portii } : s));
            scor = best.scor;
            schimbat = true;
          }
        }
        if (!schimbat) break;
      }
      rezultate.push({ sel, scor });
    }
  }
  rezultate.sort((a, b) => a.scor - b.scor);
  // varietate: oricare dintre planurile aproape la fel de bune ca cel mai bun
  let ales = null;
  if (rezultate.length) {
    const prag = rezultate[0].scor + Math.max(0.6, Math.abs(rezultate[0].scor) * 0.08);
    const bune = rezultate.filter(x => x.scor <= prag);
    ales = alegeAleatorGen(bune, rng);
  }
  const noi = ales ? ales.sel.map(s => Z.intrareMasa({ id: idNou(), masa: s.masa, reteta: s.info.r, valoriPortieReteta: s.info.v, portii: s.portii, acum })) : [];
  const mese = [...pastrate, ...noi].sort((a, b) => ORDINE_MESE_GEN.indexOf(a.masa) - ORDINE_MESE_GEN.indexOf(b.masa));
  const raport = raportPlanGen({ mese, tinte: ctx.tinte, candidate, excluse, lipsa, pastrate: [...meseCuPastrate], recente, pref: p, scop });
  return { mese, pastrate: [...meseCuPastrate], lipsa, raport };
}

// Raportul: totalurile față de ținte, ce e în toleranță și explicațiile.
function raportPlanGen({ mese, tinte, candidate, excluse, lipsa, pastrate, recente, pref }) {
  const tot = { kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 };
  for (const i of mese) for (const c of Object.keys(tot)) tot[c] += (i.valoriPortie[c] || 0) * i.portii;
  const abateri = [];
  const mesaje = [];
  if (tinte) {
    const add = (camp, tinta, toleranta) => {
      if (!(tinta > 0)) return;
      const dif = tot[camp] - tinta;
      abateri.push({ camp, tinta, valoare: tot[camp], dif, inTinta: Math.abs(dif) <= toleranta });
    };
    add('kcal', tinte.kcal, tinte.kcal * TOLERANTE_GEN.kcalProcent);
    add('proteine', tinte.proteine, TOLERANTE_GEN.proteine);
    add('carbohidrati', tinte.carbohidrati, TOLERANTE_GEN.carbohidrati);
    add('grasimi', tinte.grasimi, TOLERANTE_GEN.grasimi);
  }
  const NUME = { 'mic-dejun': 'mic dejun', 'gustare-1': 'gustarea 1', pranz: 'prânz', 'gustare-2': 'gustarea 2', cina: 'cină' };
  const motive = e => {
    const t = [];
    if (e.alergii) t.push(`${e.alergii} din cauza alergiilor`);
    if (e.excluse) t.push(`${e.excluse} din cauza ingredientelor excluse`);
    if (e.dieta) t.push(`${e.dieta} din cauza dietei`);
    if (e.timp) t.push(`${e.timp} din cauza timpului maxim`);
    if (e.necunoscut) t.push(`${e.necunoscut} cu ingrediente șterse`);
    return t.join(', ');
  };
  for (const m of lipsa) {
    mesaje.push({ tip: 'eroare', text: `Nicio rețetă pentru ${NUME[m]} nu respectă filtrele stricte (${motive(excluse[m]) || 'nu există rețete'}). Masa a rămas goală; adaug-o manual sau relaxează dieta, timpul sau ingredientele excluse. Alergiile nu se relaxează niciodată automat.` });
  }
  for (const m of ORDINE_MESE_GEN) {
    if (lipsa.includes(m) || pastrate.includes(m)) continue;
    const n = candidate[m].length;
    if (n > 0 && n < 4) mesaje.push({ tip: 'info', text: `Doar ${n === 1 ? 'o rețetă' : `${n} rețete`} pentru ${NUME[m]} ${n === 1 ? 'respectă' : 'respectă'} filtrele, așa că planurile se vor repeta des.` });
  }
  const repetate = mese.filter(i => !pastrate.includes(i.masa) && recente.has(i.idReteta)).length;
  if (repetate) mesaje.push({ tip: 'info', text: `${repetate === 1 ? 'O rețetă se repetă' : `${repetate} rețete se repetă`} din ultimele ${ZILE_FARA_REPETARE} zile, pentru că se potriveau mult mai bine cu țintele.` });
  const NUME_C = { kcal: 'Caloriile', proteine: 'Proteinele', carbohidrati: 'Carbohidrații', grasimi: 'Grăsimile' };
  for (const a of abateri) {
    if (a.inTinta) continue;
    const u = a.camp === 'kcal' ? 'kcal' : 'g';
    const sens = a.dif < 0 ? 'sub' : 'peste';
    let explicatie = '';
    if (a.camp === 'kcal' && a.dif < 0) explicatie = ' Chiar cu porții duble, rețetele potrivite nu ajung la țintă; poți adăuga o rețetă în plus la o masă.';
    else if (a.camp === 'kcal' && a.dif > 0) explicatie = ' Rețetele care respectă filtrele au prea multe calorii chiar la jumătate de porție.';
    else if (a.camp === 'proteine' && a.dif < 0) explicatie = pref.dieta.includes('vegan') || pref.dieta.includes('vegetarian')
      ? ' Cu dieta aleasă, biblioteca are puține rețete foarte proteice.' : ' Combinațiile disponibile nu au destule proteine fără să depășească caloriile.';
    else explicatie = ' E cea mai apropiată combinație găsită fără să strice caloriile și proteinele.';
    // Proteinele puțin peste țintă nu sunt o problemă la un adult sănătos: doar informăm.
    const tipMesaj = a.camp === 'proteine' && a.dif > 0 && a.dif <= 30 ? 'info' : 'avertizare';
    mesaje.push({ tip: tipMesaj, text: `${NUME_C[a.camp]} planului: ${Math.round(a.valoare)} ${u}, cu ${Math.abs(Math.round(a.dif))} ${u} ${sens} țintă (${Math.round(a.tinta)} ${u}).${explicatie}` });
  }
  return { totaluri: tot, abateri, mesaje, inTinta: abateri.length > 0 && abateri.every(a => a.inTinta) };
}

if (typeof module !== 'undefined') {
  module.exports = {
    PONDERI_MESE, PORTII_GEN, DIETE_STRICTE, PREFERINTE_STIL, TIMPI_MAXIMI, TOLERANTE_GEN, ZILE_FARA_REPETARE,
    preferinteGoale, curataPreferinteNutritie, infoGenerator, filtreazaReteteGen, conflicteReteta, reteteRecente,
    scorPlanGen, genereazaInteligent, raportPlanGen,
  };
}
