import * as SQLite from 'expo-sqlite';
import { ALL_MIGRATIONS, ADD_OUTBOX_FARM_ID_COLUMN } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('aquafort.db');
  return _db;
}

export async function initDb(): Promise<void> {
  const db = await getDb();

  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  for (const sql of ALL_MIGRATIONS) {
    await db.execAsync(sql);
  }

  await ensureOutboxFarmIdColumn(db);
}

/**
 * Multi-fazenda: instalações que já tinham a tabela `outbox` antes desta
 * feature não ganham a coluna `farm_id` de `CREATE TABLE IF NOT EXISTS`
 * (schema.ts) — só uma tabela nova teria. `ALTER TABLE ADD COLUMN` falha se
 * rodar duas vezes ("duplicate column name"), então checa via
 * `PRAGMA table_info` antes de aplicar.
 */
export async function ensureOutboxFarmIdColumn(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(outbox)`);
  const hasFarmId = columns.some((c) => c.name === 'farm_id');
  if (!hasFarmId) {
    await db.execAsync(ADD_OUTBOX_FARM_ID_COLUMN);
  }
}
