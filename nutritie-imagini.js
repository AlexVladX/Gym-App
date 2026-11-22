// Imaginile rețetelor: fotografia rețetei (din bibliotecă sau a ta) și imaginea de rezervă.
// Ordinea: 1) poza ta pentru rețetă (pozeRetete), 2) fotografia din bibliotecă (reteta.foto),
// 3) imaginea de rezervă, aceeași pentru toate (diferă doar numele mesei), niciodată o fotografie a altui fel de mâncare.
// Funcțiile de aici nu ating pagina (testabile în Node); folosirea lor e în nutritie.js.

const FOTO_LATIME = 800, FOTO_INALTIME = 600;
const FOTO_RE = /^foto-retete\/[a-z0-9-]+\.webp$/;

// Fotografia din bibliotecă a unei rețete, dacă are una validă; altfel null.
function fotoReteta(r) {
  const f = r && r.foto;
  if (!f || typeof f.fisier !== 'string' || !FOTO_RE.test(f.fisier)) return null;
  return f;
}

// Textul scurt al atribuirii, ex. „Foto: Polina Tankilevitch / Pexels”.
function textAtribuire(f) {
  if (!f) return '';
  return f.autor ? `Foto: ${f.autor} / ${f.furnizor || 'Pexels'}` : `Foto: ${f.furnizor || 'Pexels'}`;
}

// Imaginea de rezervă: un fundal închis cu o farfurie și tacâmuri desenate din linii subțiri și numele mesei.
const _cacheRezerva = new Map();
function urlImagineRezerva(numeMasa = '') {
  if (_cacheRezerva.has(numeMasa)) return _cacheRezerva.get(numeMasa);
  const text = String(numeMasa).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">` +
    `<defs><radialGradient id="g" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#FBF3EC"/><stop offset="1" stop-color="#EEDFD1"/></radialGradient></defs>` +
    `<rect width="160" height="120" fill="url(#g)"/>` +
    `<g fill="none" stroke="#D15612" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round">` +
    `<circle cx="80" cy="52" r="22"/><circle cx="80" cy="52" r="15" stroke-opacity=".3"/>` +
    `<path d="M47 36v12a3 3 0 0 0 6 0V36M50 48v20"/><path d="M110 36c-4 4-4 14 0 16v16"/></g>` +
    (text ? `<text x="80" y="98" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" letter-spacing="1.5" fill="#8C6A52">${text.toUpperCase()}</text>` : '') +
    `</svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  _cacheRezerva.set(numeMasa, url);
  return url;
}

if (typeof module !== 'undefined') {
  module.exports = { fotoReteta, textAtribuire, urlImagineRezerva, FOTO_LATIME, FOTO_INALTIME, FOTO_RE };
}
