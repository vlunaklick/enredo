-- Cada usuario puede borrar su cuenta desde la web; el cascade se lleva su perfil y sus partidas.
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
