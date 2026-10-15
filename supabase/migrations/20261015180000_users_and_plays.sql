-- Cuentas opcionales: un perfil por usuario y su progreso en cada pista.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now()
);

create table public.plays (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  puzzle_date date not null,
  status text not null check (status in ('playing', 'won', 'lost')),
  guesses text[] not null default '{}' check (cardinality(guesses) <= 5),
  hints text[] not null default '{}' check (cardinality(hints) <= 40),
  revealed smallint[] not null default '{}' check (cardinality(revealed) <= 40),
  live boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);

alter table public.profiles enable row level security;
alter table public.plays enable row level security;

-- Por ahora cada uno solo ve y toca lo suyo. Lo público (comunidad) se abrirá con políticas aparte.
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "plays: read own" on public.plays
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "plays: insert own" on public.plays
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plays: update own" on public.plays
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.plays from anon;
grant select, update (display_name) on public.profiles to authenticated;
grant select, insert, update on public.plays to authenticated;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger plays_touch before update on public.plays
  for each row execute function public.touch_updated_at();

-- Al registrarse (p. ej. con Google) se crea el perfil con su nombre.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 60));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
