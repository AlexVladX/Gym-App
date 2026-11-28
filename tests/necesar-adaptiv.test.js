// Etapa 7, funcția 1: necesarul caloric adaptiv.
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../necesar-adaptiv.js');
const Z = require('../nutritie-zi.js');

const AZI = '2026-11-30'; // luni
const IERI = N.plusZileNecesar(AZI, -1);

// O zi cu o singură intrare mâncată de `kcal` (proteine/carbo/grăsimi nu contează aici).
function zi(data, kcal, extra = {}) {
  return { data, mese: [{ id: 'i-' + data, masa: 'pranz', nume: 'Masă', portii: 1, stare: 'complet',
    valoriPortie: { kcal, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 } }], ...extra };
}
// n zile până ieri inclusiv, cu kcal(k) (k = 0 pentru cea mai veche)
function zile(n, kcal, pana = IERI) {
  return Array.from({ length: n }, (_, k) => zi(N.plusZileNecesar(pana, -(n - 1 - k)), typeof kcal === 'function' ? kcal(k) : kcal));
}
// cântăriri zilnice (sau la `pas` zile) pe n zile, cu kg(k)
function cantariri(n, kg, { pas = 1, pana = IERI } = {}) {
  const r = [];
  for (let k = 0; k < n; k += pas) r.push({ data: N.plusZileNecesar(pana, -(n - 1 - k)), tip: 'Greutate', valoare: typeof kg === 'function' ? kg(k) : kg });
  return r;
}

test('greutate constantă și 3.000 kcal/zi → necesar ≈ 3.000', () => {
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: cantariri(28, 80), panaLa: IERI });
  assert.equal(e.stare, 'ok');
  assert.ok(Math.abs(e.necesar - 3000) < 1, String(e.necesar));
  assert.equal(e.pondere, 1); // fără formulă: doar datele
  assert.ok(Math.abs(e.kgPeSapt) < 1e-9);
});

test('greutate în creștere cu 0,5 kg/săpt. la 3.000 kcal → necesar ≈ 2.450', () => {
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: cantariri(28, k => 80 + 0.5 * k / 7), panaLa: IERI });
  assert.equal(e.stare, 'ok');
  assert.ok(Math.abs(e.kgPeSapt - 0.5) < 1e-6);
  assert.ok(Math.abs(e.necesar - 2450) < 1, String(e.necesar)); // 3000 − 0,5/7 × 7700 = 2450
});

test('fluctuațiile de apă (±0,6 kg) nu strică estimarea', () => {
  const apa = [0.6, -0.4, 0.2, -0.6, 0.5, -0.1, -0.3];
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: cantariri(28, k => 80 + 0.5 * k / 7 + apa[k % 7]), panaLa: IERI });
  assert.ok(Math.abs(e.necesar - 2450) < 120, String(e.necesar));
});

test('zile lipsă: zilele goale, sub 50% din țintă și cele marcate „nu e notată complet” nu intră în medie', () => {
  const lista = zile(28, k => (k % 4 === 0 ? 0 : 3000)); // fiecare a patra zi: nimic bifat
  lista[1] = zi(lista[1].data, 900);                        // sub 50% din 3000
  lista[2] = zi(lista[2].data, 1200, { incompleta: true });  // marcată de mână
  const e = N.estimeazaNecesar({ zileNutritie: lista, masuratori: cantariri(28, 80), panaLa: IERI, tintaKcal: 3000 });
  assert.equal(e.stare, 'ok');
  assert.ok(Math.abs(e.mediaKcal - 3000) < 1e-9);
  assert.equal(e.zileValide, 28 - 7 - 2);
  const motive = e.excluse.map(x => x.motiv);
  assert.equal(motive.filter(m => m === 'goala').length, 7);
  assert.ok(motive.includes('putin') && motive.includes('marcata'));
  // doar ce e MÂNCAT: o zi cu totul planificat (neînceput) nu contează
  const plan = zi(lista[3].data, 3000); plan.mese[0].stare = 'neinceput';
  const z2 = N.zileNotateComplet([plan], { dela: plan.data, panaLa: plan.data, tintaKcal: 3000 });
  assert.equal(z2.valide.length, 0);
});

test('cântăriri lipsă: zilele fără cântărire se completează din vecine (ritmul rămâne corect)', () => {
  const m = cantariri(28, k => 80 + 0.5 * k / 7, { pas: 4 }); // 7 cântăriri, una la 4 zile
  assert.equal(m.length, 7);
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: m, panaLa: IERI });
  assert.equal(e.stare, 'ok');
  assert.ok(Math.abs(e.necesar - 2450) < 30, String(e.necesar));
  const s = N.serieGreutate(m, IERI);
  assert.equal(s.zile.filter(z => z.cantarit).length, 7);
  assert.ok(s.zile.length >= 25); // de la prima cântărire până ieri, zi de zi
});

test('o cântărire aberantă e ignorată și semnalată', () => {
  const m = cantariri(28, 80);
  m[14] = { ...m[14], valoare: 86 }; // +7,5% o singură zi
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: m, panaLa: IERI });
  assert.equal(e.aberante.length, 1);
  assert.equal(e.aberante[0].kg, 86);
  assert.ok(e.avertizari.includes('aberante'));
  assert.ok(Math.abs(e.necesar - 3000) < 1, String(e.necesar));
  // o schimbare reală (rămâne sus) NU e aberantă
  const trepte = cantariri(28, k => (k < 14 ? 80 : 83));
  assert.equal(N.marcheazaAberante(N.cantaririZilnice(trepte)).filter(c => c.aberant).length, 0);
});

test('prea puține date → „insuficient”, cu cât mai lipsește (nicio cifră)', () => {
  const e = N.estimeazaNecesar({ zileNutritie: zile(6, 3000), masuratori: cantariri(28, 80, { pas: 7 }), panaLa: IERI });
  assert.equal(e.stare, 'insuficient');
  assert.equal(e.lipsaZile, 4);
  assert.equal(e.lipsaCantariri, 2);
  assert.equal(e.necesar, undefined);
  const fara = N.estimeazaNecesar({ zileNutritie: [], masuratori: [], panaLa: IERI });
  assert.equal(fara.stare, 'insuficient');
  assert.equal(fara.lipsaZile, 10);
  assert.equal(fara.lipsaCantariri, 6);
});

test('combinarea cu formula: la început contează mai mult formula, la 4 săptămâni aproape doar datele', () => {
  const la = n => N.estimeazaNecesar({ zileNutritie: zile(n, 3000), masuratori: cantariri(28, 80), panaLa: IERI, necesarFormula: 2500 });
  const e10 = la(10), e28 = la(28);
  assert.ok(Math.abs(e10.pondere - 10 / 28) < 1e-9);
  assert.ok(e10.necesar > 2500 && e10.necesar < 2750, String(e10.necesar)); // mai aproape de formulă
  assert.equal(e28.pondere, 0.95);
  assert.ok(Math.abs(e28.necesar - (0.95 * 3000 + 0.05 * 2500)) < 1e-9);
});

test('rezultatele absurde se plafonează și se semnalează', () => {
  // +3 kg pe săptămână (cântăriri greșite / altă balanță) la 3.000 kcal
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: cantariri(28, k => 70 + 3 * k / 7), panaLa: IERI });
  assert.ok(e.avertizari.includes('ritm'));
  assert.ok(Math.abs(e.kgPeSapt - 1.5) < 1e-9);
  assert.ok(e.necesar >= N.NECESAR.NECESAR_MIN);
  // mâncat foarte puțin + slăbire mare → nu coboară sub minim
  const j = N.estimeazaNecesar({ zileNutritie: zile(28, 1100), masuratori: cantariri(28, k => 90 - 1.4 * k / 7), panaLa: IERI, tintaKcal: 1500 });
  assert.ok(j.necesar <= N.NECESAR.NECESAR_MAX && j.necesar >= N.NECESAR.NECESAR_MIN);
});

test('stabilitate: necesarul afișat se mișcă cu cel mult 150 kcal pe săptămână', () => {
  // 8 săptămâni la 2.500 kcal, apoi 4 la 3.500 (greutatea constantă tot timpul)
  const lista = zile(84, k => (k < 56 ? 2500 : 3500));
  const ist = N.istoricNecesar({ zileNutritie: lista, masuratori: cantariri(84, 80), azi: AZI, ziVerificare: 1 }).filter(x => x.stare === 'ok');
  assert.ok(ist.length >= 8);
  for (let i = 1; i < ist.length; i++) assert.ok(Math.abs(ist[i].afisat - ist[i - 1].afisat) <= 150 + 10, `${ist[i - 1].afisat} → ${ist[i].afisat}`);
  const ultim = ist[ist.length - 1];
  assert.ok(ultim.necesar > 3000 && ultim.afisat < ultim.necesar, 'brut sare, afișatul urcă treptat');
  assert.ok(ultim.limitatPas);
});

test('data verificării: cea mai recentă zi aleasă (implicit luni), până azi inclusiv', () => {
  assert.equal(N.dataVerificarii('2026-11-30', 1), '2026-11-30'); // luni
  assert.equal(N.dataVerificarii('2026-12-03', 1), '2026-11-30'); // joi → lunea trecută
  assert.equal(N.dataVerificarii('2026-12-03', 4), '2026-12-03'); // joi
  assert.equal(N.dataVerificarii('2026-12-03', 0), '2026-11-29'); // duminică
  assert.equal(N.verificareDeAratat({ azi: '2026-12-03', setare: {} }), '2026-11-30');
  assert.equal(N.verificareDeAratat({ azi: '2026-12-03', setare: { raspunsLa: '2026-11-30' } }), null);
  assert.equal(N.verificareDeAratat({ azi: '2026-12-07', setare: { raspunsLa: '2026-11-30' } }), '2026-12-07');
  assert.equal(N.verificareDeAratat({ azi: '2026-12-03', setare: { pornit: false } }), null);
});

test('ținta din obiectiv: necesar + ritm (kg/săpt. × 7.700 / 7); minimul sigur', () => {
  const t = N.tintaDinNecesar({ necesar: 2450, kg: 80, scop: 'masa', sex: 'm' }); // +0,25% = +0,2 kg/săpt.
  assert.ok(Math.abs(t.ritmKgSapt - 0.2) < 1e-9);
  assert.equal(t.kcal, Math.round((2450 + 0.2 * 7700 / 7) / 10) * 10); // 2670
  const s = N.tintaDinNecesar({ necesar: 2450, kg: 80, scop: 'slabire', ritmProcent: 1, sex: 'm' }); // −0,8 kg/săpt.
  assert.equal(s.kcal, 1570);
  const m = N.tintaDinNecesar({ necesar: 2450, kg: 80, scop: 'mentinere', sex: 'm' });
  assert.equal(m.kcal, 2450);
  assert.equal(m.ritmKgSapt, 0);
  // ritm în afara limitelor → implicit
  assert.equal(N.ritmObiectiv('masa', 2), 0.25);
  assert.equal(N.ritmObiectiv('masa', 0.4), 0.4);
  // sub minimul sigur nu coboară
  const jos = N.tintaDinNecesar({ necesar: 1500, kg: 60, scop: 'slabire', ritmProcent: 1, sex: 'f' });
  assert.equal(jos.kcal, Z.KCAL_MINIM.f);
  assert.equal(jos.limitat, true);
});

test('macronutrienți: carbohidrații au plafon de 6 g/kg; surplusul trece la proteine și grăsimi (grăsimi ≤ 35%)', () => {
  // cazul din prompt: 3.330 kcal la ~78 kg ieșea cu 495 g carbohidrați
  const m = Z.impartireMacronutrienti({ kcal: 3330, kg: 70, proteinePeKg: 1.8 });
  assert.equal(m.carbohidrati, 420); // 6 × 70
  assert.equal(m.plafonCarbo, true);
  assert.ok(m.grasimi * 9 <= 3330 * 0.35 + 9);
  assert.ok(Math.abs(m.proteine * 4 + m.carbohidrati * 4 + m.grasimi * 9 - 3330) <= 12);
  assert.ok(m.proteine > 126); // a primit din surplus
  // fără plafon atins: grăsimi 25%, restul carbo
  const n = Z.impartireMacronutrienti({ kcal: 2500, kg: 80, proteinePeKg: 2 });
  assert.equal(n.plafonCarbo, false);
  assert.equal(n.proteine, 160);
  assert.equal(n.grasimi, Math.round(2500 * 0.25 / 9));
  // calorii foarte puține: grăsimile coboară spre minimul de 0,6 g/kg, carbohidrații nu devin negativi
  const p = Z.impartireMacronutrienti({ kcal: 1300, kg: 90, proteinePeKg: 2.2 });
  assert.ok(p.carbohidrati >= 0 && p.grasimi >= Math.round(90 * 0.6));
  // aceeași împărțire la estimarea din profil
  const e = Z.estimeazaTinte({ kg: 70, inaltimeCm: 185, varsta: 25, sex: 'm', activitate: 'extrem', scop: 'masa' });
  assert.ok(e.carbohidrati <= 6 * 70 && e.detalii.plafonCarbo);
});

test('setarea și istoricul țintelor se curăță (backup, sincronizare)', () => {
  assert.deepEqual(N.curataNecesarAdaptiv(null), { pornit: true, ziVerificare: 1 });
  assert.deepEqual(N.curataNecesarAdaptiv({ pornit: false, ziVerificare: 9, ritmMasa: 0.4, ritmSlabire: 5, proteinePeKg: 2.1, raspunsLa: '2026-11-30', x: 1 }),
    { pornit: false, ziVerificare: 1, ritmMasa: 0.4, proteinePeKg: 2.1, raspunsLa: '2026-11-30' });
  const ist = N.adaugaInIstoricTinte([{ data: 'rau' }], { data: '2026-11-30', vechi: { kcal: 3330, carbohidrati: 495 }, noi: { kcal: 2670, proteine: 160 }, necesar: 2451.4 });
  assert.deepEqual(ist, [{ data: '2026-11-30', vechi: { kcal: 3330, carbohidrati: 495 }, noi: { kcal: 2670, proteine: 160 }, necesar: 2451 }]);
  const multe = Array.from({ length: 60 }, (_, k) => ({ data: '2026-01-01', noi: { kcal: 2000 + k } }));
  assert.equal(N.curataIstoricTinte(multe).length, 52);
  assert.equal(N.curataIstoricTinte(multe)[51].noi.kcal, 2059);
});

test('textele: ritmul real față de țintă și pașii calculului', () => {
  assert.equal(N.textRitm(0.43, 0.2), 'Greutatea ta crește cu 0,4 kg/săpt. (ținta: +0,2)');
  assert.equal(N.textRitm(-0.5, -0.45), 'Greutatea ta scade cu 0,5 kg/săpt. (ținta: −0,45)');
  assert.equal(N.textRitm(0.01, 0), 'Greutatea ta e stabilă (ținta: stabilă)');
  const e = N.estimeazaNecesar({ zileNutritie: zile(28, 3000), masuratori: cantariri(28, k => 80 + 0.5 * k / 7), panaLa: IERI, necesarFormula: 2800 });
  const t = N.tintaDinNecesar({ necesar: e.necesar, kg: 84, scop: 'masa', sex: 'm' });
  const p = N.pasiCalcul(e, t);
  assert.ok(p.some(x => x.includes('Media caloriilor mâncate: 3.000 kcal')));
  assert.ok(p.some(x => x.includes('+0,50 kg/săpt.')));
  assert.ok(p.some(x => x.includes('datele contează 95%')));
  assert.ok(p.some(x => x.startsWith('Obiectivul: +0,25% din greutate')));
});

test('diferențele față de țintele actuale', () => {
  assert.deepEqual(N.diferenteTinte({ kcal: 3330, proteine: 140 }, { kcal: 2670, proteine: 160, carbohidrati: 300 }), { kcal: -660, proteine: 20, carbohidrati: null });
  assert.deepEqual(N.diferenteTinte(null, { kcal: 2000 }), { kcal: null });
});
