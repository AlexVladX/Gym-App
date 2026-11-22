// Backup, restaurare, copii automate, starea stocării și ștergerea datelor.

const CHEIE_ULTIM_BACKUP = 'ultimBackup';
const ZILE_COPIE_AUTOMATA = 7;

// ---------- Pozele în backup ----------
// În bază pozele sunt Blob-uri; în fișier, text (data-URL), ca backupul să rămână un singur JSON.
function blobInText(blob) {
  return new Promise((rezolva, respinge) => {
    const r = new FileReader();
    r.onload = () => rezolva(r.result);
    r.onerror = () => respinge(r.error);
    r.readAsDataURL(blob);
  });
}
function textInBlob(dataUrl) {
  const [antet, b64] = dataUrl.split(',');
  const tip = antet.slice(5, antet.indexOf(';'));
  const bin = atob(b64);
  const octeti = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octeti[i] = bin.charCodeAt(i);
  return new Blob([octeti], { type: tip });
}
async function pozePentruBackup(sursa = exportaPoze) {
  const poze = await sursa();
  const rez = [];
  for (const p of poze) {
    if (!(p && p.imagine instanceof Blob)) continue;
    const { imagine, ...rest } = p;
    rez.push({ ...rest, imagine: await blobInText(imagine) });
  }
  return rez;
}

// Obiectul complet de backup (format v3): datele din bază plus setările și (implicit) pozele.
// cuPoze: false pentru copia automată săptămânală (pozele nu se schimbă des și ar umple spațiul).
async function construiesteBackup({ cuPoze = true } = {}) {
  const date = await exportaDate();
  const backup = {
    aplicatie: 'jurnal-antrenament',
    versiune: VERSIUNE_BACKUP,
    schema: DB_VERSIUNE,
    exportat: new Date().toISOString(),
    setari: setariPentruBackup(),
    ...date,
  };
  if (cuPoze) {
    backup.poze = await pozePentruBackup();
    backup.pozeRetete = await pozePentruBackup(exportaPozeRetete);
  }
  return backup;
}

function descarcaJson(obiect, numeFisier) {
  const blob = new Blob([JSON.stringify(obiect, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: numeFisier });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---------- Export ----------
function actualizeazaInfoBackup() {
  let ultim = null;
  try { ultim = localStorage.getItem(CHEIE_ULTIM_BACKUP); } catch (_) { /* ignorat */ }
  const info = $('backup-info');
  info.classList.remove('nota-avertizare');
  if (!ultim) {
    info.textContent = 'Nu ai exportat niciun backup încă. Fă unul săptămânal și păstrează-l în afara telefonului.';
    info.classList.add('nota-avertizare');
    return;
  }
  const zile = Math.floor((Date.now() - Date.parse(ultim)) / 86400000);
  const cand = zile === 0 ? 'azi' : `acum ${plural(zile, 'zi', 'zile')}`;
  info.textContent = `Ultimul backup exportat: ${cand}.` + (zile >= 7 ? ' A trecut o săptămână, exportă unul nou.' : '');
  if (zile >= 7) info.classList.add('nota-avertizare');
}

async function exportaBackup() {
  try {
    await salveazaCiornaAcum();
    const date = await construiesteBackup();
    const blob = new Blob([JSON.stringify(date, null, 2)], { type: 'application/json' });
    // pe telefon: meniul de partajare (Fișiere, Drive, e-mail); altfel descărcare
    const rezultat = await trimiteFisier(blob, `jurnal-backup-${dataLocala()}.json`);
    if (rezultat === 'anulat') { notifica('Exportul a fost anulat; backupul nu a fost salvat nicăieri.', 'info'); return; }
    try { localStorage.setItem(CHEIE_ULTIM_BACKUP, new Date().toISOString()); } catch (_) { /* ignorat */ }
    actualizeazaInfoBackup();
    notifica(rezultat === 'partajat' ? 'Backup trimis.' : 'Backup exportat. Salvează fișierul în Fișiere, pe Drive sau trimite-l pe e-mail.', 'succes');
  } catch (err) {
    console.error(err);
    notifica('Exportul a eșuat. Datele de pe telefon nu au fost modificate.', 'eroare');
  }
}

// ---------- Restaurare ----------
function textRezumat(r) {
  const parti = [plural(r.sesiuni, 'sesiune', 'sesiuni'), plural(r.masuratori, 'măsurătoare', 'măsurători')];
  if (r.rutine !== null) parti.push(plural(r.rutine, 'rutină', 'rutine'));
  if (r.poze) parti.push(plural(r.poze, 'poză', 'poze'));
  if (r.retete) parti.push(plural(r.retete, 'rețetă proprie', 'rețete proprii'));
  if (r.alimente) parti.push(plural(r.alimente, 'aliment propriu', 'alimente proprii'));
  if (r.pozeRetete) parti.push(plural(r.pozeRetete, 'poză de rețetă', 'poze de rețete'));
  if (r.zileNutritie) parti.push(plural(r.zileNutritie, 'zi cu mese notate', 'zile cu mese notate'));
  if (r.planuriNutritie) parti.push(plural(r.planuriNutritie, 'plan de mese', 'planuri de mese'));
  if (r.listeCumparaturi) parti.push(plural(r.listeCumparaturi, 'listă de cumpărături', 'liste de cumpărături'));
  return parti.join(', ');
}

// Restaurează un obiect de backup deja citit. sursa: text pentru dialog (ex. numele fișierului).
async function restaureaza(brut, sursa) {
  const rezultat = valideazaBackup(brut);
  if (!rezultat.ok) {
    notifica(rezultat.eroare, 'eroare');
    return false;
  }
  const { date, ignorate, rezumat } = rezultat;
  const pastrate = partiPastrate(date, brut);
  const exportat = rezumat.exportat && Number.isFinite(Date.parse(rezumat.exportat))
    ? ` din ${new Date(rezumat.exportat).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}` : '';

  const da = await confirma({
    titlu: 'Restaurezi datele?',
    text: `${sursa}${exportat} conține ${textRezumat(rezumat)}. Datele actuale de pe telefon vor fi înlocuite.` +
      (ignorate ? ` Atenție: ${ignorate === 1 ? 'o înregistrare deteriorată va fi ignorată' : `${plural(ignorate, 'înregistrare', 'înregistrări deteriorate')} vor fi ignorate`}.` : '') +
      (pastrate.length ? ` Backupul nu conține ${pastrate.join(', ')}; acestea rămân cum sunt acum pe telefon.` : '') +
      ' Înainte de restaurare se face automat o copie a datelor actuale, pe care o poți recupera din Setări.',
    ok: 'Restaurează', pericol: true,
  });
  if (!da) return false;

  // Copia de siguranță e obligatorie: dacă nu reușește, nu atingem datele.
  // Pozele intră în copie doar dacă restaurarea le înlocuiește (backupul are poze).
  try {
    await salveazaCiornaAcum();
    await salveazaInstantaneu('Înainte de restaurare', await construiesteBackup({ cuPoze: Array.isArray(date.poze) || Array.isArray(date.pozeRetete) }));
  } catch (err) {
    console.error(err);
    notifica('Nu s-a putut face copia de siguranță, așa că restaurarea a fost oprită. Datele actuale nu au fost modificate.', 'eroare');
    return false;
  }

  try {
    const deScris = { ...date };
    if (Array.isArray(date.poze)) deScris.poze = date.poze.map(p => ({ ...p, imagine: textInBlob(p.imagine) }));
    if (Array.isArray(date.pozeRetete)) deScris.pozeRetete = date.pozeRetete.map(p => ({ ...p, imagine: textInBlob(p.imagine) }));
    await inlocuiesteToate(deScris);
  } catch (err) {
    console.error(err);
    notifica('Restaurarea a eșuat. Datele actuale nu au fost modificate.', 'eroare');
    return false;
  }
  if (date.setari) aplicaSetariDinBackup(date.setari);

  await reincarcaTot();
  notifica(`Date restaurate: ${textRezumat(rezumat)}.`, 'succes');
  return true;
}

async function importaFisier(e) {
  const fisier = e.target.files[0];
  e.target.value = '';
  if (!fisier) return;
  if (fisier.size > 300 * 1024 * 1024) {
    notifica('Fișierul e prea mare pentru un backup al jurnalului (peste 300 MB).', 'eroare');
    return;
  }
  let brut;
  try {
    brut = JSON.parse(await fisier.text());
  } catch (_) {
    notifica('Fișierul nu poate fi citit: nu este un fișier JSON valid. Alege fișierul .json exportat din aplicație.', 'eroare');
    return;
  }
  await restaureaza(brut, `Fișierul „${fisier.name}"`);
}

// ---------- Copii automate ----------
const formatDataOra = t => new Date(t).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function deseneazaInstantanee() {
  const lista = $('instantanee-lista');
  let toate;
  try {
    toate = await toateInstantaneele();
  } catch (err) {
    console.error(err);
    lista.replaceChildren(el('p', { class: 'nota', text: 'Copiile automate nu au putut fi citite.' }));
    return;
  }
  if (toate.length === 0) {
    lista.replaceChildren(el('p', { class: 'nota', text: 'Nicio copie încă. Aplicația face automat o copie pe săptămână (după ce ai date salvate) și una înainte de orice restaurare.' }));
    return;
  }
  lista.replaceChildren(...toate.map(i => {
    const c = i.continut || {};
    const n = Array.isArray(c.sesiuni) ? c.sesiuni.length : 0;
    return el('div', { class: 'rand-lista rand-instantaneu' }, [
      el('div', {}, [
        el('strong', { text: formatDataOra(i.creat) }),
        el('p', { class: 'nota', text: `${i.motiv} · ${plural(n, 'sesiune', 'sesiuni')}` }),
      ]),
      buton({ icon: 'descarca', tip: 'fantoma', eticheta: `Descarcă copia din ${formatDataOra(i.creat)}`,
        onclick: () => descarcaJson(c, `jurnal-copie-${formatData(new Date(i.creat))}.json`) }),
      buton({ icon: 'istoric', tip: 'fantoma', eticheta: `Restaurează copia din ${formatDataOra(i.creat)}`,
        onclick: async () => {
          const complet = await citesteInstantaneu(i.id);
          if (!complet) { notifica('Copia nu mai există.', 'eroare'); deseneazaInstantanee(); return; }
          if (await restaureaza(complet.continut, `Copia automată din ${formatDataOra(i.creat)}`)) deseneazaInstantanee();
        } }),
    ]);
  }));
}

// O copie automată pe săptămână, făcută la pornire, păstrată pe telefon.
// Nu înlocuiește backupul exportat (care supraviețuiește ștergerii aplicației).
async function copieAutomataSaptamanala() {
  try {
    const ultima = await citesteMeta('ultimaCopieAutomata');
    if (ultima && Date.now() - ultima < ZILE_COPIE_AUTOMATA * 86400000) return;
    const date = await construiesteBackup({ cuPoze: false });
    if (date.sesiuni.length === 0 && date.masuratori.length === 0) return; // nimic de protejat încă
    await salveazaInstantaneu('Copie săptămânală', date);
    await scrieMeta('ultimaCopieAutomata', Date.now());
  } catch (err) {
    console.warn('Copia automată nu a putut fi făcută', err);
  }
}

// ---------- Stocare persistentă ----------
// Fără „persist", browserul poate șterge datele site-ului când rămâne fără spațiu
// sau după o perioadă fără utilizare (mai ales Safari).
async function cerePersistenta() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (_) {
    return null;
  }
}

async function deseneazaStareStocare() {
  const info = $('stocare-info');
  const persistent = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => null) : null;
  let folosit = '';
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage } = await navigator.storage.estimate();
      if (Number.isFinite(usage)) folosit = ` Spațiu folosit: ${(usage / 1024 / 1024).toFixed(1)} MB.`;
    } catch (_) { /* ignorat */ }
  }
  info.classList.toggle('nota-avertizare', persistent === false);
  // iPhone: în Safari (fără „Adaugă pe ecranul principal") datele site-urilor nefolosite pot fi șterse după câteva săptămâni
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalata = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const sfatIos = ios && !instalata ? ' Pe iPhone, folosește aplicația de pe ecranul principal (Partajează → Adaugă pe ecranul principal): în Safari, datele pot fi șterse dacă nu deschizi site-ul câteva săptămâni.' : '';
  info.textContent = (persistent === true
    ? `Stocare protejată: browserul nu va șterge datele aplicației.${folosit}`
    : persistent === false
      ? `Stocarea nu e protejată: browserul poate șterge datele dacă rămâne fără spațiu. Pe iPhone, adaugă aplicația pe ecranul principal (Partajează → Adaugă pe ecranul principal). Exportă backupuri regulat.${folosit}`
      : `Browserul nu spune dacă stocarea e protejată. Exportă backupuri regulat.${folosit}`) + sfatIos;
  if (sfatIos) info.classList.add('nota-avertizare');
}

// ---------- Ștergerea tuturor datelor ----------
async function stergeTot() {
  const text = await cereText({
    titlu: 'Ștergi toate datele?',
    text: 'Se șterg definitiv toate antrenamentele, măsurătorile, pozele, rutinele, rețetele, alimentele, mesele notate, planurile de mese și listele de cumpărături, antrenamentul în curs, copiile automate și „Șterse recent” de pe acest telefon. Exportă întâi un backup dacă vrei să le păstrezi. Scrie ȘTERGE ca să confirmi.',
    eticheta: 'Confirmare',
    ok: 'Șterge tot', pericol: true, confirmareExacta: 'ȘTERGE',
  });
  if (text !== 'ȘTERGE') return;
  try {
    clearTimeout(timerCiorna);
    timerCiorna = null;
    await stergeToateDatele();
  } catch (err) {
    console.error(err);
    notifica('Datele nu au putut fi șterse.', 'eroare');
    return;
  }
  golesteSesiunea();
  await reincarcaTot();
  notifica('Toate datele au fost șterse de pe acest telefon.', 'succes');
}

// Reîncarcă toate ecranele după o schimbare mare a datelor (restaurare, ștergere).
async function reincarcaTot() {
  await reincarcaBiblioteca().catch(err => console.warn(err));
  await reincarcaIstoric().catch(err => console.warn(err));
  await incarcaCiorna();
  await reincarcaMasuratori();
  await reincarcaPoze().catch(err => console.warn(err));
  await deseneazaCos().catch(err => console.warn(err));
  await reincarcaNutritie().catch(err => console.warn(err));
  deseneazaGrupe();
  deseneazaExercitii();
  randeazaBiblioteca();
  deseneazaInstantanee();
  deseneazaStareStocare();
}

function initBackup() {
  $('btn-exporta').addEventListener('click', exportaBackup);
  $('btn-importa').addEventListener('click', () => $('fisier-import').click());
  $('fisier-import').addEventListener('change', importaFisier);
  $('btn-sterge-tot').addEventListener('click', stergeTot);
}
