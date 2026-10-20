const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'gr-studio.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL);
  CREATE TABLE IF NOT EXISTS customer_sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS customer_addresses (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    full_name TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscribers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed')),
    consent_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'website',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS customer_sessions_expiry_idx ON customer_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS customer_addresses_account_idx ON customer_addresses(account_id, is_default DESC, created_at DESC);
`);
if (!db.prepare('PRAGMA table_info(orders)').all().some(column => column.name === 'account_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL');
}

function legacy(name, fallback) {
  const file = path.join(dataDir, name);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function transaction(operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateTable(table, rows, createdAt) {
  const count = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  if (count) return;
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (id, payload${createdAt ? ', created_at' : ''}) VALUES (?, ?${createdAt ? ', ?' : ''})`);
  transaction(() => {
    for (const row of (Array.isArray(rows) ? rows : [])) {
      const values = [String(row.id), JSON.stringify(row)];
      if (createdAt) values.push(String(row.createdAt || new Date().toISOString()));
      insert.run(...values);
    }
  });
}

function initialize(productSeed) {
  migrateTable('products', legacy('products.json', productSeed), false);
  migrateTable('orders', legacy('orders.json', []), true);
}

function getRows(table, order = '') {
  return db.prepare(`SELECT payload FROM ${table} ${order}`).all().map(row => JSON.parse(row.payload));
}
function replaceRows(table, rows) {
  const insert = table === 'orders'
    ? db.prepare('INSERT INTO orders (id, payload, created_at, account_id) VALUES (?, ?, ?, ?)')
    : db.prepare('INSERT INTO products (id, payload) VALUES (?, ?)');
  transaction(() => {
    db.prepare(`DELETE FROM ${table}`).run();
    for (const row of rows) {
      if (table === 'orders') insert.run(String(row.id), JSON.stringify(row), String(row.createdAt || new Date().toISOString()), row.accountId || null);
      else insert.run(String(row.id), JSON.stringify(row));
    }
  });
}

module.exports = {
  initialize,
  products: () => getRows('products'),
  orders: () => getRows('orders', 'ORDER BY created_at DESC'),
  saveProducts: rows => replaceRows('products', rows),
  saveOrders: rows => replaceRows('orders', rows),
  createOrder(order, updatedProducts) {
    transaction(() => {
      db.prepare('DELETE FROM products').run();
      const saveProduct = db.prepare('INSERT INTO products (id, payload) VALUES (?, ?)');
      for (const row of updatedProducts) saveProduct.run(String(row.id), JSON.stringify(row));
      db.prepare('INSERT INTO orders (id, payload, created_at, account_id) VALUES (?, ?, ?, ?)').run(order.id, JSON.stringify(order), order.createdAt, order.accountId || null);
    });
  },
  subscribe(email, id, now) {
    const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(email);
    if (existing) {
      db.prepare("UPDATE subscribers SET status='subscribed', consent_at=?, updated_at=?, source='website' WHERE id=?").run(now, now, existing.id);
      return { id: existing.id, existing: true };
    }
    db.prepare("INSERT INTO subscribers (id,email,status,consent_at,source,created_at,updated_at) VALUES (?,?,'subscribed',?,'website',?,?)").run(id, email, now, now, now);
    return { id, existing: false };
  },
  subscribers() {
    return db.prepare('SELECT id,email,status,consent_at AS consentAt,source,created_at AS createdAt,updated_at AS updatedAt FROM subscribers ORDER BY created_at DESC').all();
  },
  setSubscriberStatus(id, status, now) {
    return db.prepare('UPDATE subscribers SET status=?, updated_at=? WHERE id=?').run(status, now, id).changes;
  },
  accountByEmail(email) {
    return db.prepare('SELECT id,email,name,password_hash AS passwordHash,password_salt AS passwordSalt,created_at AS createdAt FROM accounts WHERE email=?').get(email);
  },
  accountById(id) {
    return db.prepare('SELECT id,email,name,created_at AS createdAt FROM accounts WHERE id=?').get(id);
  },
  createAccount(account) {
    db.prepare('INSERT INTO accounts (id,email,name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?)').run(account.id, account.email, account.name, account.passwordHash, account.passwordSalt, account.createdAt);
  },
  createCustomerSession(tokenHash, accountId, expiresAt) {
    db.prepare('INSERT INTO customer_sessions (token_hash,account_id,expires_at) VALUES (?,?,?)').run(tokenHash, accountId, expiresAt);
  },
  accountForSession(tokenHash, now) {
    return db.prepare('SELECT a.id,a.email,a.name,a.created_at AS createdAt FROM customer_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash, now);
  },
  deleteCustomerSession(tokenHash) {
    db.prepare('DELETE FROM customer_sessions WHERE token_hash=?').run(tokenHash);
  },
  accountOrders(accountId) {
    return db.prepare('SELECT payload FROM orders WHERE account_id=? ORDER BY created_at DESC').all(accountId).map(row => JSON.parse(row.payload));
  },
  accountAddresses(accountId) {
    return db.prepare('SELECT id,label,full_name AS fullName,line1,line2,city,region,postal_code AS postalCode,country,is_default AS isDefault,created_at AS createdAt,updated_at AS updatedAt FROM customer_addresses WHERE account_id=? ORDER BY is_default DESC,created_at DESC').all(accountId).map(row => ({ ...row, isDefault: !!row.isDefault }));
  },
  accountAddress(id, accountId) {
    const row = db.prepare('SELECT id,label,full_name AS fullName,line1,line2,city,region,postal_code AS postalCode,country,is_default AS isDefault,created_at AS createdAt,updated_at AS updatedAt FROM customer_addresses WHERE id=? AND account_id=?').get(id, accountId);
    return row ? { ...row, isDefault: !!row.isDefault } : null;
  },
  saveAccountAddress(address) {
    transaction(() => {
      const count = db.prepare('SELECT COUNT(*) AS count FROM customer_addresses WHERE account_id=?').get(address.accountId).count;
      if (address.isDefault || !count) db.prepare('UPDATE customer_addresses SET is_default=0 WHERE account_id=?').run(address.accountId);
      const prior = db.prepare('SELECT created_at FROM customer_addresses WHERE id=? AND account_id=?').get(address.id, address.accountId);
      const createdAt = prior?.created_at || address.now;
      db.prepare(`INSERT INTO customer_addresses (id,account_id,label,full_name,line1,line2,city,region,postal_code,country,is_default,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET label=excluded.label,full_name=excluded.full_name,line1=excluded.line1,line2=excluded.line2,city=excluded.city,region=excluded.region,postal_code=excluded.postal_code,country=excluded.country,is_default=excluded.is_default,updated_at=excluded.updated_at`)
        .run(address.id,address.accountId,address.label,address.fullName,address.line1,address.line2,address.city,address.region,address.postalCode,address.country,(address.isDefault||!count)?1:0,createdAt,address.now);
    });
    return this.accountAddress(address.id,address.accountId);
  },
  setDefaultAccountAddress(id, accountId) {
    return transaction(() => {
      const exists = db.prepare('SELECT id FROM customer_addresses WHERE id=? AND account_id=?').get(id, accountId);
      if (!exists) return false;
      db.prepare('UPDATE customer_addresses SET is_default=0 WHERE account_id=?').run(accountId);
      db.prepare('UPDATE customer_addresses SET is_default=1,updated_at=? WHERE id=? AND account_id=?').run(new Date().toISOString(), id, accountId);
      return true;
    });
  },
  deleteAccountAddress(id, accountId) {
    return transaction(() => {
      const address = db.prepare('SELECT is_default FROM customer_addresses WHERE id=? AND account_id=?').get(id, accountId);
      if (!address) return false;
      db.prepare('DELETE FROM customer_addresses WHERE id=? AND account_id=?').run(id, accountId);
      if (address.is_default) {
        const next = db.prepare('SELECT id FROM customer_addresses WHERE account_id=? ORDER BY created_at DESC LIMIT 1').get(accountId);
        if (next) db.prepare('UPDATE customer_addresses SET is_default=1,updated_at=? WHERE id=?').run(new Date().toISOString(), next.id);
      }
      return true;
    });
  },
  updateAccountName(id, name) {
    return db.prepare('UPDATE accounts SET name=? WHERE id=?').run(name, id).changes;
  },
  updateAccountPassword(id, passwordHash, passwordSalt) {
    return db.prepare('UPDATE accounts SET password_hash=?,password_salt=? WHERE id=?').run(passwordHash, passwordSalt, id).changes;
  }
};
