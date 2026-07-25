import * as SQLite from 'expo-sqlite';
import { ALL_MIGRATIONS } from './schema';

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
}
