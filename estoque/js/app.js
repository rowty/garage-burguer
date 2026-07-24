/* ===========================================================
   Controle de estoque — Garage Burger
   Custos, quantidades em estoque e fichas técnicas são um ponto de partida
   estimado (sem dado real de giro/atacadão ainda) — ajustar nos Cadastros.
   Os nomes dos produtos e ingredientes vêm do cardápio real do site.
   Persistência no Supabase (js/store.js) — sincroniza entre PC e celular.
   Login de dono via Supabase Auth (js/supabase-client.js + is_owner()).
   =========================================================== */

/* ---------- Base de insumos ----------
   Matéria-prima do cardápio do Garage Burger (hambúrgueres + temakis).
   Custos, estoque e mínimo são um PONTO DE PARTIDA estimado — não vieram de
   tabela de atacadão nem de giro real ainda. Ajuste os números reais na aba
   Cadastros; o "on conflict do nothing" do schema preserva o que você editar.

   Unidades: 'un' pra itens contados (pão, lata, alga), 'g'/'ml' pra granel
   (blend, queijos, molhos, arroz, salmão…), que é o que as fichas descontam.
*/

const SEED_INSUMOS = {
  // Hambúrgueres — pães
  'pao-batata-80':      { nome: 'Pão de batata 80g',    unidade: 'un', custo: 1.50,  estoque: 120,   minimo: 30 },
  'pao-australiano-80': { nome: 'Pão australiano 80g',  unidade: 'un', custo: 1.80,  estoque: 80,    minimo: 20 },
  // Hambúrgueres — proteína e queijos
  'carne-blend':        { nome: 'Blend de carne',       unidade: 'g',  custo: 0.035, estoque: 20000, minimo: 4000 },
  'bacon':              { nome: 'Bacon',                unidade: 'g',  custo: 0.05,  estoque: 3000,  minimo: 600 },
  'queijo-prato':       { nome: 'Queijo prato',         unidade: 'g',  custo: 0.045, estoque: 4000,  minimo: 800 },
  'queijo-coalho':      { nome: 'Queijo coalho',        unidade: 'g',  custo: 0.05,  estoque: 2500,  minimo: 500 },
  'queijo-mussarela':   { nome: 'Mussarela',            unidade: 'g',  custo: 0.04,  estoque: 2500,  minimo: 500 },
  'creme-cheddar':      { nome: 'Creme de cheddar',     unidade: 'ml', custo: 0.03,  estoque: 5000,  minimo: 1000 },
  // Hambúrgueres — molhos e vegetais
  'maionese-bacon':     { nome: 'Maionese de bacon',    unidade: 'ml', custo: 0.03,  estoque: 4000,  minimo: 800 },
  'molho-barbecue':     { nome: 'Molho barbecue',       unidade: 'ml', custo: 0.015, estoque: 3000,  minimo: 600 },
  'ketchup':            { nome: 'Ketchup',              unidade: 'ml', custo: 0.01,  estoque: 3000,  minimo: 600 },
  'cebola-caramelizada':{ nome: 'Cebola caramelizada',  unidade: 'g',  custo: 0.008, estoque: 3000,  minimo: 600 },
  'alface':             { nome: 'Alface',               unidade: 'g',  custo: 0.01,  estoque: 2000,  minimo: 400 },
  'tomate':             { nome: 'Tomate',               unidade: 'g',  custo: 0.008, estoque: 3000,  minimo: 600 },
  // Temakis / Big Hot
  'alga-nori':          { nome: 'Alga nori',            unidade: 'un', custo: 0.80,  estoque: 200,   minimo: 50 },
  'arroz-japones':      { nome: 'Arroz japonês',        unidade: 'g',  custo: 0.012, estoque: 20000, minimo: 4000 },
  'salmao':             { nome: 'Salmão',               unidade: 'g',  custo: 0.09,  estoque: 8000,  minimo: 1500 },
  'camarao':            { nome: 'Camarão',              unidade: 'g',  custo: 0.08,  estoque: 4000,  minimo: 800 },
  'kani':               { nome: 'Kani',                 unidade: 'g',  custo: 0.05,  estoque: 2000,  minimo: 400 },
  'cream-cheese':       { nome: 'Cream cheese',         unidade: 'g',  custo: 0.03,  estoque: 4000,  minimo: 800 },
  'gergelim':           { nome: 'Gergelim',             unidade: 'g',  custo: 0.02,  estoque: 1000,  minimo: 200 },
  'cebolinha':          { nome: 'Cebolinha',            unidade: 'g',  custo: 0.015, estoque: 1000,  minimo: 200 },
  // Acompanhamentos
  'batata-frita':       { nome: 'Batata frita',         unidade: 'g',  custo: 0.011, estoque: 15000, minimo: 3000 },
  // Bebidas
  'refri-1l-un':        { nome: 'Refrigerante 1L',      unidade: 'un', custo: 5.80,  estoque: 24,    minimo: 12 },
  'coca-1l-un':         { nome: 'Coca-Cola 1L',         unidade: 'un', custo: 6.50,  estoque: 24,    minimo: 12 },
  'refri-lata-un':      { nome: 'Refrigerante lata',    unidade: 'un', custo: 3.49,  estoque: 36,    minimo: 12 },
};

/* ---------- Fichas técnicas (receitas) ----------
   tipo: 'insumo' aponta pra SEED_INSUMOS
   tipo: 'produto' aponta pra outro produto dessa mesma lista (composição recursiva)
   Os IDs batem com os do cardápio do site (menu_items), pra zero remapeamento.
   As gramaturas dos recheios de temaki são estimadas — ajuste na aba Cadastros.
*/

const SEED_PRODUTOS = {
  // ----- Hambúrgueres -----
  'kids': {
    nome: 'Kids',
    preco: 20.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-batata-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 120 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 20 },
      { tipo: 'insumo', id: 'ketchup', qtd: 15 },
    ],
  },
  'opalla': {
    nome: 'Opalla',
    preco: 38.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-batata-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 300 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 60 },
      { tipo: 'insumo', id: 'creme-cheddar', qtd: 90 },
      { tipo: 'insumo', id: 'bacon', qtd: 40 },
      { tipo: 'insumo', id: 'maionese-bacon', qtd: 25 },
    ],
  },
  'mustang': {
    nome: 'Mustang',
    preco: 32.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-batata-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 200 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 20 },
      { tipo: 'insumo', id: 'queijo-coalho', qtd: 25 },
      { tipo: 'insumo', id: 'queijo-mussarela', qtd: 20 },
      { tipo: 'insumo', id: 'bacon', qtd: 25 },
      { tipo: 'insumo', id: 'molho-barbecue', qtd: 20 },
      { tipo: 'insumo', id: 'maionese-bacon', qtd: 20 },
    ],
  },
  'garage-75': {
    nome: 'Garage 75',
    preco: 24.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-batata-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 120 },
      { tipo: 'insumo', id: 'alface', qtd: 20 },
      { tipo: 'insumo', id: 'tomate', qtd: 30 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 20 },
      { tipo: 'insumo', id: 'maionese-bacon', qtd: 20 },
    ],
  },
  'maverick': {
    nome: 'Maverick',
    preco: 28.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-australiano-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 150 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 20 },
      { tipo: 'insumo', id: 'queijo-coalho', qtd: 25 },
      { tipo: 'insumo', id: 'queijo-mussarela', qtd: 20 },
      { tipo: 'insumo', id: 'cebola-caramelizada', qtd: 25 },
      { tipo: 'insumo', id: 'molho-barbecue', qtd: 20 },
      { tipo: 'insumo', id: 'creme-cheddar', qtd: 30 },
      { tipo: 'insumo', id: 'bacon', qtd: 25 },
    ],
  },
  'maverick-turbo': {
    nome: 'Maverick Turbo',
    preco: 32.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-australiano-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 300 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 40 },
      { tipo: 'insumo', id: 'queijo-mussarela', qtd: 40 },
      { tipo: 'insumo', id: 'queijo-coalho', qtd: 50 },
      { tipo: 'insumo', id: 'cebola-caramelizada', qtd: 25 },
      { tipo: 'insumo', id: 'bacon', qtd: 30 },
      { tipo: 'insumo', id: 'creme-cheddar', qtd: 30 },
      { tipo: 'insumo', id: 'molho-barbecue', qtd: 20 },
    ],
  },
  'corvette': {
    nome: 'Corvette',
    preco: 27.00,
    ficha: [
      { tipo: 'insumo', id: 'pao-batata-80', qtd: 1 },
      { tipo: 'insumo', id: 'carne-blend', qtd: 120 },
      { tipo: 'insumo', id: 'queijo-prato', qtd: 20 },
      { tipo: 'insumo', id: 'queijo-coalho', qtd: 25 },
      { tipo: 'insumo', id: 'queijo-mussarela', qtd: 20 },
      { tipo: 'insumo', id: 'bacon', qtd: 25 },
      { tipo: 'insumo', id: 'maionese-bacon', qtd: 20 },
    ],
  },
  // ----- Temaki Hot (cone frito) -----
  'temaki-hot-salmao-frito': {
    nome: 'Temaki Hot Salmão Frito',
    preco: 42.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'salmao', qtd: 80 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  'temaki-hot-camarao-salmao-frito': {
    nome: 'Temaki Hot Camarão e Salmão Frito',
    preco: 40.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'camarao', qtd: 40 },
      { tipo: 'insumo', id: 'salmao', qtd: 40 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  'temaki-hot-misto-turbinado': {
    nome: 'Temaki Hot Misto Turbinado Frito',
    preco: 45.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'camarao', qtd: 40 },
      { tipo: 'insumo', id: 'kani', qtd: 30 },
      { tipo: 'insumo', id: 'salmao', qtd: 40 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  // ----- Temaki Cru (alga ao natural) -----
  'temaki-cru-salmao-cru': {
    nome: 'Temaki Cru Salmão Cru',
    preco: 42.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'salmao', qtd: 80 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  'temaki-cru-salmao-macaricado': {
    nome: 'Temaki Cru Salmão Maçaricado',
    preco: 40.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'salmao', qtd: 80 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  'temaki-cru-camarao-salmao-cru': {
    nome: 'Temaki Cru Camarão Grelhado e Salmão Cru',
    preco: 42.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'camarao', qtd: 40 },
      { tipo: 'insumo', id: 'salmao', qtd: 40 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  'temaki-cru-camarao-salmao-macaricado': {
    nome: 'Temaki Cru Camarão Grelhado e Salmão Maçaricado',
    preco: 42.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 1 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 90 },
      { tipo: 'insumo', id: 'camarao', qtd: 40 },
      { tipo: 'insumo', id: 'salmao', qtd: 40 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 30 },
      { tipo: 'insumo', id: 'gergelim', qtd: 3 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 5 },
    ],
  },
  // ----- Big Hot (roll frito) -----
  'big-hot-salmao-frito': {
    nome: 'Big Hot Salmão Frito',
    preco: 47.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 2 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 150 },
      { tipo: 'insumo', id: 'salmao', qtd: 120 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 45 },
      { tipo: 'insumo', id: 'gergelim', qtd: 4 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 6 },
    ],
  },
  'big-hot-salmao-macaricado': {
    nome: 'Big Hot Salmão Maçaricado',
    preco: 47.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 2 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 150 },
      { tipo: 'insumo', id: 'salmao', qtd: 120 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 45 },
      { tipo: 'insumo', id: 'gergelim', qtd: 4 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 6 },
    ],
  },
  'big-hot-salmao-cru': {
    nome: 'Big Hot Salmão Cru',
    preco: 49.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 2 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 150 },
      { tipo: 'insumo', id: 'salmao', qtd: 120 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 45 },
      { tipo: 'insumo', id: 'gergelim', qtd: 4 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 6 },
    ],
  },
  'big-hot-camarao-salmao-frito': {
    nome: 'Big Hot Camarão Grelhado e Salmão Frito',
    preco: 47.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 2 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 150 },
      { tipo: 'insumo', id: 'camarao', qtd: 60 },
      { tipo: 'insumo', id: 'salmao', qtd: 60 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 45 },
      { tipo: 'insumo', id: 'gergelim', qtd: 4 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 6 },
    ],
  },
  'big-hot-camarao-salmao-macaricado': {
    nome: 'Big Hot Camarão Grelhado e Salmão Maçaricado',
    preco: 47.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 2 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 150 },
      { tipo: 'insumo', id: 'camarao', qtd: 60 },
      { tipo: 'insumo', id: 'salmao', qtd: 60 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 45 },
      { tipo: 'insumo', id: 'gergelim', qtd: 4 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 6 },
    ],
  },
  'big-hot-camarao-salmao-cru': {
    nome: 'Big Hot Camarão Grelhado e Salmão Cru',
    preco: 49.00,
    ficha: [
      { tipo: 'insumo', id: 'alga-nori', qtd: 2 },
      { tipo: 'insumo', id: 'arroz-japones', qtd: 150 },
      { tipo: 'insumo', id: 'camarao', qtd: 60 },
      { tipo: 'insumo', id: 'salmao', qtd: 60 },
      { tipo: 'insumo', id: 'cream-cheese', qtd: 45 },
      { tipo: 'insumo', id: 'gergelim', qtd: 4 },
      { tipo: 'insumo', id: 'cebolinha', qtd: 6 },
    ],
  },
  // ----- Bebidas -----
  'refrigerante-1l': {
    nome: 'Refrigerante 1L (Antártica/Pepsi)',
    preco: 10.00,
    ficha: [
      { tipo: 'insumo', id: 'refri-1l-un', qtd: 1 },
    ],
  },
  'coca-cola': {
    nome: 'Coca-Cola 1L',
    preco: 10.00,
    ficha: [
      { tipo: 'insumo', id: 'coca-1l-un', qtd: 1 },
    ],
  },
  'refrigerante-lata': {
    nome: 'Refrigerante Lata',
    preco: 6.00,
    ficha: [
      { tipo: 'insumo', id: 'refri-lata-un', qtd: 1 },
    ],
  },
  // ----- Acompanhamentos -----
  'batata-p': {
    nome: 'Batata P',
    preco: 10.00,
    ficha: [
      { tipo: 'insumo', id: 'batata-frita', qtd: 200 },
    ],
  },
  'batata-m': {
    nome: 'Batata M',
    preco: 15.00,
    ficha: [
      { tipo: 'insumo', id: 'batata-frita', qtd: 350 },
    ],
  },
  'batata-g': {
    nome: 'Batata G (com bacon e cheddar)',
    preco: 25.00,
    ficha: [
      { tipo: 'insumo', id: 'batata-frita', qtd: 500 },
      { tipo: 'insumo', id: 'bacon', qtd: 40 },
      { tipo: 'insumo', id: 'creme-cheddar', qtd: 40 },
    ],
  },
};

/* ---------- Estado ---------- */

let state = null;

function seedState() {
  return {
    insumos: JSON.parse(JSON.stringify(SEED_INSUMOS)),
    produtos: JSON.parse(JSON.stringify(SEED_PRODUTOS)),
    log: [],
  };
}

// Estado vazio pro boot, antes do login carregar os dados reais do Supabase.
function seedStateVazio() {
  return { insumos: {}, produtos: {}, log: [] };
}

/* ---------- Persistência no Supabase ----------
   O state fica todo em memória (carregado no login por store.loadAll) e a
   lógica de negócio abaixo não muda. Cada mutação grava só a linha afetada:
   os helpers a seguir traduzem "o que mudou no state" pra uma escrita no
   banco. São fire-and-forget (a fila serial do store cuida da ordem; erro
   aparece no banner via store.onError). */

function persistInsumos(ids) {
  ids.forEach((id) => {
    if (state.insumos[id]) window.BH.store.upsertInsumo(id, state.insumos[id]);
  });
}

function persistProduto(id) {
  if (state.produtos[id]) window.BH.store.upsertProduto(id, state.produtos[id]);
}

// O último item do log (state.log[0], recém-adicionado por unshift) vira uma
// linha nova em movimentacoes.
function persistUltimaMovimentacao() {
  if (state.log.length) window.BH.store.insertMovimentacao(state.log[0]);
}

function resetDemo() {
  state = seedState();
  window.BH.store.reseed(SEED_INSUMOS, SEED_PRODUTOS);
  renderAll();
}

/* ---------- Motor de baixa por ficha técnica (recursivo) ---------- */

function calcularConsumoInsumos(produtoId, quantidade, acc = {}) {
  const produto = state.produtos[produtoId];
  if (!produto) return acc;
  for (const item of produto.ficha) {
    if (item.tipo === 'insumo') {
      acc[item.id] = (acc[item.id] || 0) + item.qtd * quantidade;
    } else if (item.tipo === 'produto') {
      calcularConsumoInsumos(item.id, item.qtd * quantidade, acc);
    }
  }
  return acc;
}

// Compara os ajustes de quantidade do item (por unidade) com a ficha técnica
// padrão e devolve uma lista de textos tipo "sem Bacon" ou "Bacon: 4 un" —
// só entra na lista o que realmente foi alterado. `ajustes` pode citar um
// insumo que nem está na ficha do produto (ex: acompanhamento/bebida colado
// de uma mensagem de WhatsApp) — nesse caso ele entra como "+ Nome: qtd".
function descreverAjustes(produtoId, ajustes) {
  if (!ajustes) return [];
  const base = calcularConsumoInsumos(produtoId, 1);
  const partes = [];
  for (const insumoId of Object.keys(ajustes)) {
    const qtdBase = base[insumoId] || 0;
    const qtdFinal = ajustes[insumoId];
    if (qtdFinal === qtdBase) continue;
    const insumo = state.insumos[insumoId];
    if (!insumo) continue;
    if (qtdFinal <= 0) partes.push(`sem ${insumo.nome}`);
    else if (qtdBase === 0) partes.push(`+ ${insumo.nome}: ${qtdFinal} ${insumo.unidade}`);
    else partes.push(`${insumo.nome}: ${qtdFinal} ${insumo.unidade}`);
  }
  return partes;
}

// itens: [{ produtoId, quantidade, ajustes, precoManual }] — o pedido inteiro,
// montado no carrinho. `ajustes` mapeia insumoId -> quantidade por unidade
// (substitui o valor da ficha técnica; 0 remove o insumo; um insumoId que nem
// está na ficha entra como extra — ex: acompanhamento colado de uma mensagem
// de WhatsApp). `precoManual`, quando presente, é o valor já fechado da linha
// inteira (ex: veio de um pedido colado que já inclui adicionais) e substitui
// o cálculo preco × quantidade. Soma o consumo de todos os itens antes de
// checar estoque e dar baixa, tudo numa tacada só (nada é descontado item a
// item).
function registrarPedido(itens) {
  const consumoTotal = {};
  const resumoItens = [];
  const itensRecibo = [];
  let valorTotal = 0;

  for (const item of itens) {
    const produto = state.produtos[item.produtoId];
    if (!produto) continue;
    const consumoBase = calcularConsumoInsumos(item.produtoId, 1);
    const ajustes = item.ajustes || {};
    const insumoIds = new Set([...Object.keys(consumoBase), ...Object.keys(ajustes)]);
    for (const insumoId of insumoIds) {
      const qtdBase = consumoBase[insumoId] || 0;
      const qtdFinal = ajustes[insumoId] !== undefined ? ajustes[insumoId] : qtdBase;
      if (qtdFinal <= 0) continue;
      consumoTotal[insumoId] = (consumoTotal[insumoId] || 0) + qtdFinal * item.quantidade;
    }
    const alteracoes = descreverAjustes(item.produtoId, ajustes);
    const subtotal = item.precoManual !== undefined ? round2(item.precoManual) : round2(produto.preco * item.quantidade);
    valorTotal += subtotal;
    const sufixo = alteracoes.length ? ` (${alteracoes.join(', ')})` : '';
    resumoItens.push(`${item.quantidade}x ${produto.nome}${sufixo}`);
    itensRecibo.push({
      nome: produto.nome,
      quantidade: item.quantidade,
      precoUnit: item.precoManual !== undefined ? round2(item.precoManual / item.quantidade) : produto.preco,
      subtotal,
      alteracoes,
      detalhesOriginais: item.detalhesOriginais || null,
    });
  }

  const faltando = [];
  for (const [insumoId, qtd] of Object.entries(consumoTotal)) {
    const insumo = state.insumos[insumoId];
    if (!insumo || insumo.estoque < qtd) faltando.push(insumo ? insumo.nome : insumoId);
  }
  if (faltando.length) {
    return { ok: false, erro: `Estoque insuficiente de: ${faltando.join(', ')}.` };
  }

  for (const [insumoId, qtd] of Object.entries(consumoTotal)) {
    state.insumos[insumoId].estoque = round2(state.insumos[insumoId].estoque - qtd);
  }

  const detalhes = Object.entries(consumoTotal).map(([insumoId, qtd]) => ({
    nome: state.insumos[insumoId].nome,
    qtd,
    unidade: state.insumos[insumoId].unidade,
  }));
  const custoInsumos = round2(
    Object.entries(consumoTotal).reduce((soma, [insumoId, qtd]) => soma + qtd * state.insumos[insumoId].custo, 0)
  );

  const data = new Date().toISOString();
  state.log.unshift({
    tipo: 'saida',
    texto: `Pedido: ${resumoItens.join(', ')} · baixa em ${detalhes.length} insumo(s)`,
    detalhes,
    valor: round2(valorTotal), // receita do pedido inteiro
    custo: custoInsumos,        // custo dos insumos consumidos (CMV)
    data,
  });
  persistInsumos(Object.keys(consumoTotal));
  persistUltimaMovimentacao();
  return { ok: true, recibo: { itens: itensRecibo, total: round2(valorTotal), data } };
}

function registrarEntrada(insumoId, quantidade) {
  const insumo = state.insumos[insumoId];
  if (!insumo) return { ok: false, erro: 'Insumo não encontrado.' };
  insumo.estoque = round2(insumo.estoque + quantidade);
  state.log.unshift({
    tipo: 'entrada',
    texto: `Entrada: +${quantidade} ${insumo.unidade} de ${insumo.nome}`,
    valor: round2(insumo.custo * quantidade),
    data: new Date().toISOString(),
  });
  persistInsumos([insumoId]);
  persistUltimaMovimentacao();
  return { ok: true };
}

/* ---------- Perdas (quebra, consumo interno, item fora do padrão) ----------
   Duas formas de descartar:
   - "Produto pronto" roda a mesma ficha técnica de uma venda (calcularConsumoInsumos),
     mas sem gerar receita — ex: comeu um hambúrguer pronto.
   - "Insumo direto" desconta um insumo cru sem passar por receita nenhuma —
     ex: 2 pães a menos no saco, pão amassado fora do padrão.
   Ambas usam tipo: 'perda' no log, com valor: 0 (não é venda) e custo:
   o prejuízo em R$, pra aparecer separado no Financeiro. */

function registrarPerdaProduto(produtoId, quantidade, motivo, ajustes = {}) {
  const produto = state.produtos[produtoId];
  if (!produto) return { ok: false, erro: 'Produto não encontrado.' };

  const consumoBase = calcularConsumoInsumos(produtoId, 1);
  const consumo = {};
  for (const [insumoId, qtdBase] of Object.entries(consumoBase)) {
    const qtdFinal = ajustes[insumoId] !== undefined ? ajustes[insumoId] : qtdBase;
    if (qtdFinal <= 0) continue;
    consumo[insumoId] = qtdFinal * quantidade;
  }

  const faltando = [];
  for (const [insumoId, qtd] of Object.entries(consumo)) {
    const insumo = state.insumos[insumoId];
    if (!insumo || insumo.estoque < qtd) faltando.push(insumo ? insumo.nome : insumoId);
  }
  if (faltando.length) {
    return { ok: false, erro: `Estoque insuficiente de: ${faltando.join(', ')}.` };
  }

  for (const [insumoId, qtd] of Object.entries(consumo)) {
    state.insumos[insumoId].estoque = round2(state.insumos[insumoId].estoque - qtd);
  }

  const detalhes = Object.entries(consumo).map(([insumoId, qtd]) => ({
    nome: state.insumos[insumoId].nome,
    qtd,
    unidade: state.insumos[insumoId].unidade,
  }));
  const custo = round2(
    Object.entries(consumo).reduce((soma, [insumoId, qtd]) => soma + qtd * state.insumos[insumoId].custo, 0)
  );
  const alteracoes = descreverAjustes(produtoId, ajustes);
  const sufixoAlteracoes = alteracoes.length ? ` (${alteracoes.join(', ')})` : '';
  const sufixoMotivo = motivo ? ` · Motivo: ${motivo}` : '';

  state.log.unshift({
    tipo: 'perda',
    texto: `Perda: ${quantidade}x ${produto.nome}${sufixoAlteracoes}${sufixoMotivo} · baixa em ${detalhes.length} insumo(s)`,
    detalhes,
    valor: 0,
    custo,
    data: new Date().toISOString(),
  });
  persistInsumos(Object.keys(consumo));
  persistUltimaMovimentacao();
  return { ok: true };
}

function registrarPerdaInsumo(insumoId, quantidade, motivo) {
  const insumo = state.insumos[insumoId];
  if (!insumo) return { ok: false, erro: 'Insumo não encontrado.' };
  if (insumo.estoque < quantidade) {
    return { ok: false, erro: `Estoque insuficiente de ${insumo.nome}.` };
  }

  insumo.estoque = round2(insumo.estoque - quantidade);
  const custo = round2(insumo.custo * quantidade);
  const sufixoMotivo = motivo ? ` · Motivo: ${motivo}` : '';

  state.log.unshift({
    tipo: 'perda',
    texto: `Perda: ${quantidade} ${insumo.unidade} de ${insumo.nome}${sufixoMotivo}`,
    detalhes: [{ nome: insumo.nome, qtd: quantidade, unidade: insumo.unidade }],
    valor: 0,
    custo,
    data: new Date().toISOString(),
  });
  persistInsumos([insumoId]);
  persistUltimaMovimentacao();
  return { ok: true };
}

function round2(n) { return Math.round(n * 100) / 100; }
function formatMoney(n) { return `R$ ${n.toFixed(2).replace('.', ',')}`; }

// "1º hambúrguer:", "Acompanhamento:" etc são títulos de seção — destacados
// e numa linha própria no comprovante. O resto é detalhe (ingrediente
// alterado, extra), indentado com marcador, também numa linha própria —
// nada de espremer tudo separado por vírgula, quem prepara o pedido precisa
// bater o olho e entender rápido.
function classificarLinhaRecibo(linha) {
  if (/^\d+[ºo]\s*hamb[uú]rguer:/i.test(linha)) return 'header';
  if (/^(Acompanhamento|Molho|Bebida):/i.test(linha)) return 'header';
  return 'bullet';
}

// Prioriza as linhas originais do pedido colado do WhatsApp (já vêm
// organizadas por hambúrguer/categoria); item lançado manualmente cai no
// resumo de ajustes (descreverAjustes), um por linha.
function renderDetalhesRecibo(item) {
  const linhas = item.detalhesOriginais && item.detalhesOriginais.length
    ? item.detalhesOriginais.map((linha) => ({ tipo: classificarLinhaRecibo(linha), texto: linha.replace(/^•\s*/, '') }))
    : item.alteracoes.map((linha) => ({ tipo: 'bullet', texto: linha }));
  return linhas.map((l) => `<div class="recibo-print__detalhe recibo-print__detalhe--${l.tipo}">${l.texto}</div>`).join('');
}

// Preenche o comprovante oculto (#recibo-print) com os dados do pedido e
// dispara a impressão do navegador. O comprovante só fica visível via
// @media print — na tela ele continua com display: none.
function imprimirRecibo(recibo) {
  const dataFormatada = new Date(recibo.data).toLocaleString('pt-BR');
  document.getElementById('recibo-print-data').textContent = dataFormatada;

  const itensWrap = document.getElementById('recibo-print-itens');
  itensWrap.innerHTML = recibo.itens.map((item) => `
    <div class="recibo-print__item">
      <div class="recibo-print__item-linha">
        <span class="recibo-print__item-nome">${item.quantidade}x ${item.nome}</span>
        <span class="recibo-print__item-preco">${formatMoney(item.subtotal)}</span>
      </div>
      ${renderDetalhesRecibo(item)}
    </div>
  `).join('');

  document.getElementById('recibo-print-total').textContent = formatMoney(recibo.total);

  window.print();
}

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

/* ---------- Pedido colado do WhatsApp ----------
   O site (site/js/cart.js) monta a mensagem de WhatsApp num formato fixo:
   linhas de item sem indentação ("1x Nome - R$ 12,34"), com os detalhes da
   personalização logo abaixo indentados (3 espaços pra categoria/hambúrguer,
   6 espaços + "• " pra cada ingrediente alterado). Só entram na mensagem os
   ingredientes que MUDARAM do padrão da receita — é por isso que dá pra
   reconstruir os ajustes de estoque a partir do texto colado.
   Esse parser é o espelho de buildWhatsappMessage/buildCustomWaLines do site:
   qualquer mudança lá (novo rótulo de categoria, outro separador) precisa
   vir refletida aqui também. */

// Ingredientes cujo nome no texto do WhatsApp não bate 1:1 com o nome do
// insumo cadastrado (ou que nem fazem parte da ficha técnica do produto —
// acompanhamento, molho, bebida). `porcao` fixa a quantidade por unidade
// quando não dá pra herdar da ficha técnica do produto.
const ALIAS_INSUMO_WHATSAPP = {
  // blend (carne) — o site descreve gramaturas e multiplicidade variadas
  'blend': [{ id: 'carne-blend' }],
  'blend 100g': [{ id: 'carne-blend', porcao: 100 }],
  'blend 120g': [{ id: 'carne-blend', porcao: 120 }],
  'blend 150g': [{ id: 'carne-blend', porcao: 150 }],
  '2 blends de 100g': [{ id: 'carne-blend', porcao: 200 }],
  '3 blends de 100g': [{ id: 'carne-blend', porcao: 300 }],
  '2 blends de 150g': [{ id: 'carne-blend', porcao: 300 }],
  'adicionar - blend': [{ id: 'carne-blend', porcao: 100 }],
  // queijos (multiplicidade da descrição)
  'queijo prato': [{ id: 'queijo-prato', porcao: 20 }],
  'duplo queijo prato': [{ id: 'queijo-prato', porcao: 40 }],
  'triplo queijo prato': [{ id: 'queijo-prato', porcao: 60 }],
  'queijo coalho macaricado': [{ id: 'queijo-coalho', porcao: 25 }],
  'duplo queijo coalho macaricado': [{ id: 'queijo-coalho', porcao: 50 }],
  'mussarela': [{ id: 'queijo-mussarela', porcao: 20 }],
  'duplo mussarela': [{ id: 'queijo-mussarela', porcao: 40 }],
  'creme de cheddar': [{ id: 'creme-cheddar', porcao: 30 }],
  'triplo creme de cheddar': [{ id: 'creme-cheddar', porcao: 90 }],
  'adicionar - queijo': [{ id: 'queijo-prato', porcao: 20 }],
  'queijo': [{ id: 'queijo-prato', porcao: 20 }],
  // bacon / molhos / vegetais
  'bacon': [{ id: 'bacon', porcao: 25 }],
  'tiras de bacon crocante': [{ id: 'bacon', porcao: 40 }],
  'adicionar - bacon': [{ id: 'bacon', porcao: 40 }],
  'maionese de bacon': [{ id: 'maionese-bacon', porcao: 20 }],
  'molho barbecue': [{ id: 'molho-barbecue', porcao: 20 }],
  'cebola caramelizada': [{ id: 'cebola-caramelizada', porcao: 25 }],
  // temaki / big hot — recheios
  'arroz japones': [{ id: 'arroz-japones', porcao: 90 }],
  'salmao em cubos frito': [{ id: 'salmao', porcao: 80 }],
  'salmao em cubos cru': [{ id: 'salmao', porcao: 80 }],
  'salmao em cubos macaricado': [{ id: 'salmao', porcao: 80 }],
  'camarao grelhado': [{ id: 'camarao', porcao: 40 }],
  'pedacos de kani': [{ id: 'kani', porcao: 30 }],
  'cream cheese': [{ id: 'cream-cheese', porcao: 30 }],
  'cone de alga nori frita': [{ id: 'alga-nori', porcao: 1 }],
  'cone de alga nori ao natural': [{ id: 'alga-nori', porcao: 1 }],
  'roll de alga nori frita': [{ id: 'alga-nori', porcao: 2 }],
  // acompanhamentos
  'batata p': [{ id: 'batata-frita', porcao: 200 }],
  'batata m': [{ id: 'batata-frita', porcao: 350 }],
  'batata g': [{ id: 'batata-frita', porcao: 500 }],
  // bebidas
  'refrigerante - 1l': [{ id: 'refri-1l-un', porcao: 1 }],
  'refrigerante 1l': [{ id: 'refri-1l-un', porcao: 1 }],
  'coca-cola': [{ id: 'coca-1l-un', porcao: 1 }],
  'refrigerante lata': [{ id: 'refri-lata-un', porcao: 1 }],
};

// Fallback de quantidade por porção pra insumo que não está na ficha técnica
// do produto (então não tem como herdar a quantidade-base de lá).
const PORCAO_PADRAO_EXTRA = {
  'carne-blend': 100,
  'queijo-prato': 20,
  'queijo-coalho': 25,
  'queijo-mussarela': 20,
  'creme-cheddar': 30,
  'bacon': 25,
  'maionese-bacon': 20,
  'molho-barbecue': 20,
  'cebola-caramelizada': 25,
  'salmao': 40,
  'camarao': 40,
  'kani': 30,
  'cream-cheese': 30,
  'batata-frita': 200,
  'refri-1l-un': 1,
  'coca-1l-un': 1,
  'refri-lata-un': 1,
};

function normalizarTexto(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPontoCarne(texto) {
  return /^carne (ao ponto|bem passada|mal passada)$/i.test(texto.trim());
}

function parsePrecoBR(str) {
  return Number(str.replace(/\./g, '').replace(',', '.'));
}

// "sem X" -> conta 0; "3x X" -> conta 3; senão conta 1 (menção simples).
function extrairContagem(textoBruto) {
  const texto = textoBruto.replace(/^•\s*/, '').trim();
  const semMatch = texto.match(/^sem\s+(.+)$/i);
  if (semMatch) return { count: 0, texto: semMatch[1].trim() };
  const qtdMatch = texto.match(/^(\d+)x\s+(.+)$/i);
  if (qtdMatch) return { count: Number(qtdMatch[1]), texto: qtdMatch[2].trim() };
  return { count: 1, texto };
}

// Resolve um nome de ingrediente (já normalizado) pro(s) insumo(s) que ele
// afeta. Primeiro tenta bater direto com o nome de um insumo cadastrado
// (cobre a maioria dos casos, já que os nomes da ficha técnica geralmente
// batem com o texto do cardápio); se não achar, cai pro alias manual.
function resolverInsumosDoTexto(produtoBaseId, textoNormalizado) {
  const base = produtoBaseId ? calcularConsumoInsumos(produtoBaseId, 1) : {};
  const direto = Object.entries(state.insumos).find(([, ins]) => normalizarTexto(ins.nome) === textoNormalizado);
  if (direto) {
    const [insumoId] = direto;
    return [{ id: insumoId, porcao: base[insumoId] || PORCAO_PADRAO_EXTRA[insumoId] || 1 }];
  }
  const aliasEntry = ALIAS_INSUMO_WHATSAPP[textoNormalizado];
  if (aliasEntry) {
    return aliasEntry.map((a) => ({
      id: a.id,
      porcao: a.porcao !== undefined ? a.porcao : (base[a.id] || PORCAO_PADRAO_EXTRA[a.id] || 1),
    }));
  }
  return null;
}

// Lê uma lista de linhas de ingrediente (já sem prefixo de categoria/hambúrguer)
// e devolve { encontrados: {insumoId: qtdPorUnidade}, naoReconhecidos: [linhas] }.
function interpretarBullets(produtoBaseId, linhas) {
  const encontrados = {};
  const naoReconhecidos = [];
  linhas.forEach((linhaBruta) => {
    const { count, texto } = extrairContagem(linhaBruta);
    if (!texto || isPontoCarne(texto)) return;
    const resolvidos = resolverInsumosDoTexto(produtoBaseId, normalizarTexto(texto));
    if (!resolvidos) {
      naoReconhecidos.push(linhaBruta);
      return;
    }
    resolvidos.forEach(({ id, porcao }) => {
      encontrados[id] = round2((encontrados[id] || 0) + porcao * count);
    });
  });
  return { encontrados, naoReconhecidos };
}

// Separa as linhas de detalhe de um item em três grupos, sem sobreposição:
// - burgers: blocos por hambúrguer (Dupla de Sucesso: "1º hambúrguer:" / "2º
//   hambúrguer:"), cada um com suas próprias linhas de ingrediente;
// - categorias: linhas "Acompanhamento:"/"Molho:"/"Bebida:" (sempre extras à
//   parte, nunca fazem parte da ficha técnica de um hambúrguer);
// - soltas: ingrediente sem bloco de hambúrguer em volta — caso comum (item
//   simples, não-Dupla).
function estruturarDetalhesItem(detalhes) {
  const burgers = [];
  const categorias = [];
  const soltas = [];
  let burgerAtual = null;
  for (const linhaOriginal of detalhes) {
    const linha = linhaOriginal.trim();
    const headerBurger = linha.match(/^\d+[ºo]\s*hamb[uú]rguer:\s*(.*)$/i);
    if (headerBurger) {
      burgerAtual = { ponto: headerBurger[1].trim(), linhas: [] };
      burgers.push(burgerAtual);
      continue;
    }
    if (/^(Acompanhamento|Molho|Bebida):/i.test(linha)) {
      burgerAtual = null;
      categorias.push(linha);
      continue;
    }
    if (burgerAtual) {
      burgerAtual.linhas.push(linha);
    } else {
      soltas.push(linha);
    }
  }
  return { burgers, categorias, soltas };
}

// Monta o mapa de ajustes de insumo (por unidade do item) a partir das linhas
// de detalhe coladas do WhatsApp. Produtos "Dupla de Sucesso" (dois
// hambúrgueres personalizados separadamente, mesma ficha técnica repetida
// 2x) somam o consumo dos dois lados contra a ficha de UM hambúrguer só —
// assim um ajuste feito só no 1º hambúrguer não apaga o padrão do 2º.
function montarAjustesItem(produtoId, detalhes) {
  const produto = state.produtos[produtoId];
  const { burgers, categorias, soltas } = estruturarDetalhesItem(detalhes);
  const naoReconhecidos = [];
  const ajustesFinal = {};

  function somar(insumoId, valor) {
    ajustesFinal[insumoId] = round2((ajustesFinal[insumoId] || 0) + valor);
  }

  if (burgers.length === 2) {
    const subEntry = produto.ficha.find((f) => f.tipo === 'produto');
    const baseProdutoId = subEntry ? subEntry.id : produtoId;
    const baseUnica = calcularConsumoInsumos(baseProdutoId, 1);
    burgers.forEach((burger) => {
      const { encontrados, naoReconhecidos: nr } = interpretarBullets(baseProdutoId, burger.linhas);
      naoReconhecidos.push(...nr);
      Object.keys(baseUnica).forEach((insumoId) => {
        somar(insumoId, encontrados[insumoId] !== undefined ? encontrados[insumoId] : baseUnica[insumoId]);
      });
      Object.keys(encontrados).forEach((insumoId) => {
        if (!(insumoId in baseUnica)) somar(insumoId, encontrados[insumoId]);
      });
    });
  } else {
    const linhasSoltas = soltas.length ? soltas : (burgers.length === 1 ? burgers[0].linhas : []);
    const { encontrados, naoReconhecidos: nr } = interpretarBullets(produtoId, linhasSoltas);
    naoReconhecidos.push(...nr);
    Object.assign(ajustesFinal, encontrados);
  }

  categorias.forEach((linhaExtra) => {
    const catMatch = linhaExtra.match(/^(Acompanhamento|Molho|Bebida):\s*(.+)$/i);
    const subItens = catMatch ? catMatch[2].split(',').map((s) => s.trim()) : [linhaExtra];
    subItens.forEach((subItem) => {
      const { count, texto } = extrairContagem(subItem);
      if (!texto || isPontoCarne(texto)) return;
      const resolvidos = resolverInsumosDoTexto(produtoId, normalizarTexto(texto));
      if (!resolvidos) {
        naoReconhecidos.push(subItem);
        return;
      }
      resolvidos.forEach(({ id, porcao }) => somar(id, porcao * count));
    });
  });

  return { ajustes: ajustesFinal, naoReconhecidos };
}

// Lê a mensagem colada inteira e devolve os itens (nome, quantidade, preço já
// fechado e as linhas de detalhe cruas) + o rodapé (subtotal/total/pagamento).
function parseWhatsappOrder(texto) {
  const linhas = texto.split(/\r?\n/);
  const itens = [];
  let atual = null;
  let noRodape = false;
  let subtotal = null;
  let total = null;
  let pagamento = null;

  for (const linhaOriginal of linhas) {
    if (/^\s*Subtotal:/i.test(linhaOriginal)) noRodape = true;
    if (noRodape) {
      const mSub = linhaOriginal.match(/Subtotal:\s*R\$\s*([\d.,]+)/i);
      if (mSub) subtotal = parsePrecoBR(mSub[1]);
      const mTot = linhaOriginal.match(/^Total:\s*R\$\s*([\d.,]+)/i);
      if (mTot) total = parsePrecoBR(mTot[1]);
      const mPag = linhaOriginal.match(/^Pagamento:\s*(.+)$/i);
      if (mPag) pagamento = mPag[1].trim();
      continue;
    }
    if (!linhaOriginal.trim()) continue;
    const semIndentacao = /^\S/.test(linhaOriginal);
    const mItem = linhaOriginal.match(/^(\d+)x\s+(.+?)\s+-\s+R\$\s*([\d.,]+)\s*$/);
    if (semIndentacao && mItem) {
      atual = { quantidade: Number(mItem[1]), nome: mItem[2].trim(), preco: parsePrecoBR(mItem[3]), detalhes: [] };
      itens.push(atual);
      continue;
    }
    if (atual) atual.detalhes.push(linhaOriginal.trim());
  }

  return { itens, subtotal, total, pagamento };
}

function encontrarProdutoPorNome(nome) {
  const alvo = normalizarTexto(nome);
  const entrada = Object.entries(state.produtos).find(([, p]) => p.preco !== null && normalizarTexto(p.nome) === alvo);
  return entrada ? entrada[0] : null;
}

/* ---------- Cadastro de insumos e produtos (CRUD) ---------- */

function slugify(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function gerarIdUnico(nome, colecao) {
  const base = slugify(nome) || 'item';
  let id = base;
  let i = 2;
  while (colecao[id]) { id = `${base}-${i}`; i += 1; }
  return id;
}

function criarInsumo({ nome, unidade, custo, estoque, minimo }) {
  const id = gerarIdUnico(nome, state.insumos);
  state.insumos[id] = { nome, unidade, custo, estoque, minimo };
  persistInsumos([id]);
  return id;
}

function atualizarInsumo(id, campos) {
  if (!state.insumos[id]) return;
  Object.assign(state.insumos[id], campos);
  persistInsumos([id]);
}

function insumoEmUso(id) {
  return Object.values(state.produtos).some((p) => p.ficha.some((f) => f.tipo === 'insumo' && f.id === id));
}

function removerInsumo(id) {
  if (insumoEmUso(id)) {
    return { ok: false, erro: 'Esse insumo está sendo usado em uma ou mais fichas técnicas. Remova ele das receitas antes de excluir.' };
  }
  delete state.insumos[id];
  window.BH.store.deleteInsumo(id);
  return { ok: true };
}

function produtoEmUsoComoSubItem(id) {
  return Object.values(state.produtos).some((p) => p.ficha.some((f) => f.tipo === 'produto' && f.id === id));
}

function criaCiclo(produtoBaseId, candidatoId, visitados = new Set()) {
  if (candidatoId === produtoBaseId) return true;
  if (visitados.has(candidatoId)) return false;
  visitados.add(candidatoId);
  const produto = state.produtos[candidatoId];
  if (!produto) return false;
  return produto.ficha.some((item) => item.tipo === 'produto' && criaCiclo(produtoBaseId, item.id, visitados));
}

function criarProduto({ nome, preco, ficha }) {
  const id = gerarIdUnico(nome, state.produtos);
  state.produtos[id] = { nome, preco, ficha };
  persistProduto(id);
  return id;
}

function atualizarProduto(id, campos) {
  if (!state.produtos[id]) return;
  Object.assign(state.produtos[id], campos);
  persistProduto(id);
}

function removerProduto(id) {
  if (produtoEmUsoComoSubItem(id)) {
    return { ok: false, erro: 'Esse produto é usado como item dentro de outro produto (ex: Box). Remova ele da receita antes de excluir.' };
  }
  delete state.produtos[id];
  window.BH.store.deleteProduto(id);
  return { ok: true };
}

/* ---------- Render ---------- */

function renderEstoque() {
  const grid = document.getElementById('estoque-grid');
  grid.innerHTML = '';
  // Itens em falta (estoque <= mínimo) vêm primeiro pra saltar aos olhos; dentro
  // de cada grupo, ordem alfabética.
  const emFalta = (i) => i.estoque <= i.minimo;
  const ordenados = Object.entries(state.insumos).sort((a, b) => {
    const fa = emFalta(a[1]);
    const fb = emFalta(b[1]);
    if (fa !== fb) return fa ? -1 : 1;
    return a[1].nome.localeCompare(b[1].nome);
  });
  for (const [id, insumo] of ordenados) {
    const low = emFalta(insumo);
    const el = document.createElement('div');
    el.className = 'stock-item' + (low ? ' is-low' : '');
    el.innerHTML = `
      <div class="stock-item__name">${insumo.nome}</div>
      <div class="stock-item__row">
        <span>Estoque atual</span>
        <span class="stock-item__qty">${insumo.estoque} ${insumo.unidade}</span>
      </div>
      <div class="stock-item__row">
        <span>Mínimo</span>
        <span>${insumo.minimo} ${insumo.unidade}</span>
      </div>
      ${low
        ? `<button type="button" class="badge badge--low badge--button" data-repor="${id}">Repor</button>`
        : `<span class="badge badge--ok">Ok</span>`}
    `;
    grid.appendChild(el);
  }
}

function renderVendaSelect() {
  const select = document.getElementById('venda-produto');
  select.innerHTML = '';
  const vendaveis = Object.entries(state.produtos).filter(([, p]) => p.preco !== null);
  for (const [id, produto] of vendaveis) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = produto.nome;
    select.appendChild(opt);
  }
}

// Lista os insumos da receita do produto selecionado (já achatada, incluindo
// sub-produtos como o Box) pra deixar desmarcar o que não vai nessa venda.
function renderPersonalizacaoVenda() {
  const produtoId = document.getElementById('venda-produto').value;
  const wrap = document.getElementById('venda-personalizacao-rows');
  wrap.innerHTML = '';
  if (!produtoId || !state.produtos[produtoId]) return;
  const consumo = calcularConsumoInsumos(produtoId, 1);
  const ordenados = Object.entries(consumo).sort((a, b) => state.insumos[a[0]].nome.localeCompare(state.insumos[b[0]].nome));
  if (!ordenados.length) {
    wrap.innerHTML = '<p class="cadastro-empty">Esse produto não tem insumos numa ficha técnica.</p>';
    return;
  }
  for (const [insumoId, qtd] of ordenados) {
    wrap.appendChild(criarPersonalizacaoRow(insumoId, qtd));
  }
}

// Mesma ideia da personalização da venda, mas pro modo "Produto pronto" da
// aba Perdas — deixa desmarcar ou ajustar a quantidade do que não foi de
// fato perdido (ex: o pão amassou mas a carne e o resto foram reaproveitados).
function renderPersonalizacaoPerda() {
  const produtoId = document.getElementById('perda-produto').value;
  const wrap = document.getElementById('perda-personalizacao-rows');
  wrap.innerHTML = '';
  if (!produtoId || !state.produtos[produtoId]) return;
  const consumo = calcularConsumoInsumos(produtoId, 1);
  const ordenados = Object.entries(consumo).sort((a, b) => state.insumos[a[0]].nome.localeCompare(state.insumos[b[0]].nome));
  if (!ordenados.length) {
    wrap.innerHTML = '<p class="cadastro-empty">Esse produto não tem insumos numa ficha técnica.</p>';
    return;
  }
  for (const [insumoId, qtd] of ordenados) {
    wrap.appendChild(criarPersonalizacaoRow(insumoId, qtd));
  }
}

const PERSONALIZACAO_MAX_PORCOES = 10;

// Cria uma linha de personalização no mesmo formato do cardápio do site:
// nome do insumo + contador "− N +" de porções. 1 porção = a quantidade
// padrão da ficha técnica (ex: 1 porção de bacon = 2 fatias). Subir pra 2
// dobra a quantidade (extra), zerar remove o insumo do pedido.
function criarPersonalizacaoRow(insumoId, qtdPorPorcao) {
  const insumo = state.insumos[insumoId];
  const row = document.createElement('div');
  row.className = 'personalizacao-row';
  row.dataset.insumoId = insumoId;
  row.dataset.qtdPorPorcao = qtdPorPorcao;
  row.innerHTML = `
    <span class="personalizacao-row__nome" title="${insumo.nome}">${insumo.nome}</span>
    <div class="personalizacao-row__stepper">
      <button type="button" class="personalizacao-row__stepper-btn" data-passo="-1" aria-label="Diminuir ${insumo.nome}">−</button>
      <span class="personalizacao-row__count">1</span>
      <button type="button" class="personalizacao-row__stepper-btn" data-passo="1" aria-label="Aumentar ${insumo.nome}">+</button>
    </div>
  `;
  const countEl = row.querySelector('.personalizacao-row__count');
  row.querySelectorAll('.personalizacao-row__stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const passo = Number(btn.dataset.passo);
      const atual = Number(countEl.textContent);
      const novo = Math.max(0, Math.min(PERSONALIZACAO_MAX_PORCOES, atual + passo));
      countEl.textContent = novo;
      row.classList.toggle('is-removed', novo === 0);
    });
  });
  return row;
}

// Lê o estado atual de um grid de personalização (contadores de porção) e
// devolve o mapa { insumoId: quantidadePorUnidade } pra usar no pedido/perda —
// porções × quantidade-base da ficha técnica.
function coletarAjustesPersonalizacao(wrapId) {
  const ajustes = {};
  document.querySelectorAll(`#${wrapId} .personalizacao-row`).forEach((row) => {
    const insumoId = row.dataset.insumoId;
    const qtdPorPorcao = Number(row.dataset.qtdPorPorcao);
    const porcoes = Number(row.querySelector('.personalizacao-row__count').textContent);
    ajustes[insumoId] = round2(qtdPorPorcao * porcoes);
  });
  return ajustes;
}

/* ---------- Carrinho do pedido em montagem ---------- */

let pedidoAtual = [];
let ultimoRecibo = null;

function renderPedidoAtual() {
  const list = document.getElementById('pedido-itens-list');
  list.innerHTML = '';
  if (!pedidoAtual.length) {
    list.innerHTML = '<p class="cadastro-empty">Nenhum item adicionado ainda.</p>';
  } else {
    pedidoAtual.forEach((item, index) => {
      const produto = state.produtos[item.produtoId];
      if (!produto) return;
      const alteracoes = descreverAjustes(item.produtoId, item.ajustes);
      const sufixo = alteracoes.length ? ` (${alteracoes.join(', ')})` : '';
      const subtotal = item.precoManual !== undefined ? round2(item.precoManual) : round2(produto.preco * item.quantidade);
      const el = document.createElement('div');
      el.className = 'pedido-item-row';
      el.innerHTML = `
        <span class="pedido-item-row__nome">${item.quantidade}x ${produto.nome}${sufixo}</span>
        <span class="pedido-item-row__preco">${formatMoney(subtotal)}</span>
        <button type="button" class="pedido-item-row__remove" data-remove-index="${index}" aria-label="Remover item">✕</button>
      `;
      list.appendChild(el);
    });
  }
  const total = pedidoAtual.reduce((soma, item) => {
    const produto = state.produtos[item.produtoId];
    if (!produto) return soma;
    return soma + (item.precoManual !== undefined ? item.precoManual : produto.preco * item.quantidade);
  }, 0);
  document.getElementById('pedido-total-valor').textContent = formatMoney(round2(total));
}

function renderEntradaSelect() {
  const select = document.getElementById('entrada-insumo');
  select.innerHTML = '';
  const ordenados = Object.entries(state.insumos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  for (const [id, insumo] of ordenados) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${insumo.nome} (${insumo.unidade})`;
    select.appendChild(opt);
  }
}

function renderPerdaSelects() {
  const selectProduto = document.getElementById('perda-produto');
  selectProduto.innerHTML = '';
  const vendaveis = Object.entries(state.produtos).filter(([, p]) => p.preco !== null);
  for (const [id, produto] of vendaveis) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = produto.nome;
    selectProduto.appendChild(opt);
  }

  const selectInsumo = document.getElementById('perda-insumo');
  selectInsumo.innerHTML = '';
  const ordenados = Object.entries(state.insumos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  for (const [id, insumo] of ordenados) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${insumo.nome} (${insumo.unidade})`;
    selectInsumo.appendChild(opt);
  }
}

function renderLog() {
  const list = document.getElementById('log-list');
  list.innerHTML = '';
  if (!state.log.length) {
    list.innerHTML = '<p class="log-item">Nenhuma movimentação ainda.</p>';
    return;
  }
  for (const entrada of state.log.slice(0, 30)) {
    const el = document.createElement('div');
    el.className = 'log-item';
    const hora = new Date(entrada.data).toLocaleString('pt-BR');
    let detalhesHtml = '';
    if (entrada.detalhes && entrada.detalhes.length) {
      const linhas = entrada.detalhes
        .map((d) => `<li>${d.nome}: <strong>${d.qtd} ${d.unidade}</strong></li>`)
        .join('');
      detalhesHtml = `<ul class="log-item__detalhes">${linhas}</ul>`;
    }
    el.innerHTML = `<strong>${hora}</strong><br>${entrada.texto}${detalhesHtml}`;
    list.appendChild(el);
  }
}

function renderFinanceiro() {
  let totalVendas = 0;      // receita das vendas (preço do produto)
  let totalCustoInsumos = 0; // custo dos insumos consumidos nas vendas (CMV)
  let totalReposicao = 0;    // dinheiro gasto comprando/repondo estoque
  let totalPerdas = 0;       // prejuízo com quebras, consumo interno e itens fora do padrão
  for (const item of state.log) {
    if (item.tipo === 'saida') {
      totalVendas += item.valor || 0;
      totalCustoInsumos += item.custo || 0;
    }
    if (item.tipo === 'entrada') totalReposicao += item.valor || 0;
    if (item.tipo === 'perda') totalPerdas += item.custo || 0;
  }
  const lucroLiquido = totalVendas - totalCustoInsumos - totalPerdas;

  document.getElementById('finance-total-in').textContent = formatMoney(totalVendas);
  document.getElementById('finance-total-cost').textContent = formatMoney(totalCustoInsumos);
  document.getElementById('finance-total-perdas').textContent = formatMoney(totalPerdas);
  document.getElementById('finance-profit').textContent = formatMoney(lucroLiquido);
  document.getElementById('finance-total-out').textContent = formatMoney(totalReposicao);

  const list = document.getElementById('finance-list');
  list.innerHTML = '';
  if (!state.log.length) {
    list.innerHTML = '<p class="log-item">Nenhuma movimentação ainda.</p>';
    return;
  }
  for (const item of state.log.slice(0, 30)) {
    const el = document.createElement('div');
    el.className = 'log-item';
    const hora = new Date(item.data).toLocaleString('pt-BR');
    const isVenda = item.tipo === 'saida';
    const isPerda = item.tipo === 'perda';
    const sinal = isVenda ? '+' : '−';
    const classe = isVenda ? 'log-item__valor--in' : 'log-item__valor--out';
    const custoHtml = isVenda
      ? `<div class="log-item__custo">Custo dos insumos: <strong>${formatMoney(item.custo || 0)}</strong> · Lucro bruto: <strong>${formatMoney((item.valor || 0) - (item.custo || 0))}</strong></div>`
      : '';
    const valorExibido = isPerda ? item.custo : item.valor;
    el.innerHTML = `
      <strong>${hora}</strong><br>
      ${item.texto}
      <span class="log-item__valor ${classe}"> ${sinal} ${formatMoney(valorExibido || 0)}</span>
      ${custoHtml}
    `;
    list.appendChild(el);
  }
}

function renderFichasTecnicas() {
  const wrap = document.getElementById('fichas-wrap');
  wrap.innerHTML = '';
  const vendaveis = Object.entries(state.produtos).filter(([, p]) => p.preco !== null);
  for (const [id, produto] of vendaveis) {
    const consumo = calcularConsumoInsumos(id, 1);
    const block = document.createElement('div');
    block.className = 'card recipe-block';
    let linhas = produto.ficha.map((item) => {
      if (item.tipo === 'insumo') {
        const ins = state.insumos[item.id];
        return `<div class="recipe-line"><span class="recipe-line__name">${ins.nome}</span><span>${item.qtd} ${ins.unidade}</span></div>`;
      }
      const sub = state.produtos[item.id];
      let subLinhas = sub.ficha.map((s) => {
        const ins = state.insumos[s.id];
        return `<div class="recipe-line recipe-line--sub"><span class="recipe-line__name">↳ ${ins.nome}</span><span>${s.qtd * item.qtd} ${ins.unidade}</span></div>`;
      }).join('');
      return `<div class="recipe-line"><span class="recipe-line__name">${item.qtd}x ${sub.nome}</span><span></span></div>${subLinhas}`;
    }).join('');
    if (!linhas) {
      linhas = '<div class="recipe-line recipe-line--empty"><span class="recipe-line__name">Venda direta, sem receita (não baixa estoque).</span></div>';
    }
    block.innerHTML = `
      <div class="recipe-block__header">
        <div class="recipe-block__title">${produto.nome} <span class="price">· R$ ${produto.preco.toFixed(2)}</span></div>
        <button type="button" class="btn btn--ghost btn--small" data-edit-produto="${id}">Editar</button>
      </div>
      ${linhas}
    `;
    wrap.appendChild(block);
  }
}

function renderInsumosCadastro() {
  const list = document.getElementById('insumos-cadastro-list');
  list.innerHTML = '';
  const ordenados = Object.entries(state.insumos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  if (!ordenados.length) {
    list.innerHTML = '<p class="cadastro-empty">Nenhum insumo cadastrado ainda.</p>';
    return;
  }
  for (const [id, insumo] of ordenados) {
    const el = document.createElement('div');
    el.className = 'cadastro-item';
    el.dataset.editInsumo = id;
    el.innerHTML = `
      <div class="cadastro-item__name">${insumo.nome}</div>
      <div class="cadastro-item__meta">Custo: <strong>${formatMoney(insumo.custo)}</strong> / ${insumo.unidade}</div>
      <div class="cadastro-item__meta">Estoque: ${insumo.estoque} ${insumo.unidade} · Mínimo: ${insumo.minimo} ${insumo.unidade}</div>
    `;
    list.appendChild(el);
  }
}

function renderProdutosCadastro() {
  const list = document.getElementById('produtos-cadastro-list');
  list.innerHTML = '';
  const ordenados = Object.entries(state.produtos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
  if (!ordenados.length) {
    list.innerHTML = '<p class="cadastro-empty">Nenhum produto cadastrado ainda.</p>';
    return;
  }
  for (const [id, produto] of ordenados) {
    const el = document.createElement('div');
    el.className = 'cadastro-item';
    el.dataset.editProduto = id;
    const precoHtml = produto.preco !== null
      ? `<div class="cadastro-item__meta">Preço: <strong>${formatMoney(produto.preco)}</strong></div>`
      : `<span class="cadastro-item__tag">Item interno (não vendável)</span>`;
    const receitaHtml = produto.ficha.length
      ? `<div class="cadastro-item__meta">${produto.ficha.length} item(ns) na receita</div>`
      : `<div class="cadastro-item__meta">Venda direta (sem receita)</div>`;
    el.innerHTML = `
      <div class="cadastro-item__name">${produto.nome}</div>
      ${precoHtml}
      ${receitaHtml}
    `;
    list.appendChild(el);
  }
}

function renderCadastros() {
  renderInsumosCadastro();
  renderProdutosCadastro();
}

function renderAll() {
  renderEstoque();
  renderVendaSelect();
  renderPersonalizacaoVenda();
  renderPedidoAtual();
  renderEntradaSelect();
  renderPerdaSelects();
  renderPersonalizacaoPerda();
  renderLog();
  renderFichasTecnicas();
  renderFinanceiro();
  renderCadastros();
}

// Depois de uma venda/entrada só os números mudam — a lista de produtos e
// insumos continua a mesma, então não reconstrói os <select> (isso resetava
// a seleção do usuário de volta pro primeiro item a cada lançamento). A
// personalização é reconstruída pra voltar tudo marcado no próximo pedido
// e refletir a ficha técnica caso ela tenha sido editada nos Cadastros.
function renderDynamic() {
  renderEstoque();
  renderPersonalizacaoVenda();
  renderPersonalizacaoPerda();
  renderLog();
  renderFichasTecnicas();
  renderFinanceiro();
  renderInsumosCadastro();
}

/* ---------- Login (Supabase Auth + checagem de dono) ---------- */

let appVisivel = false;

function loginError(msg) {
  document.getElementById('login-error').textContent = msg || '';
}

function friendlyAuthError(err) {
  const msg = (err && err.message) || '';
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme o e-mail da conta antes de entrar.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Espera um pouco e tenta de novo.';
  return 'Não deu certo: ' + msg;
}

function initLogin() {
  const sb = window.BH.supabase;
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');

  if (!sb) {
    loginError('Supabase não configurado. Veja estoque/supabase/README.md.');
    return;
  }

  // Se já tem sessão salva (voltou pro painel), tenta entrar direto.
  sb.auth.getSession().then(({ data }) => {
    if (data.session) entrarComoDono();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError('Entrando…');
    const { error } = await sb.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passInput.value,
    });
    if (error) {
      loginError(friendlyAuthError(error));
      passInput.value = '';
      return;
    }
    entrarComoDono();
  });
}

// Confirma que a conta logada é dona (is_owner), carrega o estoque do
// Supabase e abre o app. Conta sem permissão é deslogada.
async function entrarComoDono() {
  const sb = window.BH.supabase;
  loginError('Verificando acesso…');
  const { data: userData } = await sb.auth.getUser();
  const user = userData && userData.user;
  if (!user) { loginError('Sessão expirada. Entre de novo.'); return; }

  const { data: profile, error } = await sb
    .from('profiles').select('is_owner').eq('id', user.id).single();
  if (error || !profile || !profile.is_owner) {
    loginError('Essa conta não tem acesso ao painel de estoque.');
    await sb.auth.signOut();
    return;
  }

  try {
    loginError('Carregando estoque…');
    state = await window.BH.store.loadAll();
  } catch (e) {
    console.error('[estoque] falha ao carregar:', e);
    loginError('Não consegui carregar o estoque. Confira a conexão e tente de novo.');
    return;
  }
  loginError('');
  showApp();
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('is-visible');
  appVisivel = true;
  renderAll();
}

// Recarrega o estoque do Supabase (sincroniza PC × celular ao reabrir a aba).
// Espera a fila de escrita esvaziar pra não sobrescrever gravação em voo.
let recarregando = false;
async function recarregarDoServidor() {
  if (!appVisivel || recarregando || !window.BH.store) return;
  recarregando = true;
  try {
    await window.BH.store.whenIdle();
    state = await window.BH.store.loadAll();
    renderAll();
  } catch (e) {
    console.error('[estoque] falha ao recarregar:', e);
  } finally {
    recarregando = false;
  }
}

function initLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (window.BH.supabase) await window.BH.supabase.auth.signOut();
    location.reload();
  });
}

function initSyncBanner() {
  const banner = document.getElementById('sync-banner');
  if (!banner || !window.BH.store) return;
  window.BH.store.onError(() => {
    banner.textContent = 'Falha ao sincronizar com o servidor. A tela pode estar à frente do que foi salvo. Recarregue a página e confira.';
    banner.classList.add('is-visible');
  });
}

/* ---------- Tabs ---------- */

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      panels.forEach((p) => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      document.getElementById(tab.dataset.panel).classList.add('is-active');
    });
  });
}

/* ---------- Formulários ---------- */

// Lê o texto colado, casa cada item com o cadastro de produtos e empilha os
// reconhecidos no pedido em montagem (sem descontar nada ainda — só
// finalizar desconta, igual ao fluxo manual). Produto ou ingrediente que não
// bate com o cadastro fica de fora e vira aviso, pro atendente completar à
// mão em vez de a venda sair errada silenciosamente.
function processarPedidoWhatsapp() {
  const textarea = document.getElementById('venda-whatsapp-texto');
  const feedback = document.getElementById('venda-whatsapp-feedback');
  feedback.classList.remove('is-visible', 'is-ok', 'is-error');

  const resultado = parseWhatsappOrder(textarea.value);
  if (!resultado.itens.length) {
    feedback.textContent = 'Não consegui identificar nenhum item nessa mensagem. Confere se colou o pedido certo (formato igual ao que o site manda pro WhatsApp).';
    feedback.classList.add('is-visible', 'is-error');
    return;
  }

  const avisos = [];
  let adicionados = 0;

  resultado.itens.forEach((item) => {
    const produtoId = encontrarProdutoPorNome(item.nome);
    if (!produtoId) {
      avisos.push(`"${item.nome}" não está cadastrado. Adiciona esse item manualmente.`);
      return;
    }
    const { ajustes, naoReconhecidos } = montarAjustesItem(produtoId, item.detalhes);
    pedidoAtual.push({
      produtoId,
      quantidade: item.quantidade,
      ajustes,
      precoManual: item.preco,
      detalhesOriginais: item.detalhes.length ? item.detalhes : null,
    });
    adicionados += 1;
    if (naoReconhecidos.length) {
      avisos.push(`"${item.nome}": não reconheci "${naoReconhecidos.join('", "')}". Confere se o estoque desses insumos precisa de ajuste manual.`);
    }
  });

  renderPedidoAtual();

  const resumo = `${adicionados} de ${resultado.itens.length} item(ns) do pedido reconhecido(s) e adicionado(s).`;
  feedback.textContent = avisos.length ? `${resumo} ${avisos.join(' ')}` : `${resumo} Confere e finaliza.`;
  feedback.classList.add('is-visible', avisos.length ? 'is-error' : 'is-ok');
}

function initForms() {
  document.getElementById('venda-whatsapp-processar').addEventListener('click', processarPedidoWhatsapp);
  document.getElementById('venda-whatsapp-limpar').addEventListener('click', () => {
    document.getElementById('venda-whatsapp-texto').value = '';
    const feedback = document.getElementById('venda-whatsapp-feedback');
    feedback.classList.remove('is-visible', 'is-ok', 'is-error');
  });

  document.getElementById('venda-produto').addEventListener('change', renderPersonalizacaoVenda);

  document.getElementById('venda-add-item').addEventListener('click', () => {
    const produtoId = document.getElementById('venda-produto').value;
    const qtd = Number(document.getElementById('venda-quantidade').value);
    if (!produtoId || !qtd || qtd <= 0) return;
    const ajustes = coletarAjustesPersonalizacao('venda-personalizacao-rows');
    pedidoAtual.push({ produtoId, quantidade: qtd, ajustes });
    document.getElementById('venda-quantidade').value = 1;
    renderPersonalizacaoVenda();
    renderPedidoAtual();
  });

  document.getElementById('pedido-itens-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-index]');
    if (!btn) return;
    pedidoAtual.splice(Number(btn.dataset.removeIndex), 1);
    renderPedidoAtual();
  });

  document.getElementById('pedido-limpar').addEventListener('click', () => {
    pedidoAtual = [];
    renderPedidoAtual();
    const feedback = document.getElementById('venda-feedback');
    feedback.classList.remove('is-visible', 'is-ok', 'is-error');
  });

  document.getElementById('pedido-finalizar').addEventListener('click', () => {
    const feedback = document.getElementById('venda-feedback');
    const btnImprimir = document.getElementById('pedido-imprimir');
    feedback.classList.remove('is-error', 'is-ok');
    btnImprimir.style.display = 'none';
    if (!pedidoAtual.length) {
      feedback.textContent = 'Adiciona pelo menos um item antes de finalizar.';
      feedback.classList.add('is-visible', 'is-error');
      return;
    }
    const totalItens = pedidoAtual.reduce((soma, item) => soma + item.quantidade, 0);
    const resultado = registrarPedido(pedidoAtual);
    feedback.classList.add('is-visible', resultado.ok ? 'is-ok' : 'is-error');
    feedback.textContent = resultado.ok
      ? `Pedido finalizado: ${totalItens} item(ns). Estoque atualizado.`
      : resultado.erro;
    if (resultado.ok) {
      ultimoRecibo = resultado.recibo;
      btnImprimir.style.display = 'block';
      pedidoAtual = [];
      renderPedidoAtual();
      renderDynamic();
    }
  });

  document.getElementById('pedido-imprimir').addEventListener('click', () => {
    if (ultimoRecibo) imprimirRecibo(ultimoRecibo);
  });

  const entradaForm = document.getElementById('entrada-form');
  entradaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const insumoId = document.getElementById('entrada-insumo').value;
    const qtd = Number(document.getElementById('entrada-quantidade').value);
    const feedback = document.getElementById('entrada-feedback');
    if (!qtd || qtd <= 0) return;
    const resultado = registrarEntrada(insumoId, qtd);
    feedback.classList.remove('is-error', 'is-ok');
    feedback.classList.add('is-visible', resultado.ok ? 'is-ok' : 'is-error');
    feedback.textContent = resultado.ok
      ? `Entrada registrada: +${qtd} ${state.insumos[insumoId].unidade} de ${state.insumos[insumoId].nome}.`
      : resultado.erro;
    if (resultado.ok) {
      document.getElementById('entrada-quantidade').value = '';
      renderDynamic();
    }
  });

  document.getElementById('reset-demo').addEventListener('click', () => {
    if (confirm('Isso apaga as movimentações, os insumos e produtos que você criou ou editou (em todos os aparelhos), e volta tudo pros valores iniciais. Confirmar?')) {
      resetDemo();
    }
  });
}

/* ---------- Perdas ---------- */

let perdaModo = 'produto';

function initPerdas() {
  const btnModoProduto = document.getElementById('perda-modo-produto');
  const btnModoInsumo = document.getElementById('perda-modo-insumo');
  const rowProduto = document.getElementById('perda-produto-row');
  const rowInsumo = document.getElementById('perda-insumo-row');
  const personalizacaoWrap = document.getElementById('perda-personalizacao-wrap');

  function setModo(modo) {
    perdaModo = modo;
    btnModoProduto.classList.toggle('is-active', modo === 'produto');
    btnModoProduto.classList.toggle('btn--ghost', modo !== 'produto');
    btnModoInsumo.classList.toggle('is-active', modo === 'insumo');
    btnModoInsumo.classList.toggle('btn--ghost', modo !== 'insumo');
    rowProduto.style.display = modo === 'produto' ? 'flex' : 'none';
    personalizacaoWrap.style.display = modo === 'produto' ? 'block' : 'none';
    rowInsumo.style.display = modo === 'insumo' ? 'flex' : 'none';
  }

  btnModoProduto.addEventListener('click', () => setModo('produto'));
  btnModoInsumo.addEventListener('click', () => setModo('insumo'));

  document.getElementById('perda-produto').addEventListener('change', renderPersonalizacaoPerda);

  const motivoSelect = document.getElementById('perda-motivo');
  const motivoOutroField = document.getElementById('perda-motivo-outro-field');
  motivoSelect.addEventListener('change', () => {
    motivoOutroField.style.display = motivoSelect.value === 'Outro' ? 'flex' : 'none';
  });

  document.getElementById('perda-registrar').addEventListener('click', () => {
    const feedback = document.getElementById('perda-feedback');
    feedback.classList.remove('is-error', 'is-ok');

    const motivoBase = motivoSelect.value;
    const motivoOutro = document.getElementById('perda-motivo-outro').value.trim();
    const motivo = motivoBase === 'Outro' && motivoOutro ? motivoOutro : motivoBase;

    let resultado;
    if (perdaModo === 'produto') {
      const produtoId = document.getElementById('perda-produto').value;
      const qtd = Number(document.getElementById('perda-produto-quantidade').value);
      if (!produtoId || !qtd || qtd <= 0) return;
      const ajustes = coletarAjustesPersonalizacao('perda-personalizacao-rows');
      resultado = registrarPerdaProduto(produtoId, qtd, motivo, ajustes);
    } else {
      const insumoId = document.getElementById('perda-insumo').value;
      const qtd = Number(document.getElementById('perda-insumo-quantidade').value);
      if (!insumoId || !qtd || qtd <= 0) return;
      resultado = registrarPerdaInsumo(insumoId, qtd, motivo);
    }

    feedback.classList.add('is-visible', resultado.ok ? 'is-ok' : 'is-error');
    feedback.textContent = resultado.ok
      ? 'Perda registrada. Estoque atualizado.'
      : resultado.erro;

    if (resultado.ok) {
      document.getElementById('perda-produto-quantidade').value = 1;
      document.getElementById('perda-insumo-quantidade').value = 1;
      renderDynamic();
    }
  });
}

/* ---------- Mini modal de reposição rápida ---------- */

let reporInsumoId = null;

function abrirReporModal(insumoId) {
  const insumo = state.insumos[insumoId];
  if (!insumo) return;
  reporInsumoId = insumoId;
  document.getElementById('repor-modal-title').textContent = `Repor ${insumo.nome}`;
  document.getElementById('repor-modal-sub').textContent =
    `Estoque atual: ${insumo.estoque} ${insumo.unidade} · Mínimo: ${insumo.minimo} ${insumo.unidade}`;
  const input = document.getElementById('repor-quantidade');
  input.value = '';
  document.getElementById('repor-modal-overlay').classList.add('is-visible');
  input.focus();
}

function fecharReporModal() {
  reporInsumoId = null;
  document.getElementById('repor-modal-overlay').classList.remove('is-visible');
}

function initReporModal() {
  document.getElementById('estoque-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-repor]');
    if (btn) abrirReporModal(btn.dataset.repor);
  });

  document.getElementById('repor-cancel').addEventListener('click', fecharReporModal);
  document.getElementById('repor-close').addEventListener('click', fecharReporModal);

  document.getElementById('repor-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'repor-modal-overlay') fecharReporModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharReporModal();
  });

  document.getElementById('repor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!reporInsumoId) return;
    const qtd = Number(document.getElementById('repor-quantidade').value);
    if (!qtd || qtd <= 0) return;
    registrarEntrada(reporInsumoId, qtd);
    fecharReporModal();
    renderDynamic();
  });
}

/* ---------- Modal de criar/editar insumo ---------- */

let editandoInsumoId = null;

function abrirInsumoModal(insumoId) {
  editandoInsumoId = insumoId || null;
  const feedback = document.getElementById('insumo-feedback');
  feedback.classList.remove('is-visible', 'is-ok', 'is-error');

  const nomeInput = document.getElementById('insumo-nome');
  const unidadeInput = document.getElementById('insumo-unidade');
  const custoInput = document.getElementById('insumo-custo');
  const estoqueInput = document.getElementById('insumo-estoque');
  const minimoInput = document.getElementById('insumo-minimo');
  const estoqueField = document.getElementById('insumo-estoque-field');
  const estoqueHint = document.getElementById('insumo-estoque-hint');
  const removerBtn = document.getElementById('insumo-remover');

  if (editandoInsumoId) {
    const insumo = state.insumos[editandoInsumoId];
    document.getElementById('insumo-modal-title').textContent = `Editar ${insumo.nome}`;
    nomeInput.value = insumo.nome;
    unidadeInput.value = insumo.unidade;
    custoInput.value = insumo.custo;
    minimoInput.value = insumo.minimo;
    // Estoque só muda via Entrada/Perdas; ao editar, esconde só esse campo e
    // mantém o mínimo (alerta) editável aqui.
    estoqueInput.required = false;
    estoqueField.style.display = 'none';
    estoqueHint.style.display = '';
    removerBtn.style.display = '';
  } else {
    document.getElementById('insumo-modal-title').textContent = 'Novo insumo';
    nomeInput.value = '';
    unidadeInput.value = 'g';
    custoInput.value = '';
    estoqueInput.value = '';
    minimoInput.value = '';
    estoqueInput.required = true;
    estoqueField.style.display = '';
    estoqueHint.style.display = 'none';
    removerBtn.style.display = 'none';
  }

  document.getElementById('insumo-modal-overlay').classList.add('is-visible');
  nomeInput.focus();
}

function fecharInsumoModal() {
  editandoInsumoId = null;
  document.getElementById('insumo-modal-overlay').classList.remove('is-visible');
}

function initInsumoModal() {
  document.getElementById('novo-insumo-btn').addEventListener('click', () => abrirInsumoModal(null));

  document.getElementById('insumos-cadastro-list').addEventListener('click', (e) => {
    const item = e.target.closest('[data-edit-insumo]');
    if (item) abrirInsumoModal(item.dataset.editInsumo);
  });

  document.getElementById('insumo-cancel').addEventListener('click', fecharInsumoModal);
  document.getElementById('insumo-close').addEventListener('click', fecharInsumoModal);

  document.getElementById('insumo-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'insumo-modal-overlay') fecharInsumoModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharInsumoModal();
  });

  document.getElementById('insumo-remover').addEventListener('click', () => {
    if (!editandoInsumoId) return;
    if (!confirm('Remover esse insumo? Essa ação não pode ser desfeita.')) return;
    const resultado = removerInsumo(editandoInsumoId);
    if (!resultado.ok) {
      const feedback = document.getElementById('insumo-feedback');
      feedback.classList.remove('is-ok');
      feedback.classList.add('is-visible', 'is-error');
      feedback.textContent = resultado.erro;
      return;
    }
    fecharInsumoModal();
    renderAll();
  });

  document.getElementById('insumo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('insumo-nome').value.trim();
    const unidade = document.getElementById('insumo-unidade').value;
    const custo = Number(document.getElementById('insumo-custo').value);
    const minimo = Number(document.getElementById('insumo-minimo').value);
    const feedback = document.getElementById('insumo-feedback');
    feedback.classList.remove('is-visible', 'is-ok', 'is-error');

    if (!nome) {
      feedback.textContent = 'Dá um nome pro insumo.';
      feedback.classList.add('is-visible', 'is-error');
      return;
    }
    if (!(custo >= 0) || !(minimo >= 0)) {
      feedback.textContent = 'Custo e mínimo precisam ser números válidos.';
      feedback.classList.add('is-visible', 'is-error');
      return;
    }

    if (editandoInsumoId) {
      atualizarInsumo(editandoInsumoId, { nome, unidade, custo, minimo });
    } else {
      const estoque = Number(document.getElementById('insumo-estoque').value);
      if (!(estoque >= 0)) {
        feedback.textContent = 'Informa o estoque inicial.';
        feedback.classList.add('is-visible', 'is-error');
        return;
      }
      criarInsumo({ nome, unidade, custo, estoque, minimo });
    }
    fecharInsumoModal();
    renderAll();
  });
}

/* ---------- Modal de criar/editar produto (com editor de ficha técnica) ---------- */

let editandoProdutoId = null;

function criarFichaRowElement(item) {
  const row = document.createElement('div');
  row.className = 'ficha-row';
  row.innerHTML = `
    <select class="ficha-row__tipo">
      <option value="insumo">Insumo</option>
      <option value="produto">Sub-produto</option>
    </select>
    <select class="ficha-row__item"></select>
    <input type="number" class="ficha-row__qtd" min="0.01" step="0.01" placeholder="Qtd">
    <button type="button" class="ficha-row__remove" aria-label="Remover item">✕</button>
  `;

  const tipoSelect = row.querySelector('.ficha-row__tipo');
  const itemSelect = row.querySelector('.ficha-row__item');
  const qtdInput = row.querySelector('.ficha-row__qtd');

  const popularItemSelect = () => {
    itemSelect.innerHTML = '';
    if (tipoSelect.value === 'insumo') {
      const ordenados = Object.entries(state.insumos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
      for (const [id, insumo] of ordenados) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${insumo.nome} (${insumo.unidade})`;
        itemSelect.appendChild(opt);
      }
    } else {
      const ordenados = Object.entries(state.produtos).sort((a, b) => a[1].nome.localeCompare(b[1].nome));
      for (const [id, produto] of ordenados) {
        if (id === editandoProdutoId) continue; // não pode referenciar a si mesmo
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = produto.nome;
        itemSelect.appendChild(opt);
      }
    }
  };

  tipoSelect.addEventListener('change', popularItemSelect);
  popularItemSelect();

  if (item) {
    tipoSelect.value = item.tipo;
    popularItemSelect();
    itemSelect.value = item.id;
    qtdInput.value = item.qtd;
  }

  row.querySelector('.ficha-row__remove').addEventListener('click', () => row.remove());

  return row;
}

function atualizarVisibilidadePrecoProduto() {
  const vendavel = document.getElementById('produto-vendavel').checked;
  document.getElementById('produto-preco').closest('.field').style.display = vendavel ? '' : 'none';
}

function abrirProdutoModal(produtoId) {
  editandoProdutoId = produtoId || null;
  const feedback = document.getElementById('produto-feedback');
  feedback.classList.remove('is-visible', 'is-ok', 'is-error');

  const nomeInput = document.getElementById('produto-nome');
  const precoInput = document.getElementById('produto-preco');
  const vendavelCheckbox = document.getElementById('produto-vendavel');
  const rowsWrap = document.getElementById('ficha-editor-rows');
  const removerBtn = document.getElementById('produto-remover');

  rowsWrap.innerHTML = '';

  if (editandoProdutoId) {
    const produto = state.produtos[editandoProdutoId];
    document.getElementById('produto-modal-title').textContent = `Editar ${produto.nome}`;
    nomeInput.value = produto.nome;
    precoInput.value = produto.preco !== null ? produto.preco : '';
    vendavelCheckbox.checked = produto.preco !== null;
    produto.ficha.forEach((item) => rowsWrap.appendChild(criarFichaRowElement(item)));
    removerBtn.style.display = '';
  } else {
    document.getElementById('produto-modal-title').textContent = 'Novo produto';
    nomeInput.value = '';
    precoInput.value = '';
    vendavelCheckbox.checked = true;
    rowsWrap.appendChild(criarFichaRowElement(null));
    removerBtn.style.display = 'none';
  }

  atualizarVisibilidadePrecoProduto();
  document.getElementById('produto-modal-overlay').classList.add('is-visible');
  nomeInput.focus();
}

function fecharProdutoModal() {
  editandoProdutoId = null;
  document.getElementById('produto-modal-overlay').classList.remove('is-visible');
}

function coletarFichaDoFormulario() {
  const linhas = document.querySelectorAll('#ficha-editor-rows .ficha-row');
  const ficha = [];
  for (const linha of linhas) {
    const tipo = linha.querySelector('.ficha-row__tipo').value;
    const id = linha.querySelector('.ficha-row__item').value;
    const qtd = Number(linha.querySelector('.ficha-row__qtd').value);
    if (!id || !qtd || qtd <= 0) continue;
    ficha.push({ tipo, id, qtd });
  }
  return ficha;
}

function initProdutoModal() {
  document.getElementById('novo-produto-btn').addEventListener('click', () => abrirProdutoModal(null));
  document.getElementById('nova-ficha-btn').addEventListener('click', () => abrirProdutoModal(null));

  document.getElementById('produtos-cadastro-list').addEventListener('click', (e) => {
    const item = e.target.closest('[data-edit-produto]');
    if (item) abrirProdutoModal(item.dataset.editProduto);
  });

  document.getElementById('fichas-wrap').addEventListener('click', (e) => {
    const item = e.target.closest('[data-edit-produto]');
    if (item) abrirProdutoModal(item.dataset.editProduto);
  });

  document.getElementById('produto-cancel').addEventListener('click', fecharProdutoModal);
  document.getElementById('produto-close').addEventListener('click', fecharProdutoModal);

  document.getElementById('produto-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'produto-modal-overlay') fecharProdutoModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharProdutoModal();
  });

  document.getElementById('produto-vendavel').addEventListener('change', atualizarVisibilidadePrecoProduto);

  document.getElementById('ficha-add-row').addEventListener('click', () => {
    document.getElementById('ficha-editor-rows').appendChild(criarFichaRowElement(null));
  });

  document.getElementById('produto-remover').addEventListener('click', () => {
    if (!editandoProdutoId) return;
    if (!confirm('Remover esse produto? Essa ação não pode ser desfeita.')) return;
    const resultado = removerProduto(editandoProdutoId);
    if (!resultado.ok) {
      const feedback = document.getElementById('produto-feedback');
      feedback.classList.remove('is-ok');
      feedback.classList.add('is-visible', 'is-error');
      feedback.textContent = resultado.erro;
      return;
    }
    fecharProdutoModal();
    renderAll();
  });

  document.getElementById('produto-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('produto-nome').value.trim();
    const vendavel = document.getElementById('produto-vendavel').checked;
    const precoRaw = document.getElementById('produto-preco').value;
    const preco = vendavel ? Number(precoRaw) : null;
    const ficha = coletarFichaDoFormulario();
    const feedback = document.getElementById('produto-feedback');
    feedback.classList.remove('is-visible', 'is-ok', 'is-error');

    if (!nome) {
      feedback.textContent = 'Dá um nome pro produto.';
      feedback.classList.add('is-visible', 'is-error');
      return;
    }
    if (vendavel && (!precoRaw || !(preco >= 0))) {
      feedback.textContent = 'Define um preço de venda válido.';
      feedback.classList.add('is-visible', 'is-error');
      return;
    }
    // Ficha é opcional: um produto sem receita (ex: bebida revendida) vende
    // normalmente, só não dá baixa em nenhum insumo.
    if (editandoProdutoId) {
      const cicloEncontrado = ficha.some((item) => item.tipo === 'produto' && criaCiclo(editandoProdutoId, item.id));
      if (cicloEncontrado) {
        feedback.textContent = 'Essa receita criaria uma referência circular (um produto usando a si mesmo, direta ou indiretamente). Ajusta os itens.';
        feedback.classList.add('is-visible', 'is-error');
        return;
      }
      atualizarProduto(editandoProdutoId, { nome, preco, ficha });
    } else {
      criarProduto({ nome, preco, ficha });
    }
    fecharProdutoModal();
    renderAll();
  });
}

/* ---------- Init ---------- */

document.addEventListener('DOMContentLoaded', () => {
  // Estado vazio até o login carregar o real do Supabase — evita render quebrar
  // caso algum init toque no state antes da hora (o app fica oculto mesmo).
  state = seedStateVazio();
  initSyncBanner();
  initLogin();
  initLogout();
  initTabs();
  initForms();
  initPerdas();
  initReporModal();
  initInsumoModal();
  initProdutoModal();

  // Sincroniza PC × celular: ao voltar pra aba/janela, relê do servidor.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recarregarDoServidor();
  });
  window.addEventListener('focus', recarregarDoServidor);
});
