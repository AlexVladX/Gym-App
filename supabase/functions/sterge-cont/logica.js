// Logica funcției „sterge-cont” (fără rețea), ca să poată fi testată și în Node (tests/sterge-cont.test.js).
// Ordinea: 1) se verifică cine cere (tokenul) și confirmarea (e-mailul scris de utilizator), 2) se șterg TOATE fișierele
// din dosarul contului („<id>/…” în spațiul „poze”), 3) se șterge contul. Rândurile din public.inregistrari și
// public.scanari_utilizare dispar odată cu contul (on delete cascade, vezi supabase/schema.sql și scanare.sql).

export class EroareStergere extends Error {
  constructor(cod, mesaj, status) { super(mesaj); this.cod = cod; this.status = status; }
}

const normal = s => String(s || '').trim().toLowerCase();

// Utilizatorul scrie adresa contului, ca ștergerea să nu poată porni dintr-o atingere greșită.
export function valideazaConfirmare(corp, email) {
  if (!corp || typeof corp !== 'object') throw new EroareStergere('cerere_invalida', 'Cerere invalidă.', 400);
  if (!email) throw new EroareStergere('cerere_invalida', 'Contul nu are adresă de e-mail.', 400);
  if (normal(corp.confirmare) !== normal(email)) throw new EroareStergere('confirmare_gresita', 'Adresa scrisă nu este cea a contului.', 400);
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function dosarCont(id) {
  if (!ID.test(String(id || ''))) throw new EroareStergere('neautentificat', 'Cont necunoscut.', 401);
  return String(id).toLowerCase();
}

// Cheia de serviciu: cea veche (SUPABASE_SERVICE_ROLE_KEY) sau cea nouă (SUPABASE_SECRET_KEYS = {"default": "sb_secret_…"}).
export function cheieServiciu(env) {
  const veche = env('SUPABASE_SERVICE_ROLE_KEY');
  if (veche) return veche;
  try {
    const noi = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    const k = noi.default || Object.values(noi)[0];
    if (k) return String(k);
  } catch (_) { /* nimic */ }
  throw new EroareStergere('configurare', 'Lipsește cheia de serviciu a proiectului Supabase.', 500);
}

// Anteturile pentru apelurile cu drepturi de administrator. O cheie sb_secret_ nu e JWT: merge doar în „apikey”.
export function antetServiciu(cheie) {
  return /^eyJ/.test(cheie) ? { apikey: cheie, Authorization: `Bearer ${cheie}` } : { apikey: cheie };
}

// Toate căile din dosarul contului. listeaza(prefix, offset) întoarce intrările unui dosar (fișiere au id, dosarele nu).
export async function toateFisierele(listeaza, dosar, { pagina = 1000, maxim = 100000 } = {}) {
  const rez = [];
  const deVazut = [dosar];
  while (deVazut.length) {
    const d = deVazut.shift();
    for (let offset = 0; ; offset += pagina) {
      const lista = await listeaza(d, offset, pagina);
      for (const x of lista || []) {
        if (!x || !x.name) continue;
        const cale = `${d}/${x.name}`;
        if (!cale.startsWith(`${dosar}/`)) continue; // nimic din afara dosarului contului
        if (x.id === null || x.id === undefined) deVazut.push(cale); else rez.push(cale);
        if (rez.length > maxim) throw new EroareStergere('prea_multe', 'Prea multe fișiere în cont.', 500);
      }
      if (!lista || lista.length < pagina) break;
    }
  }
  return rez;
}

export function inLoturi(lista, marime = 100) {
  const r = [];
  for (let i = 0; i < lista.length; i += marime) r.push(lista.slice(i, i + marime));
  return r;
}

// Tot procesul, cu operațiile de rețea date din afară (în Node, testele dau variante false).
export async function stergeContul({ utilizator, corp, listeaza, stergeFisiere, stergeUtilizator }) {
  valideazaConfirmare(corp, utilizator.email);
  const dosar = dosarCont(utilizator.id);
  const fisiere = await toateFisierele(listeaza, dosar);
  for (const lot of inLoturi(fisiere)) await stergeFisiere(lot);
  await stergeUtilizator(dosar);
  return { sters: true, fisiere: fisiere.length };
}
