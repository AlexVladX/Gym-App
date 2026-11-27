// Optimizează ilustrațiile exercițiilor (svgo) și le dă o versiune proprie, separată de versiunea aplicației.
//
// Pregătire (o singură dată; svgo nu intră în aplicație, e doar unealtă de lucru):
//   npm install --prefix tools/ilustratii --no-save svgo@3
// Rulare (din rădăcina proiectului):
//   node tools/ilustratii/optimizeaza.mjs
//
// Ce face:
//   1. rulează generatorul (genereaza.js) într-un dosar temporar → desenele „brute”;
//   2. le optimizează și le scrie în ilustratii/ (fișierele vechi care nu mai există în generator se șterg);
//   3. scrie ilustratii/amprente.json: pentru fiecare fișier, amprenta desenului brut (testul verifică astfel că
//      dosarul corespunde generatorului de acum, fără să aibă nevoie de svgo) și a fișierului optimizat;
//   4. scrie ilustratii/lista.json cu miniaturile și VERSIUNEA ilustrațiilor (din conținut) și o copiază în figuri.js.
//      Service workerul păstrează ilustrațiile între versiunile aplicației; se descarcă din nou doar când se schimbă
//      această versiune, adică doar când se schimbă desenele.
//
// Setări (verificate vizual, fără diferențe vizibile; vezi ARHITECTURA.md):
//   - desenele mari: traseele cu 1 zecimală, restul valorilor (grosimea liniilor, opacitatea) cu 2 zecimale;
//   - miniaturile: traseele rotunjite la unități (desenul e afișat mic), restul cu 2 zecimale;
//   - traseele identice se refolosesc (<use>), capetele gradienților în coordonatele desenului se rotunjesc;
//   - titlul (<title>) și viewBox rămân; removeOffCanvasPaths NU se folosește (strica desenele culcate).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let optimize;
try {
  ({ optimize } = await import('svgo'));
} catch {
  console.error('Lipsește svgo. Rulează întâi: npm install --prefix tools/ilustratii --no-save svgo@3');
  process.exit(1);
}

const AICI = path.dirname(fileURLToPath(import.meta.url));
const RADACINA = path.join(AICI, '..', '..');
const DOSAR = path.join(RADACINA, 'ilustratii');
const amprenta = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

// Gradienții în coordonatele desenului (userSpaceOnUse): capetele rotunjite la unități întregi (≤ 0,5 unități).
// Gradienții relativi la formă (objectBoundingBox, valori 0–1) nu se ating.
const rotunjesteGradiente = {
  name: 'rotunjesteGradiente',
  fn: () => ({ element: { enter: node => {
    if (!/Gradient$/.test(node.name) || node.attributes.gradientUnits !== 'userSpaceOnUse') return;
    for (const a of ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'fx', 'fy', 'r']) {
      const v = node.attributes[a];
      if (v !== undefined && /^-?\d*\.?\d+$/.test(v)) node.attributes[a] = String(Math.round(Number(v)));
    }
  } } }),
};

const configuratie = zecimaleTraseu => ({
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { floatPrecision: 2, overrides: {
      removeTitle: false, removeViewBox: false,
      convertPathData: { floatPrecision: zecimaleTraseu },
      cleanupNumericValues: { floatPrecision: zecimaleTraseu === 0 ? 2 : 1 },
      convertTransform: { floatPrecision: 2 },
    } } },
    'reusePaths',
    rotunjesteGradiente,
  ],
});
const MARE = configuratie(1);
const MINI = configuratie(0);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ilustratii-'));
execFileSync(process.execPath, [path.join(AICI, 'genereaza.js'), '--iesire', temp], { stdio: 'inherit' });

const brute = fs.readdirSync(temp).filter(f => f.endsWith('.svg')).sort();
const fisiere = {};
let inainte = 0, dupa = 0;
for (const f of brute) {
  const brut = fs.readFileSync(path.join(temp, f), 'utf8');
  const optimizat = optimize(brut, { path: f, ...(f.endsWith('-mini.svg') ? MINI : MARE) }).data;
  fs.writeFileSync(path.join(DOSAR, f), optimizat);
  fisiere[f] = { brut: amprenta(brut), optimizat: amprenta(optimizat) };
  inainte += Buffer.byteLength(brut); dupa += Buffer.byteLength(optimizat);
}
for (const f of fs.readdirSync(DOSAR)) {
  if (f.endsWith('.svg') && !fisiere[f]) fs.unlinkSync(path.join(DOSAR, f));
}
const versiune = amprenta(brute.map(f => fisiere[f].optimizat).join(',')).slice(0, 10);
const miniaturi = brute.filter(f => f.endsWith('-mini.svg'));
fs.writeFileSync(path.join(DOSAR, 'lista.json'), JSON.stringify({ versiune, miniaturi }) + '\n');
fs.writeFileSync(path.join(DOSAR, 'amprente.json'), JSON.stringify({ versiune, fisiere }, null, 1) + '\n');
// figuri.js: aceeași versiune în adresele ilustrațiilor (aplicația o citește la pornire, fără cerere în plus).
const caleFiguri = path.join(RADACINA, 'figuri.js');
const figuri = fs.readFileSync(caleFiguri, 'utf8');
const nou = figuri.replace(/const VERSIUNE_ILUSTRATII = '[^']*';/, `const VERSIUNE_ILUSTRATII = '${versiune}';`);
if (nou === figuri && !figuri.includes(`'${versiune}'`)) throw new Error('figuri.js: nu găsesc VERSIUNE_ILUSTRATII');
fs.writeFileSync(caleFiguri, nou);
fs.rmSync(temp, { recursive: true, force: true });
console.log(`${brute.length} fișiere: ${(inainte / 1048576).toFixed(2)} MB → ${(dupa / 1048576).toFixed(2)} MB (−${Math.round((1 - dupa / inainte) * 100)}%), versiunea ilustrațiilor ${versiune}`);
