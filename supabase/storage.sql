-- Cofre (bucket) de imagens do site — produtos e banner de promoção.
-- Rode UMA VEZ no SQL Editor do Supabase (depois do schema.sql).
--
-- Depois disso, no painel /admin o dono envia imagens direto do computador;
-- elas ficam guardadas aqui e o site mostra na hora, sem precisar de deploy.

-- Cria o bucket público "imagens" (público = qualquer visitante vê as fotos).
insert into storage.buckets (id, name, public)
values ('imagens', 'imagens', true)
on conflict (id) do nothing;

-- Leitura pública: todo mundo que abre o site vê as imagens.
create policy "imagens leitura publica"
  on storage.objects for select
  using (bucket_id = 'imagens');

-- Envio / troca / remoção: só quem é dono (mesma regra is_owner do resto).
create policy "imagens envio dono"
  on storage.objects for insert
  with check (bucket_id = 'imagens' and public.is_owner());

create policy "imagens troca dono"
  on storage.objects for update
  using (bucket_id = 'imagens' and public.is_owner());

create policy "imagens remocao dono"
  on storage.objects for delete
  using (bucket_id = 'imagens' and public.is_owner());
