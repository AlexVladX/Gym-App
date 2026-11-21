// Teste pentru calculele ecranului Corp (etapa 6) și pozele din backup. Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(global, require('../analiza.js'));
const c = require('../corp-calcul.js');
const { valideazaBackup } = require('../validare.js');
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);
const m = (data, tip, valoare) => ({ data, tip, valoare });

test('unități și valori plauzibile', () => {
  assert.equal(c.unitateTip('talie'), 'cm');
  assert.equal(c.unitateTip('Grăsime corporală'), '%');
  assert.equal(c.unitateTip('Biceps încordat'), '');
  assert.equal(c.valoarePlauzibila('Talie', 85), true);
  assert.equal(c.valoarePlauzibila('Talie', 8.5), false);   // probabil dm, nu cm
  assert.equal(c.valoarePlauzibila('Grăsime corporală', 90), false);
  assert.equal(c.valoarePlauzibila('Tipul meu', 12), true);
  assert.equal(c.valoarePlauzibila('Tipul meu', -1), false);
  assert.equal(c.valoarePlauzibila('Talie', NaN), false);
});

test('valori zilnice (media zilei) și media mobilă pe 7 zile', () => {
  const g = [m('2026-11-01', 'Greutate', 80), m('2026-11-01', 'Greutate', 81), m('2026-11-03', 'Greutate', 79),
    m('2026-11-10', 'Greutate', 78), m('2026-11-02', 'Talie', 90), m('2026-11-04', 'greutate', 79.5)];
  const z = c.valoriZilnice(g, 'Greutate');
  assert.deepEqual(z, [{ data: '2026-11-01', valoare: 80.5 }, { data: '2026-11-03', valoare: 79 }, { data: '2026-11-04', valoare: 79.5 }, { data: '2026-11-10', valoare: 78 }]);
  const mm = c.mediaMobila(z, 7);
  // 01: 80.5 · 03: (80.5+79)/2 · 04: (80.5+79+79.5)/3 · 10: fereastra 04..10 → (79.5+78)/2
  assert.deepEqual(mm.map(x => Math.round(x.valoare * 1000) / 1000), [80.5, 79.75, 79.667, 78.75]);
});

test('IMC și categoriile OMS', () => {
  const i = c.imc(80, 180);
  aproape(i.valoare, 80 / 3.24);
  assert.equal(i.categorie, 'greutate normală');
  assert.equal(c.imc(59, 180).categorie, 'subponderal');      // 18.2
  assert.equal(c.imc(90, 180).categorie, 'supraponderal');    // 27.8
  assert.equal(c.imc(100, 180).categorie, 'obezitate');       // 30.9
  assert.equal(c.imc(80, null), null);
  assert.equal(c.imc(80, 50), null);
});

test('obiectivul de greutate: progres, rămas și estimarea', () => {
  const o = { tinta: 80, start: 90, dela: '2026-10-01' };
  const p = c.progresObiectiv(o, 86, -0.5, '2026-11-19');
  aproape(p.progres, 0.4);
  assert.equal(p.ramas, 6);
  assert.equal(p.directie, 'slabire');
  assert.equal(p.saptamani, 12);
  assert.equal(p.estimare, '2027-02-11');                     // 19.11 + 84 de zile
  // tendința în sens opus: fără estimare
  assert.equal(c.progresObiectiv(o, 86, 0.3, '2026-11-19').estimare, null);
  // prea lent (peste 2 ani): fără estimare
  assert.equal(c.progresObiectiv(o, 86, -0.04, '2026-11-19').estimare, null);
  // atins
  const at = c.progresObiectiv(o, 79.5, -0.5, '2026-11-19');
  assert.equal(at.atins, true); assert.equal(at.progres, 1); assert.equal(at.ramas, 0);
  // creștere în greutate
  const cr = c.progresObiectiv({ tinta: 75, start: 70, dela: '2026-10-01' }, 71, 0.25, '2026-11-19');
  aproape(cr.progres, 0.2); assert.equal(cr.directie, 'crestere'); assert.equal(cr.saptamani, 16);
  // spre greutate mai mică decât startul, dar ai luat în greutate: progres 0, nu negativ
  assert.equal(c.progresObiectiv(o, 92, 0.2, '2026-11-19').progres, 0);
  assert.equal(c.progresObiectiv(null, 86, -0.5, '2026-11-19'), null);
});

test('ultimele valori pe tip, în ordinea standard, cu diferențele', () => {
  const lista = [m('2026-10-01', 'Talie', 90), m('2026-11-01', 'Talie', 88), m('2026-11-15', 'Talie', 87.5),
    m('2026-11-15', 'Braț', 38), m('2026-11-01', 'Biceps încordat', 40), m('2026-11-02', 'Greutate', 82)];
  const u = c.ultimeleValori(lista);
  assert.deepEqual(u.map(x => x.tip), ['Greutate', 'Talie', 'Braț', 'Biceps încordat']);
  const t = u[1];
  assert.equal(t.ultima, 87.5); assert.equal(t.anterioara, 88); assert.equal(t.fataDeAnterioara, -0.5);
  assert.equal(t.fataDePrima, -2.5); assert.equal(t.unitate, 'cm'); assert.equal(t.numar, 3);
  assert.equal(u[2].fataDeAnterioara, null);
});

test('compararea a două date (greutatea: cea mai apropiată, max. 3 zile)', () => {
  const lista = [m('2026-10-01', 'Talie', 90), m('2026-10-01', 'Braț', 37), m('2026-11-15', 'Talie', 87.5),
    m('2026-11-15', 'Coapsă', 60), m('2026-10-02', 'Greutate', 85), m('2026-11-10', 'Greutate', 83)];
  assert.deepEqual(c.dateCuMasuratori(lista), ['2026-11-15', '2026-10-01']);
  const r = c.comparaDate(lista, '2026-10-01', '2026-11-15');
  const pe = Object.fromEntries(r.map(x => [x.tip, [x.a, x.b, x.diferenta]]));
  assert.deepEqual(pe.Talie, [90, 87.5, -2.5]);
  assert.deepEqual(pe['Braț'], [37, null, null]);
  assert.deepEqual(pe['Coapsă'], [null, 60, null]);
  assert.deepEqual(pe.Greutate, [85, null, null]);           // 10.11 e la 5 zile de 15.11
});

test('pozele grupate pe date, în ordinea față, profil, spate', () => {
  const g = c.pozePeDate([{ data: '2026-10-01', unghi: 'spate', creat: 1 }, { data: '2026-11-01', unghi: 'fata', creat: 2 },
    { data: '2026-10-01', unghi: 'fata', creat: 3 }, { data: '2026-10-01', unghi: 'lateral', creat: 4 }, { data: null }]);
  assert.deepEqual(g.map(x => [x.data, x.poze.map(p => p.unghi)]), [['2026-11-01', ['fata']], ['2026-10-01', ['fata', 'lateral', 'spate']]]);
});

test('backup: pozele valide se păstrează, cele stricate se ignoră; fără poze, pozele nu se ating', () => {
  const imagine = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const baza = { versiune: 3, sesiuni: [], exercitii: [], masuratori: [m('2026-11-01', 'Talie', 88)] };
  const r = valideazaBackup({ ...baza, poze: [
    { id: 1, data: '2026-11-01', unghi: 'fata', imagine, latime: 960, inaltime: 1280, creat: 5 },
    { id: 2, data: '2026-11-01', unghi: 'ciudat', imagine },                // unghi necunoscut → față
    { id: 3, data: 'ieri', unghi: 'fata', imagine },                         // dată greșită
    { id: 4, data: '2026-11-01', unghi: 'fata', imagine: 'javascript:alert(1)' },
    { id: 5, data: '2026-11-01', unghi: 'fata', imagine: 'data:text/html;base64,PGI+' },
  ] });
  assert.equal(r.ok, true);
  assert.equal(r.date.poze.length, 2);
  assert.equal(r.date.poze[1].unghi, 'fata');
  assert.equal(r.ignorate, 3);
  assert.equal(r.rezumat.poze, 2);
  const fara = valideazaBackup(baza);
  assert.equal(fara.date.poze, undefined);   // inlocuiesteToate nu atinge pozele
  assert.equal(fara.rezumat.poze, null);
});
