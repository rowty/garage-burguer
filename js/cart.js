// TODO: substituir pelo número real do WhatsApp do negócio (DDI + DDD + número, só dígitos)
const WHATSAPP_NUMBER = '5500000000000';

const ADDONS = [
  { name: 'Queijo', price: 3.00 },
  { name: 'Bacon', price: 3.00 },
  { name: 'Blend', price: 6.00 },
];

const cart = new Map(); // nome -> { price, qty }
const qtyBoxes = new Map(); // nome -> lista de elementos .qty-box (o mesmo prato pode aparecer em mais de uma seção)

let selectedPayment = null;
let addonProduct = null; // { name, price } do hambúrguer sendo personalizado

function formatPrice(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function getTotals() {
  let totalItems = 0;
  let totalPrice = 0;
  cart.forEach(({ price, qty }) => {
    totalItems += qty;
    totalPrice += price * qty;
  });
  return { totalItems, totalPrice };
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

/* Dish card qty stepper */

function renderQtyBox(name) {
  const boxes = qtyBoxes.get(name);
  if (!boxes) return;
  const qty = cart.get(name)?.qty || 0;

  boxes.forEach((box) => {
    const price = parseFloat(box.dataset.price);

    if (qty <= 0) {
      box.innerHTML = '<button class="add-btn" type="button">+ Adicionar</button>';
      if (box.dataset.customizable === 'true') {
        box.querySelector('.add-btn').addEventListener('click', () => openAddonModal(name, price));
      } else {
        box.querySelector('.add-btn').addEventListener('click', () => setQty(name, price, 1));
      }
      return;
    }

    box.innerHTML = `
      <button class="qty-btn minus" type="button" aria-label="Diminuir">−</button>
      <span class="qty-value">${qty}</span>
      <button class="qty-btn plus" type="button" aria-label="Aumentar">+</button>
    `;
    box.querySelector('.minus').addEventListener('click', () => setQty(name, price, qty - 1));
    box.querySelector('.plus').addEventListener('click', () => setQty(name, price, qty + 1));
  });
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
  const totalEl = document.getElementById('cartTotalValue');
  const badgeEl = document.getElementById('cartBadge');
  const { totalItems, totalPrice } = getTotals();

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

  totalEl.textContent = formatPrice(totalPrice);

  if (totalItems > 0) {
    badgeEl.textContent = totalItems;
    badgeEl.hidden = false;
  } else {
    badgeEl.hidden = true;
  }
}

function buildWhatsAppMessage() {
  const { totalPrice } = getTotals();
  const lines = ['*Pedido - Garage Burger*', ''];

  cart.forEach(({ price, qty }, name) => {
    lines.push(`${qty}x ${name} - ${formatPrice(price * qty)}`);
  });

  lines.push('');
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

document.querySelectorAll('.qty-box').forEach((box) => {
  const name = box.dataset.name;
  if (!qtyBoxes.has(name)) qtyBoxes.set(name, []);
  qtyBoxes.get(name).push(box);
});

qtyBoxes.forEach((_, name) => renderQtyBox(name));

const cartToggle = document.getElementById('cartToggle');
const cartPanel = document.getElementById('cartPanel');
const cartCloseBtn = document.getElementById('cartCloseBtn');

cartToggle.addEventListener('click', () => {
  cartPanel.hidden = !cartPanel.hidden;
});

cartCloseBtn.addEventListener('click', () => {
  cartPanel.hidden = true;
});

document.querySelectorAll('.payment-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedPayment = btn.dataset.payment;
    document.querySelectorAll('.payment-btn').forEach((b) => b.classList.toggle('active', b === btn));
    document.getElementById('trocoSection').hidden = selectedPayment !== 'Dinheiro';
  });
});

document.getElementById('cartCheckoutBtn').addEventListener('click', () => {
  if (cart.size === 0) return;
  const text = encodeURIComponent(buildWhatsAppMessage());
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
});

renderCartPanel();
