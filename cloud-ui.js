// Setări → Cont: autentificarea, starea sincronizării, legarea dispozitivului, conflictele și copiile din cont.
// Logica e în cloud.js; aici doar interfața.

const NUME_COLECTIE = {
  sesiuni: 'Antrenament', masuratori: 'Măsurătoare', rutine: 'Rutină', poze: 'Poză de progres', exercitii: 'Exercițiu',
  alimente: 'Aliment propriu', retete: 'Rețetă proprie', pozeRetete: 'Poza unei rețete', zileNutritie: 'Zi de nutriție',
  planuriNutritie: 'Plan de mese', listeCumparaturi: 'Listă de cumpărături', setari: 'Setări',
};

function textUltimaSincronizare() {
  const u = citesteMetaSincron().ultima;
  if (!u) return '';
  const min = Math.round((Date.now() - Date.parse(u)) / 60000);
  if (min < 1) return 'chiar acum';
  if (min < 60) return `acum ${plural(min, 'minut', 'minute')}`;
  return new Date(u).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function randStareSincron() {
  const s = sinc.stare;
  const [icon, clasa, text] = {
    sincronizare: ['schimba', 'info', 'Se sincronizează…'],
    sincronizat: ['bifa', 'bun', `Sincronizat${textUltimaSincronizare() ? ` · ${textUltimaSincronizare()}` : ''}`],
    offline: ['avertizare', 'atentie', 'Fără internet: modificările rămân pe telefon și pleacă singure când revine legătura.'],
    eroare: ['avertizare', 'pericol', `Eroare de sincronizare: ${sinc.mesaj}`],
    nelegat: ['info', 'info', 'Conectat, dar acest dispozitiv nu e încă legat de cont.'],
  }[s] || ['info', 'info', ''];
  return el('p', { class: `stare-sincron stare-${clasa}`, role: 'status' }, [iconita(icon, 'iconita mica'), el('span', { text })]);
}

function deseneazaCardCont() {
  const card = $('card-cont');
  if (!card) return;
  if (sinc.stare === 'neconfigurat') {
    card.replaceChildren(
      el('h2', { text: 'Cont și sincronizare' }),
      el('p', { class: 'nota', text: 'Sincronizarea în cloud nu e configurată încă pentru această aplicație. Datele stau doar pe acest dispozitiv; folosește backup-ul de mai jos ca să nu le pierzi.' }),
    );
    return;
  }
  if (!sinc.utilizator) { card.replaceChildren(...formularCont()); return; }
  const meta = citesteMetaSincron();
  const v = meta.verificare;
  const copii = [
    el('div', { class: 'card-cap' }, [el('h2', { text: 'Cont și sincronizare' })]),
    el('p', { class: 'cont-email' }, [iconita('corp', 'iconita mica'), el('span', { text: sinc.utilizator.email || 'cont' })]),
    randStareSincron(),
    sinc.conflicte ? el('div', { class: 'conflicte-banda' }, [
      el('span', { text: `${plural(sinc.conflicte, 'înregistrare modificată', 'înregistrări modificate')} diferit pe două dispozitive. Alege ce păstrezi.` }),
      buton({ text: 'Rezolvă', tip: 'principal', mic: true, onclick: deschideConflictele }),
    ]) : null,
    v ? el('p', { class: 'nota nota-mica', text: `Ultima verificare: ${plural(v.identice, 'înregistrare de pe telefon identică', 'înregistrări de pe telefon identice')} în cont${v.diferite ? `, ${v.diferite} diferite` : ''}${v.lipsa ? `, ${v.lipsa} încă netrimise` : ''} (${new Date(v.cand).toLocaleDateString('ro-RO')}).` }) : null,
    meta.legat ? el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Sincronizează acum', icon: 'schimba', tip: 'secundar', onclick: () => sincronizeaza({ asteapta: true }).then(deseneazaCardCont) }),
      buton({ text: 'Copii în cont', icon: 'scut', tip: 'secundar', onclick: deschideCopiiCloud }),
    ]) : buton({ text: 'Leagă acest dispozitiv de cont', icon: 'legatura', tip: 'principal', lat: true, onclick: propuneLegarea }),
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Verifică datele din cont', tip: 'fantoma', mic: true, onclick: verificaAcum }),
      buton({ text: 'Ieși din cont', tip: 'fantoma', mic: true, onclick: iesiDinCont }),
    ]),
    el('div', { class: 'separator-pericol' }),
    buton({ text: 'Șterge contul', icon: 'cos', tip: 'pericol', mic: true, onclick: deschideStergereCont }),
    el('p', { class: 'nota nota-mica', text: 'Datele tale stau în contul tău (Supabase, server în UE dacă ai ales așa la crearea proiectului); doar tu le poți citi. Pe acest telefon rămân și fără internet.' }),
  ];
  card.replaceChildren(...copii.filter(Boolean));
}

function formularCont() {
  const email = el('input', { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'adresa@exemplu.ro', 'aria-label': 'E-mail' });
  const parola = el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Parola (minimum 8 caractere)', 'aria-label': 'Parola' });
  const mesaj = el('p', { class: 'nota', role: 'status' });
  const ocupat = async (fn) => {
    const b = [...$('card-cont').querySelectorAll('button')];
    b.forEach(x => { x.disabled = true; });
    mesaj.textContent = 'Se încarcă…';
    try { await fn(); } catch (err) { mesaj.textContent = mesajEroareCloud(err); mesaj.className = 'nota nota-avertizare'; }
    b.forEach(x => { x.disabled = false; });
  };
  const valid = (cuParola = true) => {
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { mesaj.textContent = 'Scrie o adresă de e-mail validă.'; email.focus(); return false; }
    if (cuParola && parola.value.length < 8) { mesaj.textContent = 'Parola trebuie să aibă cel puțin 8 caractere.'; parola.focus(); return false; }
    return true;
  };
  return [
    el('h2', { text: 'Cont și sincronizare' }),
    el('p', { class: 'nota', text: 'Cu un cont, aceleași antrenamente, mese, rețete, măsurători și setări pe telefon și pe calculator. Datele de pe acest telefon nu se pierd: la prima conectare alegi ce faci cu ele.' }),
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'E-mail' }), email]),
    el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Parola' }), parola]),
    mesaj,
    el('div', { class: 'rand-butoane' }, [
      buton({ text: 'Intră în cont', tip: 'principal', onclick: () => valid() && ocupat(async () => {
        await contAutentificare(email.value.trim(), parola.value);
        mesaj.textContent = '';
        deseneazaCardCont();
      }) }),
      buton({ text: 'Creează cont', tip: 'secundar', onclick: () => valid() && ocupat(async () => {
        const r = await contInregistrare(email.value.trim(), parola.value);
        mesaj.className = 'nota';
        mesaj.textContent = r.confirmare
          ? `Ți-am trimis un e-mail la ${email.value.trim()}. Apasă linkul din el ca să confirmi contul, apoi intră aici cu aceeași parolă.`
          : 'Cont creat.';
        if (!r.confirmare) { const u = await sinc.adaptor.utilizator(); if (u) await laConectare(u); deseneazaCardCont(); }
      }) }),
    ]),
    buton({ text: 'Am uitat parola', tip: 'fantoma', mic: true, onclick: () => valid(false) && ocupat(async () => {
      await contResetareParola(email.value.trim());
      mesaj.className = 'nota';
      mesaj.textContent = `Dacă există un cont pentru ${email.value.trim()}, primești un e-mail cu un link. Linkul deschide aplicația, unde alegi o parolă nouă.`;
    }) }),
  ];
}

async function iesiDinCont() {
  const da = await confirma({ titlu: 'Ieși din cont?', text: 'Sincronizarea se oprește pe acest dispozitiv. Datele de pe telefon rămân aici, iar cele din cont rămân în cont. Când intri din nou, sincronizarea continuă de unde a rămas.', ok: 'Ieși din cont' });
  if (!da) return;
  await contDeconectare().catch(err => notifica(mesajEroareCloud(err), 'eroare'));
  deseneazaCardCont();
}

// Etapa 6: ștergerea contului. Confirmarea: utilizatorul scrie adresa contului (verificată și pe server).
function deschideStergereCont() {
  if (!sinc.utilizator) return;
  const email = sinc.utilizator.email || '';
  const camp = el('input', { type: 'email', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: 'email', 'aria-label': 'Adresa contului, pentru confirmare' });
  const mesaj = el('p', { class: 'nota', role: 'status' });
  const btn = buton({ text: 'Șterge contul definitiv', tip: 'pericol', onclick: async () => {
    if (camp.value.trim().toLowerCase() !== email.toLowerCase()) { mesaj.textContent = 'Scrie exact adresa contului, ca să confirmi.'; camp.focus(); return; }
    btn.disabled = true;
    mesaj.textContent = 'Se șterge contul…';
    try {
      await contStergere(camp.value.trim());
      d.inchide();
      deseneazaCardCont();
      if (typeof afiseazaCategorieSetari === 'function') afiseazaCategorieSetari();
      notifica('Contul a fost șters. Datele de pe acest telefon au rămas.', 'succes', 6000);
    } catch (err) {
      btn.disabled = false;
      mesaj.textContent = err && err.cod === 'confirmare_gresita' ? 'Adresa scrisă nu este cea a contului.' : mesajEroareCloud(err);
    }
  } });
  const d = deschideDialog({
    titlu: 'Ștergi contul?',
    pericol: true,
    continut: el('div', { class: 'formular' }, [
      el('p', { class: 'dialog-text', text: `Se șterg definitiv contul ${email} și tot ce e în el: datele sincronizate, pozele și copiile de siguranță din cloud. Nu se poate anula.` }),
      el('p', { class: 'dialog-text', text: 'Datele de pe acest telefon rămân. Pe celelalte telefoane legate de cont rămân și ele, dar nu se mai sincronizează.' }),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: `Scrie adresa contului (${email}) ca să confirmi` }), camp]),
      mesaj,
    ]),
    butoane: [buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }), btn],
  });
}

async function verificaAcum() {
  try {
    await sincronizeaza({ asteapta: true });
    const v = await verificaCopiaDinCloud();
    notifica(v.diferite || v.lipsa
      ? `Verificare: ${v.identice} identice, ${v.diferite} diferite, ${v.lipsa} netrimise încă.`
      : v.identice === 1 ? 'Verificare reușită: înregistrarea de pe telefon e identică în cont.'
        : `Verificare reușită: toate cele ${numarDe(v.identice)} înregistrări de pe telefon sunt identice în cont.`, v.diferite || v.lipsa ? 'info' : 'succes', 6000);
  } catch (err) { notifica(mesajEroareCloud(err), 'eroare'); }
  deseneazaCardCont();
}

// La prima conectare a acestui dispozitiv: ce facem cu datele de pe telefon și cu cele din cont.
let legareDeschisa = false;
async function propuneLegarea() {
  if (legareDeschisa || !sinc.utilizator) return;
  legareDeschisa = true;
  try {
    let local = 0, cont = 0;
    try { [local, cont] = await Promise.all([numaraLocale(), sinc.adaptor.numara()]); } catch (err) {
      notifica(mesajEroareCloud(err), 'eroare');
      return;
    }
    const executa = async (mod, mesaj) => {
      notifica(mesaj, 'info', 2500);
      try {
        const v = await leagaDispozitivul(mod);
        notifica(v.diferite || v.lipsa
          ? `Legat. Verificare: ${v.identice} identice, ${v.diferite} diferite, ${v.lipsa} netrimise încă.`
          : `Gata: ${plural(v.identice, 'înregistrare verificată', 'înregistrări verificate')} în cont.`, 'succes', 6000);
      } catch (err) { notifica(mesajEroareCloud(err), 'eroare', 6000); }
      deseneazaCardCont();
    };
    if (local === 0) { await executa('descarca', cont ? 'Aducem datele din cont…' : 'Contul e gata.'); return; }
    if (cont === 0) {
      const da = await confirma({ titlu: 'Urci datele în cont?',
        text: `Pe acest telefon ai ${plural(local, 'înregistrare', 'înregistrări')} (antrenamente, măsurători, mese, rețete…), iar contul e gol. Le urcăm în cont, apoi verificăm copia din cont înregistrare cu înregistrare. Datele de pe telefon rămân aici.`,
        ok: 'Urcă datele', anulare: 'Mai târziu' });
      if (da) await executa('urca', 'Urcăm datele…');
      else deseneazaCardCont();
      return;
    }
    const alegere = await new Promise(rezolva => {
      const d = deschideDialog({
        titlu: 'Contul are deja date',
        text: `În cont sunt ${plural(cont, 'înregistrare', 'înregistrări')}, iar pe acest telefon ${plural(local, 'înregistrare', 'înregistrări')}. Ce facem?`,
        continut: el('div', { class: 'optiuni-legare' }, [
          el('p', { class: 'nota', text: 'Combină: păstrăm tot; ce e identic se unește, iar ce e diferit în ambele părți îți arătăm ca să alegi. Recomandat.' }),
          el('p', { class: 'nota', text: 'Doar datele din cont: datele de pe acest telefon se înlocuiesc cu cele din cont (înainte facem o copie locală, pe care o găsești în Setări → Copii automate).' }),
        ]),
        butoane: [
          buton({ text: 'Mai târziu', tip: 'fantoma', onclick: () => d.inchide(() => rezolva(null)) }),
          buton({ text: 'Doar datele din cont', tip: 'secundar', onclick: () => d.inchide(() => rezolva('doarCont')) }),
          buton({ text: 'Combină', tip: 'principal', onclick: () => d.inchide(() => rezolva('combina')) }),
        ],
        laAnulare: () => rezolva(null),
      });
    });
    if (alegere === 'doarCont') {
      const sigur = await confirma({ titlu: 'Înlocuiești datele de pe telefon?', text: `${local === 1 ? 'Înregistrarea de pe acest telefon se înlocuiește' : `Cele ${numarDe(local)} înregistrări de pe acest telefon se înlocuiesc`} cu cele din cont. Facem întâi o copie locală.`, ok: 'Înlocuiește', pericol: true });
      if (sigur) await executa('doarCont', 'Aducem datele din cont…');
    } else if (alegere === 'combina') await executa('combina', 'Combinăm datele…');
    deseneazaCardCont();
  } finally { legareDeschisa = false; }
}

// ---------- Conflicte ----------
function rezumatValoare(v) {
  if (v === undefined || v === null) return '—';
  if (Array.isArray(v)) {
    if (v.every(x => x && typeof x === 'object' && 'nume' in x)) return v.map(x => `${x.nume}${x.stare && x.stare !== 'neinceput' ? ` (${x.stare})` : ''}`).join(', ') || '—';
    return `${v.length} elemente`;
  }
  if (typeof v === 'object') { const t = JSON.stringify(v); return t.length > 120 ? `${t.slice(0, 117)}…` : t; }
  return String(v);
}

async function deschideConflictele() {
  const lista = await toateConflictele();
  if (!lista.length) { notifica('Nu mai e niciun conflict.', 'succes'); deseneazaCardCont(); return; }
  const cont = el('div', { class: 'lista-conflicte' });
  const d = deschideDialog({ titlu: 'Alege ce păstrezi', continut: cont, butoane: [buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() })] });
  const deseneaza = async () => {
    const l = await toateConflictele();
    if (!l.length) { d.inchide(); notifica('Toate conflictele sunt rezolvate.', 'succes'); deseneazaCardCont(); return; }
    cont.replaceChildren(...l.map(c => {
      const loc = c.local || {}, srv = c.server || {};
      const titlu = loc.data || srv.data || loc.nume || srv.nume || c.cheie;
      const campuri = (c.campuri || []).filter(k => !/^șters/.test(k)).slice(0, 4);
      return el('div', { class: 'conflict' }, [
        el('strong', { text: `${NUME_COLECTIE[c.colectie] || c.colectie}: ${titlu}` }),
        el('div', { class: 'conflict-variante' }, [
          el('div', {}, [el('span', { class: 'camp-eticheta', text: 'Pe acest dispozitiv' }),
            c.local ? el('ul', {}, campuri.map(k => el('li', { text: `${k}: ${rezumatValoare(loc[k])}` }))) : el('p', { class: 'nota', text: 'Ștearsă aici.' })]),
          el('div', {}, [el('span', { class: 'camp-eticheta', text: 'În cont (alt dispozitiv)' }),
            c.serverSters ? el('p', { class: 'nota', text: 'Ștearsă pe alt dispozitiv.' }) : el('ul', {}, campuri.map(k => el('li', { text: `${k}: ${rezumatValoare(srv[k])}` })))]),
        ]),
        el('div', { class: 'rand-butoane' }, [
          buton({ text: 'Păstrează de aici', tip: 'secundar', mic: true, onclick: async () => { await rezolvaConflict(c.k, 'local'); deseneaza(); } }),
          buton({ text: 'Păstrează din cont', tip: 'secundar', mic: true, onclick: async () => { await rezolvaConflict(c.k, 'cont'); deseneaza(); } }),
        ]),
      ]);
    }));
  };
  deseneaza();
}

// ---------- Parolă nouă (din linkul de resetare) ----------
function cereParolaNoua() {
  const p1 = el('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Parola nouă' });
  const p2 = el('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Repetă parola nouă' });
  const mesaj = el('p', { class: 'nota', role: 'status' });
  const d = deschideDialog({
    titlu: 'Alege o parolă nouă',
    continut: el('div', { class: 'formular' }, [
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Parola nouă (minimum 8 caractere)' }), p1]),
      el('label', { class: 'camp' }, [el('span', { class: 'camp-eticheta', text: 'Repetă parola' }), p2]),
      mesaj,
    ]),
    butoane: [
      buton({ text: 'Renunță', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Salvează parola', tip: 'principal', onclick: async () => {
        if (p1.value.length < 8) { mesaj.textContent = 'Cel puțin 8 caractere.'; return; }
        if (p1.value !== p2.value) { mesaj.textContent = 'Parolele nu coincid.'; return; }
        try { await contSchimbaParola(p1.value); d.inchide(); notifica('Parola a fost schimbată.', 'succes'); } catch (err) { mesaj.textContent = mesajEroareCloud(err); }
      } }),
    ],
  });
}

// ---------- Copii de siguranță în cont ----------
async function deschideCopiiCloud() {
  const cont = el('div', { class: 'lista-simpla' }, [stareIncarcare(2)]);
  const d = deschideDialog({
    titlu: 'Copii de siguranță în cont',
    text: 'O copie completă a datelor (fără poze, care sunt deja în cont) se face automat o dată pe săptămână. Se păstrează ultimele 10.',
    continut: cont,
    butoane: [
      buton({ text: 'Închide', tip: 'fantoma', onclick: () => d.inchide() }),
      buton({ text: 'Fă o copie acum', tip: 'principal', onclick: async () => {
        try { await faCopieCloud(); notifica('Copia a fost salvată în cont.', 'succes'); deseneaza(); } catch (err) { notifica(mesajEroareCloud(err), 'eroare'); }
      } }),
    ],
  });
  const deseneaza = async () => {
    let l;
    try { l = await listaCopiiCloud(); } catch (err) { cont.replaceChildren(el('p', { class: 'nota', text: mesajEroareCloud(err) })); return; }
    if (!l.length) { cont.replaceChildren(el('p', { class: 'nota', text: 'Încă nu ai nicio copie în cont.' })); return; }
    cont.replaceChildren(...l.map(f => {
      const data = f.nume.replace(/\.json$/, '').replace(/T(\d\d)-(\d\d)-(\d\d)-\d+Z$/, 'T$1:$2:$3Z');
      const t = Number.isFinite(Date.parse(data)) ? new Date(data).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }) : f.nume;
      return el('div', { class: 'rand aliniat' }, [
        el('span', { text: t }),
        buton({ text: 'Restaurează', tip: 'secundar', mic: true, onclick: async () => {
          try {
            const brut = await citesteCopieCloud(f.cale);
            d.inchide();
            await restaureaza(brut, `Copia din cont din ${t}`);
          } catch (err) { notifica(mesajEroareCloud(err), 'eroare'); }
        } }),
      ]);
    }));
  };
  deseneaza();
}

ascultatoriSincron.add(() => { if (typeof ecranCurent !== 'undefined' && ecranCurent === 'ecran-setari') deseneazaCardCont(); });
