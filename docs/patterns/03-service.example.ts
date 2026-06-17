/**
 * PATTERN: Services e Database — Aquafort Mobile
 *
 * Serviços são módulos singleton sem estado.
 * Repositories encapsulam o SQLite local.
 *
 * Localização:
 *   src/services/    → singleton instances (api, socket, sync)
 *   src/database/    → conexão + migrations + repositories
 */

// ─────────────────────────────────────────────────────────────────────────────
// src/database/db.ts — abre a conexão SQLite
// ─────────────────────────────────────────────────────────────────────────────

import * as SQLite from 'expo-sqlite';

// Singleton: uma única conexão para todo o app
let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('aquafort.db');
  return _db;
}

// ─────────────────────────────────────────────────────────────────────────────
// src/database/migrations.ts — cria tabelas na primeira abertura
// ─────────────────────────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS outbox_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT    NOT NULL UNIQUE,
      entity      TEXT    NOT NULL,
      endpoint    TEXT    NOT NULL,
      payload     TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'pending',
      attempts    INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS water_quality_readings_cache (
      id           TEXT PRIMARY KEY,
      client_uuid  TEXT,
      pond_id      TEXT NOT NULL,
      measured_at  TEXT NOT NULL,
      oxygen_mg_l  REAL,
      ph           REAL,
      temperature_c REAL,
      salinity_ppt REAL,
      synced       INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_readings_cache_pond
      ON water_quality_readings_cache (pond_id, measured_at DESC);

    CREATE INDEX IF NOT EXISTS idx_outbox_status
      ON outbox_queue (status, created_at);
  `);
}

// Chame runMigrations() no bootstrap do app (App.tsx ou RootNavigator)

// ─────────────────────────────────────────────────────────────────────────────
// src/database/repositories/outbox.repository.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { OutboxItem } from '../../types/sync.types';

export interface EnqueueParams {
  clientUuid: string;
  entity: string;
  endpoint: string;
  payload: Record<string, unknown>;
}

class OutboxRepository {
  async enqueue(params: EnqueueParams): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox_queue (client_uuid, entity, endpoint, payload)
       VALUES (?, ?, ?, ?)`,
      [params.clientUuid, params.entity, params.endpoint, JSON.stringify(params.payload)],
    );
  }

  async findAllPending(): Promise<OutboxItem[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM outbox_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`,
    );
    return rows.map(this.deserialize);
  }

  async countPending(): Promise<number> {
    const db = await getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox_queue WHERE status = 'pending'`,
    );
    return result?.count ?? 0;
  }

  async markSynced(clientUuids: string[]): Promise<void> {
    if (clientUuids.length === 0) return;
    const db = await getDb();
    const placeholders = clientUuids.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE outbox_queue SET status = 'synced' WHERE client_uuid IN (${placeholders})`,
      clientUuids,
    );
  }

  async incrementAttempts(clientUuids: string[]): Promise<void> {
    if (clientUuids.length === 0) return;
    const db = await getDb();
    const placeholders = clientUuids.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE outbox_queue SET attempts = attempts + 1 WHERE client_uuid IN (${placeholders})`,
      clientUuids,
    );
  }

  private deserialize(row: any): OutboxItem {
    return {
      clientUuid: row.client_uuid,
      entity: row.entity,
      endpoint: row.endpoint,
      payload: JSON.parse(row.payload),
      status: row.status,
      attempts: row.attempts,
      createdAt: row.created_at,
      lastError: row.last_error,
    };
  }
}

export const outboxRepository = new OutboxRepository();

// ─────────────────────────────────────────────────────────────────────────────
// src/database/repositories/readings.repository.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { WaterQualityReading } from '../../types/api.types';

interface FindOptions {
  limit?: number;
}

class ReadingsRepository {
  async findByPond(pondId: string, options: FindOptions = {}): Promise<WaterQualityReading[]> {
    const db = await getDb();
    const limit = options.limit ?? 50;
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM water_quality_readings_cache
       WHERE pond_id = ?
       ORDER BY measured_at DESC
       LIMIT ?`,
      [pondId, limit],
    );
    return rows.map(this.deserialize);
  }

  async upsertMany(readings: WaterQualityReading[]): Promise<void> {
    if (readings.length === 0) return;
    const db = await getDb();

    // Usa transação para performance em batch
    await db.withTransactionAsync(async () => {
      for (const r of readings) {
        await db.runAsync(
          `INSERT OR REPLACE INTO water_quality_readings_cache
           (id, pond_id, measured_at, oxygen_mg_l, ph, temperature_c, salinity_ppt, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            r.id,
            r.pondId,
            r.measuredAt,
            r.oxygenMgL ?? null,
            r.ph ?? null,
            r.temperatureC ?? null,
            r.salinityPpt ?? null,
          ],
        );
      }
    });
  }

  private deserialize(row: any): WaterQualityReading {
    return {
      id: row.id,
      pondId: row.pond_id,
      measuredAt: row.measured_at,
      oxygenMgL: row.oxygen_mg_l,
      ph: row.ph,
      temperatureC: row.temperature_c,
      salinityPpt: row.salinity_ppt,
      createdAt: row.created_at,
    };
  }
}

export const readingsRepository = new ReadingsRepository();

// ─────────────────────────────────────────────────────────────────────────────
// src/services/socket.ts — WebSocket singleton (semáforo O₂)
// ─────────────────────────────────────────────────────────────────────────────

import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('aquafort_token');

  socket = io(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000', {
    autoConnect: false,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    transports: ['websocket'], // evita polling no mobile
  });

  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// Uso em hook:
//
// useEffect(() => {
//   let s: Socket;
//   getSocket().then((socket) => {
//     s = socket;
//     socket.emit('join-pond', { pondId });
//     socket.on('water-quality:o2-alert', (data) => {
//       setO2Status(data.level);
//     });
//   });
//
//   return () => { s?.off('water-quality:o2-alert'); };
// }, [pondId]);

// ─────────────────────────────────────────────────────────────────────────────
// src/types/sync.types.ts — tipos compartilhados de sync
// ─────────────────────────────────────────────────────────────────────────────

export interface OutboxItem {
  clientUuid: string;
  entity: string;
  endpoint: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'synced' | 'error';
  attempts: number;
  createdAt: string;
  lastError?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// src/types/api.types.ts — espelha response DTOs da API
// Atualizar sempre que a API mudar os campos de resposta
// ─────────────────────────────────────────────────────────────────────────────

export interface WaterQualityReading {
  id: string;
  pondId: string;
  measuredAt: string; // ISO string
  oxygenMgL?: number;
  ph?: number;
  temperatureC?: number;
  salinityPpt?: number;
  createdAt: string;
}

export interface CreateReadingPayload {
  pondId: string;
  measuredAt: string;
  oxygenMgL?: number;
  ph?: number;
  temperatureC?: number;
  salinityPpt?: number;
}

export interface Pond {
  id: string;
  code: string;
  name: string;
  category: 'PRE_BERCARIO' | 'BERCARIO' | 'ENGORDA' | 'REPRODUTOR';
  areaHa: number;
}

export interface Cycle {
  id: string;
  pondId: string;
  pondName: string;
  status: 'PLANEJADO' | 'ATIVO' | 'COLHIDO' | 'CANCELADO';
  startDate: string;
  larvaeCount: number;
  fca?: number;
  daysInCycle?: number;
}
