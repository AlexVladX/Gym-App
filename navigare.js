// Butonul și gestul „Înapoi” (Android, browser): istoricul browserului urmărește ecranele și dialogurile.
//
// - Prima intrare din istoric e Acasă al modului de la pornire (rădăcina). De acolo, „Înapoi” iese din aplicație.
// - Fiecare schimbare de ecran (inclusiv grupul de file din Nutriție și schimbarea de mod) adaugă o intrare.
//   Revenirea la rădăcină (ex. butonul Acasă) nu adaugă una: istoricul se întoarce la rădăcină.
// - Fiecare dialog deschis adaugă o intrare. „Înapoi” îl închide ca „Renunță” (laAnulare).
// - Un dialog închis normal (buton, Escape, fundal) nu lasă intrări „moarte”: intrarea lui se scoate cu un
//   history.back() controlat, sau se refolosește dacă imediat se deschide alt dialog ori alt ecran.
// - Cât timp un history.back()/go() de-al nostru e în curs, intrările noi așteaptă într-o coadă (altfel ar fi
//   scoase chiar ele de navigarea care încă nu s-a terminat).
//
// Logica de decizie e pură (testată în Node); restul e legătura cu history API.

const nav = {
  pornit: false,
  radacina: null,       // ecranul de la baza istoricului
  adancime: 0,          // câte intrări ale noastre sunt deasupra rădăcinii
  ignora: 0,            // câte evenimente popstate provocate de noi trebuie ignorate
  coada: [],            // intrări de adăugat după ce se termină navigarea în curs
  moarta: null,         // id-ul dialogului închis a cărui intrare încă e în vârf
  timerMoarta: null,
  ultimaCheie: '',      // ecranul (și fila) afișat acum, așa cum e scris în istoric
  dinIstoric: false,    // true cât timp aplicăm o intrare venită din „Înapoi”
  contorDialog: 0,
};

// ---------- Logică pură ----------
function cheieNavigare(s) {
  return s && s.tip === 'ecran' ? `${s.ecran}|${s.fila || ''}` : '';
}

// Ce facem când se schimbă ecranul (nu din istoric): 'nimic' | 'radacina' (întoarcere) | 'adauga'.
function decizieSchimbareEcran({ cheieNoua, ultimaCheie, ecran, radacina, adancime }) {
  if (cheieNoua === ultimaCheie) return 'nimic';
  if (ecran === radacina && cheieNoua === `${radacina}|` && adancime > 0) return 'radacina';
  return 'adauga';
}

// Ce facem la „Înapoi” (popstate), dată fiind noua intrare din vârf:
//   { inchideDialog: bool, sari: bool (intrare de dialog orfană → mai mergem o dată înapoi), ecran: stare|null }
function decizieInapoi({ stare, idDialogDeschis, ultimaCheie }) {
  const aDialogului = stare && stare.tip === 'dialog' && stare.id === idDialogDeschis;
  const inchideDialog = idDialogDeschis != null && !aDialogului;
  if (stare && stare.tip === 'dialog' && !aDialogului) return { inchideDialog, sari: true, ecran: null };
  const ecran = stare && stare.tip === 'ecran' && cheieNavigare(stare) !== ultimaCheie ? stare : null;
  return { inchideDialog, sari: false, ecran };
}

// ---------- Legătura cu history API ----------
function stareEcranCurent() {
  let fila = null;
  if (ecranCurent === 'ecran-nutritie' && typeof filaNutritie !== 'undefined') fila = filaNutritie;
  if (ecranCurent === 'ecran-setari' && typeof categorieSetari !== 'undefined') fila = categorieSetari || null; // etapa 5
  return { tip: 'ecran', ecran: ecranCurent, fila };
}

function scrieIntrare(stare, inlocuieste) {
  if (!inlocuieste) nav.adancime++;
  const s = { gym: 1, ...stare, adancime: nav.adancime };
  if (inlocuieste) history.replaceState(s, '');
  else history.pushState(s, '');
}

// Adaugă o intrare: refolosește intrarea moartă din vârf, sau așteaptă dacă o navigare de-a noastră e în curs.
function adaugaIntrare(stare) {
  if (nav.ignora > 0) { nav.coada.push(stare); return; }
  if (nav.moarta !== null) {
    clearTimeout(nav.timerMoarta);
    nav.moarta = null;
    scrieIntrare(stare, true);
    return;
  }
  scrieIntrare(stare, false);
}

function navigheazaNoi(pasi) {
  nav.ignora++;
  history.go(pasi);
}

function pornesteNavigarea(radacina) {
  if (nav.pornit || typeof history === 'undefined' || !history.pushState) return;
  nav.pornit = true;
  nav.radacina = radacina;
  nav.adancime = 0;
  nav.ultimaCheie = `${radacina}|`;
  // Fără adresă nouă: cloud.js citește încă location.hash (linkurile din e-mail).
  history.replaceState({ gym: 1, tip: 'ecran', ecran: radacina, fila: null, adancime: 0 }, '');
  window.addEventListener('popstate', laInapoi);
}

// Chemată din arataEcran după fiecare afișare.
function navigareDupaEcran() {
  if (!nav.pornit || nav.dinIstoric) return;
  const s = stareEcranCurent();
  const decizie = decizieSchimbareEcran({ cheieNoua: cheieNavigare(s), ultimaCheie: nav.ultimaCheie, ecran: s.ecran, radacina: nav.radacina, adancime: nav.adancime });
  if (decizie === 'nimic') return;
  nav.ultimaCheie = cheieNavigare(s);
  if (decizie === 'radacina') {
    clearTimeout(nav.timerMoarta);
    nav.moarta = null;
    nav.coada = [];
    const pasi = nav.adancime;
    nav.adancime = 0;
    navigheazaNoi(-pasi);
    return;
  }
  adaugaIntrare(s);
}

// Dialogurile (ui.js): deschiderea întoarce un id; închiderea normală scoate intrarea.
function navigareDialogDeschis() {
  if (!nav.pornit) return null;
  const id = ++nav.contorDialog;
  adaugaIntrare({ tip: 'dialog', id });
  return id;
}

function navigareDialogInchis(id) {
  if (!nav.pornit || id == null) return;
  const inCoada = nav.coada.findIndex(s => s.tip === 'dialog' && s.id === id);
  if (inCoada >= 0) { nav.coada.splice(inCoada, 1); return; }
  const sus = history.state;
  if (!sus || sus.tip !== 'dialog' || sus.id !== id) return;
  nav.moarta = id;
  clearTimeout(nav.timerMoarta);
  // Puțin mai târziu: dacă între timp se deschide alt dialog sau alt ecran, refolosește intrarea.
  nav.timerMoarta = setTimeout(() => {
    if (nav.moarta !== id) return;
    nav.moarta = null;
    nav.adancime = Math.max(0, nav.adancime - 1);
    navigheazaNoi(-1);
  }, 0);
}

function laInapoi(e) {
  const stare = e.state && e.state.gym ? e.state : null;
  nav.adancime = stare ? stare.adancime || 0 : 0;
  if (nav.ignora > 0) {
    nav.ignora--;
    if (nav.ignora === 0 && nav.coada.length) {
      const coada = nav.coada; nav.coada = [];
      coada.forEach(s => scrieIntrare(s, false));
    }
    return;
  }
  clearTimeout(nav.timerMoarta);
  nav.moarta = null;
  const d = typeof dialogDeschis !== 'undefined' ? dialogDeschis : null;
  const decizie = decizieInapoi({ stare, idDialogDeschis: d ? d.idNav : null, ultimaCheie: nav.ultimaCheie });
  if (decizie.inchideDialog && d) d.inchide(d.laAnulare, { dinIstoric: true });
  if (decizie.sari) { navigheazaNoi(-1); return; }
  if (decizie.ecran) {
    nav.dinIstoric = true;
    try {
      const fila = decizie.ecran.fila;
      if (decizie.ecran.ecran === 'ecran-setari') { if (typeof categorieSetari !== 'undefined') categorieSetari = fila || ''; }
      else if (fila && typeof dupaIncarcareNutritie === 'function') dupaIncarcareNutritie(() => arataFilaNutritie(fila, { randeaza: false }));
      arataEcran(decizie.ecran.ecran);
    } finally { nav.dinIstoric = false; }
    nav.ultimaCheie = cheieNavigare(decizie.ecran);
  }
}

// Butonul „Înapoi” din antet (Setări): ca gestul, dacă avem unde reveni.
function poateMergeInapoi() { return nav.pornit && nav.adancime > 0; }
function mergiInapoi() { if (poateMergeInapoi()) history.back(); }

if (typeof module !== 'undefined') module.exports = { cheieNavigare, decizieSchimbareEcran, decizieInapoi };
