import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncAll, retryErrors } from '../services/sync.service';
import { outboxRepository } from '../database/repositories/outbox.repository';

export interface UseSyncReturn {
  isSyncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
  retryAllErrors: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await outboxRepository.countPending();
      setPendingCount(count);
    } catch {
      // ignore
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncAll();
      setLastSyncAt(new Date());
      await refreshPendingCount();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  const retryAllErrors = useCallback(async () => {
    await retryErrors();
    await refreshPendingCount();
    await syncNow();
  }, [syncNow, refreshPendingCount]);

  // Initial pending count
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Listen to connectivity changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnline(online);

      if (online) {
        syncNow();
      }
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    });

    return unsubscribe;
  }, [syncNow]);

  return { isSyncing, isOnline, pendingCount, lastSyncAt, syncNow, retryAllErrors };
}
