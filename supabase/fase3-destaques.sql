-- Fase 3 — marca quais itens aparecem em "Mais Pedidos" na home.
-- Rode UMA VEZ no SQL Editor do Supabase (depois do schema.sql).
--
-- is_featured = true faz o item aparecer também na vitrine "Mais Pedidos",
-- além de aparecer normalmente na categoria dele. Editável depois pelo
-- /admin (Fase 6).

alter table menu_items add column if not exists is_featured boolean not null default false;

update menu_items set is_featured = true
where id in ('opalla', 'maverick-turbo', 'big-hot-salmao-cru', 'refrigerante-lata');
