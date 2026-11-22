-- =====================================================================
-- Gym App 3.0 — Faza 2: contul și sincronizarea (Supabase)
-- Se rulează O SINGURĂ DATĂ în Supabase → SQL Editor → New query → Run.
-- Se poate rula din nou fără pagube (folosește IF NOT EXISTS / OR REPLACE).
--
-- Ce face:
--   • tabelul public.inregistrari: câte un rând pentru fiecare înregistrare a ta
--     (antrenament, măsurătoare, zi de nutriție, rețetă proprie, setări …), ca JSON;
--   • securitate la nivel de rând (RLS): fiecare cont vede și modifică DOAR rândurile lui;
--   • funcția salveaza_inregistrari: salvează cu verificarea versiunii, ca o modificare
--     făcută între timp pe alt dispozitiv să nu fie suprascrisă în tăcere;
--   • spațiul privat de fișiere „poze” (pozele de progres, pozele rețetelor, copiile de siguranță),
--     în care fiecare cont are acces doar la dosarul lui.
-- Cheia secretă (sb_secret_… / service_role) NU apare nicăieri în aplicație.
-- =====================================================================

-- Numărătoare globală de modificări: aplicația cere „ce s-a schimbat după numărul X”,
-- fără să depindă de ceasul telefoanelor.
create sequence if not exists public.inregistrari_rev;

create table if not exists public.inregistrari (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  colectie   text        not null check (colectie ~ '^[a-zA-Z]{1,40}$'),
  cheie      text        not null check (char_length(cheie) between 1 and 200),
  date       jsonb,
  sters      boolean     not null default false,
  versiune   integer     not null default 1 check (versiune >= 1),
  rev        bigint      not null default nextval('public.inregistrari_rev'),
  dispozitiv text        check (dispozitiv is null or char_length(dispozitiv) <= 80),
  modificat  timestamptz not null default now(),
  primary key (user_id, colectie, cheie),
  constraint inregistrari_marime check (date is null or pg_column_size(date) <= 2000000)
);
create index if not exists inregistrari_user_rev on public.inregistrari (user_id, rev);

alter table public.inregistrari enable row level security;

drop policy if exists "citesc doar ale mele" on public.inregistrari;
drop policy if exists "adaug doar ale mele" on public.inregistrari;
drop policy if exists "modific doar ale mele" on public.inregistrari;
drop policy if exists "sterg doar ale mele" on public.inregistrari;
create policy "citesc doar ale mele" on public.inregistrari for select to authenticated
  using (user_id = (select auth.uid()));
create policy "adaug doar ale mele" on public.inregistrari for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "modific doar ale mele" on public.inregistrari for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sterg doar ale mele" on public.inregistrari for delete to authenticated
  using (user_id = (select auth.uid()));

-- Acces explicit prin Data API (din 2026, tabelele noi nu mai sunt expuse automat).
-- Doar utilizatorii autentificați; vizitatorii fără cont (anon) nu au acces deloc.
revoke all on table public.inregistrari from anon, public;
grant select, insert, update, delete on table public.inregistrari to authenticated;
revoke all on sequence public.inregistrari_rev from anon, public;
grant usage on sequence public.inregistrari_rev to authenticated;

-- Salvarea unui lot de înregistrări, fiecare cu versiunea pe care o știa dispozitivul („baza”).
-- Dacă rândul s-a schimbat între timp (alt dispozitiv), NU se scrie: se întoarce varianta din cloud
-- ca „conflict”, iar aplicația o combină sau te întreabă pe tine.
-- security invoker: rulează cu drepturile utilizatorului, deci regulile RLS de mai sus se aplică.
create or replace function public.salveaza_inregistrari(lot jsonb, dispozitiv text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  eu uuid := auth.uid();
  e jsonb;
  rand public.inregistrari%rowtype;
  rezultat jsonb := '[]'::jsonb;
  baza integer;
begin
  if eu is null then
    raise exception 'neautentificat' using errcode = '28000';
  end if;
  if jsonb_typeof(lot) <> 'array' or jsonb_array_length(lot) > 500 then
    raise exception 'lot invalid (maximum 500 de înregistrări)' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(lot) loop
    baza := nullif(e->>'baza', '')::integer;
    select * into rand from public.inregistrari
      where user_id = eu and colectie = e->>'colectie' and cheie = e->>'cheie'
      for update;
    if not found then
      insert into public.inregistrari (user_id, colectie, cheie, date, sters, versiune, dispozitiv)
      values (eu, e->>'colectie', e->>'cheie', e->'date', coalesce((e->>'sters')::boolean, false), 1, dispozitiv)
      returning * into rand;
      rezultat := rezultat || jsonb_build_object('colectie', rand.colectie, 'cheie', rand.cheie, 'stare', 'ok', 'versiune', rand.versiune, 'rev', rand.rev);
    elsif baza is not null and baza = rand.versiune then
      update public.inregistrari
        set date = e->'date', sters = coalesce((e->>'sters')::boolean, false), versiune = rand.versiune + 1,
            rev = nextval('public.inregistrari_rev'), modificat = now(), dispozitiv = salveaza_inregistrari.dispozitiv
        where user_id = eu and colectie = rand.colectie and cheie = rand.cheie
        returning * into rand;
      rezultat := rezultat || jsonb_build_object('colectie', rand.colectie, 'cheie', rand.cheie, 'stare', 'ok', 'versiune', rand.versiune, 'rev', rand.rev);
    else
      -- s-a modificat în altă parte: nu suprascriem
      rezultat := rezultat || jsonb_build_object('colectie', rand.colectie, 'cheie', rand.cheie, 'stare', 'conflict',
        'versiune', rand.versiune, 'rev', rand.rev, 'date', rand.date, 'sters', rand.sters);
    end if;
  end loop;
  return rezultat;
end;
$$;

revoke all on function public.salveaza_inregistrari(jsonb, text) from anon, public;
grant execute on function public.salveaza_inregistrari(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- Fișiere: spațiul privat „poze” (≤ 10 MB pe fișier). Calea fiecărui fișier începe cu id-ul contului:
--   <id cont>/poze/…, <id cont>/pozeRetete/…, <id cont>/copii/…  — politica verifică primul dosar.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poze', 'poze', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/json'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "poze: citesc dosarul meu" on storage.objects;
drop policy if exists "poze: adaug în dosarul meu" on storage.objects;
drop policy if exists "poze: modific în dosarul meu" on storage.objects;
drop policy if exists "poze: șterg din dosarul meu" on storage.objects;
create policy "poze: citesc dosarul meu" on storage.objects for select to authenticated
  using (bucket_id = 'poze' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "poze: adaug în dosarul meu" on storage.objects for insert to authenticated
  with check (bucket_id = 'poze' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "poze: modific în dosarul meu" on storage.objects for update to authenticated
  using (bucket_id = 'poze' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'poze' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "poze: șterg din dosarul meu" on storage.objects for delete to authenticated
  using (bucket_id = 'poze' and (storage.foldername(name))[1] = (select auth.uid())::text);
