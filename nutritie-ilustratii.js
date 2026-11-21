// Ilustrațiile rețetelor, desenate din ingredientele lor (SVG, fără fișiere de imagine).
// Fiecare ingredient are un „aspect” (cum arată: boabe, frunze, cuburi…) și o culoare (nutritie-alimente.js).
// Vasul (farfurie, bol, pahar, borcan, tocător) vine din rețetă. Aceeași rețetă dă mereu același desen;
// o rețetă proprie primește automat ilustrația ei, iar dacă îi schimbi ingredientele, se schimbă și desenul.
// Funcția nu atinge pagina: întoarce textul SVG (testabil în Node).

const LATIME_IL = 160, INALTIME_IL = 120;

// Aspecte care acoperă o zonă întreagă (baza mâncării), nu bucăți separate.
const ASPECTE_BAZA = ['crema', 'sos', 'lichid', 'mamaliga', 'omleta', 'granule', 'fulgi-ovaz', 'boabe', 'paste'];
// Ce se desenează ultimul (deasupra): bucăți mici, presărate.
const ASPECTE_PRESARATE = ['seminte', 'verdeata', 'ras', 'stropi', 'bile-mici'];

function hashText(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function generatorAleator(samanta) {
  let a = samanta >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexInRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  const n = m ? parseInt(m[1], 16) : 0x999999;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbInHex([r, g, b]) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
// f > 0 deschide spre alb, f < 0 închide spre negru.
function nuanta(hex, f) {
  const [r, g, b] = hexInRgb(hex);
  return f >= 0 ? rgbInHex([r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f])
    : rgbInHex([r * (1 + f), g * (1 + f), b * (1 + f)]);
}
function amestecCulori(perechi) {
  let s = 0; const acc = [0, 0, 0];
  for (const [hex, w] of perechi) {
    const c = hexInRgb(hex);
    for (let i = 0; i < 3; i++) acc[i] += c[i] * w;
    s += w;
  }
  return s > 0 ? rgbInHex(acc.map(v => v / s)) : '#cccccc';
}

const n1 = v => Math.round(v * 10) / 10;

// ---------- Bucăți de mâncare (desenate în jurul punctului x, y) ----------
function bucata(aspect, culoare, x, y, rnd, s = 1) {
  const rot = Math.round(rnd() * 360);
  const inchis = nuanta(culoare, -0.25), deschis = nuanta(culoare, 0.35);
  const t = `translate(${n1(x)} ${n1(y)}) rotate(${rot}) scale(${n1(s)})`;
  switch (aspect) {
    case 'carne':
      return `<g transform="${t}"><rect x="-11" y="-5" width="22" height="10" rx="4" fill="${culoare}"/>` +
        `<path d="M-7 -4.5l-3 9M-1 -4.5l-3 9M5 -4.5l-3 9" stroke="${nuanta(culoare, -0.45)}" stroke-width="1.4" opacity=".7"/>` +
        `<rect x="-11" y="-5" width="22" height="3" rx="1.5" fill="${deschis}" opacity=".35"/></g>`;
    case 'tocata':
      return `<g transform="${t}"><circle r="5.2" fill="${culoare}"/><circle cx="-1.5" cy="-1.6" r="2" fill="${deschis}" opacity=".45"/>` +
        `<circle cx="1.8" cy="1.5" r="1" fill="${inchis}"/></g>`;
    case 'mezel':
      return `<g transform="${t}"><ellipse rx="10" ry="7" fill="${culoare}"/><ellipse rx="10" ry="7" fill="none" stroke="${deschis}" stroke-width="1.2" opacity=".7"/>` +
        `<path d="M-6 0q6 -4 12 0" stroke="${deschis}" stroke-width="1" fill="none" opacity=".6"/></g>`;
    case 'peste':
      return `<g transform="${t}"><path d="M-16 0q3 -9 16 -8q14 1 16 8q-2 7 -16 8q-13 1 -16 -8z" fill="${culoare}"/>` +
        `<path d="M-9 -6q2 6 0 12M-2 -7q2 7 0 14M5 -7q2 7 0 14M11 -5q1.5 5 0 10" stroke="${deschis}" stroke-width="1.2" fill="none" opacity=".8"/></g>`;
    case 'fulgi':
      return `<g transform="${t}"><path d="M-5 -2l3 -3l5 1l2 4l-3 3l-5 -1z" fill="${culoare}"/><path d="M-2 -1l3 0" stroke="${deschis}" stroke-width="1"/></g>`;
    case 'creveti':
      return `<g transform="${t}"><path d="M-7 3a7 7 0 1 1 9 4" fill="none" stroke="${culoare}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M-6 -2l2 1M-2 -6l1 2M3 -5l-1 2" stroke="${deschis}" stroke-width="1"/></g>`;
    case 'ou':
      return `<g transform="${t}"><ellipse rx="9" ry="7" fill="#FBF9F4"/><circle cx="0.5" cy="0.4" r="4" fill="${culoare}"/>` +
        `<circle cx="-0.8" cy="-0.8" r="1.3" fill="#FFF2B8" opacity=".8"/></g>`;
    case 'tocata-mic':
      return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(2.4 * s)}" fill="${culoare}"/>`;
    case 'branza':
      return `<g transform="${t}"><rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="${culoare}"/><rect x="-4" y="-4" width="8" height="2.5" rx="1" fill="${deschis}" opacity=".5"/></g>`;
    case 'granule':
      return `<g transform="${t}"><circle r="2.4" fill="${culoare}"/><circle cx="3" cy="2" r="2" fill="${nuanta(culoare, -0.05)}"/><circle cx="-2.5" cy="2.5" r="1.8" fill="${culoare}"/></g>`;
    case 'cuburi':
      return `<g transform="${t}"><rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx="1.4" fill="${culoare}"/><path d="M-3 -2.6h6" stroke="${deschis}" stroke-width="1" opacity=".6"/></g>`;
    case 'bile-mari':
      return `<g transform="${t}"><circle r="5.5" fill="${culoare}"/><circle cx="-1.8" cy="-1.8" r="1.7" fill="#fff" opacity=".35"/>` +
        `<path d="M0 -5.5l1 -1.5M0 -5.5l-1.5 -1" stroke="#4C8A2E" stroke-width="1"/></g>`;
    case 'bile':
      return `<g transform="${t}"><circle r="3.4" fill="${culoare}"/><circle cx="-1" cy="-1.1" r="1" fill="#fff" opacity=".35"/></g>`;
    case 'bile-mici':
      return `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(1.8 * s)}" fill="${culoare}"/>`;
    case 'rondele':
      return `<g transform="${t}"><circle r="6" fill="${culoare}"/><circle r="4.3" fill="${deschis}"/>` +
        `<circle r="1.4" fill="${nuanta(culoare, 0.15)}"/></g>`;
    case 'felii':
      return `<g transform="${t}"><path d="M-9 2a9 9 0 0 1 18 0z" fill="${culoare}"/><path d="M-7.3 2a7.3 7.3 0 0 1 14.6 0z" fill="${nuanta(culoare, 0.55)}"/></g>`;
    case 'avocado':
      return `<g transform="${t}"><path d="M-10 2a10 8 0 0 1 20 0z" fill="#3F6B2A"/><path d="M-8.6 2a8.6 6.6 0 0 1 17.2 0z" fill="#C9DB7A"/>` +
        `<path d="M-5 2a5 3.6 0 0 1 10 0z" fill="#E4ECA0"/></g>`;
    case 'buchete':
      return `<g transform="${t}"><rect x="-1.5" y="1" width="3" height="6" rx="1" fill="${nuanta(culoare, 0.3)}"/>` +
        `<circle cx="-3" cy="-1" r="3.6" fill="${culoare}"/><circle cx="3" cy="-1" r="3.6" fill="${culoare}"/><circle cy="-4" r="3.8" fill="${culoare}"/>` +
        `<circle cx="-1" cy="-4" r="1.2" fill="${deschis}" opacity=".5"/></g>`;
    case 'frunze':
      return `<g transform="${t}"><path d="M-11 0q11 -9 22 0q-11 9 -22 0z" fill="${culoare}"/><path d="M-10 0h20" stroke="${deschis}" stroke-width=".9" opacity=".7"/></g>`;
    case 'fasii':
      return `<g transform="${t}"><path d="M-9 -2q9 -3 18 0M-8 1q8 -2 16 1M-7 4q7 -2 14 0" stroke="${culoare}" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
    case 'verdeata':
      return `<g transform="${t}"><path d="M0 0l2.2 -1.2l-.4 2.4z" fill="${culoare}"/></g>`;
    case 'ciuperci':
      return `<g transform="${t}"><path d="M-6 0a6 5 0 0 1 12 0z" fill="${culoare}"/><rect x="-1.6" y="-0.5" width="3.2" height="5" rx="1" fill="${nuanta(culoare, 0.3)}"/>` +
        `<path d="M-5 0h10" stroke="${inchis}" stroke-width=".8"/></g>`;
    case 'bete':
      return `<g transform="${t}"><rect x="-10" y="-1.6" width="20" height="3.2" rx="1.6" fill="${culoare}"/><circle cx="9" r="1.6" fill="${inchis}"/></g>`;
    case 'tofu':
      return `<g transform="${t}"><rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" fill="${culoare}"/><rect x="-4.5" y="1.5" width="9" height="3" rx="1" fill="#C99A55" opacity=".55"/></g>`;
    case 'cartof':
      return `<g transform="${t}"><path d="M-7 3l4 -8l10 2l-2 7z" fill="${culoare}"/><path d="M-3 -5l10 2" stroke="${nuanta(culoare, -0.35)}" stroke-width="1.5"/></g>`;
    case 'nuci':
      return `<g transform="${t}"><ellipse rx="4" ry="2.8" fill="${culoare}"/><path d="M-2.5 -0.5q2.5 1 5 0" stroke="${inchis}" stroke-width=".8" fill="none"/></g>`;
    case 'seminte':
      return `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="${n1(1.3 * s)}" ry="${n1(0.8 * s)}" fill="${culoare}" transform="rotate(${rot} ${n1(x)} ${n1(y)})"/>`;
    case 'ras':
      return `<path d="M${n1(x)} ${n1(y)}l${n1(3 * s)} ${n1(1 * s)}" stroke="${culoare}" stroke-width="1.1" stroke-linecap="round"/>`;
    case 'stropi':
      return `<path d="M${n1(x - 10)} ${n1(y)}q5 -4 10 0t10 0" stroke="${culoare}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>`;
    case 'ciocolata':
      return `<g transform="${t}"><rect x="-2.8" y="-2.8" width="5.6" height="5.6" rx=".8" fill="${culoare}"/><path d="M-2.4 -2h4.8" stroke="${deschis}" stroke-width=".7" opacity=".5"/></g>`;
    case 'paste':
      return `<g transform="${t}"><rect x="-6" y="-2" width="12" height="4" rx="2" fill="${culoare}"/><path d="M-4 -2v4M0 -2v4M4 -2v4" stroke="${inchis}" stroke-width=".6" opacity=".5"/></g>`;
    case 'popcorn':
      return `<g transform="${t}"><circle r="3" fill="${culoare}"/><circle cx="2.5" cy="1" r="2.4" fill="${culoare}"/><circle cx="-2" cy="1.8" r="2.2" fill="${nuanta(culoare, -0.05)}"/><circle cx="0.5" cy="1" r=".8" fill="#E8C15A"/></g>`;
    case 'biscuiti':
      return `<g transform="${t}"><rect x="-7" y="-7" width="14" height="14" rx="2" fill="${culoare}"/><circle cx="-3" cy="-3" r=".8" fill="${inchis}"/><circle cx="3" cy="-3" r=".8" fill="${inchis}"/><circle cx="-3" cy="3" r=".8" fill="${inchis}"/><circle cx="3" cy="3" r=".8" fill="${inchis}"/></g>`;
    case 'rondele-orez':
      return `<g transform="${t}"><circle r="11" fill="${culoare}"/><circle r="11" fill="none" stroke="${nuanta(culoare, -0.15)}" stroke-width="1.2"/>` +
        `<circle cx="-4" cy="-3" r="1" fill="${nuanta(culoare, -0.12)}"/><circle cx="3" cy="-5" r="1" fill="${nuanta(culoare, -0.12)}"/><circle cx="4" cy="3" r="1" fill="${nuanta(culoare, -0.12)}"/><circle cx="-3" cy="5" r="1" fill="${nuanta(culoare, -0.12)}"/></g>`;
    default:
      return `<g transform="${t}"><circle r="3" fill="${culoare}"/></g>`;
  }
}

// Câte bucăți se desenează pentru un ingredient, după aspect și cât din farfurie ocupă.
function numarBucati(aspect, pondere) {
  const baza = {
    carne: 4, tocata: 9, mezel: 4, peste: 2, fulgi: 9, creveti: 6, ou: 2, branza: 7, granule: 12, cuburi: 10,
    'bile-mari': 6, bile: 12, 'bile-mici': 18, rondele: 6, felii: 4, avocado: 3, buchete: 6, frunze: 7, fasii: 6,
    verdeata: 16, ciuperci: 6, bete: 5, tofu: 7, cartof: 7, nuci: 7, seminte: 22, ras: 18, stropi: 2, ciocolata: 7,
    paste: 12, popcorn: 10, biscuiti: 2, 'rondele-orez': 2,
  }[aspect] || 6;
  return Math.max(aspect === 'stropi' ? 1 : 2, Math.round(baza * (0.55 + pondere * 1.6)));
}

// Ingredientele vizibile ale rețetei, cu ponderea lor (rădăcina cantității, ca ingredientele mici să se vadă).
function ingredienteVizibile(reteta, idx, max = 7) {
  const vazute = new Map();
  for (const [id, g] of reteta.ingrediente || []) {
    const a = idx.get(id);
    if (!a || a.aspect === 'invizibil' || !(g > 0)) continue;
    const prec = vazute.get(id);
    vazute.set(id, { a, g: (prec ? prec.g : 0) + g });
  }
  const lista = [...vazute.values()].sort((x, y) => y.g - x.g).slice(0, max);
  const s = lista.reduce((t, x) => t + Math.sqrt(x.g), 0) || 1;
  return lista.map(x => ({ ...x.a, grame: x.g, pondere: Math.sqrt(x.g) / s }));
}

// Puncte aleatoare într-un sector de cerc (pentru bucățile unui ingredient).
function punctInSector(cx, cy, R, a0, a1, rnd, rMin = 0.12) {
  const u = rMin + (1 - rMin) * Math.sqrt(rnd());
  const a = a0 + (a1 - a0) * (0.08 + 0.84 * rnd());
  return [cx + Math.cos(a) * R * u, cy + Math.sin(a) * R * u * 0.94];
}

// Baza unei zone (ex. orezul de pe o parte a farfuriei): un nor de cercuri suprapuse în sector.
function petaBaza(a, cx, cy, R, a0, a1, rnd) {
  let s = '';
  const c = a.culoare;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const [x, y] = punctInSector(cx, cy, R * 0.82, a0, a1, rnd, 0.05);
    s += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(R * (0.2 + rnd() * 0.12))}" fill="${c}"/>`;
  }
  s += texturaBaza(a, cx, cy, R * 0.8, a0, a1, rnd);
  return s;
}

function texturaBaza(a, cx, cy, R, a0, a1, rnd) {
  let s = '';
  const c = a.culoare;
  if (a.aspect === 'boabe') {
    for (let i = 0; i < 40; i++) {
      const [x, y] = punctInSector(cx, cy, R, a0, a1, rnd, 0.02);
      s += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="1.8" ry=".9" fill="${nuanta(c, i % 2 ? 0.35 : -0.08)}" transform="rotate(${Math.round(rnd() * 180)} ${n1(x)} ${n1(y)})"/>`;
    }
  } else if (a.aspect === 'fulgi-ovaz') {
    for (let i = 0; i < 30; i++) {
      const [x, y] = punctInSector(cx, cy, R, a0, a1, rnd, 0.02);
      s += `<ellipse cx="${n1(x)}" cy="${n1(y)}" rx="2.4" ry="1.6" fill="${nuanta(c, i % 2 ? 0.25 : -0.12)}"/>`;
    }
  } else if (a.aspect === 'paste') {
    for (let i = 0; i < 16; i++) {
      const [x, y] = punctInSector(cx, cy, R, a0, a1, rnd, 0.05);
      s += bucata('paste', c, x, y, rnd, 0.9);
    }
  } else if (a.aspect === 'granule') {
    for (let i = 0; i < 16; i++) {
      const [x, y] = punctInSector(cx, cy, R, a0, a1, rnd, 0.02);
      s += bucata('granule', nuanta(c, 0.1), x, y, rnd, 0.8);
    }
  } else if (a.aspect === 'crema' || a.aspect === 'mamaliga' || a.aspect === 'omleta') {
    const [x, y] = punctInSector(cx, cy, R * 0.5, a0, a1, rnd, 0.1);
    s += `<path d="M${n1(x - 8)} ${n1(y)}q8 -6 16 0" stroke="${nuanta(c, 0.4)}" stroke-width="2" fill="none" opacity=".7"/>`;
  }
  return s;
}

function aranjeazaInCerc(lista, cx, cy, R, rnd, { cuBaza }) {
  let fundal = '', mari = '', mici = '';
  const start = rnd() * Math.PI * 2;
  let a = start;
  for (const ing of lista) {
    const a0 = a, a1 = a + ing.pondere * Math.PI * 2;
    a = a1;
    if (ASPECTE_BAZA.includes(ing.aspect)) {
      if (cuBaza) fundal += petaBaza(ing, cx, cy, R, a0, a1, rnd);
      else fundal += texturaBaza(ing, cx, cy, R, a0, a1, rnd);
      continue;
    }
    if (ing.aspect === 'pudra' || ing.aspect === 'lichid') continue;
    const n = numarBucati(ing.aspect, ing.pondere);
    const presarat = ASPECTE_PRESARATE.includes(ing.aspect);
    // Ce se presară se împrăștie pe toată farfuria, nu doar în sectorul lui.
    const [b0, b1] = presarat ? [0, Math.PI * 2] : [a0, a1];
    for (let i = 0; i < n; i++) {
      const [x, y] = punctInSector(cx, cy, R * (presarat ? 0.85 : 0.82), b0, b1, rnd);
      const s = 1.05 + rnd() * 0.3;
      if (presarat) mici += bucata(ing.aspect, ing.culoare, x, y, rnd, s);
      else mari += bucata(ing.aspect, ing.culoare, x, y, rnd, s);
    }
  }
  return fundal + mari + mici;
}

function fundalIlustratie(rnd) {
  const nuante = ['#1E2530', '#20262E', '#232A2A', '#262329'];
  const c = nuante[Math.floor(rnd() * nuante.length)];
  return `<defs><radialGradient id="f" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${nuanta(c, 0.08)}"/><stop offset="1" stop-color="${nuanta(c, -0.35)}"/></radialGradient>` +
    `<radialGradient id="u" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${LATIME_IL}" height="${INALTIME_IL}" fill="url(#f)"/>`;
}

function luminozitate(hex) {
  const [r, g, b] = hexInRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// Mâncarea deschisă la culoare (iaurt, ouă, brânză) se pune pe o farfurie închisă, ca să se vadă.
function mancareDeschisa(lista) {
  const s = lista.reduce((t, i) => t + i.pondere, 0) || 1;
  const medie = lista.reduce((t, i) => t + luminozitate(i.culoare) * i.pondere, 0) / s;
  return medie > 0.68 || lista.some(i => i.pondere > 0.22 && luminozitate(i.culoare) > 0.82);
}

function desenFarfurie(lista, rnd) {
  const cx = 80, cy = 61;
  const inchisa = mancareDeschisa(lista);
  const [margine, interior, linie] = inchisa ? ['#3A404A', '#2C313A', '#4A515C'] : ['#E9E6DF', '#F4F2ED', '#D6D2C9'];
  return `<ellipse cx="${cx + 3}" cy="${cy + 5}" rx="56" ry="52" fill="url(#u)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="52" fill="${margine}"/><circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="#fff" stroke-opacity="${inchisa ? 0.12 : 0.5}" stroke-width="1"/>` +
    `<circle cx="${cx}" cy="${cy}" r="41" fill="${interior}"/><circle cx="${cx}" cy="${cy}" r="41" fill="none" stroke="${linie}" stroke-width="1.2"/>` +
    aranjeazaInCerc(lista, cx, cy, 39, rnd, { cuBaza: true });
}

function desenBol(lista, rnd) {
  const cx = 80, cy = 60;
  const culoriBol = ['#C8664A', '#5E7F8C', '#7A8A5A', '#E2DCCF', '#3E4A61'];
  const cb = culoriBol[Math.floor(rnd() * culoriBol.length)];
  const baze = lista.filter(i => ASPECTE_BAZA.includes(i.aspect));
  const pudre = lista.filter(i => i.aspect === 'pudra');
  const restul = lista.filter(i => !ASPECTE_BAZA.includes(i.aspect) && i.aspect !== 'pudra');
  let interior;
  if (baze.length) {
    // Baza (iaurt, supă, terci…) umple bolul; culoarea e amestecul bazelor (cacaua o colorează).
    const culoare = amestecCulori([...baze, ...pudre].map(b => [b.culoare, b.grame * (b.aspect === 'pudra' ? 3 : 1)]));
    interior = `<circle cx="${cx}" cy="${cy}" r="40" fill="${culoare}"/>` +
      `<circle cx="${cx - 8}" cy="${cy - 10}" r="22" fill="#fff" opacity=".08"/>`;
    for (const b of baze) {
      const c = b === baze[0] ? culoare : b.culoare;
      interior += texturaBaza({ ...b, culoare: c }, cx, cy, 36, 0, Math.PI * 2, rnd);
    }
    const s = restul.reduce((t, x) => t + x.pondere, 0) || 1;
    interior += aranjeazaInCerc(restul.map(x => ({ ...x, pondere: x.pondere / s })), cx, cy, 33, rnd, { cuBaza: false });
  } else {
    interior = `<circle cx="${cx}" cy="${cy}" r="40" fill="${nuanta(cb, -0.45)}"/>` + aranjeazaInCerc(lista, cx, cy, 37, rnd, { cuBaza: true });
  }
  return `<ellipse cx="${cx + 3}" cy="${cy + 6}" rx="54" ry="50" fill="url(#u)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="48" fill="${cb}"/><circle cx="${cx}" cy="${cy}" r="48" fill="none" stroke="${nuanta(cb, 0.3)}" stroke-width="1.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="42" fill="${nuanta(cb, -0.25)}"/>` + interior;
}

function desenPahar(lista, rnd) {
  const lichide = lista.filter(i => ['lichid', 'crema', 'pudra', 'bile', 'bile-mari', 'rondele', 'cuburi', 'felii', 'frunze', 'fulgi-ovaz', 'crema'].includes(i.aspect));
  const culoare = amestecCulori((lichide.length ? lichide : lista).map(i => [i.culoare, i.grame * (i.aspect === 'pudra' ? 3 : 1)]));
  const fructe = lista.find(i => ['rondele', 'felii', 'bile-mari', 'bile'].includes(i.aspect));
  let s = `<ellipse cx="82" cy="108" rx="30" ry="6" fill="#000" opacity=".35"/>` +
    `<path d="M58 22h44l-5 84q-.4 4 -4 4h-26q-3.6 0 -4 -4z" fill="#fff" fill-opacity=".09" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>` +
    `<path d="M60.3 36h39.4l-4.2 68.5q-.3 3 -3 3h-25q-2.7 0 -3 -3z" fill="${culoare}"/>` +
    `<path d="M60.3 36h39.4l-.4 6h-38.6z" fill="${nuanta(culoare, 0.35)}"/>` +
    `<path d="M65 40l3 62" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M88 30l12 -20" stroke="#E9E6DF" stroke-width="3.5" stroke-linecap="round"/><path d="M88 30l12 -20" stroke="#B7F34A" stroke-width="1.2" stroke-dasharray="3 3"/>`;
  if (fructe) s += bucata(fructe.aspect === 'bile' ? 'bile-mari' : fructe.aspect, fructe.culoare, 60, 24, rnd, 1.3);
  return s;
}

function desenBorcan(lista, rnd) {
  const baze = lista.filter(i => ['crema', 'lichid', 'fulgi-ovaz', 'seminte', 'boabe', 'granule'].includes(i.aspect));
  const topping = lista.filter(i => !baze.includes(i));
  let s = `<ellipse cx="80" cy="108" rx="34" ry="6" fill="#000" opacity=".35"/>`;
  const sus = 34, jos = 104;
  const straturi = baze.length ? baze : lista.slice(0, 1);
  const totalG = straturi.reduce((t, x) => t + x.grame, 0) || 1;
  let y = jos;
  const inaltimeBaza = (jos - sus) * (topping.length ? 0.72 : 0.9);
  for (const st of straturi) {
    const h = inaltimeBaza * st.grame / totalG;
    s += `<rect x="54" y="${n1(y - h)}" width="52" height="${n1(h)}" fill="${st.culoare}"/>`;
    if (st.aspect === 'seminte' || st.aspect === 'fulgi-ovaz') {
      for (let i = 0; i < 18; i++) s += `<circle cx="${n1(56 + rnd() * 48)}" cy="${n1(y - rnd() * h)}" r="${st.aspect === 'seminte' ? 0.9 : 1.5}" fill="${nuanta(st.culoare, st.aspect === 'seminte' ? -0.5 : -0.15)}"/>`;
    }
    y -= h;
  }
  for (const t of topping) {
    const n = Math.min(7, numarBucati(t.aspect, t.pondere));
    for (let i = 0; i < n; i++) s += bucata(t.aspect, t.culoare, 60 + rnd() * 40, y - 4 - rnd() * 10, rnd, 0.9);
  }
  s += `<path d="M52 30h56v72q0 6 -6 6h-44q-6 0 -6 -6z" fill="#fff" fill-opacity=".07" stroke="#fff" stroke-opacity=".4" stroke-width="1.4"/>` +
    `<rect x="50" y="20" width="60" height="11" rx="3" fill="#B98A4E"/><rect x="50" y="20" width="60" height="3" rx="1.5" fill="#D9AE72"/>` +
    `<path d="M58 36v62" stroke="#fff" stroke-opacity=".2" stroke-width="3" stroke-linecap="round"/>`;
  return s;
}

function desenTocator(lista, rnd) {
  let s = `<rect x="16" y="26" width="128" height="78" rx="12" fill="#000" opacity=".3" transform="translate(3 4)"/>` +
    `<rect x="16" y="26" width="128" height="78" rx="12" fill="#A9784A"/>` +
    `<path d="M24 44h112M22 64h116M24 86h112" stroke="#8E6038" stroke-width="1" opacity=".5"/>` +
    `<rect x="16" y="26" width="128" height="78" rx="12" fill="none" stroke="#C49466" stroke-width="1.5"/>`;
  const baza = lista.find(i => ['paine', 'rondele-orez', 'biscuiti', 'tortilla'].includes(i.aspect));
  const toppinguri = lista.filter(i => i !== baza);
  if (baza && baza.aspect === 'tortilla') {
    // Wrap tăiat în două: secțiunea arată straturile umpluturii.
    const culori = toppinguri.slice(0, 4).map(t => t.culoare);
    for (const [cx, cy] of [[60, 66], [102, 62]]) {
      s += `<circle cx="${cx}" cy="${cy}" r="21" fill="${nuanta(baza.culoare, -0.1)}"/><circle cx="${cx}" cy="${cy}" r="19" fill="${baza.culoare}"/>`;
      culori.forEach((c, i) => { s += `<circle cx="${cx + (i % 2 ? 1 : -1)}" cy="${cy}" r="${n1(16 - i * 3.6)}" fill="${c}"/>`; });
      s += `<circle cx="${cx}" cy="${cy}" r="3" fill="${baza.culoare}"/>`;
    }
    return s;
  }
  // Felii de pâine / rondele / biscuiți, cu ingredientele puse pe ele.
  const nrFelii = baza ? Math.max(1, Math.min(3, Math.round(baza.grame / (baza.buc ? baza.buc[0] : baza.aspect === 'biscuiti' ? 8 : 30)))) : 0;
  const pozitii = nrFelii === 1 ? [[80, 65]] : nrFelii === 2 ? [[58, 65], [104, 65]] : [[46, 65], [80, 65], [114, 65]];
  const centre = [];
  for (const [x, y] of pozitii.slice(0, nrFelii)) {
    if (baza.aspect === 'paine') {
      const felie = (dx, d) => `M${x - 19 + dx} ${y + 19 - d}v-20q-6 -2 -5 -9q2 -9 13 -8q6 -6 11 -6t11 6q11 -1 13 8q1 7 -5 9v20z`;
      s += `<path d="${felie(0, 0)}" fill="${nuanta(baza.culoare, -0.32)}"/>` +
        `<path d="${felie(0, 0)}" fill="${nuanta(baza.culoare, 0.42)}" transform="translate(${x} ${y}) scale(.84) translate(${-x} ${-y})"/>`;
    } else s += bucata(baza.aspect, baza.culoare, x, y, () => 0, baza.aspect === 'rondele-orez' ? 1.5 : 2.1);
    centre.push([x, y]);
  }
  if (!centre.length) {
    // Fără pâine sau lipie (ex. batoane): bucăți dreptunghiulare din amestecul ingredientelor.
    const c = amestecCulori(lista.map(i => [i.culoare, i.grame]));
    for (const [x, y] of [[50, 54], [80, 70], [110, 54]]) {
      s += `<g transform="rotate(${Math.round((rnd() - 0.5) * 24)} ${x} ${y})"><rect x="${x - 13}" y="${y - 20}" width="26" height="40" rx="4" fill="${nuanta(c, -0.2)}"/>` +
        `<rect x="${x - 11}" y="${y - 18}" width="22" height="36" rx="3" fill="${c}"/></g>`;
      centre.push([x, y]);
    }
  }
  let mari = '', mici = '';
  for (const t of toppinguri) {
    const n = Math.max(1, Math.round(numarBucati(t.aspect, t.pondere) * 0.6));
    for (let i = 0; i < n; i++) {
      const [x, y] = centre[i % centre.length];
      const px = x + (rnd() - 0.5) * 22, py = y + (rnd() - 0.5) * 22;
      if (ASPECTE_PRESARATE.includes(t.aspect)) mici += bucata(t.aspect, t.culoare, px, py, rnd, 0.9);
      else if (ASPECTE_BAZA.includes(t.aspect)) mari = `<circle cx="${n1(x)}" cy="${n1(y)}" r="13" fill="${t.culoare}" opacity=".95"/>` + mari;
      else mari += bucata(t.aspect, t.culoare, px, py, rnd, 0.85);
    }
  }
  return s + mari + mici;
}

// Textul SVG complet al ilustrației unei rețete.
function svgReteta(reteta, idx) {
  const rnd = generatorAleator(hashText(String(reteta.id || reteta.nume || '') + (reteta.ingrediente || []).map(x => x[0]).join(',')));
  const lista = ingredienteVizibile(reteta, idx);
  const vas = reteta.vas || 'farfurie';
  let corp;
  if (vas === 'bol') corp = desenBol(lista, rnd);
  else if (vas === 'pahar') corp = desenPahar(lista, rnd);
  else if (vas === 'borcan') corp = desenBorcan(lista, rnd);
  else if (vas === 'tocator') corp = desenTocator(lista, rnd);
  else corp = desenFarfurie(lista, rnd);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LATIME_IL} ${INALTIME_IL}">${fundalIlustratie(rnd)}${corp}</svg>`;
}

// Pentru <img src>: ID-urile din SVG rămân izolate în fiecare imagine.
const _cacheIlustratii = new Map();
function urlIlustratieReteta(reteta, idx) {
  const cheie = `${reteta.id}|${reteta.vas}|${JSON.stringify(reteta.ingrediente)}`;
  let url = _cacheIlustratii.get(cheie);
  if (!url) {
    url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgReteta(reteta, idx));
    if (_cacheIlustratii.size > 400) _cacheIlustratii.clear();
    _cacheIlustratii.set(cheie, url);
  }
  return url;
}

if (typeof module !== 'undefined') {
  module.exports = { svgReteta, urlIlustratieReteta, ingredienteVizibile, nuanta, amestecCulori, hashText };
}
