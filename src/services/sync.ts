import NetInfo from '@react-native-community/netinfo';
import { api } from './api';

export type SyncStatus = 'pending' | 'synced' | 'error';

export interface OutboxItem {
  clientUuid: string;
  entity: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  measuredAt: string;
  createdAt: string;
  lastError?: string;
}

// Monitor connectivity and trigger sync on reconnect
export function startSyncMonitor(onSync: () => void): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      onSync();
    }
  });
  return unsubscribe;
}

// Send a batch of pending items to the API
export async function syncBatch(
  items: OutboxItem[],
  endpoint: string,
): Promise<{ accepted: string[]; failed: string[] }> {
  try {
    const response = await api.post(endpoint, {
      items: items.map((i) => i.payload),
    });
    return {
      accepted: items.map((i) => i.clientUuid),
      failed: [],
    };
  } catch {
    return {
      accepted: [],
      failed: items.map((i) => i.clientUuid),
    };
  }
}
