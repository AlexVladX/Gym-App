// Componente de interfață refolosite în toată aplicația:
// construirea elementelor, iconițe, notificări (toast), dialoguri, stări goale, formatări.

// ---------- Elemente ----------
// Construiește elemente fără innerHTML, ca textul să nu fie interpretat ca HTML.
function el(tag, props = {}, copii = []) {
  const e = document.createElement(tag);
  for (const [cheie, valoare] of Object.entries(props)) {
    if (valoare === undefined || valoare === null || valoare === false) continue;
    if (cheie === 'text') e.textContent = valoare;
    else if (cheie.startsWith('on')) e.addEventListener(cheie.slice(2), valoare);
    else e.setAttribute(cheie, valoare === true ? '' : valoare);
  }
  for (const c of copii) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

function $(id) { return document.getElementById(id); }

// ---------- Iconițe ----------
// Set propriu, desenat pe o grilă de 24 × 24, linie de 2 px. Culoarea vine din `currentColor`.
const ICONITE = {
  gantera: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  carte: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13M9 7h6',
  grafic: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  corp: 'M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 9l7 1.5L19 9M12 10.5V15M9 22l3-7 3 7',
  setari: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  cos: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  bifa: 'M5 12.5l4.5 4.5L19 7.5',
  ceas: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9 2h6',
  descarca: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  incarca: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  editeaza: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  cauta: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  trofeu: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6',
  cantar: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 10a4.5 4.5 0 0 1 7 0M12 10l1.5-2',
  avertizare: 'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01',
  scut: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
  istoric: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  lista: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  stop: 'M7 7h10v10H7z',
  flacara: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 7-4 12a7 7 0 0 0 7 7z',
  sageata: 'M9 6l6 6-6 6',
  minus: 'M5 12h14',
  play: 'M7 5l12 7-12 7V5z',
  pauza: 'M8 5v14M16 5v14',
  puncte: 'M5 12h.01M12 12h.01M19 12h.01',
  sus: 'M12 19V5M6 11l6-6 6 6',
  jos: 'M12 5v14M6 13l6 6 6-6',
  nota: 'M5 4h10l4 4v12H5V4zM15 4v4h4M8 12h8M8 16h5',
  legatura: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  tip: 'M4 6h16M4 12h10M4 18h6',
  schimba: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  stea: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z',
  filtru: 'M4 5h16l-6 8v5l-4 2v-7L4 5z',
  copiaza: 'M9 9h11v11H9zM5 15H4V4h11v1',
  lacat: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  'lacat-deschis': 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.6-1.7',
  calendar: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h3M8 16h6',
  cumparaturi: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2M9 20h.01M18 20h.01',
  zar: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
  nutritie: 'M12 8c-1.5-1.6-5-2-6.5.5C4 11 5 16 7.5 19c1.4 1.7 2.8 2 4.5 1 1.7 1 3.1.7 4.5-1C19 16 20 11 18.5 8.5 17 6 13.5 6.4 12 8zM12 8c0-2 1-4 3-5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  galerie: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  cafea: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3',
};

function iconita(nume, clasa = 'iconita') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', clasa);
  svg.setAttribute('aria-hidden', 'true');
  // Atributele de desen sunt puse direct pe SVG, nu doar în CSS: dacă foaia de stil
  // lipsește sau e o versiune veche, iconița rămâne contur mic, nu o formă neagră plină.
  const marime = clasa.includes('mica') ? '16' : '22';
  for (const [a, v] of [['width', marime], ['height', marime], ['fill', 'none'], ['stroke', 'currentColor'],
    ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) svg.setAttribute(a, v);
  const cale = document.createElementNS(ns, 'path');
  cale.setAttribute('d', ICONITE[nume] || ICONITE.info);
  svg.append(cale);
  return svg;
}

// Buton cu iconiță și text opțional. tip: 'principal' | 'secundar' | 'fantoma' | 'pericol'
function buton({ text, icon, tip = 'secundar', mic = false, lat = false, eticheta, onclick, clasa = '' }) {
  const cls = ['btn', `btn-${tip}`, mic && 'btn-mic', lat && 'btn-lat', !text && 'btn-icon', clasa].filter(Boolean).join(' ');
  return el('button', { class: cls, type: 'button', 'aria-label': eticheta || (!text ? icon : null), onclick }, [
    icon ? iconita(icon) : null,
    text ? el('span', { text }) : null,
  ]);
}

// ---------- Notificări (toast) ----------
// tip: 'info' | 'succes' | 'eroare' | 'record'. Maximum 3 vizibile o dată.
const ICON_TOAST = { info: 'info', succes: 'bifa', eroare: 'avertizare', record: 'trofeu' };

// actiune (opțional): { text, onclick } — un buton în mesaj (ex. „Anulează" după o ștergere); mesajul stă mai mult.
function notifica(text, tip = 'info', durataMs = 3500, actiune = null) {
  let zona = $('toasturi');
  if (!zona) {
    zona = el('div', { id: 'toasturi', class: 'toasturi', role: 'status', 'aria-live': 'polite' });
    document.body.append(zona);
  }
  const t = el('div', { class: `toast toast-${tip}` }, [iconita(ICON_TOAST[tip] || 'info'), el('span', { text })]);
  const inchide = () => {
    t.classList.add('iese');
    setTimeout(() => t.remove(), 200);
  };
  if (actiune) {
    t.append(el('button', { type: 'button', class: 'toast-actiune', text: actiune.text, onclick: e => {
      e.stopPropagation();
      inchide();
      actiune.onclick();
    } }));
    durataMs = Math.max(durataMs, 8000);
  }
  t.addEventListener('click', inchide);
  zona.append(t);
  while (zona.children.length > 3) zona.firstElementChild.remove();
  setTimeout(inchide, tip === 'eroare' ? Math.max(durataMs, 5000) : durataMs);
}

// Mesajul pentru o salvare eșuată: spațiul plin are o explicație proprie.
function mesajEroareSalvare(err, implicit) {
  const nume = err && (err.name || (err.inner && err.inner.name));
  if (nume === 'QuotaExceededError' || /quota/i.test(String(err && err.message))) {
    return 'Nu mai e spațiu de stocare pentru aplicație. Exportă un backup, apoi eliberează spațiu pe telefon sau șterge poze vechi.';
  }
  return implicit;
}

// ---------- Dialoguri ----------
// Un singur dialog deschis o dată. Escape, atingerea fundalului sau „Înapoi” (navigare.js) = anulare.
//
// Focusul la deschidere (ca o atingere grăbită sau un Enter să nu facă rău și tastatura să nu acopere dialogul):
//   - dialog periculos (pericol: true sau un buton roșu) → butonul de anulare;
//   - focus: 'camp' (dialoguri al căror singur scop e scrisul, ex. „Scrie ȘTERGE”) → primul câmp;
//   - ecran tactil → titlul (tastatura nu apare până nu atingi un câmp);
//   - altfel (desktop) → primul câmp, apoi butonul principal.
let dialogDeschis = null;

function ecranTactil() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

function alegeFocusDialog(caseta, { focus, pericol }) {
  const butoane = caseta.querySelector('.dialog-butoane');
  const titlu = caseta.querySelector('h2');
  const camp = caseta.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (focus === 'camp' && camp) return camp;
  if (pericol || caseta.querySelector('.dialog-butoane .btn-pericol')) {
    return (butoane && butoane.querySelector('.btn-fantoma, .btn-secundar')) || titlu;
  }
  if (ecranTactil()) return titlu;
  return camp || caseta.querySelector('.btn-principal') || titlu;
}

function deschideDialog({ titlu, text, continut, butoane, laAnulare, focus = 'auto', pericol = false }) {
  if (dialogDeschis) dialogDeschis.inchide(dialogDeschis.laAnulare);
  const anterior = document.activeElement;
  const fundal = el('div', { class: 'dialog-fundal' });
  const caseta = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-titlu' }, [
    el('h2', { id: 'dialog-titlu', text: titlu, tabindex: '-1' }),
    text ? el('p', { class: 'dialog-text', text }) : null,
    continut || null,
    el('div', { class: 'dialog-butoane' }, butoane),
  ]);
  fundal.append(caseta);

  const tasta = e => {
    if (e.key === 'Escape') { e.preventDefault(); ctrl.inchide(laAnulare); }
  };
  const ctrl = {
    caseta,
    laAnulare,
    idNav: null,
    // dinIstoric: închis de „Înapoi” (intrarea din istoric a dispărut deja)
    inchide(actiune, { dinIstoric = false } = {}) {
      if (dialogDeschis !== ctrl) return;
      dialogDeschis = null;
      document.removeEventListener('keydown', tasta);
      fundal.classList.add('iese');
      setTimeout(() => fundal.remove(), 160);
      if (!dinIstoric && typeof navigareDialogInchis === 'function') navigareDialogInchis(ctrl.idNav);
      if (anterior && anterior.focus) anterior.focus({ preventScroll: true });
      if (actiune) actiune();
    },
  };
  fundal.addEventListener('click', e => { if (e.target === fundal) ctrl.inchide(laAnulare); });
  document.addEventListener('keydown', tasta);
  document.body.append(fundal);
  dialogDeschis = ctrl;
  if (typeof navigareDialogDeschis === 'function') ctrl.idNav = navigareDialogDeschis();
  // Focus fără derulare: dialogul începe mereu de sus (titlul și primele informații vizibile).
  setTimeout(() => {
    if (dialogDeschis !== ctrl) return;
    const tinta = alegeFocusDialog(caseta, { focus, pericol });
    if (tinta) tinta.focus({ preventScroll: true });
    caseta.scrollTop = 0;
  }, 30);
  return ctrl;
}

// Confirmare: întoarce Promise<boolean>.
function confirma({ titlu, text, ok = 'Confirmă', anulare = 'Renunță', pericol = false, continut }) {
  return new Promise(rezolva => {
    const d = deschideDialog({
      titlu, text, continut, pericol,
      laAnulare: () => rezolva(false),
      butoane: [
        buton({ text: anulare, tip: 'fantoma', onclick: () => d.inchide(() => rezolva(false)) }),
        buton({ text: ok, tip: pericol ? 'pericol' : 'principal', onclick: () => d.inchide(() => rezolva(true)) }),
      ],
    });
  });
}

// Listă de opțiuni (meniu ca foaie de jos). Fiecare opțiune: { text, icon, detaliu, activ, pericol, dezactivat, actiune }.
// Alegerea închide meniul și rulează acțiunea.
function alegeDinLista({ titlu, text, optiuni }) {
  const lista = el('div', { class: 'meniu-lista', role: 'menu' }, optiuni.map(o => el('button', {
    class: 'meniu-optiune' + (o.pericol ? ' pericol' : '') + (o.activ ? ' activ' : ''),
    type: 'button', role: 'menuitem', disabled: o.dezactivat || false,
    onclick: () => d.inchide(o.actiune),
  }, [
    o.icon ? iconita(o.icon) : el('span', { class: 'meniu-gol' }),
    el('span', { class: 'meniu-text' }, [el('span', { text: o.text }), o.detaliu ? el('small', { text: o.detaliu }) : null]),
    o.activ ? iconita('bifa', 'iconita mica') : null,
  ])));
  const d = deschideDialog({
    titlu, text, continut: lista,
    butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })],
  });
  return d;
}

// Câmp de text: întoarce Promise<string|null> (null = anulat).
// confirmareExacta: dacă e dat, butonul OK merge doar când textul scris e exact acesta.
function cereText({ titlu, text, eticheta, valoare = '', ok = 'Salvează', pericol = false, confirmareExacta = null }) {
  return new Promise(rezolva => {
    const input = el('input', { type: 'text', value: valoare, 'aria-label': eticheta || titlu, autocomplete: 'off' });
    const butonOk = buton({ text: ok, tip: pericol ? 'pericol' : 'principal', onclick: () => trimite() });
    const verifica = () => {
      const bun = confirmareExacta ? input.value.trim() === confirmareExacta : input.value.trim() !== '';
      butonOk.disabled = !bun;
    };
    const trimite = () => {
      if (butonOk.disabled) return;
      const v = input.value.trim();
      d.inchide(() => rezolva(v));
    };
    input.addEventListener('input', verifica);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); trimite(); } });
    const d = deschideDialog({
      titlu, text, focus: 'camp', // singurul scop e scrisul: câmpul primește focus (și tastatura)
      continut: el('label', { class: 'camp' }, [eticheta ? el('span', { class: 'camp-eticheta', text: eticheta }) : null, input]),
      laAnulare: () => rezolva(null),
      butoane: [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide(() => rezolva(null)) }), butonOk],
    });
    verifica();
    setTimeout(() => input.select(), 40);
  });
}

// ---------- Filtre la fel peste tot (etapa 4) ----------
// Chip-urile filtrelor active, sub căutare: fiecare cu ✕ (îl scoate). active: [{ text, scoate }].
function deseneazaFiltreActive(container, active) {
  container.hidden = !active.length;
  container.replaceChildren(...active.map(a => el('button', { type: 'button', class: 'chip chip-mic chip-activ-sters', 'aria-label': `Scoate filtrul ${a.text}`, onclick: a.scoate },
    [el('span', { text: a.text }), iconita('x', 'iconita mica')])));
}
// Eticheta butonului: „Filtre” sau „Filtre (n)”.
function etichetaButonFiltre(buton, n) {
  buton.querySelector('span').textContent = n ? `Filtre (${n})` : 'Filtre';
  buton.classList.toggle('activ', n > 0);
  buton.setAttribute('aria-label', n ? `Filtre, ${n} active` : 'Filtre');
}
// Foaia cu toate filtrele: continut se redesenează la fiecare schimbare (deseneaza), „Resetează” și „Gata”.
function deschideFoaieFiltre({ titlu = 'Filtre', deseneaza, reseteaza }) {
  const zona = el('div', { class: 'foaie-filtre' });
  const reface = () => zona.replaceChildren(...deseneaza(reface).filter(Boolean));
  reface();
  const d = deschideDialog({
    titlu, continut: zona,
    butoane: [
      buton({ text: 'Resetează', tip: 'fantoma', onclick: () => { reseteaza(); reface(); } }),
      buton({ text: 'Gata', tip: 'principal', onclick: () => d.inchide() }),
    ],
  });
  return d;
}

// ---------- Liste lungi, desenate pe bucăți (etapa 3) ----------
// Primele `marime` elemente se creează acum; restul, câte o bucată, când capătul listei se apropie de ecran
// (IntersectionObserver pe o „santinelă”). Căutarea și filtrele lucrează în continuare pe toată lista:
// aici se amână doar crearea elementelor. fabrici: funcții care întorc elementul.
function deseneazaPeBucati(container, fabrici, marime = 30) {
  if (container.__observatorBucati) { container.__observatorBucati.disconnect(); container.__observatorBucati = null; }
  let i = 0;
  const santinela = el('div', { class: 'santinela-lista', 'aria-hidden': 'true' });
  container.append(santinela);
  const aproape = () => santinela.isConnected && santinela.getBoundingClientRect().top < window.innerHeight + 800;
  const urmatoarea = () => {
    if (!santinela.isConnected) return;
    const bucata = fabrici.slice(i, i + marime).map(f => f());
    i += bucata.length;
    santinela.before(...bucata);
    if (i >= fabrici.length) {
      if (container.__observatorBucati) container.__observatorBucati.disconnect();
      container.__observatorBucati = null;
      santinela.remove();
      return;
    }
    // Pe ecrane mari, santinela poate rămâne vizibilă după o bucată (observatorul nu mai anunță): continuăm.
    requestAnimationFrame(() => { if (aproape()) urmatoarea(); });
  };
  urmatoarea();
  if (i >= fabrici.length) return;
  if (typeof IntersectionObserver !== 'function') { while (santinela.isConnected) urmatoarea(); return; }
  const obs = new IntersectionObserver(intrari => { if (intrari.some(x => x.isIntersecting)) urmatoarea(); }, { rootMargin: '0px 0px 800px 0px' });
  obs.observe(santinela);
  container.__observatorBucati = obs;
}

// ---------- Stări goale și încărcare ----------
function stareGoala({ icon = 'info', titlu, text, actiune }) {
  return el('div', { class: 'gol' }, [
    el('div', { class: 'gol-icon' }, [iconita(icon)]),
    titlu ? el('p', { class: 'gol-titlu', text: titlu }) : null,
    text ? el('p', { class: 'gol-text', text }) : null,
    actiune || null,
  ]);
}

function stareIncarcare(randuri = 3) {
  return el('div', { class: 'incarcare', 'aria-busy': 'true', 'aria-label': 'Se încarcă' },
    Array.from({ length: randuri }, () => el('div', { class: 'schelet' })));
}

// Plăcuță de statistică: etichetă, valoare mare, detaliu.
function placuta(eticheta, valoare, detaliu, clasaValoare = '') {
  return el('div', { class: 'placuta' }, [
    el('span', { class: 'placuta-eticheta', text: eticheta }),
    el('strong', { class: clasaValoare, text: valoare }),
    detaliu ? el('span', { class: 'placuta-detaliu', text: detaliu }) : null,
  ]);
}

// ---------- Formatări ----------
// „1 exercițiu", „3 exerciții", „20 de exerciții".
function plural(n, unu, multe) {
  if (n === 1) return `1 ${unu}`;
  const rest = n % 100;
  return (n === 0 || (rest >= 1 && rest <= 19)) ? `${n} ${multe}` : `${n} de ${multe}`;
}

// Numărul cu „de” când româna îl cere: „5 serii”, „20 de serii”, „101 serii”, „120 de serii”.
// Pentru propoziții în care numărul și cuvântul nu stau împreună (ex. „cele 20 de feluri”).
function numarDe(n) {
  const rest = Math.abs(n) % 100;
  return (n === 0 || (rest >= 1 && rest <= 19)) ? String(n) : `${n} de`;
}

// Data locală AAAA-LL-ZZ (toISOString ar folosi UTC și ar muta sesiunile de seara).
function formatData(d) {
  const luna = String(d.getMonth() + 1).padStart(2, '0');
  const zi = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${luna}-${zi}`;
}
function dataLocala() { return formatData(new Date()); }

// Timestamp pentru o dată AAAA-LL-ZZ (la prânz, ca să nu sară peste zi din cauza fusului orar).
function timpDinData(data) { return Date.parse(data + 'T12:00:00'); }

// Luni-ul săptămânii în care cade data (format AAAA-LL-ZZ). Calculul e în analiza.js.
function luniaSaptamanii(data) { return cheieSaptamana(data); }

function afiseazaData(data) {
  const [an, luna, zi] = data.split('-');
  return `${zi}.${luna}.${an}`;
}

const formatNumar = v => (Math.round(v * 10) / 10).toString();

// 1234567 → „1.234.567"
function formatMare(v) {
  return Math.round(v).toLocaleString('ro-RO');
}

// Secunde → „m:ss" sau „h:mm:ss"
function formatDurata(secunde) {
  const s = Math.max(0, Math.floor(secunde));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function valoareNumerica(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

if (typeof module !== 'undefined') module.exports = { plural, numarDe, alegeFocusDialog };
