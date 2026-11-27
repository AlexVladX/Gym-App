// Butonul „Înapoi”: deciziile din navigare.js (fără browser).
const test = require('node:test');
const assert = require('node:assert/strict');
const { cheieNavigare, decizieSchimbareEcran, decizieInapoi } = require('../navigare.js');

test('cheia include fila din Nutriție (Rețete și Ziua mea sunt intrări diferite)', () => {
  assert.equal(cheieNavigare({ tip: 'ecran', ecran: 'ecran-nutritie', fila: 'retete' }), 'ecran-nutritie|retete');
  assert.equal(cheieNavigare({ tip: 'ecran', ecran: 'ecran-acasa', fila: null }), 'ecran-acasa|');
  assert.equal(cheieNavigare({ tip: 'dialog', id: 3 }), '');
});

test('schimbarea de ecran: același ecran → nimic; alt ecran → intrare nouă; Acasă (rădăcina) → întoarcere', () => {
  const baza = { radacina: 'ecran-acasa', ultimaCheie: 'ecran-progres|' };
  assert.equal(decizieSchimbareEcran({ ...baza, cheieNoua: 'ecran-progres|', ecran: 'ecran-progres', adancime: 1 }), 'nimic');
  assert.equal(decizieSchimbareEcran({ ...baza, cheieNoua: 'ecran-masuratori|', ecran: 'ecran-masuratori', adancime: 1 }), 'adauga');
  assert.equal(decizieSchimbareEcran({ ...baza, cheieNoua: 'ecran-acasa|', ecran: 'ecran-acasa', adancime: 2 }), 'radacina');
  assert.equal(decizieSchimbareEcran({ ...baza, cheieNoua: 'ecran-acasa|', ecran: 'ecran-acasa', adancime: 0 }), 'adauga');
  // Schimbarea de mod (Sală → Nutriție) adaugă o intrare: Acasă din Nutriție nu e rădăcina.
  assert.equal(decizieSchimbareEcran({ radacina: 'ecran-acasa', ultimaCheie: 'ecran-acasa|', cheieNoua: 'ecran-masa|', ecran: 'ecran-masa', adancime: 0 }), 'adauga');
  // Rețete → Ziua mea (același ecran, alt grup de file) e o intrare nouă.
  assert.equal(decizieSchimbareEcran({ radacina: 'ecran-masa', ultimaCheie: 'ecran-nutritie|retete', cheieNoua: 'ecran-nutritie|zi', ecran: 'ecran-nutritie', adancime: 1 }), 'adauga');
});

test('„Înapoi” cu un dialog deschis îl închide (ca „Renunță”) și nu schimbă ecranul', () => {
  const d = decizieInapoi({ stare: { tip: 'ecran', ecran: 'ecran-nutritie', fila: 'retete' }, idDialogDeschis: 7, ultimaCheie: 'ecran-nutritie|retete' });
  assert.deepEqual(d, { inchideDialog: true, sari: false, ecran: null });
});

test('„Înapoi” fără dialog revine la ecranul anterior (Nutriție → Rețete)', () => {
  const s = { tip: 'ecran', ecran: 'ecran-nutritie', fila: 'retete' };
  assert.deepEqual(decizieInapoi({ stare: s, idDialogDeschis: null, ultimaCheie: 'ecran-nutritie|zi' }), { inchideDialog: false, sari: false, ecran: s });
});

test('intrare de dialog orfană (dialogul nu mai e deschis) → se sare peste ea', () => {
  assert.deepEqual(decizieInapoi({ stare: { tip: 'dialog', id: 2 }, idDialogDeschis: null, ultimaCheie: 'ecran-acasa|' }), { inchideDialog: false, sari: true, ecran: null });
  // Dialogul de dedesubt e chiar cel deschis (s-a închis unul pus peste el): rămâne deschis.
  assert.deepEqual(decizieInapoi({ stare: { tip: 'dialog', id: 5 }, idDialogDeschis: 5, ultimaCheie: 'ecran-acasa|' }), { inchideDialog: false, sari: false, ecran: null });
});

test('ieșirea din aplicație: o stare care nu e a noastră nu schimbă nimic', () => {
  assert.deepEqual(decizieInapoi({ stare: null, idDialogDeschis: null, ultimaCheie: 'ecran-acasa|' }), { inchideDialog: false, sari: false, ecran: null });
});
