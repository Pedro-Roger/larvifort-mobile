import { useState, useEffect, useCallback } from 'react';
import { outboxRepository } from '../database/repositories/outbox.repository';
import type { OutboxItem, SyncStatus } from '../types';

export function useOutbox(filterStatus?: SyncStatus) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, synced: 0, error: 0 });

  const load = useCallback(async () => {
    try {
      const [loadedItems, loadedCounts] = await Promise.all([
        outboxRepository.findAll(filterStatus),
        outboxRepository.countByStatus(),
      ]);
      setItems(loadedItems);
      setCounts(loadedCounts);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const retryOne = useCallback(
    async (clientId: string) => {
      await outboxRepository.retry(clientId);
      await load();
    },
    [load],
  );

  return { items, isLoading, counts, reload: load, retryOne };
}
