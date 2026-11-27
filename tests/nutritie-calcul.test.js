// Sortarea listelor după valori nutriționale.
const test = require('node:test');
const assert = require('node:assert/strict');

test('sortarea după macronutrienți (rețete pe porție, alimente la 100 g)', () => {
  const { valoareSortareNutritie, SORTARI_NUTRITIE } = require('../nutritie-calcul.js');
  const a = { kcal: 200, proteine: 30, carbohidrati: 5, grasimi: 8, fibre: 1 };
  const b = { kcal: 400, proteine: 20, carbohidrati: 60, grasimi: 10, fibre: 9 };
  const sorteaza = cheie => [a, b].sort((x, y) => valoareSortareNutritie(y, cheie) - valoareSortareNutritie(x, cheie));
  assert.equal(sorteaza('proteine-desc')[0], a);
  assert.equal(sorteaza('carbohidrati-asc')[0], a);
  assert.equal(sorteaza('carbohidrati-desc')[0], b);
  assert.equal(sorteaza('fibre-desc')[0], b);
  assert.equal(sorteaza('kcal-asc')[0], a);
  assert.equal(valoareSortareNutritie(a, 'proteine-kcal'), 15, '30 g proteine la 200 kcal = 15 g la 100 kcal');
  assert.equal(valoareSortareNutritie({ kcal: 0, proteine: 0 }, 'proteine-kcal'), 0);
  assert.equal(SORTARI_NUTRITIE[0].id, '');
});
