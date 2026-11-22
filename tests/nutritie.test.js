// Teste pentru biblioteca de nutriție: date, calcule, etichete, validare, backup, ilustrații.
// Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { ALIMENTE_BAZA, SURSA_NUTRITIE } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');
const c = require('../nutritie-calcul.js');
const v = require('../validare.js');
const im = require('../nutritie-imagini.js');
const fs = require('node:fs');
const path = require('node:path');

const idx = c.indexAlimente(ALIMENTE_BAZA);
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

test('biblioteca: cele 150 de rețete inițiale (30 pe masă) plus cele românești, cu toate câmpurile', () => {
  const ro = RETETE_BAZA.filter(r => r.id.startsWith('ro-'));
  assert.equal(RETETE_BAZA.length, 150 + ro.length);
  for (const m of c.MESE) assert.equal(RETETE_BAZA.filter(r => r.masa === m.id && !r.id.startsWith('ro-')).length, 30, m.id);
  assert.equal(new Set(RETETE_BAZA.map(r => r.id)).size, RETETE_BAZA.length);
  assert.equal(new Set(RETETE_BAZA.map(r => r.nume.toLowerCase())).size, RETETE_BAZA.length);
  for (const r of RETETE_BAZA) {
    assert.ok(r.nume && r.descriere, r.id);
    assert.ok(r.timp > 0 && Number.isInteger(r.portii) && r.portii >= 1, r.id);
    assert.ok(c.DIFICULTATI[r.dificultate], r.id);
    assert.ok(v.VASE_VALIDE.includes(r.vas), r.id);
    assert.ok(r.pasi.length >= 2, r.id);
    assert.ok(r.ingrediente.length >= 1, r.id);
    for (const [id, g] of r.ingrediente) {
      assert.ok(idx.has(id), `${r.id}: ${id}`);
      assert.ok(g > 0, `${r.id}: ${id}`);
    }
    // Rețetele din bibliotecă trec și validarea rețetelor proprii (aceleași reguli).
    assert.ok(v.curataReteta({ ...r, id: 'u-' + r.id }), r.id);
    assert.ok(c.eticheteReteta(r, idx).length > 0, `${r.id} fără etichete`);
  }
});

test('alimentele din bibliotecă: id-uri unice, sursă USDA, valori plauzibile', () => {
  assert.equal(SURSA_NUTRITIE.scurt, 'USDA SR28');
  assert.equal(new Set(ALIMENTE_BAZA.map(a => a.id)).size, ALIMENTE_BAZA.length);
  for (const a of ALIMENTE_BAZA) {
    assert.match(a.ndb, /^\d{5}$/, a.id);
    assert.ok(a.sursa && a.sursa.length > 3, a.id);
    assert.ok(a.kcal >= 0 && a.kcal <= 900, a.id);
    assert.ok(a.proteine + a.carbohidrati + a.grasimi <= 100.5, a.id);
    assert.ok(a.fibre <= a.carbohidrati + 0.5, a.id);
    assert.ok(v.CATEGORII_ALIMENT_VALIDE.includes(a.cat), a.id);
    for (const x of a.alergeni) assert.ok(v.ALERGENI_VALIZI.includes(x), `${a.id}: ${x}`);
    assert.ok(a.animal === null || v.ORIGINI_VALIDE.includes(a.animal), a.id);
  }
  // Câteva valori verificate manual în SR28 (la 100 g).
  const pui = idx.get('pui-piept');
  assert.deepEqual([pui.ndb, pui.kcal, pui.proteine, pui.carbohidrati, pui.grasimi, pui.fibre], ['05062', 120, 22.5, 0, 2.62, 0]);
  const ovaz = idx.get('ovaz');
  assert.deepEqual([ovaz.ndb, ovaz.kcal, ovaz.proteine, ovaz.carbohidrati, ovaz.grasimi, ovaz.fibre], ['08120', 379, 13.15, 67.7, 6.52, 10.1]);
  const ou = idx.get('ou');
  assert.deepEqual([ou.kcal, ou.proteine, ou.grasimi], [143, 12.56, 9.51]);
});

test('listele din validare coincid cu cele din calcule', () => {
  assert.deepEqual(v.ALERGENI_VALIZI, c.ALERGENI.map(a => a.id));
  assert.deepEqual(v.CATEGORII_ALIMENT_VALIDE, c.CATEGORII_ALIMENTE.map(a => a.id));
  assert.deepEqual(v.ORIGINI_VALIDE, c.ORIGINI_ANIMALE);
  assert.deepEqual(v.MESE_VALIDE, c.MESE.map(m => m.id));
  assert.deepEqual(v.DIFICULTATI_VALIDE, Object.keys(c.DIFICULTATI));
  assert.deepEqual(v.ETICHETE_DECLARABILE, c.ETICHETE_DECLARATE);
});

test('valorile se calculează din grame: total, porție, ingrediente lipsă', () => {
  const a = c.valoriAliment(idx.get('pui-piept'), 150);
  aproape(a.kcal, 180); aproape(a.proteine, 33.75); aproape(a.grasimi, 3.93);
  const r = { masa: 'pranz', portii: 2, ingrediente: [['pui-piept', 200], ['orez', 100], ['nu-exista', 50]] };
  const { total, lipsa, grame } = c.valoriIngrediente(r.ingrediente, idx);
  aproape(total.kcal, 240 + 365);
  aproape(total.carbohidrati, 79.95);
  assert.deepEqual(lipsa, ['nu-exista']);
  assert.equal(grame, 300);
  const p = c.valoriPortie(r, idx);
  aproape(p.kcal, (240 + 365) / 2);
  aproape(p.grame, 150);
  // Dublarea unei cantități dublează contribuția ei.
  const r2 = { ...r, ingrediente: [['pui-piept', 400], ['orez', 100]] };
  aproape(c.valoriPortie(r2, idx).kcal - c.valoriPortie({ ...r, ingrediente: [['pui-piept', 200], ['orez', 100]] }, idx).kcal, 120);
});

test('distribuția energiei dă 100% și etichetele urmează regulile', () => {
  const d = c.distributieEnergie({ proteine: 30, carbohidrati: 50, grasimi: 10 });
  aproape(d.proteine + d.carbohidrati + d.grasimi, 1);
  aproape(d.grasimi, 90 / 410);
  assert.deepEqual(c.distributieEnergie({ proteine: 0, carbohidrati: 0, grasimi: 0 }), { proteine: 0, carbohidrati: 0, grasimi: 0 });

  const et = r => c.eticheteReteta(r, idx);
  const tofu = et({ masa: 'cina', timp: 10, portii: 1, ingrediente: [['tofu', 200], ['broccoli', 150], ['ulei', 5]], etichete: ['buget'] });
  for (const x of ['vegan', 'vegetarian', 'fara-gluten', 'fara-lactate', 'buget', 'rapid']) assert.ok(tofu.includes(x), x);
  const cuMiere = et({ masa: 'gustare-1', timp: 2, portii: 1, ingrediente: [['iaurt', 150], ['miere', 10]] });
  assert.ok(cuMiere.includes('vegetarian') && !cuMiere.includes('vegan') && !cuMiere.includes('fara-lactate'));
  const ovaz = et({ masa: 'mic-dejun', timp: 20, portii: 1, ingrediente: [['ovaz', 60], ['lapte-soia', 200]] });
  assert.ok(!ovaz.includes('fara-gluten') && !ovaz.includes('rapid') && ovaz.includes('vegan'));
  // Ciocolata „poate conține lapte”: nu primește „fără lactate”, dar rămâne vegană (nu are ingrediente animale).
  const cioco = et({ masa: 'gustare-2', timp: 1, portii: 1, ingrediente: [['ciocolata', 20], ['migdale', 10]] });
  assert.ok(!cioco.includes('fara-lactate') && cioco.includes('vegan'));
  // Un ingredient necunoscut: nu promitem nicio etichetă de dietă.
  const lipsa = et({ masa: 'cina', timp: 30, portii: 1, ingrediente: [['tofu', 200], ['nu-exista', 50]] });
  assert.ok(!lipsa.includes('vegan') && !lipsa.includes('fara-gluten'));
  // Etichetele declarate necunoscute se ignoră.
  assert.ok(!et({ masa: 'cina', timp: 30, portii: 1, ingrediente: [['tofu', 100]], etichete: ['vegan', 'inventata'] }).includes('inventata'));
  // Pragul proteic diferă la gustări (12 g) față de mese (20 g).
  const shake = { timp: 2, portii: 1, ingrediente: [['iaurt-grecesc-0', 150]] }; // ~15 g proteine
  assert.ok(c.eticheteReteta({ ...shake, masa: 'gustare-1' }, idx).includes('proteic'));
  assert.ok(!c.eticheteReteta({ ...shake, masa: 'pranz' }, idx).includes('proteic'));
});

test('alergenii unei rețete: conține și poate conține, fără dubluri', () => {
  const al = c.alergeniReteta({ ingrediente: [['paine-integrala', 64], ['ou', 50], ['ciocolata', 10], ['lapte', 100]] }, idx);
  assert.deepEqual(al.contine, ['gluten', 'oua', 'lapte']);
  assert.deepEqual(al.urme, ['soia', 'nuci']);
  const sos = c.alergeniReteta({ ingrediente: [['sos-soia', 15]] }, idx);
  assert.deepEqual(sos.contine, ['gluten', 'soia']);
});

test('cantități afișate în unități când se potrivesc', () => {
  assert.equal(c.textCantitate(idx.get('ou'), 100), '2 ouă (100 g)');
  assert.equal(c.textCantitate(idx.get('ou'), 50), '1 ou (50 g)');
  assert.equal(c.textCantitate(idx.get('ou'), 75), '1,5 ouă (75 g)');
  assert.equal(c.textCantitate(idx.get('ou'), 60), '60 g');
  assert.equal(c.textCantitate(idx.get('orez'), 70), '70 g');
  assert.equal(c.textCantitate(idx.get('banana'), 118), '1 banană (118 g)');
  assert.equal(c.normalizeazaText('  Brânză ȘI Țelină '), 'branza si telina');
});

test('alimentele proprii se validează strict', () => {
  const bun = { id: 'u-abc123', nume: ' Iaurt proteic ', kcal: 70, proteine: 10, carbohidrati: 4, grasimi: 1.5, fibre: 0,
    alergeni: ['lapte', 'inventat', 'lapte'], cat: 'lactate', animal: 'lactate', campViitor: 42 };
  const a = v.curataAliment(bun);
  assert.equal(a.nume, 'Iaurt proteic');
  assert.deepEqual(a.alergeni, ['lapte']);
  assert.equal(a.campViitor, 42); // câmpurile necunoscute se păstrează
  assert.equal(v.curataAliment({ ...bun, id: 'pui-piept' }), null); // id-urile bibliotecii nu se pot suprascrie
  assert.equal(v.curataAliment({ ...bun, proteine: 60, carbohidrati: 30, grasimi: 20 }), null); // peste 100 g
  assert.equal(v.curataAliment({ ...bun, fibre: 6 }), null); // fibre mai multe decât carbohidrații
  assert.equal(v.curataAliment({ ...bun, kcal: -1 }), null);
  assert.equal(v.curataAliment({ ...bun, kcal: '70' }).kcal, 70);
  assert.equal(v.curataAliment({ ...bun, cat: 'x', animal: 'x' }).cat, 'altele');
  assert.equal(v.curataAliment({ ...bun, buc: [0, 'a', 'b'] }).buc, undefined);
});

test('rețetele proprii se validează și se curăță', () => {
  const r = { id: 'u-r1', nume: 'Bol', masa: 'pranz', portii: '2', timp: 20, dificultate: 'greu', vas: 'x',
    etichete: ['buget', 'vegan'], ingrediente: [['orez', 80], ['pui-piept', '150'], ['ou', -5], ['x'], 'rau'], pasi: ['Fierbe', '', 3] };
  const c1 = v.curataReteta(r);
  assert.deepEqual(c1.ingrediente, [['orez', 80], ['pui-piept', 150]]);
  assert.equal(c1.portii, 2);
  assert.equal(c1.dificultate, 'usor');
  assert.equal(c1.vas, 'farfurie');
  assert.deepEqual(c1.etichete, ['buget']);
  assert.deepEqual(c1.pasi, ['Fierbe']);
  assert.equal(v.curataReteta({ ...r, masa: 'brunch' }), null);
  assert.equal(v.curataReteta({ ...r, ingrediente: [] }), null);
  assert.equal(v.curataReteta({ ...r, id: 'md-shakshuka' }), null);
  // Ingredientul unui aliment propriu șters rămâne în rețetă (calculul îl arată ca lipsă).
  assert.deepEqual(v.curataReteta({ ...r, ingrediente: [['u-sters', 100]] }).ingrediente, [['u-sters', 100]]);
});

test('backupul: nutriția se restaurează doar dacă e în fișier', () => {
  const baza = { versiune: 3, sesiuni: [], exercitii: [], masuratori: [] };
  const vechi = v.valideazaBackup(baza);
  assert.ok(vechi.ok);
  assert.ok(!('alimente' in vechi.date) && !('retete' in vechi.date) && !('pozeRetete' in vechi.date));
  const poza = 'data:image/jpeg;base64,/9j/AAAA';
  const nou = v.valideazaBackup({ ...baza,
    alimente: [{ id: 'u-a', nume: 'A', kcal: 100, proteine: 5, carbohidrati: 10, grasimi: 2, fibre: 1 }, { id: 'u-a', nume: 'A2', kcal: 90, proteine: 5, carbohidrati: 10, grasimi: 2, fibre: 1 }, { nume: 'fără id' }],
    retete: [{ id: 'u-r', nume: 'R', masa: 'cina', ingrediente: [['u-a', 100]] }],
    pozeRetete: [{ id: 'md-shakshuka', imagine: poza }, { id: 'u-r', imagine: 'nu e imagine' }] });
  assert.ok(nou.ok);
  assert.equal(nou.date.alimente.length, 1);
  assert.equal(nou.date.alimente[0].nume, 'A2'); // la id dublu rămâne ultimul
  assert.equal(nou.date.retete.length, 1);
  assert.equal(nou.date.pozeRetete.length, 1);
  assert.equal(nou.ignorate, 2);
  assert.deepEqual([nou.rezumat.alimente, nou.rezumat.retete, nou.rezumat.pozeRetete], [1, 1, 1]);
});

test('fotografiile rețetelor: fișiere WebP 800×600 existente, unice, cu sursă (autor când e cunoscut)', () => {
  const cuFoto = RETETE_BAZA.filter(r => r.foto);
  assert.ok(cuFoto.length >= 6);
  const fisiere = new Set(), surse = new Map();
  for (const r of cuFoto) {
    const f = im.fotoReteta(r);
    assert.ok(f, r.id);
    assert.equal(f.fisier, `foto-retete/${r.id}.webp`);
    assert.ok(['Pexels', 'Wikimedia Commons', 'Unsplash'].includes(f.furnizor), r.id);
    if (f.furnizor === 'Pexels') {
      assert.match(f.idSursa, /^\d+$/);
      assert.ok(f.pagina.startsWith('https://www.pexels.com/photo/') && f.pagina.endsWith(`${f.idSursa}/`), r.id);
      if (f.profil) assert.ok(f.autor && f.profil.startsWith('https://www.pexels.com/@'), r.id);
    } else if (f.furnizor === 'Unsplash') {
      // doar fotografii gratuite (licența Unsplash), cu autor, profil și pagina originală
      assert.ok(f.autor && f.profil.startsWith('https://unsplash.com/@'), r.id);
      assert.ok(f.pagina.startsWith('https://unsplash.com/photos/') && f.pagina.endsWith(f.idSursa), r.id);
      assert.equal(f.linkLicenta, 'https://unsplash.com/license');
      assert.equal(im.textAtribuire(f), `Foto: ${f.autor} / Unsplash · Licența Unsplash`);
    } else {
      // licențele CC cer autorul, licența cu link și linkul la original
      assert.ok(f.autor && f.licenta && f.linkLicenta.startsWith('https://creativecommons.org/'), r.id);
      assert.ok(f.pagina.startsWith('https://commons.wikimedia.org/wiki/File:'), r.id);
      assert.match(im.textAtribuire(f), new RegExp(`${f.autor} / Wikimedia Commons · ${f.licenta.replace(/\./g, '\\.')}$`));
    }
    // aceeași fotografie nu se folosește pentru două rețete diferite
    // (excepție: variantele aceluiași fel, ex. rădăuțeană clasică/light)
    const grup = r.varianta ? r.varianta.grup : r.id;
    assert.ok(!fisiere.has(f.fisier), r.id);
    assert.ok(!surse.has(f.idSursa) || surse.get(f.idSursa) === grup, r.id);
    fisiere.add(f.fisier); surse.set(f.idSursa, grup);
    // fișierul: WebP (RIFF....WEBP), dimensiuni 800×600 din antetul VP8/VP8L/VP8X
    const b = fs.readFileSync(path.join(__dirname, '..', f.fisier));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.toString('ascii', 8, 12), 'WEBP');
    const tip = b.toString('ascii', 12, 16);
    let w, h;
    if (tip === 'VP8X') { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); }
    else if (tip === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
    else { const v = b.readUInt32LE(21); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; }
    assert.deepEqual([w, h], [im.FOTO_LATIME, im.FOTO_INALTIME], r.id);
    assert.ok(b.length < 150 * 1024, `${r.id}: ${b.length} B`);
  }
  // fiecare fișier din foto-retete/ aparține unei rețete
  for (const n of fs.readdirSync(path.join(__dirname, '..', 'foto-retete'))) assert.ok(fisiere.has(`foto-retete/${n}`), n);
});

test('imaginea de rezervă și validarea referinței foto', () => {
  assert.equal(im.fotoReteta({ id: 'x' }), null);
  assert.equal(im.fotoReteta({ foto: { fisier: 'https://altundeva.com/a.jpg' } }), null);
  assert.equal(im.fotoReteta({ foto: { fisier: '../secret.webp' } }), null);
  const u = im.urlImagineRezerva('Prânz');
  assert.match(u, /^data:image\/svg\+xml;charset=utf-8,/);
  assert.ok(decodeURIComponent(u).includes('PRÂNZ'));
  assert.ok(!decodeURIComponent(im.urlImagineRezerva('<script>')).includes('<script>'));
  assert.equal(im.textAtribuire({ autor: 'Ana', furnizor: 'Pexels' }), 'Foto: Ana / Pexels');
  assert.equal(im.textAtribuire(null), '');
});
