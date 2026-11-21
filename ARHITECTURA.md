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
| `catalog.js` | Biblioteca unificată: catalog + exercițiile și preferințele tale, grupe, alternative, validarea exercițiilor proprii |
| `ui.js` | Componente comune: `el`, iconițe, butoane, notificări, dialoguri, stări goale, formatări |
| `grafice.js` | Grafice pe canvas, cu redesenare la redimensionare și valoare la atingere |
| `setari.js` | Setările (localStorage + incluse în backup) și ecranul Setări |
| `timer.js` | Timerul de pauză și semnalul sonor |
| `sesiune.js` | Antrenamentul în curs: exerciții, serii, ciornă, recorduri, închidere |
| `corp-calcul.js` | Calcule pentru Corp (etapa 6): tipuri și unități, media pe 7 zile, IMC, obiectiv, comparare (fără DOM) |
| `corp.js` | Ecranul Corp: greutate, profil și obiectiv, măsurători, corectare, comparare, poze de progres |
| `realizari.js` | Realizări (etapa 7): nivel, obiectivul săptămânal, insigne cu trepte (fără DOM) |
| `realizari-ui.js` | Fila Progres → Realizări, cardul de pe Acasă, sărbătorirea de la finalul antrenamentului |
| `progres.js` | Ecranul Progres → Grafice: afișarea statisticilor (perioadă, rezumat, evoluție, grupe, exercițiu, forță, recorduri) |
| `istoric.js` | Istoricul sesiunilor, editare și ștergere |
| `biblioteca.js` | Ecranul Exerciții: listă, filtre, detalii, formular, reîncadrarea grupei vechi, selectorul rapid, rutine |
| `backup.js` | Export, restaurare, copii automate, stare stocare, ștergerea datelor |
| `acasa.js` | Ecranul Acasă (panoul): doar afișare; calculele sunt în `analiza.js` |
| `main.js` | Navigarea și pornirea aplicației (se încarcă ultimul) |
| `sw.js` | Service worker: întâi rețeaua (max. 3 s), apoi cache |

Regula: fișierele definesc funcții; singurul cod care rulează la încărcare este în `main.js`
(prin funcțiile `init…()` ale fiecărui modul).

## Date

Baza `jurnal-antrenament`, versiunea 5:

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
- `poze` (v5) `{ id, data, unghi: 'fata' | 'lateral' | 'spate', imagine: Blob JPEG (max. 1280 px), latime, inaltime, creat }`
- Setări noi (etapa 6, în localStorage și în backup): `inaltimeCm`, `obiectiv: { tinta, start, dela }`.

### Reguli de compatibilitate

1. Actualizarea schemei doar **adaugă** stores. Nu rescrie și nu șterge înregistrări.
2. Câmpurile noi sunt opționale; lipsa lor are o valoare implicită la citire.
3. Înregistrările ilizibile sunt ignorate la afișare, dar rămân în bază și în backup.
4. Câmpurile necunoscute se păstrează la import (un backup dintr-o versiune viitoare a unei înregistrări nu pierde date).

## Backup

Format v3: `{ aplicatie, versiune: 3, schema, exportat, setari, sesiuni, exercitii, masuratori, rutine, poze? }`.
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
