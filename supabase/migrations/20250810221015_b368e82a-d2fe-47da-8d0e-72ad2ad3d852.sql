-- Create a helper to ensure a profile row exists for the current user
create or replace function public.ensure_profile_exists()
returns void
language plpgsql
security definER
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles where id = auth.uid()) then
    insert into public.profiles (id, name)
    values (auth.uid(), 'User');
  end if;
end;
$$;