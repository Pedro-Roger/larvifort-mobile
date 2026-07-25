// ─────────────────────────────────────────────────────────────────────────────
// SQLite table definitions
// ─────────────────────────────────────────────────────────────────────────────

export const CREATE_OUTBOX = `
  CREATE TABLE IF NOT EXISTS outbox (
    client_id   TEXT PRIMARY KEY,
    entity      TEXT NOT NULL,
    payload     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    attempts    INTEGER NOT NULL DEFAULT 0,
    measured_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_error  TEXT
  );
`;

export const CREATE_PONDS_CACHE = `
  CREATE TABLE IF NOT EXISTS ponds_cache (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL,
    name       TEXT NOT NULL,
    type       TEXT,
    area_ha    REAL,
    status     TEXT,
    updated_at TEXT
  );
`;

export const CREATE_CYCLES_CACHE = `
  CREATE TABLE IF NOT EXISTS cycles_cache (
    id         TEXT PRIMARY KEY,
    pond_id    TEXT NOT NULL,
    phase      TEXT,
    status     TEXT,
    supplier   TEXT,
    stock_date TEXT,
    updated_at TEXT
  );
`;

export const CREATE_USERS_CACHE = `
  CREATE TABLE IF NOT EXISTS users_cache (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    role       TEXT,
    active     INTEGER DEFAULT 1,
    updated_at TEXT
  );
`;

export const CREATE_FEED_PRODUCTS_CACHE = `
  CREATE TABLE IF NOT EXISTS feed_products_cache (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    price_kg      REAL,
    bag_weight_kg REAL,
    active        INTEGER DEFAULT 1
  );
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status, created_at);
  CREATE INDEX IF NOT EXISTS idx_cycles_pond ON cycles_cache (pond_id, status);
`;

export const ALL_MIGRATIONS = [
  CREATE_OUTBOX,
  CREATE_PONDS_CACHE,
  CREATE_CYCLES_CACHE,
  CREATE_USERS_CACHE,
  CREATE_FEED_PRODUCTS_CACHE,
  CREATE_INDEXES,
];
