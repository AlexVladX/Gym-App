// Ecranul Biblioteca: exerciții cu imagini și antrenamente gata făcute.
// Folosește: BIBLIOTECA, ANTRENAMENTE, creeazaFigura (exercitii.js),
// și adaugaExercitiu, deseneazaGrupe, programeazaCiorna, arataEcran, anunta (app.js).

let modBiblioteca = 'exercitii';
let cautareBiblioteca = '';
let filtruGrupa = '';       // '' = toate
let filtruEchipament = '';  // '' = orice

// Căutare fără diacritice: „impins" găsește „Împins".
function fara(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cardExercitiu(e) {
  const detalii = [e.grupa, e.echipament, e.nivel].filter(Boolean).join(' · ');
  return el('div', { class: 'card fig-card' }, [
    creeazaFigura(e.poza, e.nume, 'figura') || el('span'),
    el('div', { class: 'fig-text' }, [
      el('h3', { text: e.nume }),
      el('p', { class: 'eticheta', text: detalii }),
      el('p', { class: 'descriere', text: e.descriere }),
      e.muschi?.length ? el('p', { class: 'eticheta', text: 'Mușchi: ' + e.muschi.join(', ') }) : el('span'),
      el('button', {
        class: 'buton mic', type: 'button', text: '+ Sesiune',
        onclick: () => adaugaInSesiune([e.nume], [e.grupa]),
      }),
    ]),
  ]);
}

function cardAntrenament(a) {
  return el('div', { class: 'card' }, [
    el('h3', { text: a.nume }),
    el('p', { class: 'descriere', text: a.descriere }),
    el('p', { class: 'eticheta', text: a.exercitii.join(' · ') }),
    el('button', {
      class: 'buton principal', type: 'button', text: 'Adaugă în sesiune',
      onclick: () => adaugaInSesiune(a.exercitii, a.grupe),
    }),
  ]);
}

function randeazaBiblioteca() {
  const lista = $('biblio-lista');
  const cautare = cautareBiblioteca.toLowerCase();

  if (modBiblioteca === 'exercitii') {
    // Fiecare cuvânt căutat trebuie să apară în nume sau în mușchi, în orice ordine.
    const cuvinte = fara(cautare).split(/\s+/).filter(Boolean);
    const potrivite = BIBLIOTECA.filter(e => {
      if (filtruGrupa && e.grupa !== filtruGrupa) return false;
      if (filtruEchipament && e.echipament !== filtruEchipament) return false;
      const text = fara(`${e.nume} ${(e.muschi || []).join(' ')} ${e.echipament || ''}`);
      return cuvinte.every(c => text.includes(c));
    });
    $('biblio-numar').textContent = plural(potrivite.length, 'exercițiu', 'exerciții');
    if (potrivite.length === 0) {
      lista.replaceChildren(el('div', { class: 'card' }, [
        el('p', { class: 'eticheta', text: 'Niciun exercițiu găsit. Schimbă filtrele sau caută altfel.' })]));
    } else {
      lista.replaceChildren(...potrivite.map(cardExercitiu));
    }
  } else {
    randeazaAntrenamente().catch(err => console.error(err));
  }
}

async function randeazaAntrenamente() {
  const rutine = await toateRutinele();
  const lista = $('biblio-lista');
  const continut = [el('h2', { class: 'titlu-sectiune', text: 'Rutinele mele' })];
  if (rutine.length === 0) {
    continut.push(el('div', { class: 'card' }, [el('p', { class: 'eticheta',
      text: 'Nu ai rutine salvate. În ecranul Sesiune apasă „Salvează exercițiile ca rutină", sau „Salvează ca rutină" din Istoric.' })]));
  } else {
    continut.push(...[...rutine].reverse().map(cardRutina));
  }
  continut.push(el('h2', { class: 'titlu-sectiune', text: 'Șabloane' }), ...ANTRENAMENTE.map(cardAntrenament));
  if (modBiblioteca === 'antrenamente') lista.replaceChildren(...continut);
}

function cardRutina(r) {
  return el('div', { class: 'card' }, [
    el('h3', { text: r.nume }),
    r.grupe?.length ? el('p', { class: 'eticheta', text: r.grupe.join(', ') }) : el('span'),
    el('p', { class: 'descriere', text: r.exercitii.join(' · ') }),
    el('div', { class: 'rand' }, [
      el('button', {
        class: 'buton', type: 'button', text: 'Șterge',
        onclick: async () => {
          if (!confirm(`Ștergi rutina „${r.nume}"?`)) return;
          await stergeRutina(r.id);
          randeazaBiblioteca();
        },
      }),
      el('button', {
        class: 'buton principal', type: 'button', text: 'Adaugă în sesiune',
        onclick: () => adaugaInSesiune(r.exercitii, r.grupe || []),
      }),
    ]),
  ]);
}

// Adaugă exercițiile în sesiunea curentă, cu grupele lor, și deschide ecranul Sesiune.
async function adaugaInSesiune(exercitii, grupe = []) {
  grupe.forEach(g => stare.grupe.add(g));
  deseneazaGrupe();

  let adaugate = 0;
  for (const nume of exercitii) {
    const exista = stare.exercitii.some(e => e.nume.toLowerCase() === nume.toLowerCase());
    if (exista) continue;
    $('exercitiu-nume').value = nume;
    await adaugaExercitiu();
    adaugate++;
  }
  $('exercitiu-nume').value = '';
  programeazaCiorna();
  arataEcran('ecran-sesiune');
  anunta(adaugate > 0
    ? `Adăugate în sesiune: ${plural(adaugate, 'exercițiu', 'exerciții')}.`
    : 'Exercițiile sunt deja în sesiune.');
}

$('tab-exercitii').addEventListener('click', () => {
  modBiblioteca = 'exercitii';
  $('tab-exercitii').classList.add('activ');
  $('tab-antrenamente').classList.remove('activ');
  $('biblio-filtre').hidden = false;
  randeazaBiblioteca();
});

$('tab-antrenamente').addEventListener('click', () => {
  modBiblioteca = 'antrenamente';
  $('tab-antrenamente').classList.add('activ');
  $('tab-exercitii').classList.remove('activ');
  $('biblio-filtre').hidden = true;
  randeazaBiblioteca();
});

$('biblio-cautare').addEventListener('input', e => {
  cautareBiblioteca = e.target.value.trim();
  randeazaBiblioteca();
});

// Filtrele: grupe (chip-uri) și echipament (listă).
function deseneazaFiltre() {
  const optiuni = ['', ...GRUPE];
  $('biblio-grupe').replaceChildren(...optiuni.map(g => el('button', {
    class: 'chip' + (filtruGrupa === g ? ' activ' : ''), type: 'button', text: g || 'Toate',
    onclick: () => { filtruGrupa = g; deseneazaFiltre(); randeazaBiblioteca(); },
  })));
  const select = $('biblio-echipament');
  if (!select.options.length) {
    const echipamente = [...new Set(BIBLIOTECA.map(e => e.echipament).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ro'));
    select.replaceChildren(el('option', { value: '', text: 'Orice echipament' }),
      ...echipamente.map(x => el('option', { value: x, text: x })));
  }
}

$('biblio-echipament').addEventListener('change', e => {
  filtruEchipament = e.target.value;
  randeazaBiblioteca();
});

deseneazaFiltre();
randeazaBiblioteca();
