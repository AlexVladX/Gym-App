// Timerul de odihnă după o reîncărcare: timpul rămas se calculează din ora de final salvată.
const test = require('node:test');
const assert = require('node:assert/strict');
const { decizieTimerLaPornire, PRAG_ODIHNA_TERMINATA_MS } = require('../timer.js');

const ACUM = 1_800_000_000_000;

test('timer încă activ: continuă cu timpul rămas din ora de final (1:30 pornit, reîncărcat la 0:40)', () => {
  const d = decizieTimerLaPornire({ sfarsit: ACUM + 40_000, durata: 90 }, ACUM);
  assert.equal(d.tip, 'activ');
  assert.equal(d.ramasMs, 40_000);
  assert.equal(d.durata, 90, 'bara de progres păstrează durata totală');
});

test('timer pe pauză: rămâne pe pauză cu același timp rămas, oricât a trecut', () => {
  const d = decizieTimerLaPornire({ ramasMs: 25_000, durata: 60 }, ACUM + 3_600_000);
  assert.deepEqual(d, { tip: 'pauza', ramasMs: 25_000, durata: 60 });
});

test('expirat de curând (sub 2 minute) → „Odihna s-a terminat”; mai demult → șters în liniște', () => {
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM - 30_000, durata: 90 }, ACUM).tip, 'terminat');
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM - PRAG_ODIHNA_TERMINATA_MS + 1, durata: 90 }, ACUM).tip, 'terminat');
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM - PRAG_ODIHNA_TERMINATA_MS, durata: 90 }, ACUM).tip, 'expirat');
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM - 10 * 60_000, durata: 90 }, ACUM).tip, 'expirat');
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM, durata: 90 }, ACUM).tip, 'terminat', 'exact la final: tocmai s-a terminat');
});

test('fără stare sau stare deteriorată: nimic de repornit', () => {
  assert.equal(decizieTimerLaPornire(null, ACUM).tip, 'nimic');
  assert.equal(decizieTimerLaPornire(undefined, ACUM).tip, 'nimic');
  assert.equal(decizieTimerLaPornire({}, ACUM).tip, 'expirat');
  assert.equal(decizieTimerLaPornire({ sfarsit: 'x' }, ACUM).tip, 'expirat');
  assert.equal(decizieTimerLaPornire({ ramasMs: 0, sfarsit: ACUM - 1e6 }, ACUM).tip, 'expirat');
});

test('durata lipsă sau mai mică decât restul (după +15 s): bara nu trece de 100%', () => {
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM + 50_000 }, ACUM).durata, 50);
  assert.equal(decizieTimerLaPornire({ sfarsit: ACUM + 50_000, durata: 30 }, ACUM).durata, 50);
  assert.equal(decizieTimerLaPornire({ ramasMs: 70_500, durata: 60 }, ACUM).durata, 71);
});
