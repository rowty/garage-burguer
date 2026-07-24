-- Garage Burger — ESTOQUE: schema + RLS + seed pro Supabase
--
-- Como rodar: Supabase Dashboard (MESMO projeto do site Garage Burger) >
-- SQL Editor > cola esse arquivo inteiro > Run. Pode rodar de uma vez só.
--
-- Pré-requisito: o schema do site (supabase/schema.sql do Garage) já foi
-- rodado nesse projeto. Este arquivo REUTILIZA a função is_owner() e a tabela
-- profiles que já existem lá — não recria sistema de dono. O Pedro
-- (pedrolinkdiniz@gmail.com) já é dono e é a conta que loga no estoque.
--
-- Rodar de novo é seguro: as tabelas usam "if not exists" e o seed usa
-- "on conflict do nothing" (não sobrescreve o que você já editou no painel).

-- ============================================================
-- 1. TABELAS
-- ============================================================

-- Matéria-prima (pão, blend, salmão…). id texto = reaproveita as chaves do
-- app (zero remapeamento). unidade: 'un' | 'g' | 'ml'.
create table if not exists insumos (
  id text primary key,
  nome text not null,
  unidade text not null,
  custo numeric(12,4) not null default 0,
  estoque numeric(12,2) not null default 0,
  minimo numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- Fichas técnicas (receitas). preco null = item interno, não vendável
-- direto. ficha = array [{ tipo:'insumo'|'produto', id, qtd }] em jsonb,
-- pra manter a lógica recursiva de composição do app.
create table if not exists produtos (
  id text primary key,
  nome text not null,
  preco numeric(10,2),
  ficha jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Movimentações: venda (saida), entrada, perda. detalhes/custo podem ser
-- null (entrada não tem detalhes de baixa por ficha). criado_em ordena o
-- histórico (mais novo primeiro).
create table if not exists movimentacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  texto text not null,
  detalhes jsonb,
  valor numeric(12,2) not null default 0,
  custo numeric(12,2),
  criado_em timestamptz not null default now()
);
create index if not exists movimentacoes_criado_em_idx on movimentacoes (criado_em desc);

-- ============================================================
-- 2. ROW LEVEL SECURITY — estoque é 100% interno, só dono
-- ============================================================
-- Diferente do cardápio do site (leitura pública), aqui NÃO existe acesso
-- anônimo: is_owner() é exigido pra ler e pra escrever nas três tabelas.
-- is_owner() já existe no banco (criada pelo schema do site).

alter table insumos enable row level security;
alter table produtos enable row level security;
alter table movimentacoes enable row level security;

create policy insumos_owner on insumos for all
  using (is_owner()) with check (is_owner());
create policy produtos_owner on produtos for all
  using (is_owner()) with check (is_owner());
create policy movimentacoes_owner on movimentacoes for all
  using (is_owner()) with check (is_owner());

-- ============================================================
-- 3. SEED — insumos e fichas a partir do cardápio do Garage Burger
-- ============================================================
-- Custos, estoque e mínimo são um ponto de partida ESTIMADO (sem tabela de
-- atacadão nem giro real ainda). As gramaturas das fichas — principalmente
-- dos temakis — também são estimadas. Ajuste tudo no painel > Cadastros.
-- "on conflict do nothing" preserva qualquer valor que você já tenha editado.

-- Insumos (matéria-prima) — 26 itens
insert into insumos (id, nome, unidade, custo, estoque, minimo) values
  ('pao-batata-80', 'Pão de batata 80g', 'un', 1.5, 120, 30),
  ('pao-australiano-80', 'Pão australiano 80g', 'un', 1.8, 80, 20),
  ('carne-blend', 'Blend de carne', 'g', 0.035, 20000, 4000),
  ('bacon', 'Bacon', 'g', 0.05, 3000, 600),
  ('queijo-prato', 'Queijo prato', 'g', 0.045, 4000, 800),
  ('queijo-coalho', 'Queijo coalho', 'g', 0.05, 2500, 500),
  ('queijo-mussarela', 'Mussarela', 'g', 0.04, 2500, 500),
  ('creme-cheddar', 'Creme de cheddar', 'ml', 0.03, 5000, 1000),
  ('maionese-bacon', 'Maionese de bacon', 'ml', 0.03, 4000, 800),
  ('molho-barbecue', 'Molho barbecue', 'ml', 0.015, 3000, 600),
  ('ketchup', 'Ketchup', 'ml', 0.01, 3000, 600),
  ('cebola-caramelizada', 'Cebola caramelizada', 'g', 0.008, 3000, 600),
  ('alface', 'Alface', 'g', 0.01, 2000, 400),
  ('tomate', 'Tomate', 'g', 0.008, 3000, 600),
  ('alga-nori', 'Alga nori', 'un', 0.8, 200, 50),
  ('arroz-japones', 'Arroz japonês', 'g', 0.012, 20000, 4000),
  ('salmao', 'Salmão', 'g', 0.09, 8000, 1500),
  ('camarao', 'Camarão', 'g', 0.08, 4000, 800),
  ('kani', 'Kani', 'g', 0.05, 2000, 400),
  ('cream-cheese', 'Cream cheese', 'g', 0.03, 4000, 800),
  ('gergelim', 'Gergelim', 'g', 0.02, 1000, 200),
  ('cebolinha', 'Cebolinha', 'g', 0.015, 1000, 200),
  ('batata-frita', 'Batata frita', 'g', 0.011, 15000, 3000),
  ('refri-1l-un', 'Refrigerante 1L', 'un', 5.8, 24, 12),
  ('coca-1l-un', 'Coca-Cola 1L', 'un', 6.5, 24, 12),
  ('refri-lata-un', 'Refrigerante lata', 'un', 3.49, 36, 12)
on conflict (id) do nothing;

-- Produtos (fichas técnicas / receitas) — 26 itens
insert into produtos (id, nome, preco, ficha) values
  ('kids', 'Kids', 20.00, '[{"tipo":"insumo","id":"pao-batata-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":120},{"tipo":"insumo","id":"queijo-prato","qtd":20},{"tipo":"insumo","id":"ketchup","qtd":15}]'::jsonb),
  ('opalla', 'Opalla', 38.00, '[{"tipo":"insumo","id":"pao-batata-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":300},{"tipo":"insumo","id":"queijo-prato","qtd":60},{"tipo":"insumo","id":"creme-cheddar","qtd":90},{"tipo":"insumo","id":"bacon","qtd":40},{"tipo":"insumo","id":"maionese-bacon","qtd":25}]'::jsonb),
  ('mustang', 'Mustang', 32.00, '[{"tipo":"insumo","id":"pao-batata-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":200},{"tipo":"insumo","id":"queijo-prato","qtd":20},{"tipo":"insumo","id":"queijo-coalho","qtd":25},{"tipo":"insumo","id":"queijo-mussarela","qtd":20},{"tipo":"insumo","id":"bacon","qtd":25},{"tipo":"insumo","id":"molho-barbecue","qtd":20},{"tipo":"insumo","id":"maionese-bacon","qtd":20}]'::jsonb),
  ('garage-75', 'Garage 75', 24.00, '[{"tipo":"insumo","id":"pao-batata-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":120},{"tipo":"insumo","id":"alface","qtd":20},{"tipo":"insumo","id":"tomate","qtd":30},{"tipo":"insumo","id":"queijo-prato","qtd":20},{"tipo":"insumo","id":"maionese-bacon","qtd":20}]'::jsonb),
  ('maverick', 'Maverick', 28.00, '[{"tipo":"insumo","id":"pao-australiano-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":150},{"tipo":"insumo","id":"queijo-prato","qtd":20},{"tipo":"insumo","id":"queijo-coalho","qtd":25},{"tipo":"insumo","id":"queijo-mussarela","qtd":20},{"tipo":"insumo","id":"cebola-caramelizada","qtd":25},{"tipo":"insumo","id":"molho-barbecue","qtd":20},{"tipo":"insumo","id":"creme-cheddar","qtd":30},{"tipo":"insumo","id":"bacon","qtd":25}]'::jsonb),
  ('maverick-turbo', 'Maverick Turbo', 32.00, '[{"tipo":"insumo","id":"pao-australiano-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":300},{"tipo":"insumo","id":"queijo-prato","qtd":40},{"tipo":"insumo","id":"queijo-mussarela","qtd":40},{"tipo":"insumo","id":"queijo-coalho","qtd":50},{"tipo":"insumo","id":"cebola-caramelizada","qtd":25},{"tipo":"insumo","id":"bacon","qtd":30},{"tipo":"insumo","id":"creme-cheddar","qtd":30},{"tipo":"insumo","id":"molho-barbecue","qtd":20}]'::jsonb),
  ('corvette', 'Corvette', 27.00, '[{"tipo":"insumo","id":"pao-batata-80","qtd":1},{"tipo":"insumo","id":"carne-blend","qtd":120},{"tipo":"insumo","id":"queijo-prato","qtd":20},{"tipo":"insumo","id":"queijo-coalho","qtd":25},{"tipo":"insumo","id":"queijo-mussarela","qtd":20},{"tipo":"insumo","id":"bacon","qtd":25},{"tipo":"insumo","id":"maionese-bacon","qtd":20}]'::jsonb),
  ('temaki-hot-salmao-frito', 'Temaki Hot Salmão Frito', 42.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"salmao","qtd":80},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('temaki-hot-camarao-salmao-frito', 'Temaki Hot Camarão e Salmão Frito', 40.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"camarao","qtd":40},{"tipo":"insumo","id":"salmao","qtd":40},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('temaki-hot-misto-turbinado', 'Temaki Hot Misto Turbinado Frito', 45.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"camarao","qtd":40},{"tipo":"insumo","id":"kani","qtd":30},{"tipo":"insumo","id":"salmao","qtd":40},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('temaki-cru-salmao-cru', 'Temaki Cru Salmão Cru', 42.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"salmao","qtd":80},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('temaki-cru-salmao-macaricado', 'Temaki Cru Salmão Maçaricado', 40.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"salmao","qtd":80},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('temaki-cru-camarao-salmao-cru', 'Temaki Cru Camarão Grelhado e Salmão Cru', 42.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"camarao","qtd":40},{"tipo":"insumo","id":"salmao","qtd":40},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('temaki-cru-camarao-salmao-macaricado', 'Temaki Cru Camarão Grelhado e Salmão Maçaricado', 42.00, '[{"tipo":"insumo","id":"alga-nori","qtd":1},{"tipo":"insumo","id":"arroz-japones","qtd":90},{"tipo":"insumo","id":"camarao","qtd":40},{"tipo":"insumo","id":"salmao","qtd":40},{"tipo":"insumo","id":"cream-cheese","qtd":30},{"tipo":"insumo","id":"gergelim","qtd":3},{"tipo":"insumo","id":"cebolinha","qtd":5}]'::jsonb),
  ('big-hot-salmao-frito', 'Big Hot Salmão Frito', 47.00, '[{"tipo":"insumo","id":"alga-nori","qtd":2},{"tipo":"insumo","id":"arroz-japones","qtd":150},{"tipo":"insumo","id":"salmao","qtd":120},{"tipo":"insumo","id":"cream-cheese","qtd":45},{"tipo":"insumo","id":"gergelim","qtd":4},{"tipo":"insumo","id":"cebolinha","qtd":6}]'::jsonb),
  ('big-hot-salmao-macaricado', 'Big Hot Salmão Maçaricado', 47.00, '[{"tipo":"insumo","id":"alga-nori","qtd":2},{"tipo":"insumo","id":"arroz-japones","qtd":150},{"tipo":"insumo","id":"salmao","qtd":120},{"tipo":"insumo","id":"cream-cheese","qtd":45},{"tipo":"insumo","id":"gergelim","qtd":4},{"tipo":"insumo","id":"cebolinha","qtd":6}]'::jsonb),
  ('big-hot-salmao-cru', 'Big Hot Salmão Cru', 49.00, '[{"tipo":"insumo","id":"alga-nori","qtd":2},{"tipo":"insumo","id":"arroz-japones","qtd":150},{"tipo":"insumo","id":"salmao","qtd":120},{"tipo":"insumo","id":"cream-cheese","qtd":45},{"tipo":"insumo","id":"gergelim","qtd":4},{"tipo":"insumo","id":"cebolinha","qtd":6}]'::jsonb),
  ('big-hot-camarao-salmao-frito', 'Big Hot Camarão Grelhado e Salmão Frito', 47.00, '[{"tipo":"insumo","id":"alga-nori","qtd":2},{"tipo":"insumo","id":"arroz-japones","qtd":150},{"tipo":"insumo","id":"camarao","qtd":60},{"tipo":"insumo","id":"salmao","qtd":60},{"tipo":"insumo","id":"cream-cheese","qtd":45},{"tipo":"insumo","id":"gergelim","qtd":4},{"tipo":"insumo","id":"cebolinha","qtd":6}]'::jsonb),
  ('big-hot-camarao-salmao-macaricado', 'Big Hot Camarão Grelhado e Salmão Maçaricado', 47.00, '[{"tipo":"insumo","id":"alga-nori","qtd":2},{"tipo":"insumo","id":"arroz-japones","qtd":150},{"tipo":"insumo","id":"camarao","qtd":60},{"tipo":"insumo","id":"salmao","qtd":60},{"tipo":"insumo","id":"cream-cheese","qtd":45},{"tipo":"insumo","id":"gergelim","qtd":4},{"tipo":"insumo","id":"cebolinha","qtd":6}]'::jsonb),
  ('big-hot-camarao-salmao-cru', 'Big Hot Camarão Grelhado e Salmão Cru', 49.00, '[{"tipo":"insumo","id":"alga-nori","qtd":2},{"tipo":"insumo","id":"arroz-japones","qtd":150},{"tipo":"insumo","id":"camarao","qtd":60},{"tipo":"insumo","id":"salmao","qtd":60},{"tipo":"insumo","id":"cream-cheese","qtd":45},{"tipo":"insumo","id":"gergelim","qtd":4},{"tipo":"insumo","id":"cebolinha","qtd":6}]'::jsonb),
  ('refrigerante-1l', 'Refrigerante 1L (Antártica/Pepsi)', 10.00, '[{"tipo":"insumo","id":"refri-1l-un","qtd":1}]'::jsonb),
  ('coca-cola', 'Coca-Cola 1L', 10.00, '[{"tipo":"insumo","id":"coca-1l-un","qtd":1}]'::jsonb),
  ('refrigerante-lata', 'Refrigerante Lata', 6.00, '[{"tipo":"insumo","id":"refri-lata-un","qtd":1}]'::jsonb),
  ('batata-p', 'Batata P', 10.00, '[{"tipo":"insumo","id":"batata-frita","qtd":200}]'::jsonb),
  ('batata-m', 'Batata M', 15.00, '[{"tipo":"insumo","id":"batata-frita","qtd":350}]'::jsonb),
  ('batata-g', 'Batata G (com bacon e cheddar)', 25.00, '[{"tipo":"insumo","id":"batata-frita","qtd":500},{"tipo":"insumo","id":"bacon","qtd":40},{"tipo":"insumo","id":"creme-cheddar","qtd":40}]'::jsonb)
on conflict (id) do nothing;
