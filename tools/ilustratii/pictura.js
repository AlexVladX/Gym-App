// „Pictura": colecția de definiții (degradeuri, decupaje) a unui fișier SVG și materialele comune.
// Degradeurile cilindrice (umbrirea de-a lungul unui os) folosesc un șablon de culori comun,
// referit cu href, ca fișierele să rămână mici.
'use strict';
const { f, P } = require('./geom');

// Lumina vine de sus-stânga.
const LUMINA = [-0.55, -0.83];

const TONURI = {
  piele: [[0, '#A0A9B4'], [0.22, '#7A838E'], [0.62, '#4E555F'], [1, '#2B2F35']],
  pieleDep: [[0, '#717984'], [0.35, '#525963'], [1, '#26292E']],
  p: [[0, '#F2FFC8'], [0.25, '#CDF760'], [0.7, '#91C82C'], [1, '#5A8714']],
  s: [[0, '#BFD794'], [0.35, '#93B356'], [1, '#4B6A20']],
  pd: [[0, '#CBEE80'], [0.4, '#94C43B'], [1, '#4A7012']],
  sd: [[0, '#9CB377'], [0.4, '#6E8B40'], [1, '#384F19']],
  par: [[0, '#4A5059'], [1, '#1E2126']],
  pantof: [[0, '#5B626C'], [0.5, '#353A41'], [1, '#1C1F23']],
  metal: [[0, '#E3E7EC'], [0.35, '#A9B0B9'], [1, '#4A5059']],
  disc: [[0, '#5A616B'], [0.5, '#363B42'], [1, '#1B1E22']],
  tapiterie: [[0, '#4E5560'], [0.5, '#353B43'], [1, '#22262B']],
  cadru: [[0, '#6E7682'], [0.5, '#4A515B'], [1, '#2C3036']],
};

class Pictura {
  constructor(prefix = '') {
    this.px = prefix;
    this.n = 0;
    this.defs = [];
    this.sabloane = new Set();
  }
  id() { return `${this.px}g${(this.n++).toString(36)}`; }
  sablon(nume) {
    if (!this.sabloane.has(nume)) {
      this.sabloane.add(nume);
      this.defs.unshift(`<linearGradient id="T${this.px}${nume}">${TONURI[nume].map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`);
    }
    return `T${this.px}${nume}`;
  }
  // Degrade liniar între două puncte (în coordonatele desenului), cu culorile unui șablon.
  degrade(a, b, ton) {
    const id = this.id();
    this.defs.push(`<linearGradient id="${id}" href="#${this.sablon(ton)}" gradientUnits="userSpaceOnUse" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/>`);
    return `url(#${id})`;
  }
  // Umbrire cilindrică peste un os: de la partea luminată la cea din umbră.
  cilindru(cad, w, ton, t = 0.5) {
    let a = cad.p(t, -w), b = cad.p(t, w);
    if ((b[0] - a[0]) * LUMINA[0] + (b[1] - a[1]) * LUMINA[1] > 0) [a, b] = [b, a];
    return this.degrade(a, b, ton);
  }
  // Degrade pe direcția luminii, peste un dreptunghi (obiecte fără os).
  lumina(c, r, ton) {
    return this.degrade([c[0] + LUMINA[0] * r, c[1] + LUMINA[1] * r], [c[0] - LUMINA[0] * r, c[1] - LUMINA[1] * r], ton);
  }
  vertical(y0, y1, ton, x = 0) { return this.degrade([x, y0], [x, y1], ton); }
  decupaj(d) {
    const id = this.id();
    this.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
    return `url(#${id})`;
  }
  // Formă refolosită (conturul luminos, umplerea și decupajul o referă cu <use>).
  forma(d) {
    const id = this.id();
    this.defs.push(`<path id="${id}" d="${d}"/>`);
    return id;
  }
  decupajUse(id) {
    const c = this.id();
    this.defs.push(`<clipPath id="${c}"><use href="#${id}"/></clipPath>`);
    return `url(#${c})`;
  }
  text() { return `<defs>${this.defs.join('')}</defs>`; }
}

module.exports = { Pictura, TONURI, LUMINA, f, P };
