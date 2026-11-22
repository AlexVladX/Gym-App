# Jurnal de antrenament — arhitectură

Aplicație web (PWA) în JavaScript simplu, fără framework și fără pas de build.
Fișierele se urcă direct pe GitHub Pages. Datele stau doar pe telefon (IndexedDB) și nu sunt trimise nicăieri.

## Fișiere (în ordinea încărcării din index.html)

| Fișier | Rol |
|---|---|
| `db.js` | IndexedDB: deschidere, actualizare de schemă, citire/scriere pe fiecare store, copii automate |
| `validare.js` | Validarea și curățarea backupurilor (fără DOM, testabil în Node) |
| `exercitii.js` | Biblioteca de 118 exerciții, șabloane de antrenament, siluete SVG |
| `analiza.js` | Calcule: 1RM, volum, recorduri, sugestii de progresie, serii pe grupă, tendința greutății (fără DOM) |
| `statistici.js` | Statistici avansate (etapa 5): perioade, rezumate, evoluție, distribuție pe grupe, progresie, recorduri pe repetări (fără DOM) |
| `figuri.js` | Ilustrațiile exercițiilor: alege fișierul SVG din `ilustratii/` (generat de `tools/ilustratii/`) |
| `nutritie-alimente.js` | Nutriție: 165 de alimente cu valori la 100 g din USDA SR28 (generat de `tools/nutritie/genereaza.js`) |
| `nutritie-retete.js` | Nutriție: 150 de rețete, 30 pe fiecare masă (generat de `tools/nutritie/retete.js` din `tools/nutritie/retete/`) |
| `nutritie-calcul.js` | Nutriție: calcule (valori din grame, porții, distribuția energiei, etichete, alergeni), fără DOM |
| `nutritie-zi.js` | Nutriție (etapa 3): ținte (estimare Mifflin-St Jeor), mesele zilei, planificat vs. mâncat, validarea zilelor (fără DOM) |
| `nutritie-imagini.js` | Nutriție: fotografia rețetei din bibliotecă (Pexels, locală, WebP), atribuirea și imaginea de rezervă |
| `catalog.js` | Biblioteca unificată: catalog + exercițiile și preferințele tale, grupe, alternative, validarea exercițiilor proprii |
| `ui.js` | Componente comune: `el`, iconițe, butoane, notificări, dialoguri, stări goale, formatări |
| `grafice.js` | Grafice pe canvas, cu redesenare la redimensionare și valoare la atingere |
| `setari.js` | Setările (localStorage + incluse în backup) și ecranul Setări |
| `timer.js` | Timerul de pauză și semnalul sonor |
| `sesiune.js` | Antrenamentul în curs: exerciții, serii, ciornă, recorduri, închidere |
| `corp-calcul.js` | Calcule pentru Corp (etapa 6): tipuri și unități, media pe 7 zile, IMC, obiectiv, comparare (fără DOM) |
| `corp.js` | Ecranul Corp: greutate, profil și obiectiv, măsurători, corectare, comparare, poze de progres |
| `siguranta.js` | Siguranța datelor (etapa 8): Șterse recent cu anulare, verificarea datelor, export CSV, partajarea fișierelor, memento backup, avertizarea pentru două file |
| `realizari.js` | Realizări (etapa 7): nivel, obiectivul săptămânal, insigne cu trepte (fără DOM) |
| `realizari-ui.js` | Fila Progres → Realizări, cardul de pe Acasă, sărbătorirea de la finalul antrenamentului |
| `progres.js` | Ecranul Progres → Grafice: afișarea statisticilor (perioadă, rezumat, evoluție, grupe, exercițiu, forță, recorduri) |
| `istoric.js` | Istoricul sesiunilor, editare și ștergere |
| `biblioteca.js` | Ecranul Exerciții: listă, filtre, detalii, formular, reîncadrarea grupei vechi, selectorul rapid, rutine |
| `nutritie.js` | Ecranul Nutriție: rețete și alimente (listă, filtre, detalii, editor, favorite, poza rețetei) |
| `nutritie-zi-ui.js` | Nutriție → Ziua mea: sumarul zilei, cele 5 mese, stările, adăugarea rețetelor, dialogul țintelor |
| `backup.js` | Export, restaurare, copii automate, stare stocare, ștergerea datelor |
| `acasa.js` | Ecranul Acasă (panoul): doar afișare; calculele sunt în `analiza.js` |
| `main.js` | Navigarea și pornirea aplicației (se încarcă ultimul) |
| `sw.js` | Service worker: întâi rețeaua (max. 3 s), apoi cache |

Regula: fișierele definesc funcții; singurul cod care rulează la încărcare este în `main.js`
(prin funcțiile `init…()` ale fiecărui modul).

## Date

Baza `jurnal-antrenament`, versiunea 9:

- `sesiuni` `{ id, data: 'AAAA-LL-ZZ', inceput, sfarsit, grupe[], exercitii: [{ nume, serii: [{ kg, repetari }] }] }`
  Din etapa 3 (`versiune: 2`), opțional: `durataActivaMs`, `pauze[{start, sfarsit}]`, `nota`, `serii` (nr. serii de lucru),
  `volum`; pe exercițiu `tip` ('corp' | 'timp' | 'distanta'; lipsă = greutate), `nota`, `superset` ('A', 'B'…);
  pe serie `tip` ('incalzire' | 'drop' | 'esec'; lipsă = normală), `durataSec`, `distantaM`.
- `exercitii` (cheie: `nume`) — pentru un exercițiu din catalog doar ce ai schimbat `{ nume, grupa?, tip?, favorit?, nota? }`;
  pentru unul propriu tot: `{ nume, grupa, secundari[], echipament, categorie, nivel, tip, instructiuni, favorit, nota, creat }`.
  Înregistrările care diferă doar prin litere mari/mici se unesc la citire (prima are prioritate).
- `masuratori` `{ id, data, tip, valoare, creat }`
- `rutine` `{ id, nume, grupe[], exercitii[], creat }`
- `ciorna` (cheia `curenta`) — antrenamentul în curs
- `instantanee` (v4) `{ id, creat, motiv, continut }` — ultimele 5 copii automate
- `meta` (v4) — ex. `ultimaCopieAutomata`
- `cos` (v6) „Șterse recent": `{ id, tip (store-ul de origine), inregistrare, sters (ms), eticheta }`, 30 de zile; nu intră în backup
- `poze` (v5) `{ id, data, unghi: 'fata' | 'lateral' | 'spate', imagine: Blob JPEG (max. 1280 px), latime, inaltime, creat }`
- Setări noi (etapa 6, în localStorage și în backup): `inaltimeCm`, `obiectiv: { tinta, start, dela }`.
- `alimente` (v7, nutriție) — alimentele tale, cheie text `u-…`: `{ id, nume, cat, kcal, proteine, carbohidrati, grasimi, fibre (la 100 g), alergeni[], urme[], animal, aspect, culoare, buc?, creat, modificat }`
- `retete` (v7) — rețetele tale, cheie text `u-…`: `{ id, nume, masa, descriere, timp, portii, dificultate, vas, etichete[] (doar meal-prep, buget), ingrediente: [[idAliment, grame pentru toată rețeta]], pasi[], sursa? (rețeta duplicată), creat, modificat }`
- `pozeRetete` (v7) — poza ta pentru o rețetă (din bibliotecă sau proprie): `{ id (= id-ul rețetei), imagine: Blob JPEG (max. 1024 px), latime, inaltime, creat }`
- Setare nouă: `retetePreferate` — id-urile rețetelor favorite.
- `zileNutritie` (v8) — mesele unei zile, cheie `data` ('AAAA-LL-ZZ'): `{ data, mese: [{ id, masa, idReteta, nume, portii, valoriPortie{kcal, proteine, carbohidrati, grasimi, fibre}, stare: 'neinceput' | 'partial' | 'complet', portiiMancate?, adaugat, modificat }], modificat }`
- Intrările unei zile au din etapa 4, opțional: `ingredientePortie [[idAliment, grame pe porție]]`, `timp`, `blocat`, `ajustat`.
- `planuriNutritie` (v9) — planurile de mese salvate, cheie text `u-…`: `{ id, nume, favorit, mese: [{ masa, idReteta, nume, portii, valoriPortie, ingredientePortie?, timp? }], creat, modificat }`. Ștergerea trece prin „Șterse recent”.
- Setări noi (etapa 3 nutriție): `tinteNutritie { kcal, proteine?, carbohidrati?, grasimi?, fibre?, estimat? }`, `anNastere`, `sex` ('m' | 'f'), `activitate`, `scopNutritie`.
- Alimentele și rețetele din bibliotecă nu stau în bază: sunt fișiere ale aplicației (se actualizează odată cu ea).
  Id-urile lor nu încep cu `u-`, deci nu se pot amesteca cu ale tale.

### Reguli de compatibilitate

1. Actualizarea schemei doar **adaugă** stores. Nu rescrie și nu șterge înregistrări.
2. Câmpurile noi sunt opționale; lipsa lor are o valoare implicită la citire.
3. Înregistrările ilizibile sunt ignorate la afișare, dar rămân în bază și în backup.
4. Câmpurile necunoscute se păstrează la import (un backup dintr-o versiune viitoare a unei înregistrări nu pierde date).

## Backup

Format v3: `{ aplicatie, versiune: 3, schema, exportat, setari, sesiuni, exercitii, masuratori, rutine, poze?, alimente?, retete?, pozeRetete?, zileNutritie?, planuriNutritie? }`.
Nutriția (alimente, rețete, pozele rețetelor) e opțională în fișier: un backup fără ea (ex. făcut înainte de modulul de nutriție)
nu atinge nutriția de pe telefon; o versiune mai veche a aplicației o ignoră. Pozele rețetelor urmează regula pozelor de progres.
Pozele (etapa 6) sunt în fișier ca data-URL JPEG; o versiune mai veche a aplicației le ignoră. Copia automată săptămânală
nu include pozele; copia dinainte de restaurare le include doar dacă backupul restaurat are poze. Un backup fără poze
nu atinge pozele de pe telefon.
Se pot importa și backupurile v1/v2. La restaurare:

1. fișierul e validat și curățat (`valideazaBackup`);
2. utilizatorul vede ce conține și câte înregistrări sunt deteriorate;
3. se face obligatoriu o copie automată a datelor actuale (dacă nu reușește, restaurarea se oprește);
4. înlocuirea se face într-o singură tranzacție: ori reușește toată, ori nu se schimbă nimic.

## Reguli de calcul

- **Serie validă**: are repetări, secunde sau metri > 0. **Serie de lucru**: validă și nu e încălzire.
- **Încălzirea** nu contează nicăieri în statistici: recorduri, număr de serii, serii pe grupă, sugestii și (din etapa 5) volum.
  Seriile drop și cele până la eșec sunt serii de lucru obișnuite (fiecare cu greutatea ei, deci fără volum dublat).
- **1RM estimat** (Epley): `kg × (1 + repetări / 30)`. Mai puțin precis peste 10–12 repetări.
- **Volum** (din etapa 5): adunat pe seriile de lucru cu repetări.
  - greutate: `kg × repetări`;
  - greutatea corpului: `(greutatea corporală la data sesiunii + kg în plus) × repetări`. Greutatea corporală =
    ultima cântărire din Corp din ziua aceea sau dinainte; dacă nu există, prima de după; fără cântăriri, 0.
    Tipul exercițiului: cel salvat în sesiune (din etapa 3; lipsa = greutate), iar la sesiunile mai vechi cel din bibliotecă;
  - seriile pe timp sau distanță: 0 (au recordurile lor: timp, distanță).
  - Câmpul `volum` salvat în sesiuni e doar informativ; afișarea recalculează mereu din serii (după regulile de acum).
- **Același exercițiu de două ori** într-o sesiune se unește la calcul (o singură sesiune, toate seriile).
- Toate statisticile se calculează din sesiunile salvate la fiecare afișare: editarea sau ștergerea unei sesiuni
  le actualizează imediat. Antrenamentul în curs (ciorna) nu intră. Unitatea e mereu kg.

## Siguranța datelor (etapa 8)

- **Ștergerea nu e definitivă**: antrenamentele, măsurătorile, pozele și rutinele șterse se mută (în aceeași tranzacție)
  în store-ul `cos`. Mesajul de după ștergere are „Anulează"; Setări → Șterse recent le arată cu zilele rămase,
  cu restaurare și ștergere definitivă (cu confirmare). La pornire se șterg definitiv cele mai vechi de 30 de zile.
  Restaurarea păstrează id-ul original, iar dacă e ocupat (după o restaurare de backup) primește unul nou.
  „Șterge toate datele" golește și coșul. Coșul nu intră în backup.
- **Backup**: exportul trimite fișierul prin meniul de partajare al telefonului (Fișiere, Drive, e-mail) când există
  (`navigator.share` cu fișiere, ecran tactil), altfel îl descarcă. Anularea partajării nu se numără ca backup.
  Pe Acasă apare un memento dacă ai cel puțin 3 antrenamente și nu ai exportat niciodată sau de 14+ zile.
- **CSV** (Excel / Google Sheets): antrenamentele câte un rând pe serie validă (data, nr. antrenamentului, exercițiu,
  grupă, nr. seriei, tip, kg, repetări, secunde, metri, volumul aplicației, supraset, notă) și măsurătorile cu unitate.
  Separator „;", virgulă zecimală, UTF-8 cu BOM. CSV-ul nu se poate restaura; pentru asta e backupul JSON.
- **Verifică datele**: numără înregistrările din fiecare store și pe cele care se pot afișa. Cele deteriorate nu se
  șterg niciodată automat: rămân în bază și intră în backup (validarea de la restaurare le ignoră).
- **Două file**: un `BroadcastChannel` anunță celelalte file; ambele arată o avertizare (antrenamentul în curs e salvat
  de fiecare filă și s-ar putea suprascrie).
- **Spațiu plin** (`QuotaExceededError`): mesaj explicit; antrenamentul în curs rămâne deschis.
- Stocarea: se cere stocare persistentă; pe iPhone, în Safari (nu de pe ecranul principal), se arată sfatul de a instala aplicația.

## Realizări (etapa 7)

- Nimic nu se ține separat: nivelul, seriile și insignele se calculează din antrenamentele, cântăririle, măsurătorile
  și pozele salvate. Editarea sau ștergerea unui antrenament le recalculează (o insignă se poate bloca din nou).
- **Nivel**: după numărul de antrenamente încheiate; nivelul N+1 începe la `PRAGURI_NIVEL[N]`
  (0, 1, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000).
- **Obiectivul săptămânal** (`setari.obiectivSaptamanal`, 1–7, implicit 3): antrenamente luni–duminică. Seria = săptămâni
  consecutive cu obiectivul atins; săptămâna în curs intră când e atins și nu rupe seria până nu se termină.
  Schimbarea obiectivului se aplică și retroactiv (seriile se recalculează cu noul obiectiv).
- **Insigne** (familii cu trepte bronz → argint → aur → platină): o treaptă se deblochează la data antrenamentului
  (sau a cântăririi, pozei) la care valoarea a ajuns la prag. Valorile: antrenamente; săptămâni consecutive cu cel puțin
  un antrenament; săptămâni consecutive cu obiectivul atins; tone (volumul din etapa 5); ore active; recorduri noi
  (`recorduriNoi`); exerciții diferite; săptămâni cu toate cele 6 zone (piept, spate, umeri, brațe, picioare, abdomen);
  forța = cel mai bun 1RM estimat / greutatea corporală la data sesiunii (împins, genuflexiuni, îndreptări);
  repetări într-o serie de tracțiuni; zile cu cântărire; zile cu ≥ 5 măsurători; zile cu poze; greutatea țintă
  (media pe 7 zile ajunge la țintă, după data setării).
- La salvarea unui antrenament, realizările de dinainte se compară cu cele de după: insignele noi apar într-un dialog,
  iar obiectivul atins și nivelul nou ca mesaje.

## Corp (etapa 6)

- **Tipuri standard** cu unități: greutate (kg), grăsime corporală (%), gât, umeri, piept, talie, șolduri, braț, antebraț,
  coapsă, gambă (cm). Tipurile scrise de tine rămân, fără unitate. La salvare, tipul se potrivește cu unul existent
  fără să conteze literele mari/mici sau diacriticele; valorile neplauzibile (ex. talie 8,8 cm) sunt refuzate.
- **Valoarea zilei** = media înregistrărilor din ziua aceea. **Media pe 7 zile** (graficul) = media cântăririlor din ultimele
  7 zile până la fiecare cântărire. Tendința (kg/săpt.) și media de 7 zile din plăcuțe sunt cele de dinainte (`tendintaGreutate`).
- **IMC** = kg / (m²), din media pe 7 zile; categorii OMS (< 18,5 / < 25 / < 30 / ≥ 30). Nu ține cont de masa musculară.
- **Obiectiv**: pornește de la media pe 7 zile din ziua setării. Progres = cât ai mers spre țintă / distanța totală (0–100%).
  Estimarea = (țintă − acum) / tendință, doar dacă tendința merge spre țintă cu cel puțin 0,05 kg/săpt. și durează max. 2 ani.
- **Comparare**: valorile din cele două date; greutatea din cântărirea cea mai apropiată (max. 3 zile).
- **Poze**: micșorate în browser la cel mult 1280 px, JPEG calitate 0,82 (de obicei 100–300 KB).

## Statistici avansate (etapa 5)

- **Perioade**: 4 săptămâni (28 de zile), 3 luni (91), 6 luni (182), 1 an (365), Tot (de la primul antrenament), toate
  până azi inclusiv. **Comparația** se face cu perioada de aceeași lungime de dinainte, doar dacă ai antrenamente înainte.
- **Rezumat**: antrenamente, serii de lucru, volum, timp activ (durata activă salvată, altfel sfârșit − început),
  antrenamente pe săptămână = antrenamente / (zile / 7), recorduri noi (aceleași reguli ca insigna din antrenament).
- **Evoluție**: săptămâni (de luni) sau luni calendaristice, continue (și cele fără antrenament); volum, serii,
  antrenamente sau timp. Media = totalul / numărul de săptămâni sau luni din perioadă.
- **Grupe musculare**: serii de lucru pe grupa principală a exercițiului (din bibliotecă), procent din total.
- **Progres pe exercițiu**, un punct pe sesiune: 1RM estimat (cea mai bună serie), greutate maximă, volum,
  repetări maxime (sau timp / distanță). Schimbarea = ultima sesiune față de prima din perioadă.
- **Cea mai mare greutate pe număr de repetări**: pentru N = 1, 3, 5, 8, 10, 12, greutatea maximă ridicată de cel puțin N ori.
- **Forță pe exercițiile principale**: exercițiile cu greutate făcute cel mai des în perioadă (max. 6), 1RM estimat
  la prima și la ultima sesiune din perioadă, plus recordul absolut.
- **Recorduri personale**: pentru fiecare exercițiu, 1RM estimat și greutatea maximă (sau repetări / timp / distanță),
  cele mai recente întâi.
- Teste: `tests/statistici.test.js` (valori calculate de mână).
- **Recorduri**: greutate maximă, 1RM estimat, repetări (corp fără lest), timp (exerciții pe timp), distanță.
- **Durata**: durata activă = de la început la final, minus pauzele antrenamentului.

## Antrenamentul în curs (etapa 3)

- Se salvează doar seriile **bifate ✓**. Bifarea unei serii goale o completează cu valorile de data trecută.
- Ciorna (`versiune: 2`) păstrează și bifele, notițele, pauzele și momentul ultimei modificări.
  Ciornele vechi (fără versiune): seriile completate se consideră bifate, ca înainte.
- După 3 ore fără activitate, la pornire se întreabă: Continuă (intervalul nu se numără), Salvează (se încheie la ultima activitate) sau Renunță.
- Pauza automată după o serie bifată (setare); într-un superset pornește doar după ultimul exercițiu din grup.

## Biblioteca (etapa 4)

- **11 grupe**: Piept, Spate, Umeri, Biceps, Triceps, Antebrațe, Cvadricepși, Femurali, Fese, Gambe, Abdomen.
  Cele 19 exerciții „Picioare" din catalog au fost împărțite (14 Cvadricepși, 5 Femurali). Exercițiile proprii cu
  grupa veche „Picioare" o păstrează până o alegi tu în Exerciții; istoricul nu se rescrie (grupa se citește din bibliotecă).
- **Categorie** (Compus/Izolare) pusă manual pentru toate cele 118 exerciții.
- **Mușchi secundari** = mușchii exercițiului minus cei ai grupei principale.
- **Alternative**: aceeași grupă; scor = mușchi secundari comuni (×2) + aceeași categorie (3) + același tip (1)
  + alt echipament (1) − diferența de dificultate.
- **Redenumirea** unui exercițiu propriu schimbă numele în bibliotecă, istoric și rutine într-o singură tranzacție,
  după o copie automată de siguranță; ștergerea îl scoate doar din bibliotecă (istoricul rămâne).

## Ilustrațiile exercițiilor

- Fiecare exercițiu are două fișiere SVG proprii în `ilustratii/`: `<nume>.svg` (poziția de start și cea finală,
  cu săgeata mișcării, raport 16:10) pentru detalii și `<nume>-mini.svg` (o poziție, raport 46:54) pentru liste.
  Numele fișierului = numele exercițiului fără diacritice, cu cratime (`numeFisierIlustratie` din figuri.js).
- Exercițiile create de tine primesc desenul grupei (`ilustratii/grupa-<grupa>…`); fără grupă, iconița generică.
- Fișierele sunt **generate**, nu desenate de mână: `node tools/ilustratii/genereaza.js` (fără dependențe).
  - `geom.js`, `pictura.js`: geometrie, degradeuri refolosite, forme cu `<use>` (fișiere mici).
  - `corp.js`: corpul anatomic în vedere laterală și frontală (din față / din spate), pozat prin unghiuri de articulații;
    mușchii sunt definiți relativ la profilul fiecărui segment și au zonele din aplicație.
  - `baza.js`: cinematică inversă (mâna/glezna la un punct dat); `scena.js`, `echipament.js`: bănci, bare, gantere, scripeți, aparate.
  - `exercitii/*.js`: pozițiile fiecărui exercițiu; `exercitii/grupe.js`: desenele implicite pe grupe.
  - `--grupa Piept --iesire <dosar> --revizie` scrie o pagină de verificare cu toate desenele unei grupe.
- Culori: mușchii principali verde-lămâie, cei secundari verde stins, restul gri. Mușchii evidențiați vin din datele
  exercițiului (aceleași reguli ca în catalog); singura corecție e la aparatul pentru adductori (adductorii principali).
- Service workerul salvează toate miniaturile la instalare (lista în `ilustratii/lista.json`), iar ilustrațiile
  (care au versiunea în adresă) se servesc întâi din copia locală. După ce schimbi pozițiile, rulează generatorul
  și mărește versiunea aplicației.
- `tests/figuri.test.js`: fiecare exercițiu are ambele fișiere, valide, cu mușchiul principal vizibil; desene diferite
  pentru exerciții diferite; fișierele din dosar sunt identice cu ce produce generatorul acum.

## Panoul Acasă

- Se deschide la pornire; dacă e un antrenament în curs, aplicația pornește direct pe Antrenament.
- **Serie** = săptămâni consecutive cu cel puțin un antrenament. Săptămâna curentă fără antrenament nu rupe seria.
- **Recorduri recente** = recordurile din ultimele 30 de zile, obținute reluând istoricul sesiune cu sesiune
  (aceleași reguli ca insigna PR din timpul antrenamentului). Fără recorduri recente: cele mai mari 1RM estimate.
- **Următorul antrenament** = rutina făcută cel mai demult (o rutină contează ca făcută într-o sesiune
  cu cel puțin jumătate din exercițiile ei); fără rutine, cele 3 grupe lucrate cel mai demult.
- **Grupe musculare** = serii complete pe grupa principală, în ultimele 7 sau 30 de zile.

## Teste

```
node --test tests/*.test.js
```

## La fiecare publicare

Versiunea apare în trei locuri și trebuie să fie aceeași (ex. `11` → `12`):

1. `sw.js` — `const VERSIUNE = '11'` (și orice fișier nou adăugat în `FISIERE_VERSIONATE`);
2. `index.html` — `data-versiune="11"` pe `<body>` și `?v=11` la `styles.css` și la fiecare script;
3. `styles.css` — `--versiune-css: "11"`.

De ce: GitHub Pages lasă browserul să păstreze fișierele 10 minute. Fără versiune în adresă,
telefonul putea combina pagina nouă cu foaia de stil veche (iconițe negre, pline).
Dacă totuși se întâmplă, `main.js` observă diferența, golește cache-ul și reîncarcă o dată.

Iconițele SVG au atributele de desen (`fill="none"`, `stroke="currentColor"`, dimensiuni) direct pe element,
nu doar în CSS, ca să rămână corecte chiar fără foaia de stil.

## Nutriție — reguli de calcul

- **Sursa**: USDA National Nutrient Database for Standard Reference, Release 28 (domeniu public). Fiecare aliment
  din bibliotecă păstrează codul NDB și descrierea din sursă. Câteva produse românești sunt aproximate cu cel mai apropiat
  aliment USDA (telemea = feta, cașcaval = gouda, brânză de vaci = cottage 2%); aproximarea e scrisă la aliment și în rețetă.
- **Carbohidrați** = totali, „prin diferență”, ca în sursă (includ fibrele).
- **Valorile unei rețete** = Σ (grame × valoarea la 100 g / 100) pentru fiecare ingredient; **pe porție** = total / porții.
  Nimic nu e scris de mână. Cantitățile sunt ale ingredientelor crude/uscate (orez, paste, linte), cum se cântăresc.
- Un ingredient care nu mai există (aliment propriu șters) nu se ghicește: e exclus din valori și semnalat.
  Un aliment propriu folosit într-o rețetă proprie nu se poate șterge.
- **Distribuția energiei**: proteine×4, carbohidrați×4, grăsimi×9, raportate la suma lor (procentele dau 100).
- **Etichete calculate** (pe porție): Bogat în proteine ≥25% din energie și ≥20 g (≥12 g la gustări);
  Puține calorii ≤400 kcal (≤200 la gustări); Bogat în carbohidrați ≥55%; Sărac în carbohidrați ≤20%;
  Echilibrat P 15–35%, C 35–55%, G 20–35%; Vegetarian fără carne/pește; Vegan fără nicio origine animală (inclusiv miere);
  Fără gluten / Fără lactate: niciun ingredient care conține sau „poate conține” glutenul/laptele; Rapid ≤15 minute.
  Dacă lipsește un ingredient, etichetele de dietă și alergeni nu se acordă. **Declarate** de autor: Meal prep, Buget redus.
- **Alergeni**: cei 14 din Regulamentul UE 1169/2011, pe fiecare aliment („conține” și „poate conține”).
  Ovăzul obișnuit e tratat ca având gluten.
- Valorile sunt estimări, nu recomandări medicale.

### Calculatorul zilei (etapa 3)

- **Planificat** = toate rețetele puse în zi (valori pe porție × porții), indiferent de stare.
- **Mâncat** = doar ce marchezi: „Mâncată” = toate porțiile, „Parțial” = porțiile scrise de tine (0 < x < planificat),
  „Neîncepută” = 0. Nicio masă nu se marchează automat.
- Valorile pe porție (și numele) se **copiază în zi la adăugare**: editarea sau ștergerea rețetei nu schimbă zilele notate.
- **Rămas** = ținta − mâncat (negativ = peste țintă). Doar caloriile sunt obligatorii ca țintă; macro fără țintă arată doar mâncat/plan.
- **Estimarea țintelor** (orientativă): metabolism bazal Mifflin-St Jeor (10·kg + 6,25·cm − 5·ani + 5 / −161),
  × factor de activitate (1,2 / 1,375 / 1,55 / 1,725 / 1,9), ajustat pe obiectiv (masă +10%, slăbire −20%, menținere 0),
  fără să coboare sub metabolismul bazal la slăbire și sub 1500 kcal (bărbați) / 1200 kcal (femei).
  Proteine 1,8 / 1,6 / 2,0 g/kg; grăsimi 25% din calorii (minim 0,6 g/kg); fibre 14 g la 1000 kcal; restul carbohidrați.
  Greutatea = media pe 7 zile din Corp; înălțimea din Corp; vârsta din anul nașterii. Toate țintele se pot edita manual.


### Generatorul aleatoriu (etapa 4)

- „Generează planul” alege câte o rețetă la întâmplare pentru fiecare din cele 5 mese (din bibliotecă și rețetele tale,
  după masa rețetei). Nicio rețetă nu se repetă în zi. Favoritele au șanse duble.
- Se înlocuiesc doar intrările **neîncepute și neblocate**. O masă care are o intrare blocată sau începută
  rămâne întreagă (nu primește o rețetă în plus). Generarea și încărcarea unui plan se pot anula imediat.
- „Altă rețetă” schimbă o singură intrare (aceeași masă, aceleași porții, rețetă care nu e deja în zi); restul nu se atinge.
- Ajustarea cantităților se face pe intrarea din zi (grame pe porție), nu pe rețetă; valorile se recalculează
  din ingrediente. Intrările mâncate sau parțiale nu se mai modifică (porții, cantități).
- Un plan salvat păstrează rețetele, porțiile și cantitățile ajustate, fără stări și blocări; la încărcare se aplică
  aceeași regulă ca la generare.
