const express = require('express');
const path = require('path');
const { databaseReady, databasePath } = require('./database');

const app = express();
const port = 3000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

databaseReady.then((database) => {
  app.get('/api/products', (req, res) => {
    const rows = database.all(`
      SELECT id, name, price_cents, description, category, image_url, image_alt
      FROM products
      ORDER BY rowid
    `);

    const products = rows.map((product) => ({
      id: product.id,
      name: product.name,
      priceCents: product.price_cents,
      description: product.description,
      category: product.category,
      imageUrl: product.image_url,
      imageAlt: product.image_alt
    }));

    res.json(products);
  });

  app.post('/api/orders', (req, res) => {
    const body = req.body || {};
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
    const shippingAddress = typeof body.shippingAddress === 'string' ? body.shippingAddress.trim() : '';
    const items = body.items;

    if (!customerName || customerName.length > 100) {
      return res.status(400).json({ success: false, message: 'Enter a name up to 100 characters long.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || customerEmail.length > 254) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    if (!shippingAddress || shippingAddress.length > 500) {
      return res.status(400).json({ success: false, message: 'Enter an address up to 500 characters long.' });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return res.status(400).json({ success: false, message: 'Your order must contain at least one product.' });
    }

    const orderItems = [];
    let totalCents = 0;

    for (const item of items) {
      if (
        !item
        || typeof item.productId !== 'string'
        || !Number.isSafeInteger(item.quantity)
        || item.quantity < 1
      ) {
        return res.status(400).json({ success: false, message: 'An order item has an invalid product or quantity.' });
      }

      const product = database.get(
        'SELECT id, name, price_cents FROM products WHERE id = ?',
        [item.productId]
      );
      if (!product) {
        return res.status(400).json({ success: false, message: 'A product in your cart could not be found.' });
      }

      const lineTotal = product.price_cents * item.quantity;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(totalCents + lineTotal)) {
        return res.status(400).json({ success: false, message: 'The order total is too large.' });
      }

      orderItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPriceCents: product.price_cents,
        lineTotalCents: lineTotal
      });
      totalCents += lineTotal;
    }

    try {
      const orderId = database.transaction((transaction) => {
        transaction.run(
          `INSERT INTO orders (customer_name, customer_email, shipping_address, total_cents)
           VALUES (?, ?, ?, ?)`,
          [customerName, customerEmail, shippingAddress, totalCents]
        );

        const newOrderId = transaction.get('SELECT last_insert_rowid() AS id').id;
        orderItems.forEach((item) => {
          transaction.run(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
             VALUES (?, ?, ?, ?)`,
            [newOrderId, item.productId, item.quantity, item.unitPriceCents]
          );
        });

        return newOrderId;
      });

      return res.status(201).json({
        success: true,
        orderId,
        items: orderItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents
        })),
        totalCents,
        message: `Order ${orderId} was saved successfully.`
      });
    } catch (error) {
      console.error('Could not save the order:', error);
      return res.status(500).json({ success: false, message: 'Could not save your order. Please try again.' });
    }
  });

  app.listen(port, () => {
    console.log(`Store server is running at http://localhost:${port}`);
    console.log(`SQLite database: ${databasePath}`);
  });
}).catch((error) => {
  console.error('Could not initialize the SQLite database:', error);
  process.exitCode = 1;
});
