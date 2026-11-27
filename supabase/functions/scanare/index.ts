// Funcția Supabase „scanare”: primește poza unei mese de la aplicație, o trimite la Gemini și întoarce alimentele
// recunoscute cu gramajele estimate, verificate după schemă. Cheia Gemini stă doar aici, în Secrets (GEMINI_API_KEY).
// Nu salvează poza nicăieri. Nu întoarce valori nutriționale (acelea vin din bazele de date, în aplicație).
//
// Secrets / variabile:
//   GEMINI_API_KEY  (obligatoriu)     — cheia din Google AI Studio
//   MODEL_AI        (opțional)        — implicit gemini-3.1-flash-lite
//   SCAN_LIMITA_ZI  (opțional)        — câte scanări pe zi are voie un cont (implicit 20)
//   SUPABASE_URL                      — pusă automat de Supabase
import {
  EroareScanare, valideazaCerere, corpCerereGemini, extrageTextGemini, curataRaspunsAI,
  eroareDinStatusGemini, utilizareTokeni,
} from './logica.js';

const ORIGINI = (Deno.env.get('ORIGINI_PERMISE') || 'https://alexvladx.github.io,http://localhost:8765,http://127.0.0.1:8765')
  .split(',').map(s => s.trim()).filter(Boolean);
const MODEL = Deno.env.get('MODEL_AI') || 'gemini-3.1-flash-lite';
const LIMITA_ZI = Math.min(200, Math.max(1, Number(Deno.env.get('SCAN_LIMITA_ZI')) || 20));
const GEMINI_BAZA = Deno.env.get('GEMINI_BAZA') || 'https://generativelanguage.googleapis.com';
const TIMP_MAXIM_AI_MS = 30_000;
const MAX_CORP = 2_200_000;

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

// Utilizatorul din tokenul trimis de aplicație, verificat la serverul de autentificare Supabase.
async function utilizatorDinToken(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const cheie = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  const url = Deno.env.get('SUPABASE_URL');
  if (!/^Bearer\s+\S+/.test(auth) || !cheie || !url) throw new EroareScanare('neautentificat', 'Conectează-te la contul din cloud ca să folosești scanarea.', 401);
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: cheie } });
  if (!r.ok) throw new EroareScanare('neautentificat', 'Sesiunea a expirat. Conectează-te din nou din Setări → Cont.', 401);
  const u = await r.json();
  if (!u || !u.id) throw new EroareScanare('neautentificat', 'Sesiunea a expirat. Conectează-te din nou din Setări → Cont.', 401);
  return { auth, cheie, url };
}

// Numără scanarea în baza de date (funcția SQL inregistreaza_scanare, cu regulile „doar ale mele”).
async function numaraScanarea({ auth, cheie, url }: { auth: string; cheie: string; url: string }) {
  const r = await fetch(`${url}/rest/v1/rpc/inregistreaza_scanare`, {
    method: 'POST', headers: { Authorization: auth, apikey: cheie, 'Content-Type': 'application/json' }, body: JSON.stringify({ limita: LIMITA_ZI }),
  });
  if (r.status === 404) throw new EroareScanare('configurare', 'Lipsește tabelul de scanări din Supabase (rulează supabase/scanare.sql).', 500);
  if (!r.ok) throw new EroareScanare('furnizor_indisponibil', 'Contorul de scanări nu răspunde. Încearcă din nou.', 502);
  const d = await r.json();
  if (!d || !d.permis) throw new EroareScanare('limita_zilnica', `Ai atins limita de ${LIMITA_ZI} scanări pe azi. Poți scana din nou mâine.`, 429);
  return { azi: Number(d.numar) || 0, limita: LIMITA_ZI };
}

async function intreabaGemini(cerere: { imagine: string; tip: string; nota: string }) {
  const cheie = Deno.env.get('GEMINI_API_KEY');
  if (!cheie) throw new EroareScanare('configurare', 'Cheia Gemini nu e adăugată în Supabase (Edge Functions → Secrets → GEMINI_API_KEY).', 500);
  const ctrl = new AbortController();
  const ceas = setTimeout(() => ctrl.abort(), TIMP_MAXIM_AI_MS);
  let r: Response;
  try {
    r = await fetch(`${GEMINI_BAZA}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cheie },
      body: JSON.stringify(corpCerereGemini(cerere)),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new EroareScanare('timeout', 'Analiza a durat prea mult. Încearcă din nou.', 504);
    throw new EroareScanare('furnizor_indisponibil', 'Furnizorul AI nu poate fi contactat acum.', 502);
  } finally { clearTimeout(ceas); }
  const corp = await r.json().catch(() => null);
  if (!r.ok) throw eroareDinStatusGemini(r.status, corp);
  return { rezultat: curataRaspunsAI(extrageTextGemini(corp)), tokeni: utilizareTokeni(corp) };
}

Deno.serve(async (req: Request) => {
  const origine = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: antetCors(origine) });
  try {
    if (req.method !== 'POST') throw new EroareScanare('cerere_invalida', 'Metodă nepermisă.', 405);
    if (Number(req.headers.get('content-length') || 0) > MAX_CORP) throw new EroareScanare('imagine_prea_mare', 'Poza e prea mare.', 413);
    const sesiune = await utilizatorDinToken(req);
    const textCorp = await req.text();
    if (textCorp.length > MAX_CORP) throw new EroareScanare('imagine_prea_mare', 'Poza e prea mare.', 413);
    let corp: unknown;
    try { corp = JSON.parse(textCorp); } catch (_) { throw new EroareScanare('cerere_invalida', 'Cererea nu are formatul așteptat.', 400); }
    const cerere = valideazaCerere(corp);
    const utilizare = await numaraScanarea(sesiune);
    const { rezultat, tokeni } = await intreabaGemini(cerere);
    return raspuns(200, { ...rezultat, model: MODEL, utilizare, tokeni }, origine);
  } catch (err) {
    if (err instanceof EroareScanare) return raspuns(err.status || 500, { cod: err.cod, mesaj: err.message }, origine);
    console.error(err);
    return raspuns(500, { cod: 'eroare', mesaj: 'Eroare neașteptată pe server.' }, origine);
  }
});
