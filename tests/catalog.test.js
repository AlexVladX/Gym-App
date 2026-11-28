// Teste pentru biblioteca unificată (catalog.js) și datele catalogului (exercitii.js).
// Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const c = require('../catalog.js');

// exercitii.js nu e modul: îl încărcăm ca text.
const sursa = fs.readFileSync(path.join(__dirname, '..', 'exercitii.js'), 'utf8');
const { BIBLIOTECA, ANTRENAMENTE } = new Function('document', `${sursa}; return { BIBLIOTECA, ANTRENAMENTE };`)({});

test('catalogul: 118 exerciții, toate în cele 11 grupe, cu categorie și fără „Picioare"', () => {
  assert.equal(BIBLIOTECA.length, 118);
  for (const e of BIBLIOTECA) {
    assert.ok(c.GRUPE.includes(e.grupa), `${e.nume}: grupă ${e.grupa}`);
    assert.ok(['Compus', 'Izolare'].includes(e.categorie), `${e.nume}: categorie`);
  }
  // Etapa 5: „Aparat pentru adductori” Cvadricepși → Fese; „Îndreptări românești” Fese → Femurali.
  assert.equal(BIBLIOTECA.filter(e => e.grupa === 'Cvadricepși').length, 13);
  assert.equal(BIBLIOTECA.filter(e => e.grupa === 'Femurali').length, 6);
  assert.equal(BIBLIOTECA.find(e => e.nume === 'Aparat pentru adductori').grupa, 'Fese');
  assert.equal(BIBLIOTECA.find(e => e.nume === 'Îndreptări românești').grupa, 'Femurali');
  const nume = new Set(BIBLIOTECA.map(e => e.nume.toLowerCase()));
  assert.equal(nume.size, 118, 'nume unice');
  for (const a of ANTRENAMENTE) {
    for (const g of a.grupe) assert.ok(c.GRUPE.includes(g), `${a.nume}: ${g}`);
    for (const n of a.exercitii) assert.ok(nume.has(n.toLowerCase()), `${a.nume}: ${n} lipsește din catalog`);
  }
});

test('corecțiile de categorie: presele pentru umeri sunt compuse, ridicările laterale la scripete izolare', () => {
  const dupa = n => BIBLIOTECA.find(e => e.nume === n);
  assert.equal(dupa('Împins deasupra capului').categorie, 'Compus');
  assert.equal(dupa('Ridicări laterale la scripete').categorie, 'Izolare');
  assert.equal(dupa('Genuflexiuni cu bara').categorie, 'Compus');
  assert.equal(dupa('Flexii cu bara').categorie, 'Izolare');
});

test('unificaExercitiu: catalog + preferințele tale (grupă, tip, favorit, notă)', () => {
  const e = BIBLIOTECA.find(x => x.nume === 'Genuflexiuni cu bara');
  const u = c.unificaExercitiu(e, null);
  assert.equal(u.grupa, 'Cvadricepși');
  assert.deepEqual(u.secundari, ['gambe', 'fesieri', 'femurali', 'zona lombară']);
  assert.equal(u.tip, 'greutate');
  assert.equal(u.propriu, false);
  const cuPref = c.unificaExercitiu(e, { nume: e.nume, grupa: 'Fese', tip: 'corp', favorit: true, nota: 'Talpi pe disc' });
  assert.equal(cuPref.grupa, 'Fese');
  assert.ok(cuPref.secundari.includes('cvadricepși') && !cuPref.secundari.includes('fesieri'));
  assert.equal(cuPref.tip, 'corp');
  assert.equal(cuPref.favorit, true);
  assert.equal(cuPref.nota, 'Talpi pe disc');
  // o grupă necunoscută din înregistrarea ta e ignorată
  assert.equal(c.unificaExercitiu(e, { nume: e.nume, grupa: 'xyz' }).grupa, 'Cvadricepși');
});

test('tipul implicit din catalog: plank = timp, farmer = distanță, corp = corp', () => {
  const tip = n => c.tipDinCatalog(BIBLIOTECA.find(x => x.nume === n));
  assert.equal(tip('Plank'), 'timp');
  assert.equal(tip("Mers cu greutăți (farmer's walk)"), 'distanta');
  assert.equal(tip('Tracțiuni'), 'corp');
  assert.equal(tip('Împins cu bara pe bancă'), 'greutate');
});

test('construiesteBiblioteca: catalog + exerciții proprii, inclusiv cele vechi cu grupa „Picioare"', () => {
  const b = c.construiesteBiblioteca(BIBLIOTECA, [
    { nume: 'Exercițiul meu', grupa: 'Picioare' },
    { nume: 'împins cu bara pe bancă', favorit: true }, // preferință pe un exercițiu din catalog (alte litere)
    { nume: 'Sprint pe deal', grupa: 'Cvadricepși', tip: 'distanta', echipament: 'Altele', categorie: 'Compus' },
  ]);
  assert.equal(b.size, 120);
  assert.equal(b.get('exercițiul meu').grupa, 'Picioare');
  assert.equal(b.get('exercițiul meu').propriu, true);
  assert.equal(b.get('împins cu bara pe bancă').favorit, true);
  assert.equal(b.get('împins cu bara pe bancă').nume, 'Împins cu bara pe bancă');
  assert.equal(b.get('sprint pe deal').tip, 'distanta');
});

test('construiesteBiblioteca unește înregistrările care diferă doar prin litere mari/mici', () => {
  const b = c.construiesteBiblioteca(BIBLIOTECA, [
    { nume: 'Flotări', favorit: true, nota: 'Coate aproape' },
    { nume: 'flotări', grupa: null },
  ]);
  assert.equal(b.get('flotări').favorit, true);
  assert.equal(b.get('flotări').nota, 'Coate aproape');
  assert.equal(b.get('flotări').grupa, 'Piept');
});

test('alternativePentru: aceeași grupă, cele mai asemănătoare întâi, fără exercițiul însuși', () => {
  const b = c.construiesteBiblioteca(BIBLIOTECA, []);
  const toate = [...b.values()];
  const alt = c.alternativePentru(b.get('împins cu bara pe bancă'), toate, 4);
  assert.equal(alt.length, 4);
  assert.ok(alt.every(e => e.grupa === 'Piept' && e.nume !== 'Împins cu bara pe bancă'));
  assert.ok(alt.every(e => e.categorie === 'Compus'), 'presele compuse înaintea fluturărilor');
  assert.deepEqual(c.alternativePentru({ nume: 'X', grupa: null }, toate), []);
});

test('valideazaExercitiuPropriu: nume obligatoriu și unic, grupă validă, valori implicite', () => {
  const existente = new Set(['flotări', 'exercițiul meu']);
  assert.equal(c.valideazaExercitiuPropriu({ nume: ' ', grupa: 'Piept' }, existente).ok, false);
  assert.equal(c.valideazaExercitiuPropriu({ nume: 'Flotări', grupa: 'Piept' }, existente).ok, false);
  assert.equal(c.valideazaExercitiuPropriu({ nume: 'Nou', grupa: 'Picioare' }, existente).ok, false);
  const r = c.valideazaExercitiuPropriu({ nume: '  Ramat   cu  banda ', grupa: 'Spate', secundari: ['biceps', 'dorsali', 'xyz'] }, existente);
  assert.equal(r.ok, true);
  assert.equal(r.date.nume, 'Ramat cu banda');
  assert.deepEqual(r.date.secundari, ['biceps']); // „dorsali" e chiar grupa principală, „xyz" nu există
  assert.equal(r.date.categorie, 'Compus');
  assert.equal(r.date.tip, 'greutate');
  // la editare, păstrarea aceluiași nume (alte litere) e permisă
  assert.equal(c.valideazaExercitiuPropriu({ nume: 'EXERCIȚIUL MEU', grupa: 'Fese' }, existente, 'Exercițiul meu').ok, true);
});

test('fara: căutare fără diacritice', () => {
  assert.equal(c.fara('Împins Ț'), 'impins t');
});
