-- Login por celular (sem SMS). Rode UMA VEZ no SQL Editor do Supabase.
--
-- Como funciona: quem se cadastra só com celular recebe um e-mail interno
-- automático (cel<numero>@garage-cliente.com), que o Supabase usa como login.
-- Na hora de entrar pelo número, o site chama esta função pra descobrir
-- qual e-mail de login corresponde àquele telefone, e aí faz o login normal.
--
-- A comparação ignora formatação (parênteses, traços, espaços): guarda e
-- compara só os dígitos, então tanto faz digitar (71) 99999-9999 ou
-- 71999999999.

create or replace function email_do_telefone(p_phone text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    and regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') <> ''
  limit 1;
$$;

grant execute on function email_do_telefone to anon, authenticated;
