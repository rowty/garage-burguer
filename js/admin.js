/* Painel do dono (admin.html). Só entra quem tem is_owner = true no perfil.
   CRUD do cardápio, status da loja, banner de promoção e lista de pedidos.
   Toda escrita é protegida por RLS no banco (is_owner()); o gate aqui é só
   pra UX — um não-dono nem consegue gravar mesmo que force a tela. */
(function () {
  var sb = window.BH ? window.BH.supabase : null;

  var gate = document.getElementById('admin-gate');
  var gateMsg = document.getElementById('admin-gate-message');
  var gateBack = document.getElementById('admin-gate-back');
  var app = document.getElementById('admin');

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatBRL(value) {
    return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
  }
  function formatDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function denyAccess(message) {
    gateMsg.textContent = message;
    gateBack.style.display = 'inline-flex';
  }

  // Envia um arquivo pro bucket "imagens" e devolve a URL pública. Usa um
  // nome único (pasta + timestamp) pra nunca sobrescrever outra imagem.
  function uploadImage(file, folder) {
    var clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    var path = folder + '/' + Date.now() + '-' + clean;
    return sb.storage.from('imagens').upload(path, file, { cacheControl: '3600', upsert: false })
      .then(function (res) {
        if (res.error) throw res.error;
        return sb.storage.from('imagens').getPublicUrl(path).data.publicUrl;
      });
  }

  // Liga um <input type=file> a um campo de texto de URL + preview: ao
  // escolher o arquivo, faz upload e preenche a URL sozinho.
  function wireUpload(fileInputId, urlInputId, statusId, folder, onDone) {
    var fileInput = document.getElementById(fileInputId);
    if (!fileInput) return;
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var status = document.getElementById(statusId);
      if (file.size > 5 * 1024 * 1024) {
        status.textContent = 'Imagem muito grande (máx. 5 MB).';
        return;
      }
      status.textContent = 'Enviando…';
      uploadImage(file, folder).then(function (url) {
        document.getElementById(urlInputId).value = url;
        status.textContent = 'Imagem enviada ✓';
        if (onDone) onDone(url);
      }).catch(function (err) {
        status.textContent = 'Erro no envio: ' + (err.message || err);
      }).then(function () {
        fileInput.value = '';   // permite reenviar o mesmo arquivo se precisar
      });
    });
  }

  if (!sb) {
    denyAccess('Supabase não configurado. Veja supabase/README.md.');
    return;
  }

  // ---------- Gate de acesso ----------
  sb.auth.getSession().then(function (res) {
    var session = res.data.session;
    if (!session) {
      denyAccess('Você precisa entrar pra acessar o painel. Faça login pelo site.');
      return;
    }
    sb.from('profiles').select('is_owner, full_name').eq('id', session.user.id).single().then(function (r) {
      if (r.error || !r.data || !r.data.is_owner) {
        denyAccess('Esta conta não tem acesso ao painel do dono.');
        return;
      }
      var emailEl = document.getElementById('admin-user-email');
      if (emailEl) emailEl.textContent = session.user.email;
      gate.style.display = 'none';
      app.style.display = 'block';
      initAdmin();
    });
  });

  var CATEGORIES = [];

  function initAdmin() {
    wireTabs();
    document.getElementById('admin-logout').addEventListener('click', function () {
      sb.auth.signOut().then(function () { window.location.href = 'index.html'; });
    });

    loadCategories().then(function () {
      loadMenu();
    });
    loadOrders();
    loadStore();
    loadPromo();

    document.getElementById('orders-refresh').addEventListener('click', loadOrders);
    document.getElementById('item-new').addEventListener('click', function () { openItemModal(null); });
    document.getElementById('cat-manage').addEventListener('click', openCatModal);
    wireItemModal();
    wireCatModal();
    wireStoreForm();
    wirePromoForm();

    // Upload de imagens direto do computador (produtos e banner).
    wireUpload('item-image-file', 'item-image', 'item-image-status', 'produtos', function (url) {
      updateItemPreview(url);
    });
    wireUpload('promo-image-file', 'promo-image', 'promo-image-status', 'banner', function (url) {
      updatePromoPreview(url);
    });
  }

  function updateItemPreview(url) {
    var preview = document.getElementById('item-image-preview');
    if (url) {
      preview.src = url;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }

  function wireTabs() {
    var tabs = document.querySelectorAll('.admin__tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        document.querySelectorAll('.admin-panel').forEach(function (p) {
          p.classList.toggle('is-active', p.id === tab.dataset.panel);
        });
      });
    });
  }

  // ---------- Pedidos ----------
  var ORDER_STATUSES = ['novo', 'preparando', 'saiu', 'entregue', 'cancelado'];
  var STATUS_LABEL = {
    novo: 'Recebido', preparando: 'Preparando', saiu: 'Saiu pra entrega',
    entregue: 'Entregue', cancelado: 'Cancelado'
  };
  // Mensagem que abre pronta no WhatsApp do cliente quando o status muda.
  var STATUS_WHATSAPP_MESSAGE = {
    novo: 'Recebemos seu pedido! Já vamos preparar. 🍔',
    preparando: 'Seu pedido já está sendo preparado! 👨‍🍳',
    saiu: 'Seu pedido saiu pra entrega! 🚚',
    entregue: 'Seu pedido foi entregue. Bom apetite! 🍔',
    cancelado: 'Seu pedido foi cancelado. Qualquer dúvida, chama a gente por aqui.'
  };
  var ORDERS_BY_ID = {};

  function loadOrders() {
    var listEl = document.getElementById('orders-list');
    listEl.innerHTML = '<p class="admin__empty">Carregando…</p>';
    sb.from('orders').select('*, profiles(full_name, phone)').order('created_at', { ascending: false }).limit(100).then(function (res) {
      if (res.error) {
        listEl.innerHTML = '<p class="admin__empty">Erro ao carregar pedidos.</p>';
        return;
      }
      var orders = res.data || [];
      ORDERS_BY_ID = {};
      orders.forEach(function (o) { ORDERS_BY_ID[o.id] = o; });
      if (!orders.length) {
        listEl.innerHTML = '<p class="admin__empty">Nenhum pedido ainda.</p>';
        return;
      }
      listEl.innerHTML = orders.map(orderCardHtml).join('');
      listEl.querySelectorAll('[data-order-status]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          updateOrderStatus(sel.dataset.orderStatus, sel.value, sel);
        });
      });
      listEl.querySelectorAll('[data-order-whats]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var order = ORDERS_BY_ID[btn.dataset.orderWhats];
          if (!order) return;
          var select = listEl.querySelector('[data-order-status="' + order.id + '"]');
          openWhatsAppStatus(order, select ? select.value : order.status);
        });
      });
    });
  }

  // Telefone do cliente (convidado ou cadastrado) já no formato que o
  // WhatsApp aceita no link (com DDI 55 na frente).
  function customerPhoneOf(order) {
    var raw = order.guest_phone || (order.profiles && order.profiles.phone) || '';
    var digits = String(raw).replace(/\D/g, '');
    if (!digits) return null;
    return digits.length <= 11 ? '55' + digits : digits;
  }

  // Abre o WhatsApp com a mensagem do status já escrita pro celular do
  // cliente; o dono só confere e clica em enviar. Não existe envio
  // automático sem integração paga (WhatsApp Business API), então isso é
  // feito com um clique a mais.
  function openWhatsAppStatus(order, status) {
    var phone = customerPhoneOf(order);
    var msg = STATUS_WHATSAPP_MESSAGE[status];
    if (!phone || !msg) return;
    var text = encodeURIComponent('Garage Burger: ' + msg);
    window.open('https://wa.me/' + phone + '?text=' + text, '_blank');
  }

  function orderCardHtml(order) {
    var items = (order.items || []).map(function (it) {
      return '<div class="admin-order__item">' + esc((it.qty || 1) + 'x ' + it.name) + '</div>';
    }).join('');
    var options = ORDER_STATUSES.map(function (st) {
      return '<option value="' + st + '"' + (st === order.status ? ' selected' : '') + '>' + STATUS_LABEL[st] + '</option>';
    }).join('');
    var contato = order.guest_name || order.guest_phone
      ? esc([order.guest_name, order.guest_phone].filter(Boolean).join(' · '))
      : (order.profile_id ? 'Cliente cadastrado' : 'Convidado');
    var entrega = order.tipo_entrega === 'retirada'
      ? 'Retirada no local'
      : esc(order.endereco_completo || order.bairro || '');
    var whatsBtn = customerPhoneOf(order)
      ? '<button type="button" class="admin-menu__btn admin-order__whats" data-order-whats="' + order.id + '" title="Avisar cliente no WhatsApp">📲 Avisar</button>'
      : '';
    return '<div class="admin-order">' +
      '<div class="admin-order__head">' +
        '<span class="admin-order__date">' + formatDate(order.created_at) + '</span>' +
        '<div class="admin-order__head-actions">' +
          whatsBtn +
          '<select class="admin-order__status-select" data-order-status="' + order.id + '">' + options + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="admin-order__meta">' +
        '<span>' + contato + '</span>' +
        '<span>' + esc(order.payment_method) + (order.troco_para ? ' · troco p/ ' + esc(order.troco_para) : '') + '</span>' +
      '</div>' +
      '<div class="admin-order__meta"><span>📍 ' + entrega + '</span></div>' +
      '<div class="admin-order__items">' + items + '</div>' +
      '<div class="admin-order__foot">' +
        (order.discount > 0 ? '<span class="admin-order__discount">Desconto: ' + formatBRL(order.discount) + '</span>' : '') +
        '<span class="admin-order__total">' + formatBRL(order.total) + '</span>' +
      '</div>' +
    '</div>';
  }

  function updateOrderStatus(id, status, sel) {
    sel.disabled = true;
    sb.from('orders').update({ status: status }).eq('id', id).then(function (res) {
      sel.disabled = false;
      if (res.error) { alert('Não deu pra atualizar o status: ' + res.error.message); return; }
      var order = ORDERS_BY_ID[id];
      if (order) {
        order.status = status;
        // Tenta abrir o WhatsApp na hora; se o navegador bloquear o popup
        // (pode acontecer, já que isso roda depois de uma chamada de rede),
        // o botão "📲 Avisar" no card do pedido manda a mesma mensagem.
        openWhatsAppStatus(order, status);
      }
    });
  }

  // ---------- Categorias ----------
  function loadCategories() {
    return sb.from('menu_categories').select('*').order('sort_order').then(function (res) {
      CATEGORIES = res.data || [];
      var sel = document.getElementById('item-category');
      sel.innerHTML = CATEGORIES.map(function (c) {
        return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
      }).join('');
    });
  }

  // Gera um slug (usado como âncora no site) a partir do nome da categoria.
  var ACCENT_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
  function slugify(text) {
    return text.toLowerCase()
      .normalize('NFD').replace(ACCENT_MARKS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ---------- Modal de categorias ----------
  var catModal = document.getElementById('cat-modal');

  function openCatModal() {
    document.getElementById('cat-feedback').textContent = '';
    document.getElementById('cat-form').reset();
    catModal.classList.add('is-open');
    catModal.setAttribute('aria-hidden', 'false');
    renderCatList();
  }

  function closeCatModal() {
    catModal.classList.remove('is-open');
    catModal.setAttribute('aria-hidden', 'true');
  }

  function renderCatList() {
    var listEl = document.getElementById('cat-list');
    listEl.innerHTML = CATEGORIES.map(function (cat) {
      return '<div class="admin-cat" data-cat="' + cat.id + '">' +
        '<input class="admin-form__input admin-cat__sort" type="number" step="1" value="' + (cat.sort_order || 0) + '" aria-label="Ordem">' +
        '<input class="admin-form__input admin-cat__name" type="text" value="' + esc(cat.name) + '" aria-label="Nome">' +
        '<button type="button" class="admin-menu__btn admin-menu__btn--edit" data-cat-save="' + cat.id + '">Salvar</button>' +
        '<button type="button" class="admin-menu__btn" data-cat-del="' + cat.id + '">Excluir</button>' +
      '</div>';
    }).join('') || '<p class="admin__empty">Nenhuma categoria ainda.</p>';

    listEl.querySelectorAll('[data-cat-save]').forEach(function (btn) {
      btn.addEventListener('click', function () { saveCat(btn.dataset.catSave, btn); });
    });
    listEl.querySelectorAll('[data-cat-del]').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteCat(btn.dataset.catDel); });
    });
  }

  function saveCat(id, btn) {
    var row = btn.closest('.admin-cat');
    var name = row.querySelector('.admin-cat__name').value.trim();
    var sort = parseInt(row.querySelector('.admin-cat__sort').value, 10) || 0;
    if (!name) return;
    btn.disabled = true;
    sb.from('menu_categories').update({ name: name, sort_order: sort }).eq('id', id).then(function (res) {
      btn.disabled = false;
      if (res.error) { alert('Erro: ' + res.error.message); return; }
      loadCategories().then(function () { renderCatList(); loadMenu(); });
    });
  }

  function deleteCat(id) {
    if (!confirm('Excluir essa categoria? (só funciona se ela estiver vazia)')) return;
    sb.from('menu_categories').delete().eq('id', id).then(function (res) {
      if (res.error) {
        if (/foreign key/i.test(res.error.message)) {
          alert('Essa categoria tem itens. Mova ou exclua os itens dela primeiro.');
        } else {
          alert('Erro: ' + res.error.message);
        }
        return;
      }
      loadCategories().then(function () { renderCatList(); loadMenu(); });
    });
  }

  function wireCatModal() {
    document.getElementById('cat-modal-close').addEventListener('click', closeCatModal);
    document.getElementById('cat-modal-overlay').addEventListener('click', closeCatModal);

    document.getElementById('cat-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var feedback = document.getElementById('cat-feedback');
      var name = document.getElementById('cat-name').value.trim();
      var sort = parseInt(document.getElementById('cat-sort').value, 10) || 0;
      if (!name) { feedback.textContent = 'Digite o nome da categoria.'; return; }
      var slug = slugify(name);
      if (!slug) { feedback.textContent = 'Nome inválido, use letras ou números.'; return; }
      feedback.textContent = 'Salvando…';
      sb.from('menu_categories').insert({ slug: slug, name: name, sort_order: sort }).then(function (res) {
        if (res.error) {
          feedback.textContent = /duplicate|unique/i.test(res.error.message)
            ? 'Já existe uma categoria com esse nome.'
            : 'Erro: ' + res.error.message;
          return;
        }
        document.getElementById('cat-form').reset();
        feedback.textContent = 'Categoria criada ✓';
        loadCategories().then(function () { renderCatList(); loadMenu(); });
      });
    });
  }

  // ---------- Cardápio ----------
  function loadMenu() {
    var listEl = document.getElementById('menu-list');
    listEl.innerHTML = '<p class="admin__empty">Carregando…</p>';
    sb.from('menu_items').select('*').order('sort_order').then(function (res) {
      if (res.error) {
        listEl.innerHTML = '<p class="admin__empty">Erro ao carregar cardápio.</p>';
        return;
      }
      var items = res.data || [];
      if (!items.length) {
        listEl.innerHTML = '<p class="admin__empty">Nenhum item cadastrado.</p>';
        return;
      }
      // Agrupa por categoria, na ordem das categorias.
      var html = '';
      CATEGORIES.forEach(function (cat) {
        var catItems = items.filter(function (it) { return it.category_id === cat.id; });
        if (!catItems.length) return;
        html += '<h3 class="admin-menu__cat">' + esc(cat.name) + '</h3>';
        html += '<div class="admin-menu__grid">' + catItems.map(menuRowHtml).join('') + '</div>';
      });
      listEl.innerHTML = html;
      listEl.querySelectorAll('[data-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openItemModal(items.filter(function (it) { return it.id === btn.dataset.edit; })[0]);
        });
      });
      listEl.querySelectorAll('[data-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          toggleAvailable(items.filter(function (it) { return it.id === btn.dataset.toggle; })[0]);
        });
      });
    });
  }

  function menuRowHtml(item) {
    return '<div class="admin-menu__item' + (item.is_available ? '' : ' is-off') + '">' +
      '<div class="admin-menu__item-info">' +
        '<span class="admin-menu__item-name">' + esc(item.name) + '</span>' +
        '<span class="admin-menu__item-price">' + formatBRL(item.price) + '</span>' +
      '</div>' +
      '<div class="admin-menu__item-actions">' +
        '<button type="button" class="admin-menu__btn" data-toggle="' + esc(item.id) + '">' + (item.is_available ? 'Ocultar' : 'Mostrar') + '</button>' +
        '<button type="button" class="admin-menu__btn admin-menu__btn--edit" data-edit="' + esc(item.id) + '">Editar</button>' +
      '</div>' +
    '</div>';
  }

  function toggleAvailable(item) {
    sb.from('menu_items').update({ is_available: !item.is_available, updated_at: new Date().toISOString() }).eq('id', item.id).then(function (res) {
      if (res.error) { alert('Erro: ' + res.error.message); return; }
      loadMenu();
    });
  }

  // ---------- Modal de item ----------
  var itemModal = document.getElementById('item-modal');

  function openItemModal(item) {
    document.getElementById('item-feedback').textContent = '';
    document.getElementById('item-image-status').textContent = '';
    var title = document.getElementById('item-modal-title');
    var idInput = document.getElementById('item-id');
    var delBtn = document.getElementById('item-delete');

    if (item) {
      title.textContent = 'Editar item';
      document.getElementById('item-id-original').value = item.id;
      idInput.value = item.id;
      idInput.disabled = true;   // ID é chave; não deixa trocar num item existente
      document.getElementById('item-category').value = item.category_id;
      document.getElementById('item-name').value = item.name || '';
      document.getElementById('item-description').value = item.description || '';
      document.getElementById('item-price').value = item.price;
      document.getElementById('item-sort').value = item.sort_order || 0;
      document.getElementById('item-image').value = item.image_url || '';
      document.getElementById('item-variant').value = item.image_variant || '';
      document.getElementById('item-customizable').checked = !!item.is_customizable;
      document.getElementById('item-available').checked = item.is_available;
      updateItemPreview(item.image_url);
      delBtn.style.display = 'inline-flex';
    } else {
      title.textContent = 'Novo item';
      document.getElementById('item-id-original').value = '';
      idInput.value = '';
      idInput.disabled = false;
      document.getElementById('item-form').reset();
      document.getElementById('item-available').checked = true;
      if (CATEGORIES.length) document.getElementById('item-category').value = CATEGORIES[0].id;
      updateItemPreview('');
      delBtn.style.display = 'none';
    }

    itemModal.classList.add('is-open');
    itemModal.setAttribute('aria-hidden', 'false');
  }

  function closeItemModal() {
    itemModal.classList.remove('is-open');
    itemModal.setAttribute('aria-hidden', 'true');
  }

  function wireItemModal() {
    document.getElementById('item-modal-close').addEventListener('click', closeItemModal);
    document.getElementById('item-modal-overlay').addEventListener('click', closeItemModal);

    document.getElementById('item-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var feedback = document.getElementById('item-feedback');
      var customizable = document.getElementById('item-customizable').checked;
      var payload = {
        id: document.getElementById('item-id').value.trim(),
        category_id: document.getElementById('item-category').value,
        name: document.getElementById('item-name').value.trim(),
        description: document.getElementById('item-description').value.trim() || null,
        price: parseFloat(document.getElementById('item-price').value),
        image_url: document.getElementById('item-image').value.trim() || null,
        image_variant: document.getElementById('item-variant').value || null,
        is_customizable: customizable,
        custom_type: customizable ? 'hamburguer' : null,
        is_available: document.getElementById('item-available').checked,
        sort_order: parseInt(document.getElementById('item-sort').value, 10) || 0,
        updated_at: new Date().toISOString()
      };
      if (!payload.id || !payload.name || isNaN(payload.price)) {
        feedback.textContent = 'Preencha ID, nome e preço.';
        return;
      }
      feedback.textContent = 'Salvando…';
      var original = document.getElementById('item-id-original').value;
      var query = original
        ? sb.from('menu_items').update(payload).eq('id', original)
        : sb.from('menu_items').insert(payload);
      query.then(function (res) {
        if (res.error) {
          feedback.textContent = 'Erro: ' + res.error.message;
          return;
        }
        closeItemModal();
        loadMenu();
      });
    });

    document.getElementById('item-delete').addEventListener('click', function () {
      var original = document.getElementById('item-id-original').value;
      if (!original) return;
      if (!confirm('Excluir esse item do cardápio? Isso não afeta pedidos antigos.')) return;
      sb.from('menu_items').delete().eq('id', original).then(function (res) {
        if (res.error) {
          document.getElementById('item-feedback').textContent = 'Erro: ' + res.error.message;
          return;
        }
        closeItemModal();
        loadMenu();
      });
    });
  }

  // ---------- Status da loja ----------
  function loadStore() {
    sb.from('store_status').select('*').eq('id', 1).single().then(function (res) {
      var s = res.data;
      if (!s) return;
      document.getElementById('store-open').checked = s.is_open;
      document.getElementById('store-hours').value = s.hours_text || '';
      document.getElementById('store-closed-message').value = s.closed_message || '';
    });
  }

  function wireStoreForm() {
    document.getElementById('store-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var feedback = document.getElementById('store-feedback');
      feedback.textContent = 'Salvando…';
      sb.from('store_status').update({
        is_open: document.getElementById('store-open').checked,
        hours_text: document.getElementById('store-hours').value.trim() || null,
        closed_message: document.getElementById('store-closed-message').value.trim() || 'Estamos fechados no momento. Volte mais tarde!',
        updated_at: new Date().toISOString()
      }).eq('id', 1).then(function (res) {
        feedback.textContent = res.error ? ('Erro: ' + res.error.message) : 'Salvo ✓';
      });
    });
  }

  // ---------- Banner de promoção ----------
  function loadPromo() {
    sb.from('promo_banner').select('*').eq('id', 1).single().then(function (res) {
      var p = res.data;
      if (!p) return;
      document.getElementById('promo-active').checked = p.is_active;
      document.getElementById('promo-image').value = p.image_url || '';
      document.getElementById('promo-alt').value = p.alt_text || '';
      updatePromoPreview(p.image_url);
    });
    document.getElementById('promo-image').addEventListener('input', function (e) {
      updatePromoPreview(e.target.value.trim());
    });
  }

  function updatePromoPreview(url) {
    var preview = document.getElementById('promo-preview');
    if (url) {
      preview.src = url;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }

  function wirePromoForm() {
    document.getElementById('promo-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var feedback = document.getElementById('promo-feedback');
      feedback.textContent = 'Salvando…';
      sb.from('promo_banner').update({
        is_active: document.getElementById('promo-active').checked,
        image_url: document.getElementById('promo-image').value.trim() || null,
        alt_text: document.getElementById('promo-alt').value.trim() || null,
        updated_at: new Date().toISOString()
      }).eq('id', 1).then(function (res) {
        feedback.textContent = res.error ? ('Erro: ' + res.error.message) : 'Salvo ✓';
      });
    });
  }
})();
