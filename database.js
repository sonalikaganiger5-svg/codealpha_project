const fs = require('fs');
const path = require('path');
const initializeSql = require('sql.js');

const databasePath = path.join(__dirname, 'daymark.db');

const schema = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_alt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
  );
`;

const seedProducts = [
  ['park-loop-runners', 'Park Loop Runners', 149900, 'Lightweight trainers for a quick neighborhood loop or a longer park trail.', 'Sports', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80', 'Red running shoe photographed from above.'],
  ['everyday-yoga-mat', 'Everyday Yoga Mat', 59900, 'A cushioned mat that rolls up easily after a stretch or home workout.', 'Sports', 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=800&q=80', 'Yoga mat ready for a home workout.'],
  ['easy-leather-jacket', 'Easy Leather Jacket', 199900, 'A sturdy layer for crisp mornings and cool evenings on the way home.', 'Fashion', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80', 'A brown leather jacket styled for everyday wear.'],
  ['market-crossbody-bag', 'Market Crossbody Bag', 79900, 'Keeps your phone, keys, and wallet close while your hands stay free.', 'Fashion', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80', 'A small everyday handbag displayed against a neutral background.'],
  ['handblock-cotton-kurta', 'Handblock Cotton Kurta', 79900, 'A breathable cotton kurta with a traditional print for family visits and relaxed celebrations.', 'Fashion', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', 'Traditional Indian clothing in a rich, colorful print.'],
  ['indigo-printed-saree', 'Indigo Printed Saree', 149900, 'A lightweight printed saree in deep indigo, suited to festive gatherings and special dinners.', 'Fashion', 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80', 'A traditional Indian outfit with a patterned fabric.'],
  ['weekend-linen-dress', 'Weekend Linen Dress', 129900, 'An easy, airy dress with a clean shape for a weekend market or a day out with friends.', 'Fashion', 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80', 'A model wearing a modern western-style outfit.'],
  ['everyday-denim-jacket', 'Everyday Denim Jacket', 159900, 'A classic denim layer that pairs easily with a dress, a tee, or your favorite weekend outfit.', 'Fashion', 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80', 'A denim jacket displayed as a casual western clothing layer.'],
  ['wireless-headphones', 'Wireless Headphones', 149900, 'Settle into a playlist on the bus or take a call from your desk.', 'Electronics', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80', 'Black over-ear headphones resting on a light surface.'],
  ['pocket-digital-camera', 'Pocket Digital Camera', 499900, 'A compact camera for weekend walks and little moments worth keeping.', 'Electronics', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80', 'A compact digital camera with its lens facing forward.'],
  ['reading-nook-desk-lamp', 'Reading Nook Desk Lamp', 79900, 'A warm pool of light for late-night reading or a tidy work corner.', 'Home & Living', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80', 'A desk lamp on a table.'],
  ['window-sill-planter', 'Window Sill Planter', 39900, 'A simple ceramic home for a small herb or the cutting you are rooting.', 'Home & Living', 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80', 'A leafy green plant in a pot.'],
  ['daily-dew-face-serum', 'Daily Dew Face Serum', 49900, 'A lightweight serum to add to a calm morning or evening routine.', 'Beauty', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80', 'A bottle of skincare serum on a clean surface.'],
  ['soft-color-eye-palette', 'Soft Color Eye Palette', 59900, 'A small mix of everyday shades for a quick, understated look.', 'Beauty', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=800&q=80', 'Makeup products arranged on a table.'],
  ['commute-daypack', 'Commute Daypack', 99900, 'Room for a notebook, lunch, and the extra layer you may need later.', 'Accessories', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80', 'A backpack shown against a simple background.'],
  ['stainless-water-bottle', 'Stainless Water Bottle', 39900, 'A reusable bottle to keep in your tote for classes and day trips.', 'Accessories', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80', 'Reusable water bottle photographed upright.']
];

function saveDatabase(db) {
  fs.writeFileSync(databasePath, Buffer.from(db.export()));
}

const databaseReady = initializeSql().then((SQL) => {
  const db = fs.existsSync(databasePath)
    ? new SQL.Database(fs.readFileSync(databasePath))
    : new SQL.Database();

  db.run('PRAGMA foreign_keys = ON');
  db.exec(schema);

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, price_cents, description, category, image_url, image_alt
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET price_cents = excluded.price_cents
  `);

  db.run('BEGIN TRANSACTION');
  try {
    seedProducts.forEach((product) => insertProduct.run(product));
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  } finally {
    insertProduct.free();
  }
  saveDatabase(db);

  function all(sql, parameters = []) {
    const statement = db.prepare(sql);
    try {
      statement.bind(parameters);
      const rows = [];
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  function run(sql, parameters = []) {
    const statement = db.prepare(sql);
    try {
      statement.run(parameters);
    } finally {
      statement.free();
    }
  }

  const database = {
    all,
    get(sql, parameters = []) {
      return all(sql, parameters)[0];
    },
    run,
    transaction(callback) {
      db.run('BEGIN TRANSACTION');
      try {
        const result = callback(database);
        db.run('COMMIT');
        saveDatabase(db);
        return result;
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    }
  };

  return database;
});

module.exports = { databaseReady, databasePath };
