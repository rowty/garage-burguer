/* Painel "Minha conta" do cliente logado: dados do perfil, endereço salvo,
   saldo de pontos, histórico de pedidos e "pedir de novo".
   Aberto pelo auth.js (window.BH.account.open) quando o usuário já está
   logado e clica no botão de conta no header. */
(function () {
  var sb = window.BH ? window.BH.supabase : null;

  var modal = document.getElementById('account-modal');
  var overlay = document.getElementById('account-modal-overlay');
  var closeBtn = document.getElementById('account-modal-close');
  var bodyEl = document.getElementById('account-modal-body');
  var adminLink = document.getElementById('account-admin-link');

  window.BH = window.BH || {};
  window.BH.account = { open: openPanel };

  if (!sb || !modal) return;

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
    } catch (e) {
      return iso;
    }
  }

  var STATUS_LABEL = {
    novo: 'Recebido', preparando: 'Preparando', saiu: 'Saiu pra entrega',
    entregue: 'Entregue', cancelado: 'Cancelado'
  };

  function openPanel() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    renderPanel();
  }

  function closePanel() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (overlay) overlay.addEventListener('click', closePanel);

  function renderPanel() {
    var profile = window.BH.auth.getProfile();
    var user = window.BH.auth.getUser();
    if (!profile || !user) {
      bodyEl.innerHTML = '<p class="account__empty">Faça login pra ver sua conta.</p>';
      return;
    }

    // O link só existe depois que o painel do dono (/admin) for publicado;
    // até lá o guard abaixo simplesmente não faz nada.
    if (adminLink) adminLink.style.display = profile.is_owner ? 'inline-flex' : 'none';

    bodyEl.innerHTML =
      '<div class="account__points">' +
        '<span class="account__points-value">' + (profile.loyalty_points || 0) + '</span>' +
        '<span class="account__points-label">pontos de fidelidade · ' + formatBRL((profile.loyalty_points || 0) / 20) + ' em desconto</span>' +
      '</div>' +

      '<form class="account__form" id="account-profile-form">' +
        '<h4 class="account__section-title">Meus dados</h4>' +
        '<label class="account__label">Nome' +
          '<input class="account__input" id="account-name" type="text" value="' + esc(profile.full_name) + '" required>' +
        '</label>' +
        '<label class="account__label">Telefone' +
          '<input class="account__input" id="account-phone" type="tel" value="' + esc(profile.phone) + '" placeholder="(71) 99999-9999">' +
        '</label>' +
        '<button type="submit" class="btn btn-solid account__save">Salvar dados</button>' +
        '<span class="account__feedback" id="account-profile-feedback"></span>' +
      '</form>' +

      '<form class="account__form" id="account-address-form">' +
        '<h4 class="account__section-title">Endereço salvo</h4>' +
        '<label class="account__label">Bairro' +
          '<input class="account__input" id="account-addr-bairro" type="text" placeholder="Ex: Centro">' +
        '</label>' +
        '<div class="account__field-row">' +
          '<label class="account__label account__label--grow">Rua' +
            '<input class="account__input" id="account-addr-rua" type="text" placeholder="Nome da rua">' +
          '</label>' +
          '<label class="account__label account__label--num">Nº' +
            '<input class="account__input" id="account-addr-numero" type="text" placeholder="Nº">' +
          '</label>' +
        '</div>' +
        '<label class="account__label">Complemento' +
          '<input class="account__input" id="account-addr-complemento" type="text" placeholder="Opcional">' +
        '</label>' +
        '<label class="account__label">Referência' +
          '<input class="account__input" id="account-addr-referencia" type="text" placeholder="Opcional">' +
        '</label>' +
        '<button type="submit" class="btn btn-solid account__save">Salvar endereço</button>' +
        '<span class="account__feedback" id="account-address-feedback"></span>' +
      '</form>' +

      '<div class="account__orders">' +
        '<div class="account__orders-head">' +
          '<h4 class="account__section-title">Meus pedidos</h4>' +
          '<button type="button" class="account__orders-refresh" id="account-orders-refresh">↻ Atualizar</button>' +
        '</div>' +
        '<div id="account-orders-stats"></div>' +
        '<div id="account-orders-list"><p class="account__empty">Carregando…</p></div>' +
      '</div>' +

      '<button type="button" class="account__logout" id="account-logout">Sair da conta</button>';

    wireProfileForm();
    wireAddressForm();
    loadOrders();
    document.getElementById('account-orders-refresh').addEventListener('click', loadOrders);

    document.getElementById('account-logout').addEventListener('click', function () {
      window.BH.auth.signOut();
      closePanel();
    });
  }

  var EM_ANDAMENTO = { novo: true, preparando: true, saiu: true };

  function orderNumero(order) {
    return order.id ? order.id.replace(/-/g, '').slice(0, 6).toUpperCase() : '------';
  }

  function statsHtml(orders) {
    var entregues = orders.filter(function (o) { return o.status === 'entregue'; }).length;
    var andamento = orders.filter(function (o) { return EM_ANDAMENTO[o.status]; }).length;
    return '<div class="account-stats">' +
      '<div class="account-stat">' +
        '<span class="account-stat__value">' + orders.length + '</span>' +
        '<span class="account-stat__label">Total de pedidos</span>' +
      '</div>' +
      '<div class="account-stat">' +
        '<span class="account-stat__value account-stat__value--ok">' + entregues + '</span>' +
        '<span class="account-stat__label">Entregues</span>' +
      '</div>' +
      '<div class="account-stat">' +
        '<span class="account-stat__value account-stat__value--pending">' + andamento + '</span>' +
        '<span class="account-stat__label">Em andamento</span>' +
      '</div>' +
    '</div>';
  }

  function wireProfileForm() {
    var form = document.getElementById('account-profile-form');
    var feedback = document.getElementById('account-profile-feedback');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var user = window.BH.auth.getUser();
      feedback.textContent = 'Salvando…';
      sb.from('profiles').update({
        full_name: document.getElementById('account-name').value.trim(),
        phone: document.getElementById('account-phone').value.trim()
      }).eq('id', user.id).then(function (res) {
        if (res.error) {
          feedback.textContent = 'Erro ao salvar.';
          return;
        }
        feedback.textContent = 'Dados salvos ✓';
        window.BH.auth.refreshProfile();
      });
    });
  }

  function wireAddressForm() {
    var form = document.getElementById('account-address-form');
    var feedback = document.getElementById('account-address-feedback');
    var user = window.BH.auth.getUser();

    // Carrega o endereço padrão (se existir) pros campos.
    sb.from('addresses').select('*').eq('profile_id', user.id).order('is_default', { ascending: false }).limit(1).then(function (res) {
      var addr = res.data && res.data[0];
      if (!addr) return;
      form.dataset.addressId = addr.id;
      document.getElementById('account-addr-bairro').value = addr.bairro || '';
      document.getElementById('account-addr-rua').value = addr.rua || '';
      document.getElementById('account-addr-numero').value = addr.numero || '';
      document.getElementById('account-addr-complemento').value = addr.complemento || '';
      document.getElementById('account-addr-referencia').value = addr.referencia || '';
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      feedback.textContent = 'Salvando…';
      var payload = {
        profile_id: user.id,
        bairro: document.getElementById('account-addr-bairro').value.trim(),
        rua: document.getElementById('account-addr-rua').value.trim(),
        numero: document.getElementById('account-addr-numero').value.trim(),
        complemento: document.getElementById('account-addr-complemento').value.trim() || null,
        referencia: document.getElementById('account-addr-referencia').value.trim() || null,
        is_default: true
      };
      if (!payload.bairro || !payload.rua || !payload.numero) {
        feedback.textContent = 'Preencha bairro, rua e número.';
        return;
      }
      var existingId = form.dataset.addressId;
      var query = existingId
        ? sb.from('addresses').update(payload).eq('id', existingId)
        : sb.from('addresses').insert(payload).select().single();
      query.then(function (res) {
        if (res.error) {
          feedback.textContent = 'Erro ao salvar.';
          return;
        }
        if (res.data && res.data.id) form.dataset.addressId = res.data.id;
        feedback.textContent = 'Endereço salvo ✓';
      });
    });
  }

  function loadOrders() {
    var listEl = document.getElementById('account-orders-list');
    var statsEl = document.getElementById('account-orders-stats');
    var user = window.BH.auth.getUser();
    statsEl.innerHTML = '';
    listEl.innerHTML = '<p class="account__empty">Carregando…</p>';
    sb.from('orders').select('*').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(20).then(function (res) {
      if (res.error) {
        listEl.innerHTML = '<p class="account__empty">Erro ao carregar pedidos.</p>';
        return;
      }
      var orders = res.data || [];
      if (!orders.length) {
        listEl.innerHTML = '<p class="account__empty">Você ainda não fez pedidos por aqui.</p>';
        return;
      }
      statsEl.innerHTML = statsHtml(orders);
      listEl.innerHTML = orders.map(orderCardHtml).join('');
      listEl.querySelectorAll('[data-repeat]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          repeatOrder(orders[parseInt(btn.dataset.repeat, 10)]);
        });
      });
      listEl.querySelectorAll('[data-details]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var details = document.getElementById('account-order-details-' + btn.dataset.details);
          var isOpen = details.classList.toggle('is-open');
          btn.textContent = isOpen ? 'Ocultar detalhes' : 'Ver detalhes';
        });
      });
    });
  }

  function orderCardHtml(order, index) {
    var itemsText = (order.items || []).map(function (it) {
      return esc((it.qty || 1) + 'x ' + it.name);
    }).join('<br>');
    var enderecoText = order.tipo_entrega === 'retirada'
      ? 'Retirada no local'
      : esc(order.endereco_completo || order.bairro || '');
    var cancelNote = order.status === 'novo'
      ? '<div class="account-order__cancel-note">Para cancelar este pedido, entre em contato com o estabelecimento. Cancelamento disponível apenas antes da preparação.</div>'
      : '';
    return '<div class="account-order">' +
      '<div class="account-order__head">' +
        '<span class="account-order__numero">PEDIDO-' + orderNumero(order) + '</span>' +
        '<span class="account-order__status account-order__status--' + esc(order.status) + '">' + (STATUS_LABEL[order.status] || order.status) + '</span>' +
      '</div>' +
      '<div class="account-order__meta">' +
        '<span>' + formatDate(order.created_at) + '</span>' +
        '<span class="account-order__total">' + formatBRL(order.total) + '</span>' +
      '</div>' +
      '<div class="account-order__endereco">' + enderecoText + '</div>' +
      '<div class="account-order__foot">' +
        '<button type="button" class="account-order__details-btn" data-details="' + index + '">Ver detalhes</button>' +
        '<button type="button" class="account-order__repeat" data-repeat="' + index + '">Pedir de novo</button>' +
      '</div>' +
      '<div class="account-order__details" id="account-order-details-' + index + '">' +
        '<div class="account-order__items">' + itemsText + '</div>' +
        '<div class="account-order__breakdown">' +
          '<span>Subtotal: ' + formatBRL(order.subtotal) + '</span>' +
          (order.delivery_fee ? '<span>Entrega: ' + formatBRL(order.delivery_fee) + '</span>' : '') +
          (order.discount ? '<span>Desconto: -' + formatBRL(order.discount) + '</span>' : '') +
          '<span>Pagamento: ' + esc(order.payment_method) + '</span>' +
        '</div>' +
      '</div>' +
      cancelNote +
    '</div>';
  }

  // Repõe o carrinho com os itens do pedido antigo (mesmo nome/preço
  // gravados na hora, mesmo que o cardápio tenha mudado desde então).
  function repeatOrder(order) {
    if (!window.BH.cart || !order.items) return;
    order.items.forEach(function (it) {
      window.BH.cart.addRaw({ name: it.name, price: it.price, qty: it.qty || 1 });
    });
    closePanel();
    window.BH.cart.openDrawer();
  }
})();
