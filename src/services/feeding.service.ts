import { getDb } from '../database/db';

/**
 * Feeding is what the field records most, and it is the number that moves
 * stock, so it has to survive a phone with no signal: every entry goes to the
 * local outbox first and is pushed when the connection comes back.
 */

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface FeedingOfflinePayload {
  cycleId: string;
  pondId: string;
  productId: string;
  feedKg: number;
  fedAt: string;
  responsibleId: string;
  /** Shown on the local screen only — the API resolves the user from the id. */
  responsibleName?: string;
  observation?: string;
}

/** pushOutbox posts to `/v1/<entity>`, so the entity holds the whole path. */
const FEEDING_ENTITY = 'feeding/express';

export async function saveOfflineFeeding(payload: FeedingOfflinePayload): Promise<string> {
  if (!Number.isFinite(payload.feedKg) || payload.feedKg <= 0) {
    throw new Error('Quantidade de ração deve ser maior que zero');
  }

  const db = await getDb();
  const clientId = generateUUID();

  // clientUuid makes the push idempotent: if the sync retries after a timeout,
  // the API returns the record it already has instead of feeding twice.
  const body = {
    cycleId: payload.cycleId,
    pondId: payload.pondId,
    productId: payload.productId,
    feedKg: payload.feedKg,
    fedAt: payload.fedAt,
    responsibleId: payload.responsibleId,
    observation: payload.observation,
    clientUuid: clientId,
  };

  await db.runAsync(
    `INSERT OR REPLACE INTO outbox (client_id, entity, payload, status, attempts, measured_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [clientId, FEEDING_ENTITY, JSON.stringify(body), 'pending', 0, payload.fedAt],
  );

  return clientId;
}

/**
 * Feed already recorded on this phone but not yet synced. The screen adds it to
 * what the server knows, so the operator never sees a total that ignores what
 * they just typed.
 */
export async function getPendingFeedKgForPond(pondId: string): Promise<number> {
  const db = await getDb();

  const rows = await db.getAllAsync<{ payload: string }>(
    `SELECT payload FROM outbox WHERE entity = ? AND status = 'pending'`,
    [FEEDING_ENTITY],
  );

  return rows.reduce((total, row) => {
    try {
      const parsed = JSON.parse(row.payload) as { pondId?: string; feedKg?: number };
      if (parsed.pondId !== pondId) return total;
      return total + (Number(parsed.feedKg) || 0);
    } catch {
      return total;
    }
  }, 0);
}
