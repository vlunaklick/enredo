-- Pistas de la comunidad: cualquiera lee las publicadas, los usuarios con cuenta crean, reaccionan y denuncian.

create table public.community_puzzles (
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40 and author_name = btrim(author_name)),
  clue text not null check (char_length(clue) between 5 and 200 and clue ~ '\(\d+(,\d+)*\)$'),
  enumeration text not null check (enumeration ~ '^\d{1,2}(,\d{1,2}){0,5}$'),
  type text not null check (type in ('anagrama', 'oculta', 'inversion', 'charada', 'doble', 'contenedor', 'eliminacion', 'homofono', 'combinada')),
  difficulty smallint not null check (difficulty between 1 and 3),
  secret text not null check (char_length(secret) <= 4000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  likes int not null default 0,
  hard int not null default 0,
  unclear int not null default 0,
  reports int not null default 0,
  created_at timestamptz not null default now(),
  -- La pista termina exactamente en «(enumeración)».
  check (right(clue, char_length(enumeration) + 2) = '(' || enumeration || ')')
);

create index community_puzzles_feed_new on public.community_puzzles (status, created_at desc);
create index community_puzzles_feed_top on public.community_puzzles (status, likes desc);
create index community_puzzles_author on public.community_puzzles (author_id, created_at desc);

-- Registro append-only de altas: el límite diario cuenta aquí, así que borrar pistas no lo reinicia.
create table public.community_submissions (
  author_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index community_submissions_author on public.community_submissions (author_id, created_at);

create table public.community_reactions (
  puzzle_id text not null references public.community_puzzles (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reaction text not null check (reaction in ('like', 'hard', 'unclear')),
  created_at timestamptz not null default now(),
  primary key (puzzle_id, user_id)
);

create index community_reactions_user on public.community_reactions (user_id);

create table public.community_reports (
  puzzle_id text not null references public.community_puzzles (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (puzzle_id, user_id)
);

create index community_reports_user on public.community_reports (user_id);

alter table public.community_puzzles enable row level security;
alter table public.community_submissions enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;

-- Supabase concede todo por defecto a anon/authenticated: se quita y se da solo lo necesario.
revoke all on public.community_puzzles, public.community_reactions, public.community_reports, public.community_submissions from anon, authenticated;

-- author_id no se lee desde el cliente (privacidad): select por columnas, y «Mis pistas» va por RPC.
grant select (id, author_name, clue, enumeration, type, difficulty, secret, status, likes, hard, unclear, reports, created_at)
  on public.community_puzzles to anon, authenticated;
grant delete on public.community_puzzles to authenticated;
grant insert (author_name, clue, enumeration, type, difficulty, secret) on public.community_puzzles to authenticated;
grant select, insert, update, delete on public.community_reactions to authenticated;
grant select, insert on public.community_reports to authenticated;

-- Pistas
create policy "community_puzzles: read published" on public.community_puzzles
  for select to anon, authenticated using (status = 'published');
create policy "community_puzzles: read own" on public.community_puzzles
  for select to authenticated using ((select auth.uid()) = author_id);
create policy "community_puzzles: insert own" on public.community_puzzles
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "community_puzzles: delete own" on public.community_puzzles
  for delete to authenticated using ((select auth.uid()) = author_id);

-- Reacciones: solo sobre pistas publicadas (la FK no pasa por RLS, por eso se comprueba aquí).
create policy "community_reactions: read own" on public.community_reactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "community_reactions: insert own" on public.community_reactions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.community_puzzles p where p.id = puzzle_id and p.status = 'published')
  );
create policy "community_reactions: update own" on public.community_reactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.community_puzzles p where p.id = puzzle_id and p.status = 'published')
  );
create policy "community_reactions: delete own" on public.community_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Denuncias
create policy "community_reports: read own" on public.community_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "community_reports: insert own" on public.community_reports
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.community_puzzles p where p.id = puzzle_id and p.status = 'published')
  );

-- Antes de insertar: normaliza el nombre y limita a 5 pistas por autor cada 24 h.
create function public.community_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_name := btrim(new.author_name);
  -- Serializa las altas de un mismo autor para que el límite no se salte con peticiones paralelas.
  perform pg_advisory_xact_lock(hashtextextended(new.author_id::text, 0));
  if (select count(*) from public.community_submissions
      where author_id = new.author_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limit' using errcode = 'P0001', hint = 'Máximo 5 pistas cada 24 horas';
  end if;
  insert into public.community_submissions (author_id) values (new.author_id);
  return new;
end;
$$;

create trigger community_puzzles_before_insert before insert on public.community_puzzles
  for each row execute function public.community_before_insert();

-- Contadores de reacciones: resta la reacción anterior y suma la nueva.
create function public.community_sync_reaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.community_puzzles set
      likes = likes - (old.reaction = 'like')::int,
      hard = hard - (old.reaction = 'hard')::int,
      unclear = unclear - (old.reaction = 'unclear')::int
    where id = old.puzzle_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.community_puzzles set
      likes = likes + (new.reaction = 'like')::int,
      hard = hard + (new.reaction = 'hard')::int,
      unclear = unclear + (new.reaction = 'unclear')::int
    where id = new.puzzle_id;
  end if;
  return null;
end;
$$;

create trigger community_reactions_sync after insert or update or delete on public.community_reactions
  for each row execute function public.community_sync_reaction();

-- Denuncias: cuenta y, al llegar a 3, oculta la pista.
create function public.community_count_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.community_puzzles
  set reports = reports + 1,
      status = case when reports + 1 >= 3 then 'hidden' else status end
  where id = new.puzzle_id;
  return null;
end;
$$;

create trigger community_reports_count after insert on public.community_reports
  for each row execute function public.community_count_report();

revoke execute on function public.community_before_insert(), public.community_sync_reaction(), public.community_count_report()
  from public, anon, authenticated;

-- «Mis pistas»: devuelve también las ocultas sin exponer author_id.
create function public.my_community_puzzles()
returns table (id text, author_name text, clue text, enumeration text, type text, difficulty smallint,
  status text, likes int, hard int, unclear int, reports int, created_at timestamptz)
language sql security definer stable set search_path = '' as $$
  select p.id, p.author_name, p.clue, p.enumeration, p.type, p.difficulty,
    p.status, p.likes, p.hard, p.unclear, p.reports, p.created_at
  from public.community_puzzles p
  where p.author_id = (select auth.uid())
  order by p.created_at desc;
$$;

revoke execute on function public.my_community_puzzles() from public, anon;
grant execute on function public.my_community_puzzles() to authenticated;
