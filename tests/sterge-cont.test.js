// Funcția „sterge-cont”: confirmarea, căutarea tuturor fișierelor din dosarul contului, ordinea ștergerii.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const incarca = () => import(pathToFileURL(path.join(__dirname, '../supabase/functions/sterge-cont/logica.js')).href);
const ID = '1b2c3d4e-0000-4000-8000-00000000abcd';

function stocareFalsa(fisiere) {
  // fisiere: listă de căi complete; listeaza imită API-ul (dosarele au id null)
  return async (prefix, offset, limita) => {
    const sub = new Map();
    for (const c of fisiere) {
      if (!c.startsWith(prefix + '/')) continue;
      const rest = c.slice(prefix.length + 1); const [cap, ...coada] = rest.split('/');
      sub.set(cap, coada.length ? { name: cap, id: null } : { name: cap, id: 'f-' + c });
    }
    return [...sub.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limita);
  };
}

test('confirmarea: trebuie scrisă adresa contului (fără diferențe de litere mari / spații)', async () => {
  const L = await incarca();
  assert.doesNotThrow(() => L.valideazaConfirmare({ confirmare: '  Ana@Exemplu.ro ' }, 'ana@exemplu.ro'));
  assert.throws(() => L.valideazaConfirmare({ confirmare: 'alta@exemplu.ro' }, 'ana@exemplu.ro'), e => e.cod === 'confirmare_gresita' && e.status === 400);
  assert.throws(() => L.valideazaConfirmare({}, 'ana@exemplu.ro'), e => e.cod === 'confirmare_gresita');
  assert.throws(() => L.valideazaConfirmare(null, 'ana@exemplu.ro'), e => e.cod === 'cerere_invalida');
});

test('se găsesc toate fișierele din dosarul contului, pe toate nivelurile și pe mai multe pagini', async () => {
  const L = await incarca();
  const multe = Array.from({ length: 7 }, (_, i) => `${ID}/poze/p${i}.jpg`);
  const fis = [...multe, `${ID}/pozeRetete/r1.webp`, `${ID}/copii/2026-11-01.json`, `${ID}/copii/vechi/a.json`, `alt-cont/poze/x.jpg`];
  const toate = await L.toateFisierele(stocareFalsa(fis), ID, { pagina: 3 });
  assert.deepEqual(toate.sort(), fis.filter(c => c.startsWith(ID)).sort());
});

test('ordinea: întâi fișierele (în loturi), apoi contul; o adresă greșită nu șterge nimic', async () => {
  const L = await incarca();
  const fis = Array.from({ length: 230 }, (_, i) => `${ID}/poze/p${String(i).padStart(3, '0')}.jpg`);
  const jurnal = [];
  const io = {
    listeaza: stocareFalsa(fis),
    stergeFisiere: async c => jurnal.push(['fisiere', c.length]),
    stergeUtilizator: async id => jurnal.push(['cont', id]),
  };
  await assert.rejects(L.stergeContul({ utilizator: { id: ID, email: 'ana@exemplu.ro' }, corp: { confirmare: 'x' }, ...io }), e => e.cod === 'confirmare_gresita');
  assert.deepEqual(jurnal, []);
  const r = await L.stergeContul({ utilizator: { id: ID, email: 'ana@exemplu.ro' }, corp: { confirmare: 'ana@exemplu.ro' }, ...io });
  assert.deepEqual(jurnal, [['fisiere', 100], ['fisiere', 100], ['fisiere', 30], ['cont', ID]]);
  assert.deepEqual(r, { sters: true, fisiere: 230 });
});

test('dacă ștergerea fișierelor eșuează, contul NU se șterge (se poate încerca din nou)', async () => {
  const L = await incarca();
  let contSters = false;
  await assert.rejects(L.stergeContul({
    utilizator: { id: ID, email: 'a@b.ro' }, corp: { confirmare: 'a@b.ro' },
    listeaza: stocareFalsa([`${ID}/poze/a.jpg`]), stergeFisiere: async () => { throw new Error('rețea'); }, stergeUtilizator: async () => { contSters = true; },
  }));
  assert.equal(contSters, false);
});

test('cheia de serviciu: cea veche sau cea nouă; anteturi potrivite', async () => {
  const L = await incarca();
  assert.equal(L.cheieServiciu(k => ({ SUPABASE_SERVICE_ROLE_KEY: 'eyJabc' })[k]), 'eyJabc');
  assert.equal(L.cheieServiciu(k => ({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_x"}' })[k]), 'sb_secret_x');
  assert.throws(() => L.cheieServiciu(() => undefined), e => e.cod === 'configurare');
  assert.deepEqual(L.antetServiciu('eyJabc'), { apikey: 'eyJabc', Authorization: 'Bearer eyJabc' });
  assert.deepEqual(L.antetServiciu('sb_secret_x'), { apikey: 'sb_secret_x' });
  assert.throws(() => L.dosarCont('../altcineva'), e => e.cod === 'neautentificat');
});
