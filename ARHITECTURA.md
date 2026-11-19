# Jurnal de antrenament — arhitectură

Aplicație web (PWA) în JavaScript simplu, fără framework și fără pas de build.
Fișierele se urcă direct pe GitHub Pages. Datele stau doar pe telefon (IndexedDB) și nu sunt trimise nicăieri.

## Fișiere (în ordinea încărcării din index.html)

| Fișier | Rol |
|---|---|
| `db.js` | IndexedDB: deschidere, actualizare de schemă, citire/scriere pe fiecare store, copii automate |
| `validare.js` | Validarea și curățarea backupurilor (fără DOM, testabil în Node) |
| `exercitii.js` | Biblioteca de 118 exerciții, șabloane de antrenament, siluete SVG |
| `analiza.js` | Calcule: 1RM, recorduri, sugestii de progresie, serii pe grupă, tendința greutății (fără DOM) |
| `figuri.js` | Ilustrațiile exercițiilor: alege fișierul SVG din `ilustratii/` (generat de `tools/ilustratii/`) |
| `catalog.js` | Biblioteca unificată: catalog + exercițiile și preferințele tale, grupe, alternative, validarea exercițiilor proprii |
| `ui.js` | Componente comune: `el`, iconițe, butoane, notificări, dialoguri, stări goale, formatări |
| `grafice.js` | Grafice pe canvas, cu redesenare la redimensionare și valoare la atingere |
| `setari.js` | Setările (localStorage + incluse în backup) și ecranul Setări |
| `timer.js` | Timerul de pauză și semnalul sonor |
| `sesiune.js` | Antrenamentul în curs: exerciții, serii, ciornă, recorduri, închidere |
| `corp.js` | Greutate corporală și măsurători |
| `progres.js` | Graficele de progres și seriile pe săptămână |
| `istoric.js` | Istoricul sesiunilor, editare și ștergere |
| `biblioteca.js` | Ecranul Exerciții: listă, filtre, detalii, formular, reîncadrarea grupei vechi, selectorul rapid, rutine |
| `backup.js` | Export, restaurare, copii automate, stare stocare, ștergerea datelor |
| `acasa.js` | Ecranul Acasă (panoul): doar afișare; calculele sunt în `analiza.js` |
| `main.js` | Navigarea și pornirea aplicației (se încarcă ultimul) |
| `sw.js` | Service worker: întâi rețeaua (max. 3 s), apoi cache |

Regula: fișierele definesc funcții; singurul cod care rulează la încărcare este în `main.js`
(prin funcțiile `init…()` ale fiecărui modul).

## Date

Baza `jurnal-antrenament`, versiunea 4:

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

### Reguli de compatibilitate

1. Actualizarea schemei doar **adaugă** stores. Nu rescrie și nu șterge înregistrări.
2. Câmpurile noi sunt opționale; lipsa lor are o valoare implicită la citire.
3. Înregistrările ilizibile sunt ignorate la afișare, dar rămân în bază și în backup.
4. Câmpurile necunoscute se păstrează la import (un backup dintr-o versiune viitoare a unei înregistrări nu pierde date).

## Backup

Format v3: `{ aplicatie, versiune: 3, schema, exportat, setari, sesiuni, exercitii, masuratori, rutine }`.
Se pot importa și backupurile v1/v2. La restaurare:

1. fișierul e validat și curățat (`valideazaBackup`);
2. utilizatorul vede ce conține și câte înregistrări sunt deteriorate;
3. se face obligatoriu o copie automată a datelor actuale (dacă nu reușește, restaurarea se oprește);
4. înlocuirea se face într-o singură tranzacție: ori reușește toată, ori nu se schimbă nimic.

## Reguli de calcul

- **Serie validă**: are repetări, secunde sau metri > 0. **Serie de lucru**: validă și nu e încălzire.
- **Încălzirea** nu contează la recorduri, la numărul de serii, la seriile pe grupă și la sugestii; volumul o include.
- **1RM estimat** (Epley): `kg × (1 + repetări / 30)`. Mai puțin precis peste 10–12 repetări.
- **Volum**: `kg × repetări`, adunat pe serii. Seriile pe timp/distanță și exercițiile cu greutatea corpului fără lest dau 0 (de revăzut în etapa 5).
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
