const WHATSAPP_NUMBER = '5571999841726';

const ADDONS = [
  { name: 'Queijo', price: 3.00 },
  { name: 'Bacon', price: 3.00 },
  { name: 'Blend', price: 6.00 },
];

const cart = new Map(); // nome -> { price, qty }

let selectedPayment = null;
let addonProduct = null; // { name, price } do hambúrguer sendo personalizado
let deliveryMode = 'entrega'; // 'entrega' | 'retirada'

function formatPrice(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function getTotals() {
  let totalItems = 0;
  let subtotal = 0;
  cart.forEach(({ price, qty }) => {
    totalItems += qty;
    subtotal += price * qty;
  });

  const bairroSelect = document.getElementById('bairroSelect');
  const selectedOption = bairroSelect.options[bairroSelect.selectedIndex];
  const feeRaw = selectedOption ? selectedOption.dataset.fee : '';
  const deliveryFee = deliveryMode === 'retirada' ? 0 : (feeRaw ? parseFloat(feeRaw) : null);

  const totalPrice = subtotal + (deliveryFee || 0);

  return { totalItems, subtotal, deliveryFee, totalPrice };
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

/* Cart panel */

function renderCartPanel() {
  const itemsEl = document.getElementById('cartItems');
  const subtotalEl = document.getElementById('subtotalValue');
  const feeEl = document.getElementById('deliveryFeeValue');
  const totalEl = document.getElementById('cartTotalValue');
  const badgeEl = document.getElementById('cartBadge');
  const { totalItems, subtotal, deliveryFee, totalPrice } = getTotals();

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

  totalEl.textContent = formatPrice(totalPrice);

  if (totalItems > 0) {
    badgeEl.textContent = totalItems;
    badgeEl.hidden = false;
  } else {
    badgeEl.hidden = true;
  }
}

function buildWhatsAppMessage() {
  const { subtotal, deliveryFee, totalPrice } = getTotals();
  const lines = ['*Pedido - Garage Burger*', ''];

  cart.forEach(({ price, qty }, name) => {
    lines.push(`${qty}x ${name} - ${formatPrice(price * qty)}`);
  });

  lines.push('');

  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
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

document.getElementById('bairroSelect').addEventListener('change', renderCartPanel);

document.getElementById('cartCheckoutBtn').addEventListener('click', () => {
  if (cart.size === 0) return;
  const text = encodeURIComponent(buildWhatsAppMessage());
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
});

renderCartPanel();
