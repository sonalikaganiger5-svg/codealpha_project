const express = require('express');
const path = require('path');
const {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} = require('crypto');
const { databaseReady, databasePath } = require('./database');

const app = express();
const port = Number(process.env.PORT) || 3000;
const sessionCookieName = 'snapcart_session';
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function getSessionToken(req) {
  const cookies = req.headers.cookie || '';
  const sessionCookie = cookies
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${sessionCookieName}=`));

  return sessionCookie ? sessionCookie.slice(sessionCookieName.length + 1) : '';
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getAuthenticatedUser(database, req) {
  const token = getSessionToken(req);
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }

  const user = database.get(
    `SELECT users.id, users.name, users.email, sessions.expires_at
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?`,
    [hashSessionToken(token)]
  );

  if (!user) {
    return null;
  }

  if (user.expires_at <= Date.now()) {
    database.transaction((transaction) => {
      transaction.run('DELETE FROM sessions WHERE token_hash = ?', [hashSessionToken(token)]);
    });
    return null;
  }

  return user;
}

function setSessionCookie(res, token, req) {
  const secure = req.get('x-forwarded-proto') === 'https' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDurationMs / 1000}${secure}`
  );
}

databaseReady.then((database) => {
  app.post('/api/auth/register', (req, res) => {
    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Enter a name up to 100 characters long.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 1024) {
      return res.status(400).json({ success: false, message: 'Use a password with at least 8 characters.' });
    }

    if (database.get('SELECT id FROM users WHERE email = ?', [email])) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    }

    const salt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, salt, 64).toString('hex');

    try {
      database.transaction((transaction) => {
        transaction.run(
          'INSERT INTO users (name, email, password_salt, password_hash) VALUES (?, ?, ?, ?)',
          [name, email, salt, passwordHash]
        );
      });

      return res.status(201).json({ success: true, message: 'Account created. You can now log in.' });
    } catch (error) {
      console.error('Could not create the account:', error);
      return res.status(500).json({ success: false, message: 'Could not create the account. Please try again.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = database.get(
      'SELECT id, name, email, password_salt, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (!user || Buffer.byteLength(password, 'utf8') > 1024) {
      return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
    }

    const submittedHash = scryptSync(password, user.password_salt, 64);
    const savedHash = Buffer.from(user.password_hash, 'hex');
    if (savedHash.length !== submittedHash.length || !timingSafeEqual(savedHash, submittedHash)) {
      return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(token);
    const expiresAt = Date.now() + sessionDurationMs;

    try {
      database.transaction((transaction) => {
        transaction.run('DELETE FROM sessions WHERE expires_at <= ?', [Date.now()]);
        transaction.run(
          'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
          [tokenHash, user.id, expiresAt]
        );
      });
    } catch (error) {
      console.error('Could not start the user session:', error);
      return res.status(500).json({ success: false, message: 'Could not log in. Please try again.' });
    }

    setSessionCookie(res, token, req);
    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email }
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(database, req);
    return res.json({
      user: user ? { id: user.id, name: user.name, email: user.email } : null
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getSessionToken(req);
    if (/^[a-f0-9]{64}$/i.test(token)) {
      database.transaction((transaction) => {
        transaction.run('DELETE FROM sessions WHERE token_hash = ?', [hashSessionToken(token)]);
      });
    }

    res.setHeader(
      'Set-Cookie',
      `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    );
    return res.json({ success: true });
  });

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
    const user = getAuthenticatedUser(database, req);

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
          `INSERT INTO orders (user_id, customer_name, customer_email, shipping_address, total_cents)
           VALUES (?, ?, ?, ?, ?)`,
          [user ? user.id : null, customerName, customerEmail, shippingAddress, totalCents]
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
