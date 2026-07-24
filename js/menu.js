/* Renderização do cardápio a partir do Supabase.
   Os cards de produto deixaram de ser HTML fixo: esse script busca
   menu_categories/menu_items e monta os mesmos <div class="dish-card"> com
   os mesmos data-* que o cart.js lê. Assim o dono edita o cardápio no
   /admin e o site reflete sem deploy.

   Se o Supabase ainda não estiver configurado (ou a rede falhar), usa o
   FALLBACK abaixo — uma cópia do cardápio — pro site nunca ficar sem menu.

   Depois de renderizar, dispara 'bh:menu-rendered' no document pro
   cart.js (re)ligar os botões +/− dos pratos que acabaram de aparecer. */
(function () {
  var sb = window.BH ? window.BH.supabase : null;

  // As 3 categorias de temaki viram subsseções dentro de UMA seção
  // (#temakis) em vez de 3 seções separadas — nessa ordem.
  var TEMAKI_GROUP_SLUGS = ['temaki-hot', 'temaki-cru', 'big-hot'];

  // Espelho do seed em supabase/schema.sql. Só é usado quando o banco está
  // inacessível; a fonte da verdade é a tabela menu_items.
  var FALLBACK = [
    { slug: 'hamburgueres', name: 'Hambúrgueres', items: [
      { id: 'kids', name: 'Kids', description: 'Pão de batata 80g, blend 120g, queijo prato e ketchup', price: 20.00, image_url: 'img/produtos/kids.jpg', is_customizable: true },
      { id: 'opalla', name: 'Opalla', description: 'Pão de batata 80g, 3 blends de 100g, triplo queijo prato, triplo creme de cheddar, tiras de bacon crocante e maionese de bacon', price: 38.00, image_url: 'img/produtos/opalla.jpg', is_customizable: true, is_featured: true },
      { id: 'mustang', name: 'Mustang', description: 'Pão de batata 80g, 2 blends de 100g, queijo prato, queijo coalho maçaricado, mussarela, bacon, molho barbecue e maionese de bacon', price: 32.00, image_url: 'img/produtos/mustang.jpg', is_customizable: true },
      { id: 'garage-75', name: 'Garage 75', description: 'Pão de batata 80g, blend 120g, alface, tomate, queijo prato e maionese de bacon', price: 24.00, image_url: 'img/produtos/garage-75.jpg', is_customizable: true },
      { id: 'maverick', name: 'Maverick', description: 'Pão australiano 80g, blend 150g, queijo prato, queijo coalho maçaricado, mussarela, cebola caramelizada, molho barbecue, creme de cheddar e bacon', price: 28.00, image_url: 'img/produtos/maverick.jpg', is_customizable: true },
      { id: 'maverick-turbo', name: 'Maverick Turbo', description: 'Pão australiano, 2 blends de 150g, duplo queijo prato, duplo mussarela, duplo queijo coalho maçaricado, cebola caramelizada, bacon, creme de cheddar e molho barbecue', price: 32.00, image_url: 'img/produtos/maverick-turbo.jpg', is_customizable: true, is_featured: true },
      { id: 'corvette', name: 'Corvette', description: 'Pão de batata 80g, blend 120g, queijo prato, queijo coalho maçaricado, mussarela, bacon e maionese', price: 27.00, image_url: 'img/produtos/corvette.jpg', is_customizable: true }
    ] },
    { slug: 'temaki-hot', name: 'Temaki Hot (cone frito)', items: [
      { id: 'temaki-hot-salmao-frito', name: 'Salmão Frito', description: 'Cone de alga nori frita, recheado com arroz japonês, salmão em cubos frito, gergelim, cebolinha e cream cheese', price: 42.00, image_url: 'img/produtos/temaki-salmao-frito.jpg' },
      { id: 'temaki-hot-camarao-salmao-frito', name: 'Camarão e Salmão Frito', description: 'Cone de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos frito, gergelim, cebolinha e cream cheese', price: 40.00, image_url: 'img/produtos/temaki-camarao-salmao-frito.jpg' },
      { id: 'temaki-hot-misto-turbinado', name: 'Misto Turbinado Frito', description: 'Cone de alga nori frita, recheado com arroz japonês, camarão grelhado, pedaços de kani, salmão em cubos frito, gergelim, cebolinha e cream cheese', price: 45.00, image_url: 'img/produtos/temaki-misto-turbinado.jpg' }
    ] },
    { slug: 'temaki-cru', name: 'Temaki Cru (alga ao natural)', items: [
      { id: 'temaki-cru-salmao-cru', name: 'Salmão Cru', description: 'Cone de alga nori ao natural, recheado com arroz japonês, salmão em cubos cru, gergelim, cebolinha e cream cheese', price: 42.00, image_url: 'img/produtos/temaki-cru-salmao-cru.jpeg' },
      { id: 'temaki-cru-salmao-macaricado', name: 'Salmão Maçaricado', description: 'Cone de alga nori ao natural, recheado com arroz japonês, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', price: 40.00, image_url: 'img/produtos/temaki-cru-salmao-macaricado.jpg' },
      { id: 'temaki-cru-camarao-salmao-cru', name: 'Camarão Grelhado e Salmão Cru', description: 'Cone de alga nori ao natural, recheado com arroz japonês, camarão grelhado, salmão em cubos cru, gergelim, cebolinha e cream cheese', price: 42.00, image_url: 'img/produtos/temaki-cru-camarao-salmao-cru.jpeg' },
      { id: 'temaki-cru-camarao-salmao-macaricado', name: 'Camarão Grelhado e Salmão Maçaricado', description: 'Cone de alga nori ao natural, recheado com arroz japonês, camarão grelhado, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', price: 42.00, image_url: 'img/produtos/temaki-cru-camarao-salmao-macaricado.jpg' }
    ] },
    { slug: 'big-hot', name: 'Big Hot (roll frito)', items: [
      { id: 'big-hot-salmao-frito', name: 'Salmão Frito', description: 'Roll de alga nori frita, recheado com arroz japonês, salmão em cubos frito, gergelim, cebolinha e cream cheese', price: 47.00, image_url: 'img/produtos/big-hot-salmao-frito.jpg' },
      { id: 'big-hot-salmao-macaricado', name: 'Salmão Maçaricado', description: 'Roll de alga nori frita, recheado com arroz japonês, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', price: 47.00, image_url: 'img/produtos/big-hot-salmao-macaricado.jpg' },
      { id: 'big-hot-salmao-cru', name: 'Salmão Cru', description: 'Roll de alga nori frita, recheado com arroz japonês, salmão em cubos cru, gergelim, cebolinha e cream cheese', price: 49.00, image_url: 'img/produtos/big-hot-salmao-cru.webp', is_featured: true },
      { id: 'big-hot-camarao-salmao-frito', name: 'Camarão Grelhado e Salmão Frito', description: 'Roll de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos frito, gergelim, cebolinha e cream cheese', price: 47.00, image_url: 'img/produtos/big-hot-camarao-salmao-frito.jpg' },
      { id: 'big-hot-camarao-salmao-macaricado', name: 'Camarão Grelhado e Salmão Maçaricado', description: 'Roll de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos maçaricado, gergelim, cebolinha e cream cheese', price: 47.00, image_url: 'img/produtos/big-hot-camarao-salmao-macaricado.jpg' },
      { id: 'big-hot-camarao-salmao-cru', name: 'Camarão Grelhado e Salmão Cru', description: 'Roll de alga nori frita, recheado com arroz japonês, camarão grelhado, salmão em cubos cru, gergelim, cebolinha e cream cheese', price: 49.00, image_url: 'img/produtos/big-hot-camarao-salmao-cru.jpg' }
    ] },
    { slug: 'bebidas', name: 'Bebidas', items: [
      { id: 'refrigerante-1l', name: 'Refrigerante 1L', description: 'Antártica ou Pepsi', price: 10.00, image_url: 'img/produtos/pepsi.png', image_variant: 'contain' },
      { id: 'coca-cola', name: 'Coca-Cola', description: '', price: 10.00, image_url: 'img/produtos/coca-cola.png', image_variant: 'contain' },
      { id: 'refrigerante-lata', name: 'Refrigerante Lata', description: 'Bem gelada', price: 6.00, image_url: 'img/produtos/coca-lata.jpg', is_featured: true }
    ] },
    { slug: 'acompanhamentos', name: 'Acompanhamentos', items: [
      { id: 'batata-p', name: 'Batata P', description: '', price: 10.00, image_url: 'img/produtos/batata-frita.jpg' },
      { id: 'batata-m', name: 'Batata M', description: '', price: 15.00, image_url: 'img/produtos/batata-frita.jpg' },
      { id: 'batata-g', name: 'Batata G', description: 'Com bacon e cheddar', price: 25.00, image_url: 'img/produtos/batata-frita.jpg' }
    ] }
  ];

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatBRL(value) {
    return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
  }

  // "Temaki Cru (alga ao natural)" -> "Temaki Cru" (prefixo curto usado no
  // nome do carrinho, pra distinguir "Salmão Cru" do Temaki Cru do "Salmão
  // Cru" do Big Hot).
  function shortLabel(categoryName) {
    return categoryName.split(' (')[0];
  }

  function isTemakiGroup(category) {
    return TEMAKI_GROUP_SLUGS.indexOf(category.slug) !== -1;
  }

  // Nome usado como identificador único no carrinho. Nas categorias de
  // temaki é sempre qualificado ("Big Hot – Salmão Cru"); nas demais é o
  // nome puro do prato.
  function cartName(item, category) {
    if (isTemakiGroup(category)) return shortLabel(category.name) + ' – ' + item.name;
    return item.name;
  }

  function dishCardHtml(item, category, opts) {
    opts = opts || {};
    var name = cartName(item, category);
    var displayName = opts.qualified ? name : item.name;
    var variantClass = item.image_variant ? ' ' + item.image_variant : '';
    var customAttr = item.is_customizable ? ' data-customizable="true"' : '';

    return '<div class="dish-card">' +
      '<div class="dish-photo-wrap">' +
        '<img class="dish-photo' + variantClass + '" src="' + esc(item.image_url || '') + '" alt="' + esc(displayName) + '">' +
      '</div>' +
      '<h3 class="dish-name">' + esc(displayName) + '</h3>' +
      '<p class="dish-desc">' + esc(item.description) + '</p>' +
      '<div class="dish-bottom">' +
        '<span class="dish-price">' + formatBRL(item.price) + '</span>' +
        '<div class="qty-box" data-name="' + esc(name) + '" data-price="' + Number(item.price) + '"' + customAttr + '></div>' +
      '</div>' +
    '</div>';
  }

  function renderMenu(categories) {
    // "Mais Pedidos" — pratos marcados como destaque, de qualquer categoria.
    var featuredGrid = document.querySelector('[data-menu-grid="featured"]');
    if (featuredGrid) {
      var featuredHtml = '';
      categories.forEach(function (cat) {
        cat.items.forEach(function (item) {
          if (item.is_featured) featuredHtml += dishCardHtml(item, cat, { qualified: true });
        });
      });
      featuredGrid.innerHTML = featuredHtml;
    }

    // Categorias "normais": uma seção cada, grid próprio.
    categories.forEach(function (cat) {
      if (isTemakiGroup(cat)) return; // tratadas à parte, abaixo
      var grid = document.querySelector('[data-menu-grid="' + cat.slug + '"]');
      if (!grid) return;
      grid.innerHTML = cat.items.map(function (item) {
        return dishCardHtml(item, cat, { qualified: false });
      }).join('');
    });

    // Temakis: as 3 categorias viram 3 subsseções dentro de um container só.
    var temakiRoot = document.querySelector('[data-menu-group="temakis"]');
    if (temakiRoot) {
      var temakiCats = TEMAKI_GROUP_SLUGS
        .map(function (slug) {
          var found = null;
          categories.forEach(function (c) { if (c.slug === slug) found = c; });
          return found;
        })
        .filter(Boolean);

      temakiRoot.innerHTML = temakiCats.map(function (cat, idx) {
        var headClass = idx === 0 ? 'subsection-head first' : 'subsection-head';
        var itemsHtml = cat.items.map(function (item) {
          return dishCardHtml(item, cat, { qualified: false });
        }).join('');
        return '<span class="' + headClass + '">' + esc(cat.name) + '</span>' +
          '<div class="dishes-grid">' + itemsHtml + '</div>';
      }).join('');
    }

    // Avisa o cart.js pra ligar os botões +/− dos cards que acabaram de
    // entrar no DOM (podem ter chegado bem depois do cart.js já ter rodado).
    document.dispatchEvent(new CustomEvent('bh:menu-rendered'));
  }

  function loadMenu() {
    if (!sb) {
      renderMenu(FALLBACK);
      return;
    }
    Promise.all([
      sb.from('menu_categories').select('*').order('sort_order'),
      sb.from('menu_items').select('*').eq('is_available', true).order('sort_order')
    ]).then(function (results) {
      var cats = results[0].data;
      var items = results[1].data;
      if (results[0].error || results[1].error || !cats || !cats.length) {
        console.warn('[Garage] Falha ao carregar cardápio do Supabase, usando fallback', results[0].error || results[1].error);
        renderMenu(FALLBACK);
        return;
      }
      renderMenu(cats.map(function (cat) {
        return {
          slug: cat.slug,
          name: cat.name,
          items: items.filter(function (item) { return item.category_id === cat.id; })
        };
      }));
    }).catch(function (err) {
      console.warn('[Garage] Erro de rede ao carregar cardápio, usando fallback', err);
      renderMenu(FALLBACK);
    });
  }

  // Guarda o status da loja pro cart.js usar (Fase 4) e avisa quem já
  // estiver escutando.
  function loadStoreStatus() {
    if (!sb) return;
    sb.from('store_status').select('*').eq('id', 1).single().then(function (res) {
      if (res.error || !res.data) return;
      window.BH.storeStatus = res.data;
      document.dispatchEvent(new CustomEvent('bh:store-status'));
    });
  }

  loadMenu();
  loadStoreStatus();
})();
