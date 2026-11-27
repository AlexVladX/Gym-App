# Configurarea contului în cloud (Supabase) — o singură dată

Durează ~10 minute. Nu ai nevoie de cunoștințe tehnice: doar copiezi și apeși butoane.
**Cheia secretă** (`sb_secret_…` sau `service_role`) **nu o copia nicăieri** — aplicația nu are nevoie de ea.

## 1. Proiectul
1. Intră pe https://supabase.com/dashboard → **New project**.
2. Nume: `gym-app`. Parola bazei de date: generată (o păstrezi în managerul de parole; aplicația nu o folosește).
3. Regiunea: **Europe (Frankfurt)** — cea mai apropiată.
4. Lasă bifa „Automatically expose new tables” **nebifată** (implicit). Fișierul SQL dă singur accesul strict necesar.
5. **Create new project** și așteaptă 1–2 minute.

## 2. Baza de date (fișierul `supabase/schema.sql`)
1. În meniul din stânga: **SQL Editor** → **New query**.
2. Deschide `supabase/schema.sql` din repo, copiază **tot** conținutul și lipește-l în editor.
3. **Run**. Trebuie să apară „Success. No rows returned”. (Se poate rula din nou fără pagube.)

## 3. Adresele aplicației (pentru linkurile din e-mail)
**Authentication** → **URL Configuration**:
- **Site URL**: `https://alexvladx.github.io/Gym-App/`
- **Redirect URLs** → Add URL: `https://alexvladx.github.io/Gym-App/**`

## 4. E-mailul
**Authentication** → **Sign In / Providers** → **Email**: activat; „Confirm email” activat (recomandat).
Serviciul de e-mail implicit al Supabase trimite **doar la adresele din echipa proiectului** și foarte puține mesaje pe oră.
Pentru tine e suficient: creează contul din aplicație **cu același e-mail cu care ai contul Supabase**.
(Dacă vrei conturi și pentru alte persoane, trebuie configurat un server SMTP propriu — Authentication → Emails → SMTP.)

## 5. Cele două valori publice
**Project Settings** → **API Keys**:
- **Project URL** (ex. `https://abcdefghijklm.supabase.co`)
- **Publishable key** (`sb_publishable_…`)

Ambele sunt **publice prin natura lor** (stau în orice aplicație web care folosește Supabase); datele sunt protejate
de regulile din pasul 2. Pune-le în `cloud-config.js`:
```js
const CONFIG_CLOUD = {
  url: 'https://abcdefghijklm.supabase.co',
  cheiePublica: 'sb_publishable_...',
};
```

## 6. În aplicație
Setări → **Cont** → e-mail + parolă → **Creează cont** → confirmă din e-mail → **Intră în cont**.
La prima conectare, aplicația propune să urce datele de pe telefon și apoi verifică copia din cont.
Pe al doilea dispozitiv: aceeași adresă, **Intră în cont** — datele vin singure.

## De știut
- Planul gratuit oprește proiectul după o săptămână fără nicio activitate. Aplicația merge mai departe pe telefon;
  sincronizarea revine după ce apeși **Restore project** în panoul Supabase.
- Copii de siguranță: aplicația face automat, săptămânal, o copie completă în cont (Setări → Cont → Copii în cont),
  iar exportul JSON din Setări → Backup rămâne disponibil.

## Scanarea meselor (Fotografiază masa)

Cheile stau DOAR în Supabase → Edge Functions → Secrets (niciodată în aplicație, pe GitHub sau în chat):

| Nume | Ce e |
|---|---|
| `GEMINI_API_KEY` | cheia din Google AI Studio (cu plata activată, ca pozele să nu fie folosite la antrenarea modelelor) |
| `FDC_API_KEY` | cheia gratuită USDA FoodData Central (pentru etapa cu baza de date) |
| `SCAN_LIMITA_ZI` | opțional — câte scanări pe zi (implicit 20) |
| `MODEL_AI` | opțional — implicit `gemini-3.1-flash-lite` |

O singură dată:
1. SQL Editor → lipești tot din `supabase/scanare.sql` → Run (contorul zilnic de scanări).
2. Publicarea funcției `supabase/functions/scanare`:
   - automat: în GitHub → Settings → Secrets and variables → Actions → New repository secret,
     nume `SUPABASE_ACCESS_TOKEN`, valoare = un token din Supabase → Account → Access Tokens.
     Apoi GitHub → Actions → „Funcții Supabase” → Run workflow (și se republică singură la fiecare modificare).
   - sau manual, din panoul Supabase (Edge Functions → Deploy a new function → Via Editor), cu numele `scanare`,
     cele două fișiere (`index.ts`, `logica.js`) și „Verify JWT” dezactivat (funcția verifică singură contul).
