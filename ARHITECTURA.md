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
| `ui.js` | Componente comune: `el`, iconițe, butoane, notificări, dialoguri, stări goale, formatări |
| `grafice.js` | Grafice pe canvas, cu redesenare la redimensionare și valoare la atingere |
| `setari.js` | Setările (localStorage + incluse în backup) și ecranul Setări |
| `timer.js` | Timerul de pauză și semnalul sonor |
| `sesiune.js` | Antrenamentul în curs: exerciții, serii, ciornă, recorduri, închidere |
| `corp.js` | Greutate corporală și măsurători |
| `progres.js` | Graficele de progres și seriile pe săptămână |
| `istoric.js` | Istoricul sesiunilor, editare și ștergere |
| `biblioteca.js` | Ecranul Exerciții (bibliotecă și rutine) |
| `backup.js` | Export, restaurare, copii automate, stare stocare, ștergerea datelor |
| `main.js` | Navigarea și pornirea aplicației (se încarcă ultimul) |
| `sw.js` | Service worker: întâi rețeaua (max. 3 s), apoi cache |

Regula: fișierele definesc funcții; singurul cod care rulează la încărcare este în `main.js`
(prin funcțiile `init…()` ale fiecărui modul).

## Date

Baza `jurnal-antrenament`, versiunea 4:

- `sesiuni` `{ id, data: 'AAAA-LL-ZZ', inceput, sfarsit, grupe[], exercitii: [{ nume, serii: [{ kg, repetari }] }] }`
- `exercitii` (cheie: `nume`) `{ nume, grupa }` — grupa aleasă pentru exercițiile proprii
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

- **1RM estimat** (Epley): `kg × (1 + repetări / 30)`. Mai puțin precis peste 10–12 repetări.
- **Volum**: `kg × repetări`, adunat pe serii. Exercițiile cu greutatea corpului au volum 0 (de revăzut în etapa 5).
- **Serii pe grupă**: seriile cu repetări > 0, pe grupa principală a exercițiului.

## Teste

```
node --test tests/*.test.js
```

## La fiecare publicare

Mărește numărul din `CACHE` în `sw.js` (ex. `jurnal-v9` → `jurnal-v10`) și adaugă în `FISIERE` orice fișier nou.
