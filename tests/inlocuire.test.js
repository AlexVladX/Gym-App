// Etapa 7, funcția 3: înlocuirea exercițiului — alternative explicate, echipament, împărțire, rutină.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const c = require('../catalog.js');
const I = require('../inlocuire.js');
const sursa = fs.readFileSync(path.join(__dirname, '..', 'exercitii.js'), 'utf8');
const { BIBLIOTECA } = new Function('document', `${sursa}; return { BIBLIOTECA, ANTRENAMENTE };`)({});
const proprii = [
  { nume: 'Presa mea veche', grupa: 'Picioare', secundari: [], echipament: 'Aparat', categorie: 'Compus', nivel: 'Începător', tip: 'greutate', creat: 1 },
  { nume: 'Împins cu gantere pe mingea mea', grupa: 'Piept', secundari: [], echipament: 'Gantere', categorie: null, nivel: null, tip: 'greutate', creat: 2 },
];
const toate = [...c.construiesteBiblioteca(BIBLIOTECA, proprii).values()];
const dupa = nume => toate.find(e => e.nume === nume);
let id = 100;
const serieGoala = (tip = 'normal') => ({ kg: '', repetari: '', durataSec: '', distantaM: '', tip, facut: false });
const s = (kg, rep, facut, tip = 'normal') => ({ kg: String(kg), repetari: String(rep), durataSec: '', distantaM: '', tip, facut });

test('împărțire (cazul din prompt): 2 serii bifate rămân la bară, restul trec la gantere, imediat dedesubt', () => {
  const ex = { id: 1, nume: 'Împins cu bara pe bancă', tip: 'greutate', nota: 'priză lată', superset: 'A',
    serii: [s(60, 10, true, 'incalzire'), s(80, 8, true), s(80, '', false), s(70, '', false, 'drop')] };
  const nou = { id: ++id, nume: 'Împins cu gantere pe bancă', tip: 'greutate', nota: '', superset: null, serii: [serieGoala(), serieGoala(), serieGoala()] };
  const r = I.imparteLaInlocuire(ex, nou, serieGoala);
  assert.equal(r.impartit, true);
  assert.equal(r.facute, 2);
  assert.equal(r.mutate, 2);
  const [vechi, nouEx] = r.lista;
  assert.equal(vechi.nume, 'Împins cu bara pe bancă');
  assert.deepEqual(vechi.serii.map(x => [x.kg, x.tip, x.facut]), [['60', 'incalzire', true], ['80', 'normal', true]]);
  assert.equal(vechi.nota, 'priză lată');
  assert.equal(vechi.superset, 'A');
  assert.equal(nouEx.nume, 'Împins cu gantere pe bancă');
  assert.equal(nouEx.id, nou.id);
  assert.deepEqual(nouEx.serii.map(x => [x.kg, x.tip, x.facut]), [['', 'normal', false], ['', 'drop', false]], 'aceleași tipuri, goale (valorile de data trecută apar ca sugestie)');
  assert.equal(nouEx.superset, 'A', 'supersetul continuă');
  assert.equal(nouEx.nota, '', 'nota rămâne la exercițiul inițial');
  assert.equal(ex.serii.length, 4, 'exercițiul original nu e modificat pe loc');
  assert.match(I.textImpartire(vechi.nume, nouEx.nume, 2, 2), /^2 serii bifate rămân la Împins cu bara pe bancă\. 2 serii nebifate trec la Împins cu gantere pe bancă, care apare imediat dedesubt\./);
});

test('fără serii bifate: înlocuire pe loc, cu supersetul și nota păstrate (ca înainte)', () => {
  const ex = { id: 1, nume: 'A', nota: 'n', superset: 'B', serii: [s('', '', false), s('', '', false)] };
  const nou = { id: 2, nume: 'B', nota: '', superset: null, serii: [serieGoala()] };
  const r = I.imparteLaInlocuire(ex, nou, serieGoala);
  assert.equal(r.impartit, false);
  assert.equal(r.lista.length, 1);
  assert.deepEqual([r.lista[0].nume, r.lista[0].superset, r.lista[0].nota, r.lista[0].serii.length], ['B', 'B', 'n', 1]);
  // toate bifate: nou primește o serie
  const tot = I.imparteLaInlocuire({ ...ex, serii: [s(10, 5, true)] }, nou, serieGoala);
  assert.equal(tot.lista[1].serii.length, 1);
  assert.equal(tot.mutate, 0);
});

test('motivele: aceeași mișcare / aceiași mușchi + echipamentul', () => {
  const bara = dupa('Împins cu bara pe bancă');
  assert.equal(I.motivAlternativa(bara, dupa('Împins cu gantere pe bancă')), 'aceeași mișcare · gantere în loc de bară');
  const alt = I.alternativeExplicate(bara, toate, { n: 30 });
  const flotari = alt.find(x => x.e.echipament === 'Corp' && x.e.poza !== bara.poza);
  if (flotari) assert.match(flotari.motiv, /^aceiași mușchi · greutatea corpului în loc de bară$/);
  const aparat = alt.find(x => x.e.echipament === 'Aparat');
  assert.ok(aparat && /aparat în loc de bară$/.test(aparat.motiv), aparat && aparat.motiv);
  // aceeași mișcare e prima, iar la egalitate cea cu alt echipament (banca / aparatul e ocupat)
  assert.equal(alt[0].e.nume, 'Împins cu gantere pe bancă');
  const varianta = alt.find(x => x.e.poza === bara.poza && x.e.echipament === 'Bară');
  assert.equal(varianta.motiv, 'aceeași mișcare · tot cu bara');
  assert.ok(alt.every(x => x.e.grupa === 'Piept'));
});

test('filtrul de echipament și „Echipamentul din sala mea”', () => {
  const bara = dupa('Împins cu bara pe bancă');
  assert.equal(I.potrivesteFiltruEchipament(dupa('Împins cu gantere pe bancă'), 'gantere'), true);
  assert.equal(I.potrivesteFiltruEchipament(dupa('Împins cu gantere pe bancă'), 'aparat'), false);
  assert.equal(I.potrivesteFiltruEchipament(bara, 'toate'), true);
  assert.equal(I.potrivesteFiltruEchipament({ echipament: 'Bară EZ' }, 'bara'), true);
  // fără gantere în sală: alternativele cu gantere coboară la final, marcate
  const alt = I.alternativeExplicate(bara, toate, { n: 40, echipamentSala: ['Bară', 'Aparat', 'Scripete'] });
  const primaLipsa = alt.findIndex(x => x.lipsa);
  assert.ok(primaLipsa > 0, 'există și disponibile, și lipsă');
  assert.ok(alt.slice(primaLipsa).every(x => x.lipsa), 'cele lipsă sunt toate la final');
  assert.ok(alt.filter(x => x.e.echipament === 'Gantere').every(x => x.lipsa));
  assert.ok(alt.filter(x => x.e.echipament === 'Corp').every(x => !x.lipsa), 'greutatea corpului e mereu disponibilă');
  assert.equal(I.echipamentDisponibil({ echipament: 'Gantere' }, []), true, 'setare goală = totul disponibil');
  assert.deepEqual(I.curataEchipamentSala(['Gantere', 'x', 'Gantere', 'Corp']), ['Gantere']);
});

test('exercițiile proprii au alternative după grupă; „Picioare” caută în toate grupele de picioare (și rămâne „Picioare”)', () => {
  const presa = dupa('Presa mea veche');
  assert.equal(presa.grupa, 'Picioare', 'grupa veche rămâne neschimbată');
  const alt = I.alternativeExplicate(presa, toate, { n: 60 });
  const grupe = new Set(alt.map(x => x.e.grupa));
  assert.ok(['Cvadricepși', 'Femurali', 'Fese', 'Gambe'].every(g => grupe.has(g)), [...grupe].join(','));
  assert.match(alt.find(x => x.e.grupa === 'Fese').motiv, /^tot picioare \(fese\)/);
  const mingea = dupa('Împins cu gantere pe mingea mea');
  const a2 = I.alternativeExplicate(mingea, toate, { n: 5 });
  assert.equal(a2.length, 5);
  assert.ok(a2.every(x => x.e.grupa === 'Piept'));
  assert.equal(I.alternativeExplicate({ nume: 'x', grupa: '' }, toate).length, 0);
});

test('rutina se actualizează doar la „Da”: numele vechi devine cel nou, fără dubluri', () => {
  const r = { id: 3, nume: 'Piept', grupe: ['Piept'], exercitii: ['Împins cu bara pe bancă', 'Fluturări cu gantere'] };
  const nou = I.inlocuiesteInRutina(r, 'împins cu bara pe bancă', 'Împins cu gantere pe bancă', 'Piept');
  assert.deepEqual(nou.exercitii, ['Împins cu gantere pe bancă', 'Fluturări cu gantere']);
  assert.deepEqual(r.exercitii, ['Împins cu bara pe bancă', 'Fluturări cu gantere'], 'rutina originală nu e modificată pe loc');
  assert.deepEqual(I.inlocuiesteInRutina(r, 'Fluturări cu gantere', 'Împins cu bara pe bancă').exercitii, ['Împins cu bara pe bancă'], 'fără dubluri');
  assert.equal(I.inlocuiesteInRutina(r, 'Nu există', 'X'), null);
  assert.deepEqual(I.inlocuiesteInRutina(r, 'Fluturări cu gantere', 'Ridicări laterale', 'Umeri').grupe, ['Piept', 'Umeri']);
});
