// Încărcarea la cerere a modulelor de nutriție și scanare (etapa 3).
//
// Pornirea în modul Sală nu mai descarcă și nu mai execută aceste fișiere (~450 KB, inclusiv rețetele și alimentele).
// Se încarcă la prima intrare în Nutriție (sau la pornire, dacă modul salvat e Nutriție), o singură dată.
// Toate sunt și în precache-ul service workerului, deci merg offline după prima vizită.
// Nucleul păstrează doar stratul de date al nutriției (validare, zile, ținte, cafea, liste), folosit de backup,
// sincronizare și setări.
const SCRIPTURI_NUTRITIE = [
  'nutritie-alimente.js', 'nutritie-retete.js', 'nutritie-analiza.js', 'nutritie-imagini.js',
  'nutritie.js', 'nutritie-zi-ui.js', 'cafea-ui.js', 'nutritie-saptamana-ui.js', 'nutritie-analiza-ui.js', 'nutritie-cumparaturi-ui.js',
  'scanare.js', 'scanare-baze.js', 'scanare-ui.js', 'acasa-mealprep.js',
];

let nutritiePornita = false;          // scripturile au rulat, initNutritie() și prima citire s-au făcut
let promisiuneNutritie = null;        // o singură încărcare în curs
const scripturiIncarcate = new Set(); // la o reîncercare nu rulăm de două ori un fișier (const/let dublate ar da eroare)
const dupaNutritie = [];              // acțiuni cerute înainte de încărcare (ex. fila aleasă din bara de jos)

function incarcaScript(src) {
  return new Promise((rezolva, respinge) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false; // se descarcă în paralel, dar rulează în ordinea din listă (dependențele)
    s.onload = () => { scripturiIncarcate.add(src); rezolva(); };
    s.onerror = () => { s.remove(); respinge(new Error(`Nu s-a putut încărca ${src}`)); };
    document.body.append(s);
  });
}

// Promisiune unică; la eroare (ex. fără internet la prima vizită) se poate încerca din nou.
function incarcaNutritia() {
  if (nutritiePornita) return Promise.resolve();
  if (!promisiuneNutritie) {
    const v = document.body.dataset.versiune || '';
    const surse = SCRIPTURI_NUTRITIE.map(f => `${f}?v=${v}`).filter(src => !scripturiIncarcate.has(src));
    promisiuneNutritie = Promise.all(surse.map(incarcaScript))
      .then(async () => {
        initNutritie();
        try { await reincarcaNutritie(); } catch (err) { console.warn('Datele de nutriție nu au putut fi citite', err); }
        nutritiePornita = true;
        for (const f of dupaNutritie.splice(0)) { try { f(); } catch (err) { console.warn(err); } }
      })
      .catch(err => { promisiuneNutritie = null; throw err; });
  }
  return promisiuneNutritie;
}

// Rulează acum dacă nutriția e încărcată, altfel imediat după încărcare.
function dupaIncarcareNutritie(f) {
  if (nutritiePornita) f(); else dupaNutritie.push(f);
}

// Pentru cod din nucleu care reîncarcă datele (backup, sincronizare): fără nutriție încărcată nu e nimic de reîmprospătat.
function reincarcaNutritiaDacaE() {
  return nutritiePornita ? reincarcaNutritie() : Promise.resolve();
}

if (typeof module !== 'undefined') module.exports = { SCRIPTURI_NUTRITIE };
