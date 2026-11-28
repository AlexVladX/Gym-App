// Etapa 7, funcția 3: înlocuirea unui exercițiu în antrenament — alternative explicate, filtrul de echipament,
// împărțirea când are serii bifate, actualizarea rutinei. Fără DOM (testat în Node, tests/inlocuire.test.js).
// Folosește din catalog.js: GRUPA_VECHE, NIVELURI.

const GRUPE_PICIOARE = ['Cvadricepși', 'Femurali', 'Fese', 'Gambe'];

// Filtrul rapid din selector (Toate / Gantere / Aparat / Scripete / Corp / Bară).
const FILTRE_ECHIPAMENT = [
  { id: 'toate', nume: 'Toate' },
  { id: 'gantere', nume: 'Gantere', echipamente: ['Gantere', 'Kettlebell'] },
  { id: 'aparat', nume: 'Aparat', echipamente: ['Aparat'] },
  { id: 'scripete', nume: 'Scripete', echipamente: ['Scripete'] },
  { id: 'corp', nume: 'Corp', echipamente: ['Corp'] },
  { id: 'bara', nume: 'Bară', echipamente: ['Bară', 'Bară EZ'] },
];
// Echipamentele care se pot bifa la „Echipamentul din sala mea” (greutatea corpului e mereu disponibilă).
const ECHIPAMENTE_SALA = ['Bară', 'Bară EZ', 'Gantere', 'Aparat', 'Scripete', 'Kettlebell', 'Benzi elastice'];

function catalogInlocuire() {
  if (typeof GRUPA_VECHE !== 'undefined' && typeof NIVELURI !== 'undefined') return { GRUPA_VECHE, NIVELURI };
  return require('./catalog.js');
}

function potrivesteFiltruEchipament(e, id) {
  const f = FILTRE_ECHIPAMENT.find(x => x.id === id);
  return !f || !f.echipamente || f.echipamente.includes(e && e.echipament);
}

// Lista goală (sau lipsă) = setarea nu e folosită: totul e disponibil. Corpul și „Altele” sunt mereu disponibile.
function echipamentDisponibil(e, sala) {
  if (!Array.isArray(sala) || !sala.length) return true;
  const ech = e && e.echipament;
  return !ech || ech === 'Corp' || ech === 'Altele' || sala.includes(ech);
}

function curataEchipamentSala(lista) {
  return Array.isArray(lista) ? [...new Set(lista.filter(x => ECHIPAMENTE_SALA.includes(x)))] : [];
}

// Grupele în care se caută alternative. Vechea grupă „Picioare” (exerciții proprii) → toate grupele de picioare.
function grupeAlternative(grupa) {
  const { GRUPA_VECHE } = catalogInlocuire();
  if (grupa === GRUPA_VECHE) return [...GRUPE_PICIOARE, GRUPA_VECHE];
  return grupa ? [grupa] : [];
}

const TOT_CU_ECHIPAMENT = { 'Bară': 'tot cu bara', 'Bară EZ': 'tot cu bara EZ', 'Gantere': 'tot cu gantere', 'Aparat': 'tot la aparat', 'Scripete': 'tot la scripete', 'Corp': 'tot cu greutatea corpului', 'Kettlebell': 'tot cu kettlebell', 'Benzi elastice': 'tot cu benzi elastice' };
const FORMA_ECHIPAMENT = { 'Bară': 'bară', 'Bară EZ': 'bară EZ', 'Gantere': 'gantere', 'Aparat': 'aparat', 'Scripete': 'scripete', 'Corp': 'greutatea corpului', 'Kettlebell': 'kettlebell', 'Benzi elastice': 'benzi elastice' };

// Motivul scurt: „aceeași mișcare · gantere în loc de bară”, „aceiași mușchi · aparat în loc de bară”, „tot picioare (fese)”.
function motivAlternativa(tinta, e) {
  const { GRUPA_VECHE } = catalogInlocuire();
  const parti = [];
  const sec = new Set(tinta.secundari || []);
  if (tinta.poza && e.poza && tinta.poza === e.poza) parti.push('aceeași mișcare');
  else if (tinta.grupa === GRUPA_VECHE && e.grupa !== GRUPA_VECHE) parti.push(`tot picioare (${String(e.grupa).toLowerCase()})`);
  else if ((e.secundari || []).some(m => sec.has(m)) || e.grupa === tinta.grupa) parti.push('aceiași mușchi');
  const fe = FORMA_ECHIPAMENT[e.echipament], ft = FORMA_ECHIPAMENT[tinta.echipament];
  if (fe && ft && e.echipament !== tinta.echipament) parti.push(`${fe} în loc de ${ft}`);
  else if (fe && ft) parti.push(TOT_CU_ECHIPAMENT[e.echipament]);
  else if (fe && !ft) parti.push(e.echipament === 'Corp' ? 'cu greutatea corpului' : `la ${fe}`);
  return parti.join(' · ');
}

// Alternativele explicate, cele mai potrivite întâi. Cele care cer echipament pe care nu-l ai coboară la final (lipsa: true).
// Scor: aceeași mișcare (aceeași ilustrație) +5, fiecare mușchi secundar comun +2, aceeași categorie +3, același tip +1,
// alt echipament +1 (de obicei îl schimbi pentru că aparatul sau banca e ocupată), diferența de nivel −1 pe treaptă. Exercițiile proprii fără mușchi secundari se potrivesc după grupă.
function alternativeExplicate(tinta, toate, { n = 8, echipamentSala = null } = {}) {
  if (!tinta || !tinta.grupa) return [];
  const { NIVELURI } = catalogInlocuire();
  const grupe = new Set(grupeAlternative(tinta.grupa));
  const sec = new Set(tinta.secundari || []);
  const nivel = e => Math.max(0, NIVELURI.indexOf(e.nivel));
  return (toate || [])
    .filter(e => e && e.nume.toLowerCase() !== tinta.nume.toLowerCase() && grupe.has(e.grupa))
    .map(e => {
      let scor = 0;
      if (tinta.poza && e.poza === tinta.poza) scor += 5;
      for (const m of e.secundari || []) if (sec.has(m)) scor += 2;
      if (e.categorie && e.categorie === tinta.categorie) scor += 3;
      if (e.tip === tinta.tip) scor += 1;
      if (e.echipament && tinta.echipament && e.echipament !== tinta.echipament) scor += 1;
      scor -= Math.abs(nivel(e) - nivel(tinta));
      return { e, scor, motiv: motivAlternativa(tinta, e), lipsa: !echipamentDisponibil(e, echipamentSala) };
    })
    .sort((a, b) => Number(a.lipsa) - Number(b.lipsa) || b.scor - a.scor || a.e.nume.localeCompare(b.e.nume, 'ro'))
    .slice(0, n);
}

// ---------- Împărțirea la înlocuire ----------
// ex: exercițiul din antrenament; nou: exercițiul nou gata făcut (exercitiuNou: serii goale ca data trecută, pentru „Anterior”).
// Fără serii bifate: nou îl înlocuiește pe loc (cu supersetul și nota lui ex). Cu serii bifate: seriile bifate rămân la ex,
// iar seriile nebifate trec la nou (același număr și aceleași tipuri, goale: valorile de data trecută apar ca sugestie);
// nou ia supersetul lui ex, nota rămâne la ex. Întoarce { impartit, lista } — exercițiile care iau locul lui ex, în ordine.
function imparteLaInlocuire(ex, nou, serieGoala) {
  const facute = ex.serii.filter(s => s.facut);
  if (!facute.length) return { impartit: false, lista: [{ ...nou, superset: ex.superset, nota: ex.nota }] };
  const ramase = ex.serii.filter(s => !s.facut);
  const serii = ramase.length ? ramase.map(s => serieGoala(s.tip || 'normal')) : [serieGoala('normal')];
  return {
    impartit: true,
    facute: facute.length,
    mutate: ramase.length,
    lista: [{ ...ex, serii: facute }, { ...nou, serii, superset: ex.superset, nota: '' }],
  };
}

// Textul explicației din dialog, înainte de confirmare.
function textImpartire(numeVechi, numeNou, facute, mutate) {
  const s = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  return `${s(facute, 'serie bifată rămâne', 'serii bifate rămân')} la ${numeVechi}. `
    + (mutate ? `${s(mutate, 'serie nebifată trece', 'serii nebifate trec')} la ${numeNou}, care apare imediat dedesubt.` : `${numeNou} apare imediat dedesubt, cu o serie.`)
    + ' În istoric rămân două exerciții separate.';
}

// ---------- Rutina ----------
// „Folosești [nou] și data viitoare?” → Da: în rutină, numele vechi devine cel nou (o singură dată, fără dubluri).
function inlocuiesteInRutina(rutina, vechi, nou, grupaNoua = null) {
  const v = vechi.toLowerCase();
  const exercitii = [];
  let schimbat = false;
  for (const x of rutina.exercitii || []) {
    const nume = !schimbat && x.toLowerCase() === v ? (schimbat = true, nou) : x;
    if (!exercitii.some(y => y.toLowerCase() === nume.toLowerCase())) exercitii.push(nume);
  }
  if (!schimbat) return null;
  const grupe = [...(rutina.grupe || [])];
  if (grupaNoua && !grupe.includes(grupaNoua)) grupe.push(grupaNoua);
  return { ...rutina, exercitii, grupe };
}

if (typeof module !== 'undefined') {
  module.exports = { GRUPE_PICIOARE, FILTRE_ECHIPAMENT, ECHIPAMENTE_SALA, potrivesteFiltruEchipament, echipamentDisponibil, curataEchipamentSala,
    grupeAlternative, motivAlternativa, alternativeExplicate, imparteLaInlocuire, textImpartire, inlocuiesteInRutina };
}
