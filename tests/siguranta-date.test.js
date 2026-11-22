// Etapa 11: restaurarea înlocuiește doar ce există în backup; restul rămâne și e numit în dialog.
const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../validare.js');

test('backup vechi (fără nutriție): nutriția și pozele rămân, iar dialogul le numește', () => {
  const brut = { versiune: 2, sesiuni: [], exercitii: [], masuratori: [], rutine: [], setari: { minRep: 8 } };
  const r = v.valideazaBackup(brut);
  assert.ok(r.ok);
  for (const k of ['alimente', 'retete', 'zileNutritie', 'planuriNutritie', 'listeCumparaturi']) assert.equal(r.date[k], undefined);
  const p = v.partiPastrate(r.date, brut);
  assert.deepEqual(p, ['alimentele tale', 'rețetele tale', 'mesele notate', 'planurile de mese', 'listele de cumpărături', 'pozele de progres', 'pozele rețetelor']);
});

test('backup complet: nimic nu rămâne neatins', () => {
  const brut = { versiune: 3, sesiuni: [], exercitii: [], masuratori: [], rutine: [], alimente: [], retete: [], zileNutritie: [], planuriNutritie: [],
    listeCumparaturi: [], poze: [], pozeRetete: [], setari: {} };
  assert.deepEqual(v.partiPastrate(v.valideazaBackup(brut).date, brut), []);
});

test('backup fără setări: setările rămân', () => {
  const brut = { versiune: 3, sesiuni: [], exercitii: [], masuratori: [], rutine: [], alimente: [], retete: [], zileNutritie: [], planuriNutritie: [], listeCumparaturi: [], poze: [], pozeRetete: [] };
  assert.deepEqual(v.partiPastrate(v.valideazaBackup(brut).date, brut), ['setările (inclusiv țintele și preferințele de nutriție)']);
});
