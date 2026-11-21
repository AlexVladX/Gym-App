// Siguranța datelor (etapa 8): „Șterse recent" cu anulare, verificarea datelor, export CSV, trimiterea fișierelor
// prin meniul de partajare al telefonului, memento pentru backup și avertizarea când aplicația e deschisă în două file.
// Partea fără DOM (CSV, memento) e testată în Node (tests/siguranta.test.js).

// ---------- CSV ----------
// Separator „;" și virgulă zecimală, ca Excel în limba română să deschidă fișierul direct; UTF-8 cu BOM.
function celulaCsv(v) {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '';
  const t = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v);
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function randCsv(valori) { return valori.map(celulaCsv).join(';'); }
const TIP_SERIE_TEXT = { normal: 'normală', incalzire: 'încălzire', drop: 'drop', esec: 'până la eșec' };

// Antrenamentele: un rând pe serie. Volumul după regulile aplicației (vezi volumSerie).
function csvAntrenamente(sesiuni, grupaDe = () => '') {
  const rand = [randCsv(['Data', 'Antrenament', 'Exercițiu', 'Grupă', 'Serie', 'Tip serie', 'Kg', 'Repetări', 'Secunde', 'Metri', 'Volum (kg)', 'Supraset', 'Notă antrenament'])];
  const sortate = [...sesiuni].sort((a, b) => a.data.localeCompare(b.data) || (a.inceput || 0) - (b.inceput || 0));
  sortate.forEach((s, i) => {
    for (const ex of s.exercitii || []) {
      if (!ex || !Array.isArray(ex.serii)) continue;
      ex.serii.forEach((se, j) => {
        if (!serieValida(se)) return;
        rand.push(randCsv([s.data, i + 1, ex.nume, grupaDe(ex.nume) || '', j + 1, TIP_SERIE_TEXT[tipSerie(se)] || 'normală',
          se.kg, se.repetari || null, se.durataSec || null, se.distantaM || null, volumSerie(se, ex, s.data, s), ex.supraset || '', s.nota || '']));
      });
    }
  });
  return '﻿' + rand.join('\r\n') + '\r\n';
}

function csvMasuratori(masuratori) {
  const rand = [randCsv(['Data', 'Tip', 'Valoare', 'Unitate'])];
  for (const m of [...masuratori].sort((a, b) => a.data.localeCompare(b.data) || a.tip.localeCompare(b.tip, 'ro'))) {
    rand.push(randCsv([m.data, m.tip, m.valoare, unitateTip(m.tip)]));
  }
  return '﻿' + rand.join('\r\n') + '\r\n';
}

// ---------- Memento pentru backup ----------
// Apare pe Acasă dacă ai cel puțin 3 antrenamente și nu ai exportat niciodată sau ultimul export are 14+ zile.
const ZILE_MEMENTO_BACKUP = 14;
function trebuieMementoBackup(ultimExportIso, numarSesiuni, acum = Date.now()) {
  if (numarSesiuni < 3) return null;
  if (!ultimExportIso || !Number.isFinite(Date.parse(ultimExportIso))) return { niciodata: true, zile: null };
  const zile = Math.floor((acum - Date.parse(ultimExportIso)) / 86400000);
  return zile >= ZILE_MEMENTO_BACKUP ? { niciodata: false, zile } : null;
}

if (typeof module !== 'undefined') {
  module.exports = { celulaCsv, csvAntrenamente, csvMasuratori, trebuieMementoBackup, ZILE_MEMENTO_BACKUP };
}

// ====================== În pagină ======================
const NUME_TIP_COS = { sesiuni: 'Antrenament', masuratori: 'Măsurătoare', poze: 'Poză', rutine: 'Rutină',
  alimente: 'Aliment', retete: 'Rețetă', pozeRetete: 'Poză de rețetă' };

// După o ștergere: mesaj cu „Anulează" care pune înregistrarea înapoi.
function notificaStergere(text, idCos, dupaRestaurare) {
  if (idCos === null || idCos === undefined) { notifica(text, 'succes'); return; }
  notifica(`${text} O găsești 30 de zile în Setări → Șterse recent.`, 'succes', 8000, {
    text: 'Anulează',
    onclick: async () => {
      try {
        await restaureazaDinCos(idCos);
      } catch (err) {
        console.error(err);
        notifica('Nu am putut anula ștergerea. Încearcă din Setări → Șterse recent.', 'eroare');
        return;
      }
      await dupaRestaurare();
      deseneazaCos().catch(() => {});
      notifica('Ștergerea a fost anulată.', 'succes');
    },
  });
}

// Reîncarcă ecranele afectate de restaurarea unui element din coș.
async function dupaRestaurareDinCos(tip) {
  if (tip === 'sesiuni') {
    await reincarcaIstoric();
    if (typeof randeazaIstoric === 'function' && !$('progres-istoric').hidden) randeazaIstoric();
    deseneazaExercitii();
  } else if (tip === 'masuratori') await reincarcaMasuratori();
  else if (tip === 'poze') await reincarcaPoze();
  else if (tip === 'rutine') randeazaBiblioteca();
  else if (tip === 'alimente' || tip === 'retete' || tip === 'pozeRetete') await reincarcaNutritie();
}

function descriereElementCos(x) {
  const r = x.inregistrare;
  if (x.eticheta) return x.eticheta;
  if (x.tip === 'sesiuni') return `din ${afiseazaData(r.data)}`;
  if (x.tip === 'masuratori') return `${r.tip}: ${formatNumar(r.valoare)} ${unitateTip(r.tip)}, ${afiseazaData(r.data)}`;
  if (x.tip === 'poze') return `din ${afiseazaData(r.data)}`;
  return r.nume || '';
}

async function deseneazaCos() {
  const cont = $('cos-lista');
  if (!cont) return;
  let lista;
  try {
    lista = await toateDinCos();
  } catch (err) {
    console.error(err);
    cont.replaceChildren(el('p', { class: 'nota', text: 'Lista nu a putut fi citită.' }));
    return;
  }
  if (!lista.length) {
    cont.replaceChildren(el('p', { class: 'nota', text: 'Nimic șters recent. Ce ștergi rămâne aici 30 de zile, apoi dispare definitiv.' }));
    return;
  }
  cont.replaceChildren(...lista.map(x => {
    const zileRamase = Math.max(0, ZILE_IN_COS - Math.floor((Date.now() - x.sters) / 86400000));
    return el('div', { class: 'rand-lista rand-cos' }, [
      el('div', { class: 'rand-lista-text' }, [
        el('strong', { text: `${NUME_TIP_COS[x.tip]} ${descriereElementCos(x)}` }),
        el('span', { class: 'nota', text: `șters ${formatDataOra(x.sters)} · ${plural(zileRamase, 'zi rămasă', 'zile rămase')}` }),
      ]),
      buton({ icon: 'istoric', tip: 'fantoma', eticheta: `Restaurează: ${NUME_TIP_COS[x.tip]} ${descriereElementCos(x)}`, onclick: async () => {
        try { await restaureazaDinCos(x.id); } catch (err) { console.error(err); notifica(mesajEroareSalvare(err, 'Nu s-a putut restaura.'), 'eroare'); return; }
        await dupaRestaurareDinCos(x.tip);
        await deseneazaCos();
        notifica(`${NUME_TIP_COS[x.tip]} restaurat${['masuratori', 'poze', 'rutine', 'retete', 'pozeRetete'].includes(x.tip) ? 'ă' : ''}.`, 'succes');
      } }),
      buton({ icon: 'cos', tip: 'fantoma', eticheta: `Șterge definitiv: ${NUME_TIP_COS[x.tip]} ${descriereElementCos(x)}`, onclick: async () => {
        const da = await confirma({ titlu: 'Ștergi definitiv?', text: `${NUME_TIP_COS[x.tip]} ${descriereElementCos(x)} nu mai poate fi recuperat(ă) decât dintr-un backup.`, ok: 'Șterge definitiv', pericol: true });
        if (!da) return;
        try { await stergeDinCos(x.id); } catch (err) { console.error(err); notifica('Nu s-a putut șterge.', 'eroare'); return; }
        await deseneazaCos();
      } }),
    ]);
  }));
}

// ---------- Verificarea datelor ----------
async function verificaDatele() {
  const rez = $('verificare-rezultat');
  rez.replaceChildren(el('p', { class: 'nota', text: 'Se verifică…' }));
  let d;
  try {
    d = await diagnosticBaza();
  } catch (err) {
    console.error(err);
    rez.replaceChildren(el('p', { class: 'nota nota-avertizare', text: 'Baza de date nu a putut fi citită. Reîncarcă aplicația; dacă problema rămâne, restaurează un backup.' }));
    return;
  }
  const nume = { sesiuni: 'Antrenamente', masuratori: 'Măsurători', rutine: 'Rutine', exercitii: 'Exerciții folosite', poze: 'Poze',
    retete: 'Rețetele tale', alimente: 'Alimentele tale', pozeRetete: 'Poze de rețete', cos: 'Șterse recent' };
  const probleme = Object.entries(d).filter(([k, v]) => k !== 'cos' && v.total !== v.lizibile);
  rez.replaceChildren(
    el('div', { class: 'tabel-compara' }, Object.entries(nume).map(([k, n]) => el('div', { class: 'tabel-compara-rand verificare' }, [
      el('span', { text: n }),
      el('strong', { text: String(d[k].total) }),
      el('span', { class: d[k].total !== d[k].lizibile && k !== 'cos' ? 'text-avertizare' : 'nota', text: k === 'cos' ? '' : d[k].total === d[k].lizibile ? 'în regulă' : `${d[k].total - d[k].lizibile} deteriorate` }),
    ]))),
    el('p', { class: 'nota' + (probleme.length ? ' nota-avertizare' : ''), text: probleme.length
      ? 'Unele înregistrări sunt deteriorate și nu pot fi afișate. Nu le-am șters: rămân în baza de date și intră în backup, ca să poată fi recuperate.'
      : 'Toate înregistrările se citesc corect.' }),
  );
}

// ---------- Exporturi ----------
// Pe telefon, fișierul se trimite prin meniul de partajare (Fișiere, Drive, e-mail); altfel se descarcă.
// Întoarce 'partajat', 'descarcat' sau 'anulat'.
async function trimiteFisier(blob, nume) {
  const fisier = new File([blob], nume, { type: blob.type });
  const telefon = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (telefon && navigator.canShare && navigator.share) {
    let poate = false;
    try { poate = navigator.canShare({ files: [fisier] }); } catch (_) { poate = false; }
    if (poate) {
      try {
        await navigator.share({ files: [fisier], title: nume });
        return 'partajat';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'anulat';
        console.warn('Partajarea a eșuat, descărcăm fișierul', err);
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nume });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'descarcat';
}

async function exportaCsv(tip) {
  try {
    if (tip === 'antrenamente') {
      await reincarcaIstoric();
      if (!istoric.length) { notifica('Nu ai antrenamente de exportat.', 'info'); return; }
      const r = await trimiteFisier(new Blob([csvAntrenamente(istoric, grupaExercitiu)], { type: 'text/csv' }), `jurnal-antrenamente-${dataLocala()}.csv`);
      if (r !== 'anulat') notifica('Tabelul cu antrenamente a fost exportat (se deschide în Excel sau Google Sheets).', 'succes');
    } else {
      const m = await toateMasuratorile();
      if (!m.length) { notifica('Nu ai măsurători de exportat.', 'info'); return; }
      const r = await trimiteFisier(new Blob([csvMasuratori(m)], { type: 'text/csv' }), `jurnal-masuratori-${dataLocala()}.csv`);
      if (r !== 'anulat') notifica('Tabelul cu măsurători a fost exportat.', 'succes');
    }
  } catch (err) {
    console.error(err);
    notifica('Exportul a eșuat. Datele nu au fost modificate.', 'eroare');
  }
}

// ---------- Memento pe Acasă ----------
function cardMementoBackup(sesiuni) {
  let ultim = null;
  try { ultim = localStorage.getItem(CHEIE_ULTIM_BACKUP); } catch (_) { /* ignorat */ }
  const m = trebuieMementoBackup(ultim, sesiuni.length);
  if (!m) return null;
  return el('div', { class: 'card card-memento' }, [
    el('div', { class: 'rand-memento' }, [
      iconita('scut'),
      el('div', {}, [
        el('h2', { text: m.niciodata ? 'Fă primul backup' : 'E timpul pentru un backup' }),
        el('p', { class: 'nota', text: (m.niciodata ? 'Datele tale sunt doar pe acest telefon.' : `Ultimul backup a fost acum ${plural(m.zile, 'zi', 'zile')}.`)
          + ' Exportă-l și păstrează-l în Fișiere, pe Drive sau pe e-mail.' }),
      ]),
    ]),
    buton({ text: 'Exportă acum', icon: 'descarca', tip: 'principal', lat: true, onclick: async () => { await exportaBackup(); randeazaAcasa(); } }),
  ]);
}

// ---------- Aplicația deschisă în mai multe file ----------
// Antrenamentul în curs e salvat de fiecare filă; două file deschise ar putea să-l suprascrie una pe alta.
function supravegheazaFile() {
  if (typeof BroadcastChannel === 'undefined') return;
  const canal = new BroadcastChannel('jurnal-antrenament');
  const arata = () => {
    if ($('avertizare-file')) return;
    const banda = el('div', { id: 'avertizare-file', class: 'banda-avertizare', role: 'alert' }, [
      iconita('avertizare'),
      el('span', { text: 'Aplicația e deschisă și în altă filă sau fereastră. Folosește una singură, ca antrenamentul în curs să nu fie suprascris.' }),
      buton({ icon: 'x', tip: 'fantoma', eticheta: 'Închide avertizarea', onclick: () => banda.remove() }),
    ]);
    document.body.prepend(banda);
  };
  canal.onmessage = e => {
    if (e.data === 'salut') { canal.postMessage('aici'); arata(); }
    else if (e.data === 'aici') arata();
  };
  canal.postMessage('salut');
}

function initSiguranta() {
  $('btn-csv-antrenamente').addEventListener('click', () => exportaCsv('antrenamente'));
  $('btn-csv-masuratori').addEventListener('click', () => exportaCsv('masuratori'));
  $('btn-verifica').addEventListener('click', verificaDatele);
  golesteCosulVechi().catch(err => console.warn(err)).finally(() => deseneazaCos().catch(() => {}));
  supravegheazaFile();
}
