import { getDb } from '../db';
import type { OutboxItem, SyncStatus } from '../../types';

/**
 * Every write to the `outbox` table goes through here — see
 * docs/patterns/00-folder-structure.md ("Hooks chamam repositórios, não o
 * SQLite diretamente"). Before this file existed, near-identical INSERT/SELECT/
 * UPDATE statements were duplicated across the feature services, sync.service,
 * useOutbox/useSync and OutboxScreen, and had already drifted (one service used
 * a plain INSERT while the others used INSERT OR REPLACE + attempts).
 */

export interface EnqueueParams {
  clientId: string;
  entity: string;
  payload: Record<string, unknown>;
  measuredAt: string;
}

interface OutboxRow {
  client_id: string;
  entity: string;
  payload: string;
  status: SyncStatus;
  attempts: number;
  measured_at: string;
  created_at: string;
  last_error: string | null;
}

function deserialize(row: OutboxRow): OutboxItem {
  return {
    clientId: row.client_id,
    entity: row.entity,
    payload: JSON.parse(row.payload),
    status: row.status,
    attempts: row.attempts,
    measuredAt: row.measured_at,
    createdAt: row.created_at,
    lastError: row.last_error ?? undefined,
  };
}

export const outboxRepository = {
  /**
   * Queues a payload for sync. `client_id` doubles as the idempotency key the
   * API dedupes on, so re-enqueueing the same id replaces the pending row
   * instead of creating a duplicate.
   */
  async enqueue({ clientId, entity, payload, measuredAt }: EnqueueParams): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO outbox (client_id, entity, payload, status, attempts, measured_at, created_at)
       VALUES (?, ?, ?, 'pending', 0, ?, datetime('now'))`,
      [clientId, entity, JSON.stringify(payload), measuredAt],
    );
  },

  /** All items, optionally filtered by status — backs the outbox list screen. */
  async findAll(status?: SyncStatus): Promise<OutboxItem[]> {
    const db = await getDb();
    const rows = status
      ? await db.getAllAsync<OutboxRow>(
          `SELECT * FROM outbox WHERE status = ? ORDER BY created_at DESC`,
          [status],
        )
      : await db.getAllAsync<OutboxRow>(`SELECT * FROM outbox ORDER BY created_at DESC`);
    return rows.map(deserialize);
  },

  /** Pending items for one entity — used to total what a screen has queued but not yet synced. */
  async findPendingByEntity(entity: string): Promise<OutboxItem[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      `SELECT * FROM outbox WHERE entity = ? AND status = 'pending'`,
      [entity],
    );
    return rows.map(deserialize);
  },

  /** FIFO batch of pending items, oldest first — what the sync push loop sends next. */
  async findPendingBatch(limit = 50): Promise<OutboxItem[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<OutboxRow>(
      `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
      [limit],
    );
    return rows.map(deserialize);
  },

  async countPending(): Promise<number> {
    const db = await getDb();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM outbox WHERE status = 'pending'`,
    );
    return result?.count ?? 0;
  },

  /** Counts grouped by status — backs the summary chips on the outbox screen. */
  async countByStatus(): Promise<Record<SyncStatus, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ status: SyncStatus; count: number }>(
      `SELECT status, COUNT(*) as count FROM outbox GROUP BY status`,
    );
    const counts = { pending: 0, synced: 0, error: 0 } as Record<SyncStatus, number>;
    for (const row of rows) {
      counts[row.status] = row.count;
    }
    return counts;
  },

  async markSynced(clientId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE outbox SET status = 'synced' WHERE client_id = ?`, [clientId]);
  },

  async markError(clientId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(`UPDATE outbox SET status = 'error' WHERE client_id = ?`, [clientId]);
  },

  async incrementAttempts(clientId: string, errorMessage: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE client_id = ?`,
      [errorMessage, clientId],
    );
  },

  /** Resets a single item back to pending — the operator retrying one failed row from the outbox screen. */
  async retry(clientId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE client_id = ?`,
      [clientId],
    );
  },

  /** Resets every errored item back to pending, ahead of a full resync. */
  async retryAllErrors(): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE status = 'error'`,
    );
  },
};
