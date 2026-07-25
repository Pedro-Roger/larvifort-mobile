import { useState, useEffect, useCallback } from 'react';
import { getDb } from '../database/db';
import type { OutboxItem, SyncStatus } from '../types';

export function useOutbox(filterStatus?: SyncStatus) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, synced: 0, error: 0 });

  const load = useCallback(async () => {
    try {
      const db = await getDb();

      let rows: any[];
      if (filterStatus) {
        rows = await db.getAllAsync(
          `SELECT * FROM outbox WHERE status = ? ORDER BY created_at DESC`,
          [filterStatus],
        );
      } else {
        rows = await db.getAllAsync(
          `SELECT * FROM outbox ORDER BY created_at DESC`,
        );
      }

      setItems(
        rows.map((r) => ({
          clientId: r.client_id,
          entity: r.entity,
          payload: JSON.parse(r.payload),
          status: r.status as SyncStatus,
          attempts: r.attempts,
          measuredAt: r.measured_at,
          createdAt: r.created_at,
          lastError: r.last_error ?? undefined,
        })),
      );

      // Always compute all counts
      const countRows = await db.getAllAsync<{ status: string; count: number }>(
        `SELECT status, COUNT(*) as count FROM outbox GROUP BY status`,
      );
      const c = { pending: 0, synced: 0, error: 0 };
      for (const row of countRows) {
        if (row.status === 'pending') c.pending = row.count;
        if (row.status === 'synced') c.synced = row.count;
        if (row.status === 'error') c.error = row.count;
      }
      setCounts(c);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, isLoading, counts, reload: load };
}
