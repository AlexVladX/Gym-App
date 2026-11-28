// Funcția Supabase „sterge-cont”: șterge definitiv contul conectat, cu tot ce e în cloud (rândurile sincronizate,
// pozele, copiile de siguranță, contorul de scanări). Datele de pe telefon NU sunt atinse.
// Cheia de serviciu e pusă automat de Supabase în funcție (nu stă în aplicație și nici pe GitHub).
import { EroareStergere, stergeContul, cheieServiciu, antetServiciu } from './logica.js';

const ORIGINI = (Deno.env.get('ORIGINI_PERMISE') || 'https://alexvladx.github.io,http://localhost:8765,http://127.0.0.1:8765')
  .split(',').map(s => s.trim()).filter(Boolean);
const SPATIU = 'poze';

function antetCors(origine: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Vary': 'Origin',
  };
  if (origine && ORIGINI.includes(origine)) h['Access-Control-Allow-Origin'] = origine;
  return h;
}
function raspuns(status: number, corp: unknown, origine: string | null) {
  return new Response(JSON.stringify(corp), { status, headers: { ...antetCors(origine), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function utilizatorDinToken(req: Request, url: string) {
  const auth = req.headers.get('authorization') || '';
  const cheie = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!/^Bearer\s+\S+/.test(auth) || !cheie) throw new EroareStergere('neautentificat', 'Conectează-te la cont ca să-l poți șterge.', 401);
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: cheie } });
  if (!r.ok) throw new EroareStergere('neautentificat', 'Sesiunea a expirat. Intră din nou în cont.', 401);
  const u = await r.json();
  if (!u || !u.id) throw new EroareStergere('neautentificat', 'Sesiunea a expirat. Intră din nou în cont.', 401);
  return { id: String(u.id), email: String(u.email || '') };
}

Deno.serve(async (req) => {
  const origine = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: antetCors(origine) });
  try {
    if (req.method !== 'POST') throw new EroareStergere('metoda', 'Doar POST.', 405);
    if (origine && !ORIGINI.includes(origine)) throw new EroareStergere('origine', 'Origine nepermisă.', 403);
    const url = Deno.env.get('SUPABASE_URL');
    if (!url) throw new EroareStergere('configurare', 'Lipsește SUPABASE_URL.', 500);
    const utilizator = await utilizatorDinToken(req, url);
    const admin = antetServiciu(cheieServiciu(k => Deno.env.get(k)));
    let corp: unknown = null;
    try { corp = await req.json(); } catch (_) { corp = null; }
    const rezultat = await stergeContul({
      utilizator, corp,
      async listeaza(prefix: string, offset: number, limita: number) {
        const r = await fetch(`${url}/storage/v1/object/list/${SPATIU}`, {
          method: 'POST', headers: { ...admin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, limit: limita, offset, sortBy: { column: 'name', order: 'asc' } }),
        });
        if (r.status === 400 || r.status === 404) return []; // spațiul sau dosarul nu există: nimic de șters
        if (!r.ok) throw new EroareStergere('furnizor_indisponibil', 'Fișierele din cont nu pot fi citite acum. Încearcă din nou.', 502);
        return await r.json();
      },
      async stergeFisiere(cai: string[]) {
        const r = await fetch(`${url}/storage/v1/object/${SPATIU}`, {
          method: 'DELETE', headers: { ...admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: cai }),
        });
        if (!r.ok) throw new EroareStergere('furnizor_indisponibil', 'Fișierele din cont nu au putut fi șterse. Încearcă din nou.', 502);
      },
      async stergeUtilizator(id: string) {
        const r = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: admin });
        if (!r.ok && r.status !== 404) throw new EroareStergere('furnizor_indisponibil', 'Contul nu a putut fi șters. Încearcă din nou.', 502);
      },
    });
    return raspuns(200, rezultat, origine);
  } catch (err) {
    const e = err instanceof EroareStergere ? err : new EroareStergere('eroare', 'Eroare la server.', 500);
    if (!(err instanceof EroareStergere)) console.error(err);
    return raspuns(e.status, { cod: e.cod, mesaj: e.message }, origine);
  }
});
