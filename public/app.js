let products = [];

const cartStorageKey = 'daymarkCartItems';
const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR'
});

function formatPrice(priceCents) {
  return priceFormatter.format(priceCents / 100);
}

function getCartItemCount(items) {
  return Object.values(items).reduce((count, quantity) => count + quantity, 0);
}

function loadCartItems() {
  const savedCart = sessionStorage.getItem(cartStorageKey);
  if (!savedCart) {
    return {};
  }

  const items = JSON.parse(savedCart);
  if (!items || Array.isArray(items) || typeof items !== 'object') {
    throw new Error('Saved cart has an invalid format.');
  }

  Object.entries(items).forEach(([productId, quantity]) => {
    const productExists = products.some((product) => product.id === productId);
    if (!productExists || !Number.isSafeInteger(quantity) || quantity < 1) {
      throw new Error('Saved cart contains an invalid product or quantity.');
    }
  });

  if (!Number.isSafeInteger(getCartItemCount(items))) {
    throw new Error('Saved cart contains too many items.');
  }

  return items;
}

function initializeCart() {
  try {
    cartContents = loadCartItems();
    if (!sessionStorage.getItem(cartStorageKey)) {
      const savedCount = Number(sessionStorage.getItem('daymarkCartCount'));
      if (Number.isSafeInteger(savedCount) && savedCount > 0) {
        legacyCartCount = savedCount;
      }
    }
  } catch (error) {
    console.error('Could not load the saved cart:', error);
    cartLoadError = 'Your saved cart could not be read. Clear this tab’s session storage and try again.';
  }

  itemCount = getCartItemCount(cartContents);
  updateCartCount();
}

const productList = document.getElementById('product-list');
const productDetails = document.getElementById('product-detail');
const cartCount = document.getElementById('cart-count');
const cartPage = document.getElementById('cart-page');
const cartItemList = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const cartTotalCount = document.getElementById('cart-total-count');
const cartTotalPrice = document.getElementById('cart-total-price');
const checkoutSection = document.getElementById('checkout-section');
const orderForm = document.getElementById('order-form');
const orderMessage = document.getElementById('order-message');
const orderReceipt = document.getElementById('order-receipt');
const orderReceiptId = document.getElementById('order-receipt-id');
const orderReceiptItems = document.getElementById('order-receipt-items');
const orderReceiptTotal = document.getElementById('order-receipt-total');
const categoryButtons = document.querySelectorAll('.filter-button');
const categoryDropdown = document.querySelector('.category-dropdown');
const productSearch = document.getElementById('product-search');
const categories = ['All', 'Sports', 'Fashion', 'Electronics', 'Home & Living', 'Beauty', 'Accessories'];
const requestedCategory = new URLSearchParams(window.location.search).get('category');
const requestedProductId = new URLSearchParams(window.location.search).get('id');

let cartContents = {};
let cartLoadError = '';
let legacyCartCount = 0;
let itemCount = 0;
let selectedCategory = categories.includes(requestedCategory) ? requestedCategory : 'All';
const showAllLinks = document.querySelectorAll('[data-show-all]');

function createProductImage(product, imageClass) {
  const imageArea = document.createElement('div');
  imageArea.className = 'product-image-area';
  const image = document.createElement('img');
  image.className = imageClass;
  image.src = product.imageUrl;
  image.alt = product.imageAlt;
  image.loading = 'lazy';

  const imageFallback = document.createElement('p');
  imageFallback.className = 'image-fallback';
  imageFallback.textContent = 'Product photo is unavailable.';
  imageFallback.hidden = true;

  image.addEventListener('error', () => {
    image.hidden = true;
    imageFallback.hidden = false;
  });

  imageArea.append(image, imageFallback);
  return imageArea;
}

function addItemToCart(productId, quantity, quantityInput, feedback) {
  if (quantityInput && !quantityInput.reportValidity()) {
    return false;
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    if (quantityInput) {
      quantityInput.setCustomValidity('Enter a whole number of 1 or more.');
      quantityInput.reportValidity();
    } else {
      feedback.textContent = 'Enter a whole number of 1 or more.';
    }
    return false;
  }

  if (cartLoadError) {
    feedback.textContent = cartLoadError;
    return false;
  }

  const product = products.find((item) => item.id === productId);
  const nextQuantity = (cartContents[productId] || 0) + quantity;
  const nextCart = { ...cartContents, [productId]: nextQuantity };
  const nextItemCount = getCartItemCount(nextCart);

  if (!product || !Number.isSafeInteger(nextQuantity) || !Number.isSafeInteger(nextItemCount)) {
    feedback.textContent = 'That quantity is too large for the cart.';
    return false;
  }

  try {
    sessionStorage.setItem(cartStorageKey, JSON.stringify(nextCart));
  } catch (error) {
    console.error('Could not save the cart:', error);
    feedback.textContent = 'Could not save your cart in this browser.';
    return false;
  }

  cartContents = nextCart;
  itemCount = nextItemCount;
  updateCartCount();
  feedback.textContent = `${product.name} added to your cart (${quantity}).`;
  return true;
}

function updateCartCount() {
  if (cartCount) {
    cartCount.textContent = cartLoadError ? '!' : String(itemCount);
  }
}

function createCartFeedback() {
  const feedback = document.createElement('p');
  feedback.className = 'cart-action-message';
  feedback.setAttribute('aria-live', 'polite');
  return feedback;
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';

  const detailsLink = document.createElement('a');
  detailsLink.className = 'product-details-link';
  detailsLink.href = `product.html?id=${encodeURIComponent(product.id)}&category=${encodeURIComponent(selectedCategory)}`;
  detailsLink.append(createProductImage(product, 'product-image'));

  const category = document.createElement('p');
  category.className = 'product-category';
  category.textContent = product.category;
  detailsLink.append(category);

  const name = document.createElement('h3');
  name.textContent = product.name;
  detailsLink.append(name);

  const description = document.createElement('p');
  description.className = 'product-description';
  description.textContent = product.description;
  detailsLink.append(description);

  const price = document.createElement('p');
  price.className = 'price';
  price.textContent = formatPrice(product.priceCents);
  detailsLink.append(price);

  const viewDetails = document.createElement('a');
  viewDetails.className = 'view-details-button';
  viewDetails.href = detailsLink.href;
  viewDetails.textContent = 'View Details';

  card.append(detailsLink, viewDetails);
  return card;
}

function createPurchaseControls(product) {
  const controls = document.createElement('div');
  controls.className = 'product-purchase-controls';

  const heading = document.createElement('h3');
  heading.className = 'purchase-heading';
  heading.textContent = 'Order Details';

  const quantityField = document.createElement('label');
  quantityField.className = 'quantity-field';
  quantityField.htmlFor = `${product.id}-quantity`;

  const quantityLabel = document.createElement('span');
  quantityLabel.className = 'quantity-label';
  quantityLabel.textContent = 'Quantity';

  const quantityInput = document.createElement('input');
  quantityInput.className = 'product-quantity';
  quantityInput.id = `${product.id}-quantity`;
  quantityInput.type = 'number';
  quantityInput.min = '1';
  quantityInput.step = '1';
  quantityInput.value = '1';
  quantityInput.required = true;
  quantityInput.setAttribute('aria-label', `Quantity for ${product.name}`);
  quantityInput.addEventListener('input', () => {
    quantityInput.setCustomValidity('');
  });
  quantityField.append(quantityLabel, quantityInput);

  const addButton = document.createElement('button');
  addButton.className = 'add-to-cart';
  addButton.type = 'button';
  addButton.textContent = 'Add to Cart';
  const feedback = createCartFeedback();
  addButton.addEventListener('click', () => {
    addItemToCart(product.id, Number(quantityInput.value), quantityInput, feedback);
  });

  const checkoutButton = document.createElement('button');
  checkoutButton.className = 'continue-to-checkout';
  checkoutButton.type = 'button';
  checkoutButton.textContent = 'Continue to Checkout';
  checkoutButton.addEventListener('click', () => {
    window.location.href = 'cart.html';
  });

  controls.append(heading, quantityField, addButton, checkoutButton, feedback);
  return controls;
}

function showProducts() {
  productList.replaceChildren();

  const searchTerm = productSearch ? productSearch.value.trim().toLowerCase() : '';
  const visibleProducts = products.filter((product) => (
    (selectedCategory === 'All' || product.category === selectedCategory)
    && `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(searchTerm)
  ));

  if (visibleProducts.length === 0) {
    const message = document.createElement('p');
    message.className = 'product-not-found';
    message.textContent = 'No products match your search. Try another word or category.';
    productList.append(message);
    return;
  }

  visibleProducts.forEach((product) => {
    productList.append(createProductCard(product));
  });
}

function selectCategory(category) {
  selectedCategory = category;

  categoryButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.category === category);
  });

  if (categoryDropdown) {
    categoryDropdown.open = false;
  }
  showProducts();
}

function renderProductDetails() {
  const product = products.find((item) => item.id === requestedProductId);
  const backToShop = document.getElementById('back-to-shop');

  if (backToShop && categories.includes(requestedCategory)) {
    backToShop.href = `index.html?category=${encodeURIComponent(requestedCategory)}#shop`;
  }

  if (!product) {
    const message = document.createElement('p');
    message.className = 'product-not-found';
    message.textContent = 'This product could not be found. Return to the shop to choose another one.';
    productDetails.replaceChildren(message);
    document.title = 'Product Not Found | Snapcart';
    return;
  }

  document.title = `${product.name} | Snapcart`;

  const information = document.createElement('div');
  information.className = 'product-detail-info';

  const category = document.createElement('p');
  category.className = 'product-category';
  category.textContent = product.category;

  const name = document.createElement('h2');
  name.textContent = product.name;

  const description = document.createElement('p');
  description.className = 'product-detail-description';
  description.textContent = product.description;

  const price = document.createElement('p');
  price.className = 'product-detail-price';
  price.textContent = formatPrice(product.priceCents);

  information.append(category, name, description, price, createPurchaseControls(product));
  productDetails.replaceChildren(createProductImage(product, 'product-image detail-image'), information);
}

function renderCart() {
  cartItemList.replaceChildren();

  if (cartLoadError) {
    const message = document.createElement('p');
    message.className = 'cart-error';
    message.textContent = cartLoadError;
    cartItemList.append(message);
    cartTotal.hidden = true;
    checkoutSection.hidden = true;
    return;
  }

  const productsInCart = products.filter((product) => cartContents[product.id]);
  if (productsInCart.length === 0) {
    const message = document.createElement('p');
    message.className = 'cart-empty-state';
    if (legacyCartCount > 0) {
      const itemWord = legacyCartCount === 1 ? 'item' : 'items';
      message.append(
        `Your previous cart counted ${legacyCartCount} ${itemWord}, but did not save product names. Add those products again. `
      );
    } else {
      message.append('Your cart is empty. ');
    }

    const shopLink = document.createElement('a');
    shopLink.href = 'index.html#shop';
    shopLink.textContent = 'Browse the shop';
    message.append(shopLink);

    cartItemList.append(message);
    cartTotal.hidden = true;
    checkoutSection.hidden = true;
    return;
  }

  let subtotalCents = 0;

  productsInCart.forEach((product) => {
    const quantity = cartContents[product.id];
    const lineTotalCents = product.priceCents * quantity;
    subtotalCents += lineTotalCents;

    const item = document.createElement('article');
    item.className = 'cart-item';

    const productLink = document.createElement('a');
    productLink.className = 'cart-item-product';
    productLink.href = `product.html?id=${encodeURIComponent(product.id)}&category=${encodeURIComponent(product.category)}`;
    productLink.append(createProductImage(product, 'cart-item-image'));

    const productInfo = document.createElement('div');
    const category = document.createElement('p');
    category.className = 'product-category';
    category.textContent = product.category;

    const name = document.createElement('h3');
    name.textContent = product.name;
    productInfo.append(category, name);
    productLink.append(productInfo);

    const itemValues = document.createElement('div');
    itemValues.className = 'cart-item-values';
    [
      ['Unit price', formatPrice(product.priceCents)],
      ['Quantity', String(quantity)],
      ['Subtotal', formatPrice(lineTotalCents)]
    ].forEach(([label, value]) => {
      const valueText = document.createElement('p');
      valueText.textContent = `${label}: ${value}`;
      itemValues.append(valueText);
    });

    const itemActions = document.createElement('div');
    itemActions.className = 'cart-item-actions';

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-from-cart';
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove ${product.name} from cart`);
    removeButton.addEventListener('click', () => removeCartItem(product.id));

    itemActions.append(itemValues, removeButton);
    item.append(productLink, itemActions);
    cartItemList.append(item);
  });

  cartTotalCount.textContent = String(itemCount);
  cartTotalPrice.textContent = formatPrice(subtotalCents);
  cartTotal.hidden = false;
  checkoutSection.hidden = false;
}

function removeCartItem(productId) {
  const nextCart = { ...cartContents };
  delete nextCart[productId];

  try {
    sessionStorage.setItem(cartStorageKey, JSON.stringify(nextCart));
  } catch (error) {
    console.error('Could not remove the cart item:', error);
    const message = document.createElement('p');
    message.className = 'cart-error';
    message.textContent = 'Could not remove this product from your cart.';
    cartItemList.prepend(message);
    return;
  }

  cartContents = nextCart;
  itemCount = getCartItemCount(cartContents);
  updateCartCount();
  renderCart();
}

function showOrderMessage(text, isError) {
  orderMessage.textContent = text;
  orderMessage.classList.toggle('error', isError);
  orderMessage.classList.toggle('success', !isError);
}

function renderOrderReceipt(order) {
  orderReceiptId.textContent = String(order.orderId);
  orderReceiptItems.replaceChildren();

  const items = Array.isArray(order.items) ? order.items : [];
  items.forEach((item) => {
    const receiptItem = document.createElement('li');
    receiptItem.className = 'order-receipt-item';

    const name = document.createElement('h3');
    name.textContent = item.name;

    const quantity = document.createElement('p');
    quantity.textContent = `Quantity: ${item.quantity}`;

    const unitPrice = document.createElement('p');
    unitPrice.textContent = `Price per item: ${formatPrice(item.unitPriceCents)}`;

    const lineTotal = document.createElement('p');
    lineTotal.className = 'order-receipt-line-total';
    lineTotal.textContent = `Line total: ${formatPrice(item.lineTotalCents)}`;

    receiptItem.append(name, quantity, unitPrice, lineTotal);
    orderReceiptItems.append(receiptItem);
  });

  orderReceiptTotal.textContent = formatPrice(order.totalCents);
  orderReceipt.hidden = false;
}

function prepareOrderReceipt(order, requestedItems) {
  if (!order || order.orderId == null) {
    throw new Error('The order was saved, but the server did not return an order number.');
  }

  const responseItems = Array.isArray(order.items) ? order.items : [];
  const receiptItems = requestedItems.map((requestedItem, index) => {
    const product = products.find((item) => item.id === requestedItem.productId);
    if (!product) {
      throw new Error('The order was saved, but a product could not be added to the receipt.');
    }

    const responseItem = responseItems[index] || {};
    const quantity = Number.isSafeInteger(responseItem.quantity)
      ? responseItem.quantity
      : requestedItem.quantity;
    const unitPriceCents = Number.isSafeInteger(responseItem.unitPriceCents)
      ? responseItem.unitPriceCents
      : product.priceCents;
    const lineTotalCents = Number.isSafeInteger(responseItem.lineTotalCents)
      ? responseItem.lineTotalCents
      : unitPriceCents * quantity;

    return {
      name: typeof responseItem.name === 'string' ? responseItem.name : product.name,
      quantity,
      unitPriceCents,
      lineTotalCents
    };
  });

  const calculatedTotalCents = receiptItems.reduce((total, item) => total + item.lineTotalCents, 0);
  const totalCents = Number.isSafeInteger(order.totalCents)
    ? order.totalCents
    : calculatedTotalCents;

  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error('The order was saved, but its total could not be shown.');
  }

  return { orderId: order.orderId, items: receiptItems, totalCents };
}

async function submitOrder(event) {
  event.preventDefault();

  const submitButton = orderForm.querySelector('button[type="submit"]');
  const items = Object.entries(cartContents).map(([productId, quantity]) => ({
    productId,
    quantity
  }));

  if (!orderForm.reportValidity() || items.length === 0) {
    return;
  }

  orderReceipt.hidden = true;
  submitButton.disabled = true;

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: orderForm.elements.customerName.value,
        customerEmail: orderForm.elements.customerEmail.value,
        shippingAddress: orderForm.elements.shippingAddress.value,
        items
      })
    });

    const result = await response.json();
    if (!response.ok || result.success !== true) {
      throw new Error(result.message || 'Your order could not be saved.');
    }

    const receiptOrder = prepareOrderReceipt(result, items);
    renderOrderReceipt(receiptOrder);

    cartContents = {};
    itemCount = 0;
    legacyCartCount = 0;

    try {
      sessionStorage.removeItem(cartStorageKey);
    } catch (error) {
      console.error('The order was saved, but the cart could not be cleared:', error);
      cartLoadError = 'Your order was saved, but the cart could not be cleared from this browser tab.';
    }

    updateCartCount();
    renderCart();
    orderForm.reset();
    showOrderMessage(result.message || `Order ${receiptOrder.orderId} was saved successfully.`, false);
  } catch (error) {
    console.error('Could not submit the order:', error);
    showOrderMessage(error.message || 'Could not submit your order. Please try again.', true);
  } finally {
    submitButton.disabled = false;
  }
}

function showProductLoadError(error) {
  console.error('Could not load products from SQLite:', error);
  const message = document.createElement('p');
  message.className = 'product-not-found';
  message.textContent = 'Could not load products from the database. Make sure the Express server is running and refresh the page.';

  if (productList) {
    productList.replaceChildren(message.cloneNode(true));
  }
  if (productDetails) {
    productDetails.replaceChildren(message.cloneNode(true));
  }
  if (cartPage) {
    cartItemList.replaceChildren(message.cloneNode(true));
    cartTotal.hidden = true;
    checkoutSection.hidden = true;
  }
  if (cartCount) {
    cartCount.textContent = '!';
  }
}

async function startStore() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error(`The product request failed with status ${response.status}.`);
    }

    const loadedProducts = await response.json();
    if (!Array.isArray(loadedProducts)) {
      throw new Error('The product response has an invalid format.');
    }

    products = loadedProducts.map((product) => {
      const legacyPrice = typeof product.price === 'string'
        ? Number(product.price.replace(/[^\d.]/g, ''))
        : NaN;
      const legacyPriceCents = legacyPrice * 100;
      const priceCents = Number.isSafeInteger(product.priceCents)
        ? product.priceCents
        : legacyPriceCents;

      if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
        throw new Error('A product has an invalid price.');
      }

      return { ...product, priceCents };
    });
  } catch (error) {
    showProductLoadError(error);
    return;
  }

  initializeCart();

  if (productList) {
    if (productSearch) {
      productSearch.addEventListener('input', showProducts);
    }

    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        selectCategory(button.dataset.category);
        categoryDropdown.querySelector('summary').focus();
      });
    });

    showAllLinks.forEach((link) => {
      link.addEventListener('click', () => {
        selectCategory('All');
      });
    });

    document.addEventListener('click', (event) => {
      if (categoryDropdown.open && !categoryDropdown.contains(event.target)) {
        categoryDropdown.open = false;
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && categoryDropdown.open) {
        categoryDropdown.open = false;
        categoryDropdown.querySelector('summary').focus();
      }
    });

    selectCategory(selectedCategory);
  }

  if (productDetails) {
    renderProductDetails();
  }

  if (cartPage) {
    renderCart();
  }

  if (orderForm) {
    orderForm.addEventListener('submit', submitOrder);
  }
}

startStore();
