// Biblioteca de exerciții și antrenamente gata făcute.
// Imaginile sunt siluete desenate din coordonate (SVG), fără fotografii și fără internet.

// Coordonatele pozelor pe un cadru de 120 x 140.
// cap: centrul capului; trunchi: gât și șold; brate și picioare: liste de 3 puncte (sus, mijloc, capăt).
// bara / sol / banca: linii opționale (bara de la antrenament, podeaua, banca).
const STAND = [[[60, 80], [54, 106], [54, 130]], [[60, 80], [66, 106], [66, 130]]];

const POZE = {
  genuflexiune: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 36], [44, 50], [44, 38]], [[66, 36], [76, 50], [76, 38]]],
    picioare: [[[60, 80], [44, 102], [46, 128]], [[60, 80], [76, 102], [74, 128]]],
    bara: [28, 36, 92, 36],
  },
  impins_culcat: {
    cap: [20, 66],
    trunchi: [[30, 68], [72, 68]],
    brate: [[[40, 68], [40, 46], [44, 28]], [[50, 68], [50, 46], [54, 28]]],
    picioare: [[[72, 68], [88, 54], [88, 80]], [[72, 68], [92, 54], [92, 80]]],
    bara: [30, 22, 70, 22],
    sol: [8, 84, 112, 84],
  },
  flotari: {
    cap: [20, 60],
    trunchi: [[30, 66], [84, 84]],
    brate: [[[36, 70], [38, 88], [32, 106]], [[36, 70], [38, 88], [32, 106]]],
    picioare: [[[84, 84], [100, 96], [112, 104]], [[84, 84], [100, 96], [112, 104]]],
    sol: [8, 108, 118, 108],
  },
  fluture: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 38], [34, 44], [18, 44]], [[66, 38], [86, 44], [102, 44]]],
    picioare: STAND,
  },
  impins_sus: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 38], [42, 24], [40, 10]], [[66, 38], [78, 24], [80, 10]]],
    picioare: STAND,
    bara: [28, 8, 92, 8],
  },
  flexie: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 38], [48, 62], [50, 46]], [[66, 38], [72, 62], [70, 46]]],
    picioare: STAND,
  },
  extensie_triceps: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 38], [44, 22], [54, 44]], [[66, 38], [76, 22], [66, 44]]],
    picioare: STAND,
  },
  tractiuni: {
    cap: [60, 36],
    trunchi: [[60, 46], [60, 88]],
    brate: [[[52, 50], [40, 30], [40, 12]], [[68, 50], [80, 30], [80, 12]]],
    picioare: [[[60, 88], [54, 112], [54, 132]], [[60, 88], [66, 112], [66, 132]]],
    bara: [22, 10, 98, 10],
  },
  ramat: {
    cap: [90, 36],
    trunchi: [[82, 48], [58, 78]],
    brate: [[[80, 56], [90, 76], [90, 98]], [[86, 58], [94, 78], [94, 98]]],
    picioare: [[[58, 78], [50, 106], [50, 130]], [[58, 78], [64, 106], [64, 130]]],
  },
  mort_romanesc: {
    cap: [90, 36],
    trunchi: [[82, 48], [58, 78]],
    brate: [[[80, 56], [76, 86], [74, 116]], [[86, 56], [82, 86], [80, 116]]],
    picioare: [[[58, 78], [54, 106], [54, 130]], [[58, 78], [62, 106], [62, 130]]],
    bara: [64, 118, 96, 118],
  },
  hip_thrust: {
    cap: [22, 76],
    trunchi: [[32, 82], [68, 56]],
    brate: [[[34, 88], [30, 104], [24, 112]], [[40, 88], [38, 104], [32, 112]]],
    picioare: [[[68, 56], [86, 88], [86, 118]], [[68, 56], [92, 88], [92, 118]]],
    sol: [8, 124, 112, 124],
  },
  abdomen: {
    cap: [26, 104],
    trunchi: [[36, 106], [72, 116]],
    brate: [[[44, 112], [52, 100], [40, 96]], [[44, 114], [54, 104], [42, 100]]],
    picioare: [[[72, 116], [88, 98], [102, 110]], [[72, 116], [92, 96], [106, 106]]],
    sol: [8, 124, 112, 124],
  },
  plank: {
    cap: [22, 64],
    trunchi: [[30, 72], [90, 88]],
    brate: [[[34, 76], [36, 96], [30, 110]], [[40, 78], [42, 96], [36, 110]]],
    picioare: [[[90, 88], [106, 96], [112, 104]], [[90, 88], [106, 96], [112, 104]]],
    sol: [8, 114, 116, 114],
  },
  stand_greutati: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 38], [50, 60], [50, 82]], [[66, 38], [70, 60], [70, 82]]],
    picioare: STAND,
    bara: [42, 84, 78, 84],
  },
  gambe: {
    cap: [60, 14],
    trunchi: [[60, 26], [60, 74]],
    brate: [[[54, 32], [50, 54], [50, 74]], [[66, 32], [70, 54], [70, 74]]],
    picioare: [[[60, 74], [56, 100], [58, 122]], [[60, 74], [64, 100], [62, 122]]],
    sol: [36, 128, 84, 128],
  },
  paralele: {
    cap: [60, 22],
    trunchi: [[60, 34], [60, 80]],
    brate: [[[54, 38], [42, 48], [40, 64]], [[66, 38], [78, 48], [80, 64]]],
    picioare: [[[60, 80], [56, 104], [70, 118]], [[60, 80], [64, 104], [76, 116]]],
    bara: [28, 66, 92, 66],
  },
  helcometru: {
    cap: [56, 46],
    trunchi: [[56, 58], [58, 96]],
    brate: [[[50, 62], [38, 46], [38, 24]], [[62, 62], [76, 46], [78, 24]]],
    picioare: [[[58, 96], [84, 98], [86, 124]], [[58, 96], [88, 100], [90, 124]]],
    bara: [22, 22, 94, 22],
    sol: [40, 102, 74, 102],
  },
  ramat_sezut: {
    cap: [36, 50],
    trunchi: [[38, 62], [42, 100]],
    brate: [[[40, 68], [58, 82], [76, 78]], [[42, 70], [60, 86], [78, 82]]],
    picioare: [[[42, 100], [72, 94], [96, 110]], [[42, 100], [74, 98], [98, 114]]],
    sol: [20, 106, 62, 106],
  },
  presa: {
    cap: [22, 94],
    trunchi: [[32, 98], [62, 110]],
    brate: [[[38, 102], [46, 114], [54, 118]], [[42, 104], [50, 116], [58, 120]]],
    picioare: [[[62, 110], [70, 82], [92, 70]], [[62, 110], [74, 84], [96, 72]]],
    bara: [86, 54, 106, 86],
  },
  extensie_genunchi: {
    cap: [38, 28],
    trunchi: [[40, 40], [44, 84]],
    brate: [[[42, 46], [46, 66], [52, 86]], [[44, 48], [50, 68], [56, 88]]],
    picioare: [[[44, 84], [76, 84], [104, 78]], [[44, 86], [76, 88], [104, 82]]],
    sol: [26, 92, 80, 92],
  },
  flexie_culcat: {
    cap: [16, 80],
    trunchi: [[26, 86], [66, 90]],
    brate: [[[30, 90], [30, 100], [22, 104]], [[34, 90], [34, 100], [26, 104]]],
    picioare: [[[66, 90], [92, 92], [86, 64]], [[66, 92], [94, 94], [90, 66]]],
    sol: [8, 100, 100, 100],
  },
  fandare: {
    cap: [60, 20],
    trunchi: [[60, 32], [60, 80]],
    brate: [[[54, 38], [48, 58], [46, 44]], [[66, 38], [72, 58], [74, 44]]],
    picioare: [[[60, 80], [46, 104], [46, 130]], [[60, 80], [76, 104], [92, 128]]],
  },
};

// Exercițiile din bibliotecă. Numele trebuie să fie unice (sunt folosite și ca nume în sesiune).
// Numele și descrierile sunt scrise în română,
// iar mușchii, echipamentul și nivelul vin din setul de date free-exercise-db (domeniu public).
const BIBLIOTECA = [
  {"nume": "Împins cu bara pe bancă", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Culcat pe bancă, coboară bara spre piept controlat, apoi împinge-o în sus până la extensia completă a brațelor.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Împins cu gantere pe bancă înclinată", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Bancă înclinată ușor. Coboară ganterele spre laterele pieptului și împinge-le sus.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Flotări", "grupa": "Piept", "poza": "flotari", "descriere": "Corp drept, mâinile puțin mai late decât umerii. Coboară pieptul aproape de sol și revino.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Fluturări cu gantere", "grupa": "Piept", "poza": "fluture", "descriere": "Culcat, brațele ușor îndoite. Deschide ganterele într-un arc până simți întinderea în piept, apoi readu-le.", "muschi": ["piept"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Împins cu bara pe bancă înclinată", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Bancă înclinată la 30–45°. Coboară bara spre partea de sus a pieptului și împinge-o vertical. Accent pe pieptul superior.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Împins cu bara pe bancă declinată", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Capul mai jos decât șoldurile, picioarele prinse sub suport. Coboară bara spre partea de jos a pieptului și împinge. Accent pe pieptul inferior.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Împins cu gantere pe bancă", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Bancă orizontală, ganterele la nivelul pieptului. Împinge-le sus până aproape se ating și coboară controlat. Amplitudinea e mai mare decât la bară.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Fluturări cu gantere pe bancă înclinată", "grupa": "Piept", "poza": "fluture", "descriere": "Pe bancă înclinată, coatele ușor îndoite. Deschide brațele în arc până simți întinderea în piept, apoi strânge-le deasupra pieptului.", "muschi": ["piept", "umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Fluturări la scripete (crossover)", "grupa": "Piept", "poza": "fluture", "descriere": "Între doi scripeți prinși sus, cu un pas înainte. Adu mânerele în arc în fața pieptului, coatele ușor îndoite, și revino lent.", "muschi": ["piept", "umeri"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Fluturări la scripete de jos", "grupa": "Piept", "poza": "fluture", "descriere": "Mânerele de la scripeții de jos. Adu-le în arc de jos în sus, până în fața pieptului superior. Accent pe pieptul superior.", "muschi": ["piept", "umeri"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Fluturări la aparat (pec deck)", "grupa": "Piept", "poza": "fluture", "descriere": "Așezat cu spatele lipit de spătar, brațele pe pernițe sau mânere. Strânge brațele în fața pieptului, ține o secundă, revino controlat.", "muschi": ["piept"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Împins la aparat pentru piept", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Mânerele la nivelul mijlocului pieptului. Împinge până aproape de întinderea brațelor, fără să blochezi coatele, și revino lent.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Împins înclinat la aparatul Smith", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Bancă înclinată sub bara ghidată. Coboară bara spre partea de sus a pieptului și împinge. Traseul fix te lasă să te concentrezi pe piept.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Flotări cu picioarele ridicate", "grupa": "Piept", "poza": "flotari", "descriere": "Picioarele pe o bancă, mâinile pe sol puțin mai late decât umerii. Corpul drept, coboară pieptul spre sol și împinge.", "muschi": ["piept", "umeri", "triceps"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Pullover cu gantera", "grupa": "Piept", "poza": "impins_culcat", "descriere": "Culcat pe bancă, ține o gantera cu ambele mâini deasupra pieptului. Coboară-o în arc în spatele capului, brațele aproape întinse, și readu-o.", "muschi": ["piept", "dorsali", "umeri", "triceps"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Tracțiuni", "grupa": "Spate", "poza": "tractiuni", "descriere": "Prinde bara cu palmele în afară și trage corpul în sus până bărbia trece de bară. Coboară lent.", "muschi": ["dorsali", "biceps", "spate (mijloc)"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Tracțiuni la helcometru", "grupa": "Spate", "poza": "helcometru", "descriere": "Așezat, trage bara spre piept cu spatele drept. Revine în sus controlat.", "muschi": ["dorsali", "biceps", "spate (mijloc)", "umeri"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Ramat cu bara", "grupa": "Spate", "poza": "ramat", "descriere": "Trunchiul aplecat, trage bara spre abdomen strângând omoplații. Spatele rămâne drept.", "muschi": ["spate (mijloc)", "biceps", "dorsali", "umeri"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Ramat cu gantera", "grupa": "Spate", "poza": "ramat", "descriere": "Un genunchi și o mână pe bancă. Trage gantera spre șold, cu coatul aproape de corp.", "muschi": ["spate (mijloc)", "biceps", "dorsali", "umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Îndreptări (deadlift)", "grupa": "Spate", "poza": "mort_romanesc", "descriere": "Bara deasupra mijlocului tălpii. Prinde-o cu spatele drept, împinge prin picioare și ridică până stai drept. Coboară pe același traseu, cu bara aproape de picioare.", "muschi": ["zona lombară", "gambe", "antebrațe", "fesieri", "femurali", "dorsali", "spate (mijloc)", "cvadricepși", "trapez"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Îndreptări parțiale (rack pull)", "grupa": "Spate", "poza": "mort_romanesc", "descriere": "Bara pe suporți, la nivelul genunchilor. Ridică-o până stai drept, strângând omoplații, și coboar-o controlat înapoi pe suporți.", "muschi": ["zona lombară", "antebrațe", "fesieri", "femurali", "trapez"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Tracțiuni cu priză supinată", "grupa": "Spate", "poza": "tractiuni", "descriere": "Palmele spre tine, la lățimea umerilor. Trage până bărbia trece de bară și coboară complet. Lucrează mult și bicepșii.", "muschi": ["dorsali", "biceps", "antebrațe", "spate (mijloc)"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Helcometru cu priză îngustă", "grupa": "Spate", "poza": "helcometru", "descriere": "Mâinile apropiate pe bară. Trage bara spre partea de sus a pieptului, cu pieptul ridicat și coatele spre corp, apoi revino întinzând brațele.", "muschi": ["dorsali", "biceps", "spate (mijloc)", "umeri"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Helcometru cu mâner în V", "grupa": "Spate", "poza": "helcometru", "descriere": "Mânerul în V, palmele una spre cealaltă. Trage spre piept cu spatele ușor arcuit și revino lent până la întinderea completă.", "muschi": ["dorsali", "biceps", "spate (mijloc)", "umeri"], "echipament": "Scripete", "nivel": "Mediu"},
  {"nume": "Pulldown cu brațele întinse", "grupa": "Spate", "poza": "ramat", "descriere": "În fața scripetelui de sus, ușor aplecat. Cu brațele aproape întinse, trage bara în arc până la coapse și revino lent. Izolează dorsalii.", "muschi": ["dorsali"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Ramat la scripete, așezat", "grupa": "Spate", "poza": "ramat_sezut", "descriere": "Așezat, picioarele pe suport, genunchii ușor îndoiți. Trage mânerul spre abdomen strângând omoplații, fără să te balansezi.", "muschi": ["spate (mijloc)", "biceps", "dorsali", "umeri"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Ramat la aparat", "grupa": "Spate", "poza": "ramat_sezut", "descriere": "Pieptul lipit de pernă. Trage mânerele spre tine, coatele pe lângă corp, strânge omoplații și revino controlat.", "muschi": ["spate (mijloc)", "dorsali"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Ramat T-bar", "grupa": "Spate", "poza": "ramat", "descriere": "Aplecat peste bară, spatele drept. Trage mânerul spre piept, coatele aproape de corp, și coboară până la întinderea brațelor.", "muschi": ["spate (mijloc)", "biceps", "dorsali"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Ramat cu două gantere", "grupa": "Spate", "poza": "ramat", "descriere": "Aplecat din șolduri, spatele drept, câte o gantera în fiecare mână. Trage-le spre șolduri strângând omoplații.", "muschi": ["spate (mijloc)", "biceps", "dorsali", "umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Ramat cu pieptul pe bancă înclinată", "grupa": "Spate", "poza": "ramat", "descriere": "Cu pieptul sprijinit pe o bancă înclinată, trage ganterele spre șolduri. Sprijinul elimină balansul și protejează zona lombară.", "muschi": ["spate (mijloc)", "biceps", "antebrațe", "dorsali", "umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Ridicări din umeri cu bara", "grupa": "Spate", "poza": "stand_greutati", "descriere": "În picioare, bara în fața coapselor, brațele întinse. Ridică umerii spre urechi, ține o secundă, coboară. Lucrează trapezul.", "muschi": ["trapez"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Ridicări din umeri cu gantere", "grupa": "Spate", "poza": "stand_greutati", "descriere": "Câte o gantera pe lângă corp. Ridică umerii drept în sus, fără să-i rotești, și coboară controlat. Lucrează trapezul.", "muschi": ["trapez"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Hiperextensii (extensii lombare)", "grupa": "Spate", "poza": "mort_romanesc", "descriere": "Pe banca de hiperextensii, șoldurile pe pernă. Coboară trunchiul cu spatele drept și ridică-l până în linie cu picioarele, fără să-l arcuiești peste.", "muschi": ["zona lombară", "fesieri", "femurali"], "echipament": "Corp", "nivel": "Mediu"},
  {"nume": "Împins deasupra capului", "grupa": "Umeri", "poza": "impins_sus", "descriere": "În picioare, împinge bara de la umeri deasupra capului. Corpul rămâne drept.", "muschi": ["umeri", "triceps"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Ridicări laterale", "grupa": "Umeri", "poza": "fluture", "descriere": "Ganterele în lateral, coatele ușor îndoite. Ridică brațele până la nivelul umerilor și coboară lent.", "muschi": ["umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Împins cu gantere deasupra capului", "grupa": "Umeri", "poza": "impins_sus", "descriere": "Ganterele la nivelul umerilor, palmele înainte. Împinge-le sus până aproape se ating și coboară până la urechi.", "muschi": ["umeri", "triceps"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Împins cu gantere din șezut", "grupa": "Umeri", "poza": "impins_sus", "descriere": "Pe bancă cu spătar vertical. Împinge ganterele deasupra capului fără să arcuiești spatele și coboară controlat.", "muschi": ["umeri", "triceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Împins Arnold", "grupa": "Umeri", "poza": "impins_sus", "descriere": "Începi cu ganterele în fața umerilor, palmele spre tine. Pe măsură ce împingi, rotește palmele înainte. Coboară cu mișcarea inversă.", "muschi": ["umeri", "triceps"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Împins la aparat pentru umeri", "grupa": "Umeri", "poza": "impins_sus", "descriere": "Mânerele la nivelul umerilor. Împinge în sus fără să blochezi coatele și coboară lent. Bun pentru serii grele în siguranță.", "muschi": ["umeri", "triceps"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Ridicări laterale la scripete", "grupa": "Umeri", "poza": "fluture", "descriere": "Mânerul de la scripetele de jos, prins cu mâna opusă. Ridică brațul lateral până la umăr. Scripetele ține tensiunea pe tot traseul.", "muschi": ["umeri", "spate (mijloc)", "trapez"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Ridicări frontale cu gantere", "grupa": "Umeri", "poza": "fluture", "descriere": "Ganterele în fața coapselor. Ridică-le înainte până la nivelul umerilor, cu brațele aproape întinse, și coboară lent.", "muschi": ["umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Fluturări inverse cu gantere", "grupa": "Umeri", "poza": "ramat", "descriere": "Aplecat din șolduri, ganterele sub piept. Deschide brațele lateral până la nivelul umerilor, coatele ușor îndoite. Lucrează deltoidul posterior.", "muschi": ["umeri"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Fluturări inverse la aparat", "grupa": "Umeri", "poza": "fluture", "descriere": "Cu pieptul spre spătarul aparatului. Deschide brațele în arc spre spate, strânge omoplații și revino controlat. Deltoid posterior.", "muschi": ["umeri"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Face pull la scripete", "grupa": "Umeri", "poza": "ramat_sezut", "descriere": "Frânghia la scripetele de sus, la nivelul feței. Trage-o spre frunte desfăcând capetele, coatele sus. Bun pentru deltoidul posterior și postură.", "muschi": ["umeri", "spate (mijloc)"], "echipament": "Scripete", "nivel": "Mediu"},
  {"nume": "Ramat vertical cu bara", "grupa": "Umeri", "poza": "stand_greutati", "descriere": "Bara în fața coapselor, priză la lățimea umerilor. Trage-o în sus pe lângă corp până la piept, coatele conduc mișcarea.", "muschi": ["umeri", "trapez"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Flexii cu bara", "grupa": "Biceps", "poza": "flexie", "descriere": "În picioare, coatele lipite de corp. Ridică bara spre umeri și coboară controlat.", "muschi": ["biceps", "antebrațe"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Flexii cu gantere alternativ", "grupa": "Biceps", "poza": "flexie", "descriere": "Alternează brațele. Rotește palma în sus pe parcursul ridicării.", "muschi": ["biceps", "antebrațe"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Flexii ciocan", "grupa": "Biceps", "poza": "flexie", "descriere": "Palmele una spre cealaltă, ca la ținerea unui ciocan. Lucrează și antebrațul.", "muschi": ["biceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Flexii cu bara EZ", "grupa": "Biceps", "poza": "flexie", "descriere": "Bara EZ, priza pe porțiunile înclinate. Coatele lipite de corp, ridică bara spre umeri și coboară complet. Mai ușor pentru încheieturi.", "muschi": ["biceps"], "echipament": "Bară EZ", "nivel": "Începător"},
  {"nume": "Flexii la pupitru (Scott)", "grupa": "Biceps", "poza": "flexie", "descriere": "Brațele sprijinite pe pupitru. Ridică bara spre umeri și coboară până aproape de întinderea brațelor, fără să le lași să cadă.", "muschi": ["biceps"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Flexii la aparat pentru biceps", "grupa": "Biceps", "poza": "flexie", "descriere": "Brațele pe perniță, mânerele în palme. Flexează coatele până la contracția completă și revino lent.", "muschi": ["biceps"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Flexii cu gantere pe bancă înclinată", "grupa": "Biceps", "poza": "flexie", "descriere": "Spatele pe o bancă înclinată, brațele atârnă în spatele corpului. Ridică ganterele fără să miști coatele. Întinde bine bicepsul.", "muschi": ["biceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Flexii concentrate", "grupa": "Biceps", "poza": "flexie", "descriere": "Așezat, cotul sprijinit pe interiorul coapsei. Ridică gantera spre umăr, strânge sus și coboară complet.", "muschi": ["biceps", "antebrațe"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Flexii la scripete", "grupa": "Biceps", "poza": "flexie", "descriere": "Bara la scripetele de jos. Coatele fixe pe lângă corp, ridică bara spre piept și revino lent. Tensiune constantă pe tot traseul.", "muschi": ["biceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Flexii ciocan la scripete", "grupa": "Biceps", "poza": "flexie", "descriere": "Frânghia la scripetele de jos, palmele una spre cealaltă. Ridică spre umeri cu coatele fixe. Lucrează și antebrațul.", "muschi": ["biceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Flexii spider", "grupa": "Biceps", "poza": "flexie", "descriere": "Cu pieptul pe o bancă înclinată, brațele atârnă vertical. Ridică bara sau ganterele spre umeri și strânge sus.", "muschi": ["biceps"], "echipament": "Bară EZ", "nivel": "Începător"},
  {"nume": "Flexii inverse cu bara", "grupa": "Biceps", "poza": "flexie", "descriere": "Priză cu palmele în jos. Ridică bara spre umeri cu coatele fixe. Lucrează brahioradialul și antebrațele.", "muschi": ["biceps", "antebrațe"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Flexii Zottman", "grupa": "Biceps", "poza": "flexie", "descriere": "Urci ganterele cu palmele în sus, rotești palmele în jos sus și cobori lent cu palmele în jos. Biceps la urcare, antebraț la coborâre.", "muschi": ["biceps", "antebrațe"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Extensii triceps la scripete", "grupa": "Triceps", "poza": "extensie_triceps", "descriere": "Coatele lipite de corp. Împinge mânerul în jos până întinzi complet brațele.", "muschi": ["triceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Flotări cu mâinile apropiate", "grupa": "Triceps", "poza": "flotari", "descriere": "Mâinile sub piept, coatele aproape de corp. Accentuează tricepșii.", "muschi": ["triceps", "piept", "umeri"], "echipament": "Corp", "nivel": "Mediu"},
  {"nume": "Extensii triceps deasupra capului", "grupa": "Triceps", "poza": "extensie_triceps", "descriere": "Ține o gantera cu ambele mâini deasupra capului și coboară-o în spatele capului, coatele apropiate.", "muschi": ["triceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Extensii triceps la scripete cu frânghie", "grupa": "Triceps", "poza": "extensie_triceps", "descriere": "Coatele lipite de corp. Împinge frânghia în jos și desfă capetele jos, la întinderea completă. Revino până la unghi drept.", "muschi": ["triceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Extensii triceps la scripete cu bară în V", "grupa": "Triceps", "poza": "extensie_triceps", "descriere": "Mânerul în V la scripetele de sus. Coatele fixe, împinge în jos până întinzi brațele și revino controlat.", "muschi": ["triceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Extensii triceps cu priză inversă", "grupa": "Triceps", "poza": "extensie_triceps", "descriere": "Bara prinsă cu palmele în sus. Coatele fixe, împinge în jos până la întinderea brațelor. Accent pe capul medial.", "muschi": ["triceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Extensii triceps deasupra capului la scripete", "grupa": "Triceps", "poza": "extensie_triceps", "descriere": "Cu spatele la scripete, frânghia în spatele capului. Întinde brațele înainte și în sus, coatele fixe. Întinde bine capul lung al tricepsului.", "muschi": ["triceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Extensii franceze cu bara EZ (skullcrusher)", "grupa": "Triceps", "poza": "impins_culcat", "descriere": "Culcat, bara deasupra pieptului. Îndoaie doar coatele și coboară bara spre frunte, apoi întinde brațele. Brațele de sus rămân fixe.", "muschi": ["triceps", "antebrațe"], "echipament": "Bară EZ", "nivel": "Începător"},
  {"nume": "Extensii triceps culcat cu gantere", "grupa": "Triceps", "poza": "impins_culcat", "descriere": "Culcat, ganterele deasupra pieptului, palmele una spre cealaltă. Coboară-le spre urechi îndoind coatele și întinde la loc.", "muschi": ["triceps", "piept", "umeri"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Împins cu priză îngustă", "grupa": "Triceps", "poza": "impins_culcat", "descriere": "Ca la împinsul pe bancă, dar cu mâinile la lățimea umerilor și coatele aproape de corp. Mută efortul spre triceps.", "muschi": ["triceps", "piept", "umeri"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Flotări la paralele (dips)", "grupa": "Triceps", "poza": "paralele", "descriere": "Sprijinit pe paralele, corpul vertical. Coboară până coatele ajung la unghi drept și împinge înapoi. Aplecat înainte lucrează mai mult pieptul.", "muschi": ["triceps", "piept", "umeri"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Flotări între bănci", "grupa": "Triceps", "poza": "paralele", "descriere": "Mâinile pe marginea unei bănci, în spatele tău, picioarele înainte. Coboară corpul îndoind coatele și împinge înapoi.", "muschi": ["triceps", "piept", "umeri"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Dips la aparat", "grupa": "Triceps", "poza": "paralele", "descriere": "Așezat, mânerele lângă corp. Împinge în jos până întinzi brațele și revino controlat. Variantă ușor de dozat a flotărilor la paralele.", "muschi": ["triceps", "piept", "umeri"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Kickback cu gantera", "grupa": "Triceps", "poza": "ramat", "descriere": "Aplecat, brațul de sus paralel cu solul și lipit de corp. Întinde cotul spre spate până brațul e drept, apoi revino.", "muschi": ["triceps"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Genuflexiuni cu bara", "grupa": "Picioare", "poza": "genuflexiune", "descriere": "Bara pe trapez, picioarele la lățimea umerilor. Coboară până șoldurile ajung sub genunchi și urcă.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali", "zona lombară"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Genuflexiuni goblet", "grupa": "Picioare", "poza": "genuflexiune", "descriere": "Ții o gantera la piept. Coboară adânc, cu spatele drept.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali", "zona lombară"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Fandări", "grupa": "Picioare", "poza": "fandare", "descriere": "Pas înainte cu un picior și coboară până genunchiul din spate aproape atinge podeaua. Schimbă piciorul.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Presa pentru picioare", "grupa": "Picioare", "poza": "presa", "descriere": "Picioarele pe platformă la lățimea umerilor. Coboară până genunchii ajung aproape de piept, fără să ridici fesele de pe scaun, și împinge.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Hack squat la aparat", "grupa": "Picioare", "poza": "genuflexiune", "descriere": "Spatele pe spătarul aparatului, umerii sub pernițe. Coboară adânc, controlat, și împinge prin toată talpa.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Genuflexiuni la aparatul Smith", "grupa": "Picioare", "poza": "genuflexiune", "descriere": "Bara ghidată pe trapez, picioarele ușor înainte. Coboară până coapsele sunt paralele cu solul și urcă.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali", "zona lombară"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Genuflexiuni frontale", "grupa": "Picioare", "poza": "genuflexiune", "descriere": "Bara pe partea din față a umerilor, coatele sus. Coboară cu trunchiul vertical și urcă. Accent pe cvadricepși.", "muschi": ["cvadricepși", "abdomen", "fesieri", "femurali"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Genuflexiuni fără greutăți", "grupa": "Picioare", "poza": "genuflexiune", "descriere": "Picioarele la lățimea umerilor, brațele înainte. Coboară cu șoldurile înapoi și în jos, cu spatele drept, apoi urcă.", "muschi": ["cvadricepși", "fesieri", "femurali"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Extensii pentru cvadricepși la aparat", "grupa": "Picioare", "poza": "extensie_genunchi", "descriere": "Așezat, pernița pe glezne. Întinde genunchii până picioarele sunt drepte, strânge o secundă și coboară lent.", "muschi": ["cvadricepși"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Flexii pentru femurali, culcat", "grupa": "Picioare", "poza": "flexie_culcat", "descriere": "Culcat pe burtă, pernița deasupra călcâielor. Adu călcâiele spre fese și coboară controlat, fără să ridici șoldurile.", "muschi": ["femurali"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Flexii pentru femurali, așezat", "grupa": "Picioare", "poza": "extensie_genunchi", "descriere": "Așezat, pernița sub glezne și una pe coapse. Trage călcâiele în jos și înapoi sub scaun, apoi revino lent.", "muschi": ["femurali"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Genuflexiuni fandate cu gantere (split squat)", "grupa": "Picioare", "poza": "fandare", "descriere": "Un picior în față, unul în spate, pe loc. Coboară vertical până genunchiul din spate aproape atinge solul. Cu piciorul din spate pe bancă devine varianta bulgărească.", "muschi": ["cvadricepși", "fesieri", "femurali"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Fandări cu bara", "grupa": "Picioare", "poza": "fandare", "descriere": "Bara pe trapez. Fă un pas înainte și coboară până ambii genunchi sunt la unghi drept, apoi revino. Alternează picioarele.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Fandări din mers", "grupa": "Picioare", "poza": "fandare", "descriere": "Cu bara sau ganterele, fandează înainte și continuă cu celălalt picior, înaintând. Trunchiul rămâne drept.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Urcări pe bancă cu gantere", "grupa": "Picioare", "poza": "fandare", "descriere": "Un picior pe bancă. Urcă împingând prin călcâiul de sus, nu prin piciorul de jos, și coboară controlat.", "muschi": ["cvadricepși", "gambe", "fesieri", "femurali"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Îndreptări cu picioarele întinse, cu gantere", "grupa": "Picioare", "poza": "mort_romanesc", "descriere": "Genunchii aproape întinși, spatele drept. Coboară ganterele de-a lungul picioarelor până simți întinderea femuralilor și revino.", "muschi": ["femurali", "fesieri", "zona lombară"], "echipament": "Gantere", "nivel": "Începător"},
  {"nume": "Good morning cu bara", "grupa": "Picioare", "poza": "mort_romanesc", "descriere": "Bara pe trapez, genunchii ușor îndoiți. Apleacă trunchiul împingând șoldurile înapoi, cu spatele drept, și revino. Începe ușor.", "muschi": ["femurali", "abdomen", "fesieri", "zona lombară"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Îndreptări sumo", "grupa": "Picioare", "poza": "mort_romanesc", "descriere": "Picioarele larg depărtate, vârfurile în afară, mâinile între genunchi. Ridică bara cu pieptul sus și spatele drept.", "muschi": ["femurali", "adductori", "antebrațe", "fesieri", "zona lombară", "spate (mijloc)", "cvadricepși", "trapez"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Aparat pentru adductori", "grupa": "Picioare", "poza": "extensie_genunchi", "descriere": "Așezat, pernițele pe interiorul genunchilor. Strânge picioarele unul spre altul și revino lent. Lucrează interiorul coapselor.", "muschi": ["adductori", "fesieri", "femurali"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Ridicări pe vârfuri la aparat, în picioare", "grupa": "Gambe", "poza": "gambe", "descriere": "Umerii sub pernițe, vârfurile pe treaptă. Coboară călcâiele cât poți, apoi urcă pe vârfuri cât mai sus și ține o secundă.", "muschi": ["gambe"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Ridicări pe vârfuri la aparat, așezat", "grupa": "Gambe", "poza": "gambe", "descriere": "Așezat, pernița pe genunchi, vârfurile pe treaptă. Coboară și urcă pe amplitudine completă. Lucrează mai ales solearul.", "muschi": ["gambe"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Ridicări pe vârfuri la presă", "grupa": "Gambe", "poza": "presa", "descriere": "La presa pentru picioare, doar vârfurile pe marginea platformei, genunchii întinși. Împinge cu vârfurile și revino lent.", "muschi": ["gambe"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Ridicări pe vârfuri cu gantere", "grupa": "Gambe", "poza": "gambe", "descriere": "Câte o gantera în mână, vârfurile pe o treaptă. Urcă pe vârfuri, ține sus o secundă, coboară sub nivelul treptei.", "muschi": ["gambe"], "echipament": "Gantere", "nivel": "Mediu"},
  {"nume": "Îndreptări românești", "grupa": "Fese", "poza": "mort_romanesc", "descriere": "Împinge șoldurile înapoi cu genunchii ușor îndoiți și spatele drept. Simți întinderea la ischiogambieri.", "muschi": ["femurali", "gambe", "fesieri", "zona lombară"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Hip thrust", "grupa": "Fese", "poza": "hip_thrust", "descriere": "Spatele sprijinit pe bancă, bara pe șolduri. Ridică șoldurile până corpul e drept și strânge fesierii sus.", "muschi": ["fesieri", "gambe", "femurali"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Pod pentru fesieri cu bara", "grupa": "Fese", "poza": "hip_thrust", "descriere": "Culcat pe spate pe sol, bara pe șolduri. Ridică șoldurile până corpul e drept de la umeri la genunchi și strânge fesierii.", "muschi": ["fesieri", "gambe", "femurali"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Pod pe un picior", "grupa": "Fese", "poza": "hip_thrust", "descriere": "Culcat pe spate, un picior pe sol, celălalt ridicat. Ridică șoldurile împingând prin călcâi și coboară controlat.", "muschi": ["fesieri", "femurali"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Kickback la scripete pentru fesieri", "grupa": "Fese", "poza": "fandare", "descriere": "Manșeta la gleznă, scripetele jos. Împinge piciorul înapoi cu genunchiul aproape întins, strânge fesierul și revino.", "muschi": ["fesieri", "femurali"], "echipament": "Scripete", "nivel": "Mediu"},
  {"nume": "Pull-through la scripete", "grupa": "Fese", "poza": "mort_romanesc", "descriere": "Cu spatele la scripetele de jos, frânghia printre picioare. Împinge șoldurile înapoi, apoi îndreaptă-te strângând fesierii.", "muschi": ["fesieri", "femurali", "zona lombară"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Kickback din patrupedie", "grupa": "Fese", "poza": "plank", "descriere": "În patru labe. Împinge un picior înapoi și în sus, genunchiul îndoit, până coapsa e paralelă cu solul. Fără să arcuiești spatele.", "muschi": ["fesieri", "femurali"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Aparat pentru abductori", "grupa": "Fese", "poza": "extensie_genunchi", "descriere": "Așezat, pernițele pe exteriorul genunchilor. Desfă picioarele cât poți și revino lent. Lucrează fesierul mijlociu.", "muschi": ["abductori", "fesieri"], "echipament": "Aparat", "nivel": "Începător"},
  {"nume": "Crunch", "grupa": "Abdomen", "poza": "abdomen", "descriere": "Culcat, mâinile la tâmple. Ridică umerii de pe sol contractând abdomenul.", "muschi": ["abdomen"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Plank", "grupa": "Abdomen", "poza": "plank", "descriere": "Sprijin pe antebrațe și vârfurile picioarelor, corpul drept ca o scândură. Ține poziția.", "muschi": ["abdomen"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Crunch la scripete, din genunchi", "grupa": "Abdomen", "poza": "abdomen", "descriere": "În genunchi, frânghia la scripetele de sus lângă cap. Rulează trunchiul în jos contractând abdomenul, șoldurile nu se mișcă.", "muschi": ["abdomen"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Crunch la aparat", "grupa": "Abdomen", "poza": "abdomen", "descriere": "Așezat, mânerele sau pernițele la piept. Rulează trunchiul înainte contractând abdomenul și revino controlat.", "muschi": ["abdomen"], "echipament": "Aparat", "nivel": "Mediu"},
  {"nume": "Crunch invers", "grupa": "Abdomen", "poza": "abdomen", "descriere": "Culcat pe spate, genunchii îndoiți. Adu genunchii spre piept ridicând șoldurile de pe sol și coboară lent.", "muschi": ["abdomen"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Ridicări de picioare pe bancă", "grupa": "Abdomen", "poza": "abdomen", "descriere": "Culcat pe bancă, ține marginea de lângă cap. Ridică picioarele întinse până la vertical și coboară fără să atingi solul.", "muschi": ["abdomen"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Răsuciri rusești", "grupa": "Abdomen", "poza": "abdomen", "descriere": "Așezat, trunchiul înclinat înapoi, picioarele ridicate. Rotește trunchiul dintr-o parte în alta, eventual cu o greutate în mâini.", "muschi": ["abdomen", "zona lombară"], "echipament": "Corp", "nivel": "Mediu"},
  {"nume": "Plank lateral", "grupa": "Abdomen", "poza": "plank", "descriere": "Sprijin pe un antebraț și pe marginea tălpii, corpul drept. Ține poziția, apoi schimbă partea. Lucrează oblicii.", "muschi": ["abdomen", "umeri"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Dead bug", "grupa": "Abdomen", "poza": "abdomen", "descriere": "Pe spate, brațele în sus, genunchii la 90°. Întinde brațul și piciorul opus spre sol, cu spatele lipit de sol, și revino.", "muschi": ["abdomen"], "echipament": "Corp", "nivel": "Începător"},
  {"nume": "Pallof press la scripete", "grupa": "Abdomen", "poza": "stand_greutati", "descriere": "Lateral față de scripete, mânerul la piept. Împinge brațele înainte și ține, fără să lași corpul să se rotească.", "muschi": ["abdomen", "piept", "umeri", "triceps"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Rollout cu bara", "grupa": "Abdomen", "poza": "plank", "descriere": "Din genunchi, mâinile pe bară sau pe roata abdominală. Rulează înainte cât poți cu spatele drept și trage înapoi cu abdomenul.", "muschi": ["abdomen", "zona lombară", "umeri"], "echipament": "Bară", "nivel": "Mediu"},
  {"nume": "Tăietorul de lemne la scripete", "grupa": "Abdomen", "poza": "fluture", "descriere": "Mânerul la scripetele de sus, lateral. Trage-l în diagonală în jos, peste corp, rotind trunchiul. Schimbă partea.", "muschi": ["abdomen", "umeri"], "echipament": "Scripete", "nivel": "Începător"},
  {"nume": "Flexii de încheietură, palmele în sus", "grupa": "Antebrațe", "poza": "flexie", "descriere": "Antebrațele pe bancă, încheieturile peste margine, palmele în sus. Coboară bara spre degete și ridic-o flexând încheieturile.", "muschi": ["antebrațe"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Extensii de încheietură, palmele în jos", "grupa": "Antebrațe", "poza": "flexie", "descriere": "Antebrațele pe bancă, palmele în jos. Ridică bara extinzând încheieturile și coboar-o lent. Folosește o greutate mică.", "muschi": ["antebrațe"], "echipament": "Bară", "nivel": "Începător"},
  {"nume": "Mers cu greutăți (farmer's walk)", "grupa": "Antebrațe", "poza": "stand_greutati", "descriere": "Câte o gantera grea în fiecare mână. Mergi cu pași scurți, umerii trași înapoi, trunchiul drept. Lucrează strânsoarea și trapezul.", "muschi": ["antebrațe", "abdomen", "fesieri", "femurali", "zona lombară", "cvadricepși", "trapez"], "echipament": "Altele", "nivel": "Mediu"},
];

// Antrenamente gata făcute. Numele exercițiilor trebuie să existe în BIBLIOTECA.
const ANTRENAMENTE = [
  { nume: 'Împins (piept, umeri, triceps)',
    descriere: 'Pentru zilele de împins: piept, umeri și tricepși.',
    grupe: ['Piept', 'Umeri', 'Triceps'],
    exercitii: ['Împins cu bara pe bancă', 'Împins cu gantere pe bancă înclinată', 'Împins deasupra capului', 'Ridicări laterale', 'Extensii triceps la scripete'] },
  { nume: 'Tragere (spate, biceps)',
    descriere: 'Pentru zilele de tragere: spate și bicepși.',
    grupe: ['Spate', 'Biceps'],
    exercitii: ['Tracțiuni', 'Tracțiuni la helcometru', 'Ramat cu bara', 'Flexii cu bara', 'Flexii ciocan'] },
  { nume: 'Picioare și fese',
    descriere: 'Picioare, fese și ischiogambieri.',
    grupe: ['Picioare', 'Fese'],
    exercitii: ['Genuflexiuni cu bara', 'Îndreptări românești', 'Fandări', 'Hip thrust'] },
  { nume: 'Corp întreg (scurt)',
    descriere: 'Un antrenament scurt, cu exerciții de bază pentru tot corpul.',
    grupe: ['Picioare', 'Piept', 'Spate', 'Abdomen'],
    exercitii: ['Genuflexiuni cu bara', 'Flotări', 'Ramat cu bara', 'Plank', 'Crunch'] },
];

// Siluetă SVG din coordonatele pozei. Stilul vine din styles.css (clasele .figura / .figura-mica).
function figuraSvg(p, nume, clasa) {
  const linie = pct => `<polyline points="${pct.map(q => q.join(',')).join(' ')}"/>`;
  let s = '';
  if (p.sol) s += `<line class="sol" x1="${p.sol[0]}" y1="${p.sol[1]}" x2="${p.sol[2]}" y2="${p.sol[3]}"/>`;
  if (p.bara) s += `<line class="bara-ex" x1="${p.bara[0]}" y1="${p.bara[1]}" x2="${p.bara[2]}" y2="${p.bara[3]}"/>`;
  s += `<circle cx="${p.cap[0]}" cy="${p.cap[1]}" r="9"/>`;
  s += linie(p.trunchi);
  for (const b of p.brate) s += linie(b);
  for (const l of p.picioare) s += linie(l);
  return `<svg class="${clasa}" viewBox="0 0 120 140" role="img" aria-label="${nume}">${s}</svg>`;
}

// Întoarce elementul SVG pentru un exercițiu din bibliotecă, sau null.
function creeazaFigura(poza, nume, clasa = 'figura') {
  const p = POZE[poza];
  if (!p) return null;
  const sablon = document.createElement('template');
  sablon.innerHTML = figuraSvg(p, nume, clasa);
  return sablon.content.firstElementChild;
}

// Miniatură pentru un nume de exercițiu (dacă există în bibliotecă), altfel un element gol.
function miniatura(nume, clasa = 'figura-mica') {
  const gasit = BIBLIOTECA.find(e => e.nume.toLowerCase() === nume.toLowerCase());
  const figura = gasit ? creeazaFigura(gasit.poza, gasit.nume, clasa) : null;
  return figura || document.createElement('span');
}
