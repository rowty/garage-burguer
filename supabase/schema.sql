-- Garage Burger — schema + RLS + seed pro Supabase
--
-- Como rodar: Supabase Dashboard > SQL Editor > cola esse arquivo inteiro >
-- Run. Pode rodar de uma vez só, na ordem que está aqui.
--
-- Depois de rodar, veja README.md nessa mesma pasta pros próximos passos
-- (rodar login-telefone.sql + storage.sql, colar as chaves no site e virar
-- dono da própria conta).

-- ============================================================
-- 1. TABELAS
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  is_owner boolean not null default false,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text not null default 'Principal',
  bairro text not null,
  rua text not null,
  numero text not null,
  complemento text,
  referencia text,
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);
create index addresses_profile_id_idx on addresses (profile_id);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order integer not null default 0
);

create table menu_items (
  id text primary key,
  category_id uuid not null references menu_categories(id),
  name text not null,
  description text,
  price numeric(10,2) not null,
  image_url text,
  image_variant text,              -- null | 'contain' (modificador do CSS .dish-photo.contain)
  is_customizable boolean not null default false,
  custom_type text,                -- null | 'hamburguer' | 'acompanhamento'
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_category_id_idx on menu_items (category_id);

create table promo_banner (
  id integer primary key default 1 check (id = 1),
  image_url text,
  alt_text text,
  link_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table store_status (
  id integer primary key default 1 check (id = 1),
  is_open boolean not null default true,
  closed_message text not null default 'Estamos fechados no momento. Volte mais tarde!',
  hours_text text,
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),   -- null = pedido de convidado
  guest_name text,
  guest_phone text,
  status text not null default 'novo',        -- novo | preparando | saiu | entregue | cancelado
  tipo_entrega text not null,                 -- entrega | retirada
  bairro text,
  endereco_completo text,
  payment_method text not null,
  troco_para text,
  items jsonb not null,                       -- snapshot do carrinho no momento do pedido
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  points_used integer not null default 0,
  points_earned integer not null default 0,
  total numeric(10,2) not null,
  created_at timestamptz not null default now()
);
create index orders_profile_id_idx on orders (profile_id);

create table loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id),
  delta integer not null,           -- positivo = ganhou, negativo = resgatou
  reason text not null,             -- order_earn | order_redeem | manual_adjust
  created_at timestamptz not null default now()
);
create index loyalty_ledger_profile_id_idx on loyalty_ledger (profile_id);

-- ============================================================
-- 2. FUNÇÕES
-- ============================================================

-- Diz se o usuário logado é dono. security definer + tabela própria evita
-- recursão de policy (uma policy em profiles que consultasse profiles
-- direto entraria em loop).
create or replace function is_owner()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select is_owner from profiles where id = auth.uid()), false);
$$;

-- Cria a linha em profiles automaticamente quando alguém se cadastra.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- Impede que um cliente altere is_owner/loyalty_points da própria linha
-- direto por um UPDATE (só dono ou a função place_order podem). A checagem
-- de auth.uid() garante que UPDATEs rodados pelo painel do Supabase (sem
-- usuário logado) passem — senão nem o admin conseguiria promover um dono.
create or replace function prevent_privileged_self_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not is_owner() then
    new.is_owner := old.is_owner;
    new.loyalty_points := old.loyalty_points;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard
before update on profiles
for each row execute function prevent_privileged_self_update();

-- Único jeito de criar um pedido. Recalcula pontos e valida tudo no
-- servidor — nunca confia em valor vindo do cliente (nem loja
-- aberta/fechada, nem saldo de pontos, nem total).
create or replace function place_order(
  p_items jsonb,
  p_tipo_entrega text,
  p_bairro text,
  p_endereco_completo text,
  p_payment_method text,
  p_troco_para text,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_points_used integer default 0,
  p_guest_name text default null,
  p_guest_phone text default null
)
returns orders
language plpgsql security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_is_open boolean;
  v_available_points integer := 0;
  v_discount numeric(10,2) := 0;
  v_total numeric(10,2);
  v_points_earned integer;
  v_order orders;
begin
  select is_open into v_is_open from store_status where id = 1;
  if coalesce(v_is_open, true) = false then
    raise exception 'store_closed' using errcode = 'P0001';
  end if;

  if v_profile_id is not null then
    select loyalty_points into v_available_points from profiles where id = v_profile_id;
  end if;

  if p_points_used is null or p_points_used < 0 then
    p_points_used := 0;
  end if;
  if p_points_used > coalesce(v_available_points, 0) then
    raise exception 'insufficient_points' using errcode = 'P0001';
  end if;

  -- 20 pontos = R$1 de desconto (100 pontos = R$5). Só usa em múltiplos de
  -- 20 — o resto fica guardado, não é descartado.
  p_points_used := floor(p_points_used / 20.0)::integer * 20;
  v_discount := floor(p_points_used / 20.0);

  v_total := greatest(p_subtotal + coalesce(p_delivery_fee, 0) - v_discount, 0);
  v_points_earned := floor(v_total)::integer;

  insert into orders (
    profile_id, guest_name, guest_phone, status, tipo_entrega, bairro,
    endereco_completo, payment_method, troco_para, items, subtotal,
    delivery_fee, discount, points_used, points_earned, total
  ) values (
    v_profile_id, p_guest_name, p_guest_phone, 'novo', p_tipo_entrega, p_bairro,
    p_endereco_completo, p_payment_method, p_troco_para, p_items, p_subtotal,
    coalesce(p_delivery_fee, 0), v_discount, p_points_used, v_points_earned, v_total
  ) returning * into v_order;

  if v_profile_id is not null then
    if p_points_used > 0 then
      insert into loyalty_ledger (profile_id, order_id, delta, reason)
      values (v_profile_id, v_order.id, -p_points_used, 'order_redeem');
    end if;
    insert into loyalty_ledger (profile_id, order_id, delta, reason)
    values (v_profile_id, v_order.id, v_points_earned, 'order_earn');

    update profiles
    set loyalty_points = loyalty_points - p_points_used + v_points_earned
    where id = v_profile_id;
  end if;

  return v_order;
end;
$$;

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table addresses enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table promo_banner enable row level security;
alter table store_status enable row level security;
alter table orders enable row level security;
alter table loyalty_ledger enable row level security;

-- profiles: cada um vê/edita a própria linha; dono vê/edita todas.
-- (INSERT não tem policy — só acontece via handle_new_user(), que roda
-- como security definer e ignora RLS.)
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_owner());
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_owner());
create policy profiles_delete on profiles for delete
  using (is_owner());

-- addresses: só o dono do endereço mexe nele.
create policy addresses_all on addresses for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- cardápio, banner, status da loja: leitura pública, escrita só dono.
create policy menu_categories_select on menu_categories for select using (true);
create policy menu_categories_write on menu_categories for insert with check (is_owner());
create policy menu_categories_update on menu_categories for update using (is_owner());
create policy menu_categories_delete on menu_categories for delete using (is_owner());

create policy menu_items_select on menu_items for select using (true);
create policy menu_items_write on menu_items for insert with check (is_owner());
create policy menu_items_update on menu_items for update using (is_owner());
create policy menu_items_delete on menu_items for delete using (is_owner());

create policy promo_banner_select on promo_banner for select using (true);
create policy promo_banner_write on promo_banner for update using (is_owner());

create policy store_status_select on store_status for select using (true);
create policy store_status_write on store_status for update using (is_owner());

-- orders: cliente vê os próprios (e os de convidado ficam só visíveis pro
-- dono); dono vê e atualiza status de todos. INSERT não tem policy — só
-- acontece via place_order(), que recalcula tudo no servidor.
create policy orders_select on orders for select
  using (profile_id = auth.uid() or is_owner());
create policy orders_update on orders for update
  using (is_owner());

-- loyalty_ledger: só leitura (própria ou dono). Escrita só via place_order().
create policy loyalty_ledger_select on loyalty_ledger for select
  using (profile_id = auth.uid() or is_owner());

grant execute on function place_order to anon, authenticated;
grant execute on function is_owner to anon, authenticated;

-- ============================================================
-- 4. SEED — cardápio atual do site (site/index.html), banner e horário
-- ============================================================

insert into menu_categories (slug, name, sort_order) values
  ('hamburgueres', 'Hambúrgueres', 0),
  ('temaki-hot', 'Temaki Hot (cone frito)', 1),
  ('temaki-cru', 'Temaki Cru (alga ao natural)', 2),
  ('big-hot', 'Big Hot (roll frito)', 3),
  ('bebidas', 'Bebidas', 4),
  ('acompanhamentos', 'Acompanhamentos', 5);

-- Hambúrgueres (todos customizáveis: abrem o modal de adicionais)
insert into menu_items (id, category_id, name, description, price, image_url, is_customizable, custom_type, sort_order) values
  ('kids', (select id from menu_categories where slug = 'hamburgueres'), 'Kids', 'Pão de batata 80g, blend 120g, queijo prato e ketchup', 20.00, 'img/produtos/kids.jpg', true, 'hamburguer', 0),
  ('opalla', (select id from menu_categories where slug = 'hamburgueres'), 'Opalla', 'Pão de batata 80g, 3 blends de 100g, triplo queijo prato, triplo creme de cheddar, tiras de bacon crocante e maionese de bacon', 38.00, 'img/produtos/opalla.jpg', true, 'hamburguer', 1),
  ('mustang', (select id from menu_categories where slug = 'hamburgueres'), 'Mustang', 'Pão de batata 80g, 2 blends de 100g, queijo prato, queijo coalho maçaricado, mussarela, bacon, molho barbecue e maionese de bacon', 32.00, 'img/produtos/mustang.jpg', true, 'hamburguer', 2),
  ('garage-75', (select id from menu_categories where slug = 'hamburgueres'), 'Garage 75', 'Pão de batata 80g, blend 120g, alface, tomate, queijo prato e maionese de bacon', 24.00, 'img/produtos/garage-75.jpg', true, 'hamburguer', 3),
  ('maverick', (select id from menu_categories where slug = 'hamburgueres'), 'Maverick', 'Pão australiano 80g, blend 150g, queijo prato, queijo coalho maçaricado, mussarela, cebola caramelizada, molho barbecue, creme de cheddar e bacon', 28.00, 'img/produtos/maverick.jpg', true, 'hamburguer', 4),
  ('maverick-turbo', (select id from menu_categories where slug = 'hamburgueres'), 'Maverick Turbo', 'Pão australiano, 2 blends de 150g, duplo queijo prato, duplo mussarela, duplo queijo coalho maçaricado, cebola caramelizada, bacon, creme de cheddar e molho barbecue', 32.00, 'img/produtos/maverick-turbo.jpg', true, 'hamburguer', 5),
  ('corvette', (select id from menu_categories where slug = 'hamburgueres'), 'Corvette', 'Pão de batata 80g, blend 120g, queijo prato, queijo coalho maçaricado, mussarela, bacon e maionese', 27.00, 'img/produtos/corvette.jpg', true, 'hamburguer', 6);

-- Temaki Hot (cone frito)
insert into menu_items (id, category_id, name, description, price, image_url, sort_order) values
  ('temaki-hot-salmao-frito', (select id from menu_categories where slug = 'temaki-hot'), 'Salmão Frito', 'Cone de alga nori frita, recheado com arroz japonês, salmão em cubos frito, gergelim, cebolinha e cream cheese', 42.00, 'img/produtos/temaki-salmao-frito.jpg', 0),
  ('temaki-hot-camarao-salmao-frito', (select id from menu_categories where slug = 'temaki-hot'), 'Camarão e Salmão Frito', 'Cone de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos frito, gergelim, cebolinha e cream cheese', 40.00, 'img/produtos/temaki-camarao-salmao-frito.jpg', 1),
  ('temaki-hot-misto-turbinado', (select id from menu_categories where slug = 'temaki-hot'), 'Misto Turbinado Frito', 'Cone de alga nori frita, recheado com arroz japonês, camarão grelhado, pedaços de kani, salmão em cubos frito, gergelim, cebolinha e cream cheese', 45.00, 'img/produtos/temaki-misto-turbinado.jpg', 2);

-- Temaki Cru (alga ao natural)
insert into menu_items (id, category_id, name, description, price, image_url, sort_order) values
  ('temaki-cru-salmao-cru', (select id from menu_categories where slug = 'temaki-cru'), 'Salmão Cru', 'Cone de alga nori ao natural, recheado com arroz japonês, salmão em cubos cru, gergelim, cebolinha e cream cheese', 42.00, 'img/produtos/temaki-cru-salmao-cru.jpeg', 0),
  ('temaki-cru-salmao-macaricado', (select id from menu_categories where slug = 'temaki-cru'), 'Salmão Maçaricado', 'Cone de alga nori ao natural, recheado com arroz japonês, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', 40.00, 'img/produtos/temaki-cru-salmao-macaricado.jpg', 1),
  ('temaki-cru-camarao-salmao-cru', (select id from menu_categories where slug = 'temaki-cru'), 'Camarão Grelhado e Salmão Cru', 'Cone de alga nori ao natural, recheado com arroz japonês, camarão grelhado, salmão em cubos cru, gergelim, cebolinha e cream cheese', 42.00, 'img/produtos/temaki-cru-camarao-salmao-cru.jpeg', 2),
  ('temaki-cru-camarao-salmao-macaricado', (select id from menu_categories where slug = 'temaki-cru'), 'Camarão Grelhado e Salmão Maçaricado', 'Cone de alga nori ao natural, recheado com arroz japonês, camarão grelhado, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', 42.00, 'img/produtos/temaki-cru-camarao-salmao-macaricado.jpg', 3);

-- Big Hot (roll frito)
insert into menu_items (id, category_id, name, description, price, image_url, sort_order) values
  ('big-hot-salmao-frito', (select id from menu_categories where slug = 'big-hot'), 'Salmão Frito', 'Roll de alga nori frita, recheado com arroz japonês, salmão em cubos frito, gergelim, cebolinha e cream cheese', 47.00, 'img/produtos/big-hot-salmao-frito.jpg', 0),
  ('big-hot-salmao-macaricado', (select id from menu_categories where slug = 'big-hot'), 'Salmão Maçaricado', 'Roll de alga nori frita, recheado com arroz japonês, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', 47.00, 'img/produtos/big-hot-salmao-macaricado.jpg', 1),
  ('big-hot-salmao-cru', (select id from menu_categories where slug = 'big-hot'), 'Salmão Cru', 'Roll de alga nori frita, recheado com arroz japonês, salmão em cubos cru, gergelim, cebolinha e cream cheese', 49.00, 'img/produtos/big-hot-salmao-cru.webp', 2),
  ('big-hot-camarao-salmao-frito', (select id from menu_categories where slug = 'big-hot'), 'Camarão Grelhado e Salmão Frito', 'Roll de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos frito, gergelim, cebolinha e cream cheese', 47.00, 'img/produtos/big-hot-camarao-salmao-frito.jpg', 3),
  ('big-hot-camarao-salmao-macaricado', (select id from menu_categories where slug = 'big-hot'), 'Camarão Grelhado e Salmão Maçaricado', 'Roll de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', 47.00, 'img/produtos/big-hot-camarao-salmao-macaricado.jpg', 4),
  ('big-hot-camarao-salmao-cru', (select id from menu_categories where slug = 'big-hot'), 'Camarão Grelhado e Salmão Cru', 'Roll de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos cru, gergelim, cebolinha e cream cheese', 49.00, 'img/produtos/big-hot-camarao-salmao-cru.jpg', 5);

-- Bebidas (Pepsi e Coca em PNG com fundo branco = variante 'contain')
insert into menu_items (id, category_id, name, description, price, image_url, image_variant, sort_order) values
  ('refrigerante-1l', (select id from menu_categories where slug = 'bebidas'), 'Refrigerante 1L', 'Antártica ou Pepsi', 10.00, 'img/produtos/pepsi.png', 'contain', 0),
  ('coca-cola', (select id from menu_categories where slug = 'bebidas'), 'Coca-Cola', '', 10.00, 'img/produtos/coca-cola.png', 'contain', 1);
insert into menu_items (id, category_id, name, description, price, image_url, sort_order) values
  ('refrigerante-lata', (select id from menu_categories where slug = 'bebidas'), 'Refrigerante Lata', 'Bem gelada', 6.00, 'img/produtos/coca-lata.jpg', 2);

-- Acompanhamentos
insert into menu_items (id, category_id, name, description, price, image_url, sort_order) values
  ('batata-p', (select id from menu_categories where slug = 'acompanhamentos'), 'Batata P', '', 10.00, 'img/produtos/batata-frita.jpg', 0),
  ('batata-m', (select id from menu_categories where slug = 'acompanhamentos'), 'Batata M', '', 15.00, 'img/produtos/batata-frita.jpg', 1),
  ('batata-g', (select id from menu_categories where slug = 'acompanhamentos'), 'Batata G', 'Com bacon e cheddar', 25.00, 'img/produtos/batata-frita.jpg', 2);

-- Banner de promoção: o Garage não usa banner hoje — deixamos desligado.
insert into promo_banner (id, is_active) values (1, false);

-- Status da loja (ajuste o horário no /admin depois)
insert into store_status (id, is_open, hours_text, closed_message) values
  (1, true, 'Qua a Seg · Ter fechado', 'Estamos fechados no momento. Volte mais tarde!');
