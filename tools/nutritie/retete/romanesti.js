// Rețete românești tradiționale (Gym App 3.0, Faza 3). Același format ca celelalte fișiere, plus câmpuri opționale:
//   masa         — masa din plan (aici fiecare rețetă o are pe a ei: prânz, cină, gustări)
//   numeEn       — numele în engleză
//   fel          — 'fel-principal' | 'ciorba' | 'patiserie' | 'desert'
//   bucatarie    — 'romaneasca' (pentru filtrul „Românești”)
//   timpPregatire, timpGatire (minute); timp = totalul
//   gatit        — { greutateGatita: grame pentru TOATĂ rețeta gătită, nota: cum s-a estimat } → porția în grame
//   estimari     — ce anume e estimat în valorile nutriționale (restul se calculează exact din ingrediente, USDA SR28)
//   varianta     — { grup, nume }: variantele aceluiași fel (ex. sarmale de porc / porc și vită / curcan) au
//                  fiecare profilul lor nutrițional, nu o medie înșelătoare.
// Cantitățile sunt pentru TOATĂ rețeta, în grame, ingrediente crude, parte comestibilă.
module.exports = [
  {
    id: 'ro-sarmale-porc', nume: 'Sarmale cu carne de porc', numeEn: 'Cabbage rolls with pork', masa: 'pranz',
    fel: 'fel-principal', bucatarie: 'romaneasca', varianta: { grup: 'sarmale', nume: 'cu carne de porc' },
    descriere: 'Sarmale în foi de varză murată, cu carne tocată de porc, orez și afumătură, fierte încet cu cimbru și pastă de roșii. Mămăliga și smântâna de alături nu sunt incluse.',
    timpPregatire: 60, timpGatire: 180, timp: 240, portii: 10, dificultate: 'avansat', vas: 'farfurie', etichete: ['meal-prep'],
    ingrediente: [['porc-tocat', 1000], ['afumatura', 100], ['orez', 100], ['ceapa', 200], ['ulei', 30], ['varza-murata', 900],
      ['pasta-rosii', 70], ['cimbru', 3], ['boia', 5], ['piper', 2], ['dafin', 1], ['sare', 8]],
    gatit: { greutateGatita: 2500, nota: 'Estimare: ingredientele crude (≈2,4 kg) plus apa absorbită de orez, minus apa pierdută de carne la fiert; zeama rămasă se servește cu sarmalele. O porție ≈ 5 sarmale medii cu varză.' },
    pasi: [
      'Desfă foile de varză murată; dacă sunt foarte sărate, ține-le 30 de minute în apă rece. Taie cotorul gros. Toacă mărunt foile mici și rupte.',
      'Călește ceapa tocată în ulei 5 minute, adaugă orezul spălat și mai călește 2 minute.',
      'Amestecă carnea cu ceapa și orezul, boiaua, jumătate din cimbru, piperul și sarea.',
      'Pune câte o lingură de umplutură pe fiecare foaie, rulează strâns și împinge capetele înăuntru.',
      'Așază în oală un strat de varză tocată, apoi sarmalele, bucățile de afumătură și foile de dafin, apoi restul de varză.',
      'Toarnă pasta de roșii dizolvată în apă cât să acopere sarmalele, presară restul de cimbru și fierbe acoperit la foc mic 3 ore (sau la cuptor, la 170 °C).',
    ],
  },
  {
    id: 'ro-ciorba-radauteana', nume: 'Ciorbă rădăuțeană', numeEn: 'Rădăuți chicken sour soup', masa: 'pranz',
    fel: 'ciorba', bucatarie: 'romaneasca',
    descriere: 'Ciorbă de pui acrită cu oțet, legată cu smântână, gălbenușuri și usturoi. Varianta cu 300 g smântână la 8 porții.',
    timpPregatire: 20, timpGatire: 90, timp: 110, portii: 8, dificultate: 'mediu', vas: 'bol', etichete: ['meal-prep'],
    ingrediente: [['pui-pulpa-piele', 800], ['ceapa', 100], ['morcovi', 150], ['telina-radacina', 100], ['usturoi', 30],
      ['smantana', 300], ['galbenus', 54], ['otet', 40], ['dafin', 1], ['piper', 2], ['sare', 14]],
    gatit: { greutateGatita: 3700, nota: 'Estimare: ingredientele (≈1,6 kg) plus 2,5 L apă, minus ≈15% evaporare la fiert. O porție ≈ un castron de 450 ml.' },
    estimari: ['Pulpele de pui sunt cântărite fără os (carne și piele).'],
    pasi: [
      'Pune pulpele în 2,5 L de apă rece cu sare și dafin; fierbe la foc mic 40 de minute, luând spuma.',
      'Adaugă ceapa, morcovul și țelina tăiate mărunt; fierbe încă 30 de minute.',
      'Scoate pulpele, dezosează-le și pune carnea înapoi în ciorbă.',
      'Amestecă smântâna cu gălbenușurile și usturoiul pisat. Adaugă treptat câte un polonic de ciorbă fierbinte, amestecând, ca să nu se taie.',
      'Toarnă amestecul în ciorbă, adaugă oțetul și piperul, încălzește fără să mai fiarbă.',
    ],
  },
  {
    id: 'ro-tochitura-moldoveneasca', nume: 'Tochitură moldovenească', numeEn: 'Moldavian pork stew', masa: 'cina',
    fel: 'fel-principal', bucatarie: 'romaneasca',
    descriere: 'Ceafă și cârnați de porc înăbușiți cu usturoi, vin alb și pastă de roșii, cu mămăligă, ou ochi și telemea.',
    timpPregatire: 15, timpGatire: 45, timp: 60, portii: 4, dificultate: 'mediu', vas: 'farfurie', etichete: [],
    ingrediente: [['porc-ceafa', 500], ['carnati-porc', 300], ['ulei', 30], ['usturoi', 20], ['vin-alb', 100], ['pasta-rosii', 40],
      ['boia', 3], ['cimbru', 1], ['piper', 1], ['sare', 10], ['malai', 300], ['ou', 200], ['telemea', 160]],
    gatit: { greutateGatita: 2320, nota: 'Estimare: carnea pierde ≈30% din greutate la gătit; mămăliga din 300 g mălai și 1,2 L apă (≈1,25 kg gătită); ouăle prăjite, telemeaua și sosul.' },
    estimari: ['Caloriile vinului includ alcoolul, care se evaporă în mare parte la fiert: valoarea reală e cu ≈50 kcal mai mică pe toată rețeta.'],
    pasi: [
      'Taie ceafa cuburi și cârnații bucăți. Rumenește-le în 20 g ulei, 10 minute.',
      'Adaugă usturoiul, boiaua și cimbrul, apoi vinul și pasta de roșii cu puțină apă; înăbușă acoperit 25 de minute.',
      'Între timp, fierbe 1,2 L apă cu sare, adaugă mălaiul în ploaie și amestecă 15–20 de minute până se îngroașă mămăliga.',
      'Prăjește ouăle ochi în restul de ulei.',
      'Servește tochitura cu mămăligă, telemea rasă și câte un ou deasupra.',
    ],
  },
  {
    id: 'ro-placinte-branza', nume: 'Plăcinte cu brânză', numeEn: 'Sweet cheese pies', masa: 'gustare-1',
    fel: 'patiserie', bucatarie: 'romaneasca',
    descriere: 'Plăcinte moldovenești din aluat dospit, umplute cu brânză de vaci dulce, vanilie și stafide, coapte la cuptor. 12 bucăți.',
    timpPregatire: 90, timpGatire: 30, timp: 120, portii: 12, dificultate: 'avansat', vas: 'tocator', etichete: ['meal-prep'],
    ingrediente: [['faina', 500], ['lapte', 250], ['drojdie', 25], ['zahar', 150], ['ou', 150], ['unt', 50], ['sare', 5],
      ['branza-vaci', 600], ['vanilie', 4], ['stafide', 50], ['galbenus', 17]],
    gatit: { greutateGatita: 1620, nota: 'Estimare: aluatul și umplutura (≈1,8 kg) pierd ≈10% din greutate la copt. O porție = o plăcintă (≈135 g).' },
    estimari: ['Brânza de vaci din comerț are între 2% și 10% grăsime; s-au folosit valorile USDA pentru brânză de vaci cu 2% grăsime.'],
    pasi: [
      'Dizolvă drojdia în laptele călduț cu 1 lingură de zahăr; lasă 10 minute.',
      'Frământă făina cu laptele cu drojdie, 50 g zahăr, un ou, untul topit și sarea, 10 minute. Lasă la dospit acoperit 1 oră.',
      'Amestecă brânza cu restul ouălor, restul zahărului, vanilia și stafidele.',
      'Împarte aluatul în 12 bucăți, întinde fiecare, pune umplutura și strânge marginile spre centru.',
      'Așază plăcintele în tavă, unge-le cu gălbenuș și coace 25–30 de minute la 180 °C.',
    ],
  },
  {
    id: 'ro-papanasi', nume: 'Papanași cu smântână și dulceață', numeEn: 'Romanian fried cheese doughnuts', masa: 'gustare-2',
    fel: 'desert', bucatarie: 'romaneasca',
    descriere: 'Gogoși din brânză de vaci prăjite, servite calde cu smântână, dulceață și zahăr pudră. O porție = un papanaș mare și unul mic.',
    timpPregatire: 20, timpGatire: 20, timp: 40, portii: 4, dificultate: 'mediu', vas: 'farfurie', etichete: [],
    ingrediente: [['branza-vaci', 500], ['ou', 100], ['faina', 200], ['zahar', 50], ['praf-copt', 5], ['sare', 1], ['vanilie', 4],
      ['ulei', 70], ['smantana', 200], ['gem', 120], ['zahar-pudra', 10]],
    gatit: { greutateGatita: 1170, nota: 'Estimare: aluatul (≈860 g) pierde ≈10% apă la prăjire și absoarbe uleiul; plus smântâna, dulceața și zahărul pudră.' },
    estimari: [
      'Uleiul absorbit la prăjire e estimat la 70 g (≈8% din greutatea aluatului); pentru prăjire se folosesc ≈700 ml ulei, restul rămâne în tigaie.',
      'Brânza de vaci din comerț are între 2% și 10% grăsime; s-au folosit valorile USDA pentru brânză de vaci cu 2% grăsime.',
    ],
    pasi: [
      'Amestecă brânza cu ouăle, zahărul, vanilia și sarea.',
      'Adaugă făina amestecată cu praful de copt și frământă scurt un aluat moale.',
      'Formează 4 inele mari și 4 bile mici, cu mâinile pudrate cu făină.',
      'Prăjește-le în ulei încins (170 °C), câte 3–4 minute pe fiecare parte, până se rumenesc; scurge-le pe hârtie.',
      'Servește calzi: inelul, smântână, dulceață, bila deasupra și zahăr pudră.',
    ],
  },
];
