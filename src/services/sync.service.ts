import NetInfo from '@react-native-community/netinfo';
import { api, getActiveFarmId } from './api';
import { getDb } from '../database/db';
import { outboxRepository } from '../database/repositories/outbox.repository';
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
  const items = await outboxRepository.findPendingBatch(50);

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Multi-fazenda: envia o farmId CAPTURADO na criação do registro
      // (item.farmId), não a fazenda ativa agora — entre o lançamento em
      // campo e o sync (pode levar horas/dias sem sinal) a fazenda ativa
      // pode ter mudado. Só cai pro fallback "fazenda ativa agora" em
      // registros legados enfileirados antes desta coluna existir, e nesse
      // caso avisa: pode estar sincronizando pra fazenda errada.
      let farmId = item.farmId;
      if (!farmId) {
        farmId = (await getActiveFarmId()) ?? undefined;
        if (farmId) {
          console.warn(
            `[sync] outbox item ${item.clientId} (${item.entity}) não tem farmId capturado (registro legado) — ` +
              `usando a fazenda ativa agora (${farmId}) como fallback. Pode sincronizar pra fazenda errada.`,
          );
        }
      }

      if (farmId) {
        await api.post(`/v1/${item.entity}`, item.payload, { headers: { 'X-Farm-Id': farmId } });
      } else {
        await api.post(`/v1/${item.entity}`, item.payload);
      }

      await outboxRepository.markSynced(item.clientId);
      sent++;
    } catch (err: any) {
      const errorMsg = err?.message ?? 'Unknown error';
      await outboxRepository.incrementAttempts(item.clientId, errorMsg);

      // Mark as error after 3 attempts
      if (item.attempts + 1 >= 3) {
        await outboxRepository.markError(item.clientId);
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
  await outboxRepository.retryAllErrors();
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
