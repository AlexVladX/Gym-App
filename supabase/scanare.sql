-- Scanarea meselor (etapa 1): contorul zilnic de scanări, ca să nu poată crește costul AI peste limită.
-- Se rulează O SINGURĂ DATĂ în Supabase → SQL Editor → New query → lipești tot → Run. Se poate rula din nou fără probleme.
-- Fiecare cont își vede doar rândurile lui; nimeni nu poate scrie direct în tabel, doar prin funcția de mai jos.

create table if not exists public.scanari_utilizare (
  user_id uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  zi      date    not null,
  numar   integer not null default 0 check (numar >= 0),
  primary key (user_id, zi)
);

alter table public.scanari_utilizare enable row level security;

drop policy if exists "vad doar scanarile mele" on public.scanari_utilizare;
create policy "vad doar scanarile mele" on public.scanari_utilizare for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.scanari_utilizare from anon, authenticated;

-- Adună o scanare pentru contul conectat, în ziua de azi (ora României), dacă limita nu e atinsă.
-- Întoarce { permis, numar, limita }. Funcția de pe server („scanare”) hotărăște limita.
create or replace function public.inregistreaza_scanare(limita integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  z date := (now() at time zone 'Europe/Bucharest')::date;
  n integer;
begin
  if u is null then
    raise exception 'neautentificat' using errcode = '28000';
  end if;
  if limita is null or limita < 1 or limita > 200 then
    limita := 20;
  end if;
  insert into public.scanari_utilizare as s (user_id, zi, numar) values (u, z, 1)
  on conflict (user_id, zi) do update set numar = s.numar + 1 where s.numar < limita
  returning s.numar into n;
  if n is null then
    select s.numar into n from public.scanari_utilizare s where s.user_id = u and s.zi = z;
    return json_build_object('permis', false, 'numar', n, 'limita', limita);
  end if;
  return json_build_object('permis', true, 'numar', n, 'limita', limita);
end;
$$;

revoke all on function public.inregistreaza_scanare(integer) from public, anon;
grant execute on function public.inregistreaza_scanare(integer) to authenticated;
