// Teste pentru ilustrațiile exercițiilor (figuri.js + ilustratii/). Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RADACINA = path.join(__dirname, '..');
const sursa = fs.readFileSync(path.join(RADACINA, 'exercitii.js'), 'utf8');
const { BIBLIOTECA } = new Function('document', `${sursa}; return { BIBLIOTECA };`)({});
const cat = require('../catalog.js');
const fig = require('../figuri.js');
const gen = require('../tools/ilustratii/genereaza.js');
const DOSAR = path.join(RADACINA, 'ilustratii');
const citeste = cale => fs.readFileSync(path.join(RADACINA, cale), 'utf8');

test('fiecare exercițiu din catalog are ilustrația mare și miniatura, valide', () => {
  for (const e of BIBLIOTECA) {
    for (const tip of ['mare', 'mini']) {
      const cale = fig.caleIlustratie(e.nume, e.grupa, BIBLIOTECA, tip);
      assert.ok(cale, `${e.nume}: fără cale`);
      assert.ok(fs.existsSync(path.join(RADACINA, cale)), `${e.nume}: lipsește ${cale}`);
      const svg = citeste(cale);
      assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="'), `${cale}: nu e SVG`);
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${cale}: coordonate invalide`);
      assert.ok(svg.includes('#CDF760'), `${cale}: mușchiul principal nu e evidențiat`);
      assert.ok(svg.length < (tip === 'mare' ? 130 : 32) * 1024, `${cale}: prea mare (${svg.length} octeți)`);
    }
  }
});

test('ilustrații diferite pentru exerciții diferite (mari și miniaturi)', () => {
  for (const tip of ['mare', 'mini']) {
    const vazute = new Map();
    for (const e of BIBLIOTECA) {
      const svg = citeste(fig.caleIlustratie(e.nume, e.grupa, BIBLIOTECA, tip)).replace(/<title>.*?<\/title>/, '');
      const h = crypto.createHash('sha1').update(svg).digest('hex');
      assert.ok(!vazute.has(h), `${e.nume} are același desen (${tip}) ca ${vazute.get(h)}`);
      vazute.set(h, e.nume);
    }
  }
});

test('fișierele din dosar sunt cele produse acum de generator (nimic învechit)', () => {
  const exemple = ['Împins cu bara pe bancă', 'Tracțiuni', 'Flexii ciocan', 'Plank', "Mers cu greutăți (farmer's walk)"];
  for (const nume of exemple) {
    const e = BIBLIOTECA.find(x => x.nume === nume);
    const u = cat.unificaExercitiu(e, null);
    const { mare, mini } = gen.construieste(gen.SPECIFICATII[nume], gen.nivel(u), nume);
    const s = fig.numeFisierIlustratie(nume);
    assert.equal(mare, fs.readFileSync(path.join(DOSAR, `${s}.svg`), 'utf8'), `${nume}: rulează node tools/ilustratii/genereaza.js`);
    assert.equal(mini, fs.readFileSync(path.join(DOSAR, `${s}-mini.svg`), 'utf8'));
  }
  const lista = JSON.parse(fs.readFileSync(path.join(DOSAR, 'lista.json'), 'utf8')).miniaturi;
  const reale = fs.readdirSync(DOSAR).filter(f => f.endsWith('-mini.svg')).sort();
  assert.deepEqual(lista, reale);
});

test('numele fișierelor: același în aplicație și în generator, unic pentru fiecare exercițiu', () => {
  const nume = BIBLIOTECA.map(e => fig.numeFisierIlustratie(e.nume));
  assert.equal(new Set(nume).size, BIBLIOTECA.length);
  for (const e of BIBLIOTECA) assert.equal(fig.numeFisierIlustratie(e.nume), gen.slug(e.nume));
  assert.equal(fig.numeFisierIlustratie('Împins cu bara pe bancă înclinată'), 'impins-cu-bara-pe-banca-inclinata');
});

test('exercițiile proprii primesc desenul grupei; numele din catalog contează fără majuscule', () => {
  for (const g of [...cat.GRUPE, cat.GRUPA_VECHE]) {
    for (const tip of ['mare', 'mini']) {
      const cale = fig.caleIlustratie('Exercițiul meu', g, BIBLIOTECA, tip);
      assert.ok(cale && fs.existsSync(path.join(RADACINA, cale)), `grupa ${g}: lipsește ${cale}`);
    }
  }
  assert.equal(fig.caleIlustratie('Exercițiul meu', null, BIBLIOTECA), null);
  assert.equal(fig.caleIlustratie('Exercițiul meu', 'Altceva', BIBLIOTECA), null);
  assert.equal(fig.caleIlustratie('FLOTĂRI', null, BIBLIOTECA), 'ilustratii/flotari-mini.svg');
});

test('mușchii evidențiați urmează datele exercițiului', () => {
  // ridicările din umeri: grupa Spate, dar mușchiul lucrat e trapezul
  assert.deepEqual(gen.nivel({ grupa: 'Spate', principali: ['trapez'], secundari: [] }), { trapez: 2 });
  // fără mușchi principali (exercițiu propriu): zonele obișnuite ale grupei
  assert.deepEqual(gen.nivel({ grupa: 'Spate', principali: [], secundari: ['biceps'] }), { biceps: 1, dorsali: 2, spateMijloc: 2 });
});
