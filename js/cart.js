const WHATSAPP_NUMBER = '5571999841726';
const CIDADE = 'São Sebastião do Passé';

const ADDONS = [
  { name: 'Queijo', price: 3.00 },
  { name: 'Bacon', price: 3.00 },
  { name: 'Blend', price: 6.00 },
];

// Bairros atendidos e taxa de entrega (mesma lista usada no delivery da
// cidade). Selecionar um bairro já soma a taxa no total do pedido.
const BAIRROS = [
  { nome: 'Agostinho Amaral', taxa: 7 },
  { nome: 'Alegre de Baixo', taxa: 7 },
  { nome: 'Alegre de Cima', taxa: 8 },
  { nome: 'Após o Centro de Abastecimento', taxa: 8 },
  { nome: 'Araçatiba (antes do condomínio)', taxa: 9 },
  { nome: 'Araçatiba (Minha Casa Minha Vida)', taxa: 9 },
  { nome: 'Brasília', taxa: 8 },
  { nome: 'Brasília (Rua dos Loucos)', taxa: 8 },
  { nome: 'Centro', taxa: 7 },
  { nome: 'Centro de Abastecimento', taxa: 7 },
  { nome: 'Conceição', taxa: 8 },
  { nome: 'Humildes', taxa: 7 },
  { nome: 'Irmã Dulce', taxa: 7 },
  { nome: 'Jaime Menezes', taxa: 7 },
  { nome: 'Jangada (Minha Casa Minha Vida)', taxa: 8 },
  { nome: 'Júlio Silva', taxa: 7 },
  { nome: 'Malhada', taxa: 7 },
  { nome: 'Mario Cruz', taxa: 7 },
  { nome: 'Patrício Dórea', taxa: 8 },
  { nome: 'Penão', taxa: 7 },
  { nome: 'Rua do Colégio Polivalente', taxa: 7 },
  { nome: 'Rua Eutiquio de Lima (antes do condomínio)', taxa: 7 },
  { nome: 'São Roque', taxa: 7 },
  { nome: 'Urbis I', taxa: 7 },
  { nome: 'Urbis II', taxa: 7 },
  { nome: 'Urbis III', taxa: 7 },
  { nome: 'Urbis IV', taxa: 7 },
  { nome: 'Vivendas do Passé', taxa: 7 },
];

const cart = new Map(); // nome -> { price, qty }

let selectedPayment = null;
let addonProduct = null; // { name, price } do hambúrguer sendo personalizado
let deliveryMode = 'entrega'; // 'entrega' | 'retirada'
let usePoints = false; // resgatar pontos de fidelidade no pedido

function formatPrice(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function onlyDigits(value) {
  return (value || '').replace(/\D/g, '');
}

function isLoggedIn() {
  return !!(window.BH && window.BH.auth && window.BH.auth.getUser && window.BH.auth.getUser());
}

function getProfile() {
  return window.BH && window.BH.auth && window.BH.auth.getProfile ? window.BH.auth.getProfile() : null;
}

function getLoyaltyPoints() {
  const profile = getProfile();
  return profile ? (profile.loyalty_points || 0) : 0;
}

function isStoreClosed() {
  const status = window.BH && window.BH.storeStatus;
  return !!(status && status.is_open === false);
}

function getCustomerName() {
  const profile = getProfile();
  if (profile && profile.full_name) return profile.full_name;
  return document.getElementById('customerName').value.trim();
}

function getCustomerPhone() {
  const profile = getProfile();
  if (profile && profile.phone) return profile.phone;
  return document.getElementById('customerPhone').value.trim();
}

function getEnderecoCompleto() {
  const rua = document.getElementById('ruaInput').value.trim();
  const numero = document.getElementById('numeroInput').value.trim();
  const complemento = document.getElementById('complementoInput').value.trim();
  const referencia = document.getElementById('referenciaInput').value.trim();
  const bairro = document.getElementById('bairroSelect').value;
  const partes = [];
  if (rua) partes.push(rua + (numero ? `, ${numero}` : ''));
  if (bairro) partes.push(bairro);
  partes.push(CIDADE);
  if (complemento) partes.push(`Compl.: ${complemento}`);
  if (referencia) partes.push(`Ref.: ${referencia}`);
  return partes.join(' - ');
}

function getTotals() {
  let totalItems = 0;
  let subtotal = 0;
  cart.forEach(({ price, qty }) => {
    totalItems += qty;
    subtotal += price * qty;
  });

  const bairroSelect = document.getElementById('bairroSelect');
  const selectedBairro = BAIRROS.find((b) => b.nome === bairroSelect.value);
  const deliveryFee = deliveryMode === 'retirada' ? 0 : (selectedBairro ? selectedBairro.taxa : null);

  // Fidelidade: 20 pontos = R$ 1 de desconto. Nunca resgata mais do que o
  // valor do próprio pedido nem mais do que o saldo — o servidor
  // (place_order) recalcula tudo de novo antes de gravar.
  let pointsToUse = 0;
  if (usePoints) {
    const maxByOrder = Math.floor(subtotal + (deliveryFee || 0));
    const maxByBalance = Math.floor(getLoyaltyPoints() / 20);
    pointsToUse = Math.min(maxByOrder, maxByBalance) * 20;
  }
  const discount = pointsToUse / 20;

  const totalPrice = Math.max(subtotal + (deliveryFee || 0) - discount, 0);

  return { totalItems, subtotal, deliveryFee, pointsToUse, discount, totalPrice };
}

function setQty(name, price, qty) {
  qty = Math.max(0, qty);
  if (qty === 0) {
    cart.delete(name);
  } else {
    cart.set(name, { price, qty });
  }
  renderQtyBox(name);
  renderCartPanel();
}

/* Dish card qty stepper
   O cardápio pode ser inserido no DOM depois deste script (ele vem do
   Supabase de forma assíncrona, via menu.js). Por isso os cliques nos
   botões são tratados por delegação de evento (um listener só, no
   document, lá embaixo em "Wiring") em vez de um listener por botão — daí
   não importa quando o card do prato aparece na página. */

function renderQtyBoxContent(box) {
  const name = box.dataset.name;
  const qty = cart.get(name)?.qty || 0;

  if (qty <= 0) {
    box.innerHTML = '<button class="add-btn" type="button">+ Adicionar</button>';
    return;
  }

  box.innerHTML = `
    <button class="qty-btn minus" type="button" aria-label="Diminuir">−</button>
    <span class="qty-value">${qty}</span>
    <button class="qty-btn plus" type="button" aria-label="Aumentar">+</button>
  `;
}

// Atualiza todo box .qty-box que representa este prato (pode aparecer em
// mais de uma seção, ex: "Mais Pedidos" + a categoria dele).
function renderQtyBox(name) {
  document.querySelectorAll('.qty-box').forEach((box) => {
    if (box.dataset.name === name) renderQtyBoxContent(box);
  });
}

// Preenche o conteúdo inicial ("+ Adicionar") de todo .qty-box presente no
// DOM agora. Chamado no carregamento e de novo sempre que o cardápio
// dinâmico termina de renderizar (evento 'bh:menu-rendered').
function renderAllQtyBoxes() {
  document.querySelectorAll('.qty-box').forEach(renderQtyBoxContent);
}

/* Addon modal (personalização do hambúrguer) */

const addonModal = document.getElementById('addonModal');
const addonList = document.getElementById('addonList');

function openAddonModal(name, price) {
  addonProduct = { name, price };
  document.getElementById('addonProductName').textContent = name;

  addonList.innerHTML = '';
  ADDONS.forEach((addon) => {
    const label = document.createElement('label');
    label.className = 'addon-item';
    label.innerHTML = `
      <span class="addon-item-label">${addon.name}<span>+ ${formatPrice(addon.price)}</span></span>
      <input type="checkbox" data-addon-name="${addon.name}" data-addon-price="${addon.price}">
    `;
    label.querySelector('input').addEventListener('change', updateAddonTotal);
    addonList.appendChild(label);
  });

  updateAddonTotal();
  addonModal.hidden = false;
}

function closeAddonModal() {
  addonModal.hidden = true;
  addonProduct = null;
}

function getSelectedAddons() {
  return Array.from(addonList.querySelectorAll('input:checked')).map((input) => ({
    name: input.dataset.addonName,
    price: parseFloat(input.dataset.addonPrice),
  }));
}

function updateAddonTotal() {
  const addonsTotal = getSelectedAddons().reduce((sum, a) => sum + a.price, 0);
  document.getElementById('addonTotalValue').textContent = formatPrice(addonProduct.price + addonsTotal);
}

document.getElementById('addonCloseBtn').addEventListener('click', closeAddonModal);
document.getElementById('addonBackdrop').addEventListener('click', closeAddonModal);

document.getElementById('addonConfirmBtn').addEventListener('click', () => {
  if (!addonProduct) return;
  const addons = getSelectedAddons();
  const finalName = addons.length
    ? `${addonProduct.name} (${addons.map((a) => a.name).join(', ')})`
    : addonProduct.name;
  const finalPrice = addonProduct.price + addons.reduce((sum, a) => sum + a.price, 0);
  const existingQty = cart.get(finalName)?.qty || 0;

  setQty(finalName, finalPrice, existingQty + 1);
  closeAddonModal();
});

/* Dados do cliente / login */

function updateAccountUI() {
  const fieldsEl = document.getElementById('customerFields');
  const greetingEl = document.getElementById('customerGreeting');
  if (!fieldsEl || !greetingEl) return;

  if (isLoggedIn()) {
    fieldsEl.hidden = true;
    greetingEl.hidden = false;
    const profile = getProfile();
    const firstName = profile && profile.full_name ? profile.full_name.split(' ')[0] : 'cliente';
    const points = profile ? (profile.loyalty_points || 0) : 0;
    greetingEl.textContent = `Olá, ${firstName}! Você tem ${points} pontos.`;
  } else {
    fieldsEl.hidden = false;
    greetingEl.hidden = true;
  }
}

const loginLink = document.getElementById('loginLink');
if (loginLink) {
  loginLink.addEventListener('click', (event) => {
    event.preventDefault();
    if (window.BH.auth && window.BH.auth.openModal) window.BH.auth.openModal();
  });
}

/* Cart panel */

function renderCartPanel() {
  updateAccountUI();

  const itemsEl = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('subtotalValue');
  const feeEl = document.getElementById('deliveryFeeValue');
  const discountRowEl = document.getElementById('discountRow');
  const discountEl = document.getElementById('discountValue');
  const totalEl = document.getElementById('cartTotalValue');
  const badgeEl = document.getElementById('cartBadge');
  const loyaltySection = document.getElementById('loyaltySection');
  const loyaltyLabel = document.getElementById('loyaltyLabel');
  const loyaltyCheckbox = document.getElementById('loyaltyCheckbox');
  const closedNote = document.getElementById('closedNote');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');
  const { totalItems, subtotal, deliveryFee, pointsToUse, discount, totalPrice } = getTotals();

  if (cart.size === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Seu carrinho está vazio.</p>';
  } else {
    itemsEl.innerHTML = '';
    cart.forEach(({ price, qty }, name) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${name}</div>
          <div class="cart-item-price">${formatPrice(price)}</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn minus" type="button" aria-label="Diminuir">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn plus" type="button" aria-label="Aumentar">+</button>
        </div>
      `;
      row.querySelector('.minus').addEventListener('click', () => setQty(name, price, qty - 1));
      row.querySelector('.plus').addEventListener('click', () => setQty(name, price, qty + 1));
      itemsEl.appendChild(row);
    });
  }

  subtotalEl.textContent = formatPrice(subtotal);

  if (deliveryMode === 'retirada') {
    feeEl.textContent = 'Grátis (retirada)';
  } else if (deliveryFee === null) {
    feeEl.textContent = 'Selecione o bairro';
  } else {
    feeEl.textContent = formatPrice(deliveryFee);
  }

  // Caixa "usar meus pontos": só aparece logado, com saldo que renda pelo
  // menos R$ 1 e com item no carrinho.
  const points = getLoyaltyPoints();
  if (loyaltySection) {
    if (isLoggedIn() && points >= 20 && cart.size > 0) {
      loyaltySection.hidden = false;
      const usable = Math.min(Math.floor(subtotal + (deliveryFee || 0)), Math.floor(points / 20)) * 20;
      loyaltyLabel.textContent = `Usar ${usable} pontos (${formatPrice(usable / 20)} de desconto). Saldo: ${points}`;
    } else {
      loyaltySection.hidden = true;
      usePoints = false;
      if (loyaltyCheckbox) loyaltyCheckbox.checked = false;
    }
  }

  if (discountRowEl) {
    discountRowEl.hidden = discount <= 0;
    if (discount > 0) discountEl.textContent = '- ' + formatPrice(discount);
  }

  totalEl.textContent = formatPrice(totalPrice);

  if (totalItems > 0) {
    badgeEl.textContent = totalItems;
    badgeEl.hidden = false;
  } else {
    badgeEl.hidden = true;
  }

  if (closedNote) {
    if (isStoreClosed()) {
      const status = window.BH.storeStatus;
      closedNote.textContent = status.closed_message || 'Estamos fechados no momento. Volte mais tarde!';
      closedNote.hidden = false;
    } else {
      closedNote.hidden = true;
    }
  }

  checkoutBtn.disabled = cart.size === 0 || isStoreClosed();
}

function buildWhatsAppMessage() {
  const { subtotal, deliveryFee, pointsToUse, discount, totalPrice } = getTotals();
  const lines = ['*Pedido - Garage Burger*', ''];

  cart.forEach(({ price, qty }, name) => {
    lines.push(`${qty}x ${name} - ${formatPrice(price * qty)}`);
  });

  lines.push('');

  const name = getCustomerName();
  const phone = getCustomerPhone();
  if (name) lines.push(`Nome: ${name}`);
  if (phone) lines.push(`Celular: ${phone}`);

  lines.push('');

  if (deliveryMode === 'retirada') {
    lines.push('*Retirada no local*');
  } else {
    lines.push('*Entrega*');
    const bairroSelect = document.getElementById('bairroSelect');
    const bairro = bairroSelect.value;
    const rua = document.getElementById('ruaInput').value.trim();
    const numero = document.getElementById('numeroInput').value.trim();
    const complemento = document.getElementById('complementoInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();

    if (bairro) lines.push(`Bairro: ${bairro}`);
    if (rua) lines.push(`Rua: ${rua}${numero ? `, ${numero}` : ''}`);
    if (complemento) lines.push(`Complemento: ${complemento}`);
    if (referencia) lines.push(`Referência: ${referencia}`);
  }

  lines.push('');
  lines.push(`Subtotal: ${formatPrice(subtotal)}`);
  lines.push(`Taxa de entrega: ${deliveryMode === 'retirada' ? 'Grátis (retirada)' : (deliveryFee === null ? 'não selecionada' : formatPrice(deliveryFee))}`);
  if (discount > 0) {
    lines.push(`Desconto (${pointsToUse} pontos): -${formatPrice(discount)}`);
  }
  lines.push(`*Total: ${formatPrice(totalPrice)}*`);

  if (selectedPayment) {
    lines.push(`Pagamento: ${selectedPayment}`);
    if (selectedPayment === 'Dinheiro') {
      const troco = document.getElementById('trocoInput').value.trim();
      if (troco) lines.push(`Troco para: ${troco}`);
    }
  }

  return lines.join('\n');
}

// Grava o pedido no Supabase (histórico do cliente, painel do dono e
// pontos). Roda em segundo plano: o WhatsApp já abriu na hora do clique,
// então se qualquer coisa aqui falhar, o pedido não fica travado.
//
// Se o cliente não está logado mas digitou uma senha, cria a conta ANTES
// de gravar o pedido, pra esse primeiro pedido já contar pontos pra ele.
function recordOrder() {
  const sb = window.BH && window.BH.supabase;
  if (!sb) return;

  const nome = document.getElementById('customerName').value.trim();
  const telefone = document.getElementById('customerPhone').value.trim();
  const senha = document.getElementById('customerPassword').value;

  let pre = Promise.resolve();
  if (!isLoggedIn() && senha && window.BH.auth && window.BH.auth.signUpAtCheckout) {
    pre = window.BH.auth.signUpAtCheckout({ name: nome, phone: telefone, password: senha })
      .then((r) => {
        if (!r.ok && r.jaExiste) {
          console.info('[Garage] Esse celular já tem conta; pedido segue sem criar outra.');
        }
      })
      .catch(() => {});
  }

  const { subtotal, deliveryFee, pointsToUse } = getTotals();
  const bairroSelect = document.getElementById('bairroSelect');
  const trocoInput = document.getElementById('trocoInput');

  pre.then(() => {
    const items = Array.from(cart.entries()).map(([itemName, { price, qty }]) => ({ name: itemName, price, qty }));
    return sb.rpc('place_order', {
      p_items: items,
      p_tipo_entrega: deliveryMode,
      p_bairro: deliveryMode === 'entrega' ? bairroSelect.value : null,
      p_endereco_completo: deliveryMode === 'entrega' ? getEnderecoCompleto() : null,
      p_payment_method: selectedPayment,
      p_troco_para: selectedPayment === 'Dinheiro' && trocoInput.value.trim() ? trocoInput.value.trim() : null,
      p_subtotal: Math.round(subtotal * 100) / 100,
      p_delivery_fee: deliveryFee || 0,
      p_points_used: pointsToUse,
      p_guest_name: nome || null,
      p_guest_phone: onlyDigits(telefone) || null,
    });
  }).then((res) => {
    if (res && res.error) {
      console.warn('[Garage] Pedido não registrado no sistema (WhatsApp segue valendo):', res.error.message);
      return;
    }
    document.getElementById('customerPassword').value = '';
    usePoints = false;
    const loyaltyCheckbox = document.getElementById('loyaltyCheckbox');
    if (loyaltyCheckbox) loyaltyCheckbox.checked = false;
    if (window.BH.auth && window.BH.auth.refreshProfile) window.BH.auth.refreshProfile();
  });
}

/* Wiring */

renderAllQtyBoxes();
document.addEventListener('bh:menu-rendered', renderAllQtyBoxes);

// Delegação: um clique em qualquer .qty-box (do cardápio inteiro, mesmo o
// que ainda nem existia quando a página carregou) é resolvido aqui.
document.addEventListener('click', (event) => {
  const box = event.target.closest('.qty-box');
  if (!box) return;

  const name = box.dataset.name;
  const price = parseFloat(box.dataset.price);
  const qty = cart.get(name)?.qty || 0;

  if (event.target.closest('.add-btn')) {
    if (box.dataset.customizable === 'true') {
      openAddonModal(name, price);
    } else {
      setQty(name, price, 1);
    }
  } else if (event.target.closest('.minus')) {
    setQty(name, price, qty - 1);
  } else if (event.target.closest('.plus')) {
    setQty(name, price, qty + 1);
  }
});

const cartToggle = document.getElementById('cartToggle');
const cartPanel = document.getElementById('cartPanel');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartCloseBtn = document.getElementById('cartCloseBtn');

function openCart() {
  cartPanel.hidden = false;
  cartBackdrop.hidden = false;
}

function closeCart() {
  cartPanel.hidden = true;
  cartBackdrop.hidden = true;
}

// API mínima pro account.js usar no "Pedir de novo".
window.BH = window.BH || {};
window.BH.cart = {
  addRaw: (item) => {
    const existingQty = cart.get(item.name)?.qty || 0;
    setQty(item.name, item.price, existingQty + (item.qty || 1));
  },
  openDrawer: () => openCart(),
};

cartToggle.addEventListener('click', () => {
  if (cartPanel.hidden) openCart(); else closeCart();
});

cartCloseBtn.addEventListener('click', closeCart);
cartBackdrop.addEventListener('click', closeCart);

document.querySelectorAll('.payment-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedPayment = btn.dataset.payment;
    document.querySelectorAll('.payment-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.getElementById('trocoSection').hidden = selectedPayment !== 'Dinheiro';
  });
});

document.querySelectorAll('.delivery-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    deliveryMode = btn.dataset.mode;
    document.querySelectorAll('.delivery-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.getElementById('deliveryFields').hidden = deliveryMode === 'retirada';
    renderCartPanel();
  });
});

// Popula o select de bairros a partir da lista real de entrega e lembra a
// última escolha (não precisa selecionar de novo em toda visita).
const bairroSelect = document.getElementById('bairroSelect');
const BAIRRO_STORAGE_KEY = 'garage_bairro';
BAIRROS.forEach((bairro) => {
  const opt = document.createElement('option');
  opt.value = bairro.nome;
  opt.textContent = `${bairro.nome} — ${formatPrice(bairro.taxa)}`;
  bairroSelect.appendChild(opt);
});
const savedBairro = localStorage.getItem(BAIRRO_STORAGE_KEY);
if (savedBairro) bairroSelect.value = savedBairro;
bairroSelect.addEventListener('change', () => {
  localStorage.setItem(BAIRRO_STORAGE_KEY, bairroSelect.value);
  renderCartPanel();
});

// Nome, celular e endereço ficam salvos no navegador pra não redigitar
// tudo de novo em todo pedido.
[
  { id: 'customerName', key: 'garage_nome' },
  { id: 'customerPhone', key: 'garage_telefone' },
  { id: 'ruaInput', key: 'garage_rua' },
  { id: 'numeroInput', key: 'garage_numero' },
  { id: 'complementoInput', key: 'garage_complemento' },
  { id: 'referenciaInput', key: 'garage_referencia' },
].forEach(({ id, key }) => {
  const input = document.getElementById(id);
  if (!input) return;
  const saved = localStorage.getItem(key);
  if (saved) input.value = saved;
  input.addEventListener('input', () => localStorage.setItem(key, input.value));
});

const loyaltyCheckbox = document.getElementById('loyaltyCheckbox');
if (loyaltyCheckbox) {
  loyaltyCheckbox.addEventListener('change', () => {
    usePoints = loyaltyCheckbox.checked;
    renderCartPanel();
  });
}

document.getElementById('cartCheckoutBtn').addEventListener('click', () => {
  if (cart.size === 0) return;
  if (isStoreClosed()) return;

  if (deliveryMode === 'entrega' && !bairroSelect.value) {
    bairroSelect.focus();
    return;
  }
  const ruaInput = document.getElementById('ruaInput');
  if (deliveryMode === 'entrega' && !ruaInput.value.trim()) {
    ruaInput.focus();
    return;
  }
  const numeroInput = document.getElementById('numeroInput');
  if (deliveryMode === 'entrega' && !numeroInput.value.trim()) {
    numeroInput.focus();
    return;
  }
  if (!selectedPayment) return;

  // Se vai criar conta (senha preenchida e não logado), nome e celular
  // válidos são obrigatórios.
  const senhaInput = document.getElementById('customerPassword');
  if (!isLoggedIn() && senhaInput.value) {
    const nomeInput = document.getElementById('customerName');
    const phoneInput = document.getElementById('customerPhone');
    if (!nomeInput.value.trim()) {
      nomeInput.focus();
      return;
    }
    if (onlyDigits(phoneInput.value).length < 10) {
      phoneInput.focus();
      return;
    }
    if (senhaInput.value.length < 6) {
      senhaInput.focus();
      return;
    }
  }

  // Monta a mensagem ANTES do recordOrder resetar o resgate de pontos.
  const text = encodeURIComponent(buildWhatsAppMessage());
  recordOrder();
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
});

// Login/logout muda saldo de pontos e dados salvos; status da loja muda o
// checkout.
document.addEventListener('bh:auth-change', renderCartPanel);
document.addEventListener('bh:store-status', renderCartPanel);

renderCartPanel();
