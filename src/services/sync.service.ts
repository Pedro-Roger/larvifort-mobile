import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import { getDb } from '../database/db';
import type { Pond, Cycle, User, OutboxItem, FeedProduct } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Pull remote data into local SQLite cache
// ─────────────────────────────────────────────────────────────────────────────

export async function pullData(): Promise<void> {
  const db = await getDb();

  const [pondsRes, cyclesRes, usersRes, productsRes] = await Promise.all([
    api.get<Pond[]>('/v1/ponds'),
    api.get<Cycle[]>('/v1/cycles?status=ATIVO'),
    api.get<User[]>('/v1/users?active=true'),
    api.get<FeedProduct[]>('/v1/feed-products'),
  ]);

  await db.withTransactionAsync(async () => {
    for (const pond of pondsRes.data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ponds_cache (id, code, name, type, area_ha, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pond.id, pond.code, pond.name, pond.type ?? null, pond.areaHa ?? null, pond.status ?? null, pond.updatedAt ?? null],
      );
    }

    for (const cycle of cyclesRes.data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cycles_cache (id, pond_id, phase, status, supplier, stock_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cycle.id, cycle.pondId, cycle.phase ?? null, cycle.status ?? null, cycle.supplier ?? null, cycle.stockDate ?? null, cycle.updatedAt ?? null],
      );
    }

    // The feeding form needs a product to post, so it has to work offline too.
    for (const product of productsRes.data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO feed_products_cache (id, name, price_kg, bag_weight_kg, active)
         VALUES (?, ?, ?, ?, ?)`,
        [product.id, product.name, product.priceKg ?? null, product.bagWeightKg ?? null, product.active === false ? 0 : 1],
      );
    }

    for (const user of usersRes.data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO users_cache (id, name, role, active, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, user.name, user.role ?? null, user.active ? 1 : 0, user.updatedAt ?? null],
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Push pending outbox items to API (FIFO, one by one)
// ─────────────────────────────────────────────────────────────────────────────

export async function pushOutbox(): Promise<{ sent: number; failed: number }> {
  const db = await getDb();

  const rows = await db.getAllAsync<{
    client_id: string;
    entity: string;
    payload: string;
    attempts: number;
  }>(
    `SELECT client_id, entity, payload, attempts FROM outbox
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 50`,
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload);
      await api.post(`/v1/${row.entity}`, payload);

      await db.runAsync(
        `UPDATE outbox SET status = 'synced' WHERE client_id = ?`,
        [row.client_id],
      );
      sent++;
    } catch (err: any) {
      const errorMsg = err?.message ?? 'Unknown error';
      await db.runAsync(
        `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE client_id = ?`,
        [errorMsg, row.client_id],
      );

      // Mark as error after 3 attempts
      if (row.attempts + 1 >= 3) {
        await db.runAsync(
          `UPDATE outbox SET status = 'error' WHERE client_id = ?`,
          [row.client_id],
        );
      }
      failed++;
    }
  }

  return { sent, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry items marked as error
// ─────────────────────────────────────────────────────────────────────────────

export async function retryErrors(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'error'`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main sync orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export async function syncAll(): Promise<{ sent: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected || !netState.isInternetReachable) {
    return { sent: 0, failed: 0 };
  }

  await pullData();
  return pushOutbox();
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return !!(state.isConnected && state.isInternetReachable);
}
