// Fotografiile rețetelor din bibliotecă: o fotografie verificată pentru fiecare rețetă.
// Fișierele sunt în foto-retete/<id rețetă>.webp (800×600, decupate 4:3, WebP calitate 80).
// tools/nutritie/retete.js le adaugă în nutritie-retete.js ca rețeta.foto.
//
// Sursa: Pexels (https://www.pexels.com). Licența Pexels (https://www.pexels.com/license/) permite folosirea
// gratuită, inclusiv modificarea (decupare, redimensionare), fără atribuire obligatorie. Nu e voie: vânzarea
// copiilor nemodificate, redistribuirea ca bibliotecă de imagini, sugerarea unei susțineri din partea
// persoanelor sau mărcilor din fotografii. Aplicația afișează totuși autorul și linkul la fotografia originală.
//
// Regula de alegere: fotografia trebuie să arate felul de mâncare al rețetei (verificată vizual, nu primul
// rezultat al căutării). Dacă nu există o fotografie potrivită, rețeta nu primește una și aplicația
// afișează imaginea de rezervă (nu o fotografie a altui fel de mâncare).
//
// Coloane: idRețetă: [id Pexels, slug pagină, autor, profil autor]. Slug/autor/profil sunt null când nu au
// putut fi citite de pe pagina fotografiei; atunci linkul duce la pexels.com/photo/<id>/ și creditul e „Foto: Pexels”.

module.exports = {
  'md-bol-quinoa-capsuni': ['4725742', 'sliced-fruits-in-a-bowl-near-a-gold-spoon-on-a-white-surface', 'Polina Tankilevitch', 'polina-tankilevitch'],
  'md-omleta-spanac-telemea': ['5840304', 'stainless-steel-fork-and-knife-on-a-plate-of-food', 'Roman Odintsov', 'roman-odintsov'],
  'g1-crudite-hummus': ['3872351', 'fresh-sliced-vegetables-served-with-sauce-in-black-bowl-on-tray', 'Polina Tankilevitch', 'polina-tankilevitch'],
  'pr-pui-orez-broccoli': ['30635713', 'healthy-meal-prep-with-chicken-and-broccoli', 'IARA MELO', 'iara-melo-558346607'],
  'g2-shake-banana': ['15481508', 'cocktail-with-straw', 'Garley Gibson', 'garley-gibson-447183984'],
  'ci-somon-sparanghel': ['12318013', 'overhead-shot-of-a-seared-salmon-dish', 'Jordan Rushton', 'jordanr93'],
  'md-ovaz-banana-arahide': ['7167853', 'close-up-shot-of-a-bowl-of-delicious-oatmeal', null, null],
  'md-chefir-ovaz-para': ['4488082', 'white-ceramic-bowl-with-food', null, null],
  'md-iaurt-granola': ['6823331', 'sliced-kiwi-and-cashew-nuts-in-ceramic-bowl', null, null],
  'g1-iaurt-kiwi': ['1406573', 'fruit-salad-in-ceramic-bowl', null, null],
  'md-iaurt-fructe-padure': ['6823327', 'mixed-fruits-and-nuts-in-ceramic-bowls', null, null],
  'g1-iaurt-chia-zmeura': ['5945660', 'tasty-healthy-dessert-with-berries-served-on-pink-table-with-wooden-spoon', null, null],
  'g2-iaurt-ovaz-miere': ['29516115', 'delicious-greek-yogurt-with-fresh-fruits-and-honey', 'Enisa Halidi', 'enisahalidi'],
  'g1-iaurt-miere-nuci': ['5620413', 'yogurt-with-pecan-nuts', null, null],
  'g2-tzatziki-pita': ['5191839', null, null, null],
  'md-clatite-proteice-ovaz': ['3780469', 'pancakes-with-black-berries-on-white-ceramic-plate', 'Lucas Guizo', null],
  'md-clatite-ricotta-zmeura': ['6758332', 'two-plates-of-crepes-with-fruits', null, null],
  'md-toast-avocado-ou': ['30471825', 'delicious-avocado-toast-with-poached-eggs-for-brunch', 'Aliaksandra Babko', null],
  'g2-paine-avocado-seminte': ['3957527', 'avocado-toast', null, null],
  'md-toast-hummus-rosii': ['6327123', 'avocado-toasts-on-a-plate', null, null],
  'md-shakshuka': ['3648979', 'delicious-fried-eggs-and-tomatoes-in-morning', 'Julia Khalimova', null],
  'md-mamaliga-branza-ou': ['15793780', 'hominy-on-a-spoon-and-various-vegetarian-dishes', null, null],
  'ci-tocanita-ciuperci': ['20205483', 'delicious-gourmet-meal', null, null],
  'md-burrito': ['27603260', 'authentic-mexican-food', null, null],
  'md-budinca-chia-mango': ['5150202', 'chia-seeds-and-yoghurt-cream-on-clear-glasses', null, null],
  'md-overnight-cacao-cirese': ['27850086', 'a-bowl-of-oatmeal-with-chocolate-chips-and-nuts', 'Livilla Latini', null],
  'md-smoothie-bowl-verde': ['7937040', 'a-hand-putting-the-kiwi-slices-on-a-breakfast-bowl', 'Nicola Barts', null],
  'g1-smoothie-verde-mar': ['7656401', 'a-glass-of-spinach-and-kiwi-smoothie', null, null],
  'g1-smoothie-capsuni-chefir': ['845552', 'clear-drinking-glass-with-strawberry', 'Lisa Fotios', null],
  'g2-smoothie-afine-ovaz': ['11135665', 'close-up-view-of-glass-with-blueberry-smoothie', 'Ralitsa Racheva', null],
  'md-paine-arahide-banana': ['20605002', 'bread-with-peanut-butter-and-banana-slices', 'Lisa Fotios', null],
  'g1-mix-nuci-stafide': ['12955793', 'full-shot-of-various-nuts', null, null],
  'g2-hummus-pita': ['5852251', 'food-on-a-plate', null, null],
  'g2-oua-paine-secara': ['10074027', 'slices-of-hard-boiled-egg-on-plate', null, null],
  'g1-edamame': ['29935499', 'bowl-of-fresh-edamame-with-salt-on-wooden-table', null, null],
  'ci-salata-spanac-ou-ton': ['6544221', 'tuna-and-green-bean-salad-with-egg-in-bowl', null, null],
  'g2-branza-vaci-fructe': ['15048297', 'healthy-breakfast-with-fruits', null, null],
  'pr-supa-linte-rosie': ['12077978', 'turkish-creamy-soup', null, null],
  'pr-buddha-bowl': ['17597408', 'a-bowl-with-a-healthy-salad', null, null],
  'pr-salata-caesar-pui': ['8251537', 'close-up-of-caesar-salad', 'Julia Filirovska', null],
  'pr-tocanita-vita': ['10692537', 'cooked-food-on-white-ceramic-bowl', null, null],
  'pr-curry-naut': ['9287035', 'close-up-of-chana-masala', null, null],
  'pr-wrap-pui': ['12464909', 'tortillas-with-chicken-lettuce-and-vegetables', 'Nadin Sh', null],
  'pr-paste-bolognese': ['6287525', 'appetizing-pasta-bolognese-served-with-parsley', 'Klaus Nielsen', null],
  'pr-ardei-umpluti': ['22698511', 'meal-on-plate-and-tray', null, null],
  'ci-ardei-quinoa': ['40091208', 'vibrant-stuffed-bell-peppers-in-black-pot', null, null],
  'pr-chili-curcan': ['1618906', 'meat-dish', null, null],
  'pr-paste-pesto-pui': ['4730661', 'food-plate-salad-dinner', 'Lisa Fotios', null],
  'pr-bol-mexican-fasole': ['10696501', 'meal-in-bowl', null, null],
  'pr-stir-fry-vita': ['2181151', 'vegetable-dish', null, null],
  'pr-taitei-creveti': ['2827263', 'cooked-food', null, null],
  'pr-supa-pui-taitei': ['32649105', 'delicious-homemade-chicken-noodle-soup-with-herbs', null, null],
  'ci-tilapia-legume-cuptor': ['27294732', 'a-fish-is-in-a-pan-with-tomatoes-and-herbs', null, null],
  'ci-pastrav-cuptor-legume': ['12653380', 'marinade-fish-in-aluminum-container', null, null],
};
