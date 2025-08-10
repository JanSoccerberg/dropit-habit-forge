-- Fix linter: add SET search_path to functions missing it
create or replace function public.challenges_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.join_code is null or not (new.join_code ~ '^[A-Z0-9]{6}$') then
    new.join_code := public.generate_unique_join_code();
  end if;
  return new;
end;
$function$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.profiles_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.display_name is not null then
    if length(btrim(new.display_name)) < 1 or length(new.display_name) > 50 then
      raise exception 'display_name must be 1..50 characters';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.profiles_fill_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (new.display_name is null or length(btrim(coalesce(new.display_name, ''))) = 0) then
    if new.name is not null and length(btrim(new.name)) > 0 then
      new.display_name := left(new.name, 50);
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.generate_unique_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  chars constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code text := '';
  i int;
  exists_code int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;

    select count(*) into exists_code from public.challenges where join_code = code;

    exit when exists_code = 0;
  end loop;

  return code;
end;
$function$;