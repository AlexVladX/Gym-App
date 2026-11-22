# Faza foto (brief "PROFESSIONAL FOOD PHOTOGRAPHY UPGRADE") — aprobat stilul pe 5 mostre, acum restul de 104
Reguli: doar poze care arată felul rețetei (verificate vizual); Unsplash doar "Free"(Unsplash License), niciodată Unsplash+;
Commons cu licență CC/PD; Pexels blocat de anti-bot (nu ocolim). Dacă nu există potrivită -> rămâne imaginea de rezervă.
Fără duplicat: aceeași poză nu pentru două rețete.
Salvare: alese-faza5.txt  -> Unsplash: id|unsplash|idFoto|slug|Autor|profil ; Commons: id|Fisier.jpg|Autor|Licenta
Respinse (fără poză potrivită): vezi respinse-faza5.txt
Unelte: taie.py <png> <id> [box]; taie_u.py <png> <id> [dy] (detectează automat fotografia pe pagina Unsplash 1400x992)
La final: node tools/nutritie/retete.js după ce scrii foto-unsplash.js/foto-commons.js din alese-faza5.txt (script scrie_surse.py)
