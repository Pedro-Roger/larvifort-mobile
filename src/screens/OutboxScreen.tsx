import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { OutboxItemCard } from '../components/OutboxItemCard';
import { useOutbox } from '../hooks/useOutbox';
import { useSync } from '../hooks/useSync';
import { SyncStatus } from '../types';
import { retryErrors } from '../services/sync.service';
import { getDb } from '../database/db';

type FilterTab = 'all' | SyncStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: SyncStatus.PENDING, label: 'Pendentes' },
  { key: SyncStatus.SYNCED, label: 'Sincronizados' },
  { key: SyncStatus.ERROR, label: 'Erros' },
];

export function OutboxScreen() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const { items, isLoading, counts, reload } = useOutbox(
    activeTab === 'all' ? undefined : activeTab,
  );
  const { retryAllErrors, isSyncing } = useSync();

  const handleRetryAll = useCallback(async () => {
    if (counts.error === 0) return;
    await retryAllErrors();
    reload();
  }, [counts.error, retryAllErrors, reload]);

  const handleRetrySingle = useCallback(
    async (clientId: string) => {
      try {
        const db = await getDb();
        await db.runAsync(
          `UPDATE outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE client_id = ?`,
          [clientId],
        );
        await reload();
        Alert.alert('OK', 'Item marcado para reenvio');
      } catch {
        Alert.alert('Erro', 'Não foi possível reenviar o item');
      }
    },
    [reload],
  );

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <SummaryChip label="Pendentes" count={counts.pending} color="#f59e0b" />
        <SummaryChip label="Sincronizados" count={counts.synced} color="#22c55e" />
        <SummaryChip label="Erros" count={counts.error} color="#ef4444" />
      </View>

      {/* Retry all errors button */}
      {counts.error > 0 && (
        <TouchableOpacity
          style={[styles.retryAllBtn, isSyncing && styles.retryAllBtnDisabled]}
          onPress={handleRetryAll}
          disabled={isSyncing}
        >
          <Text style={styles.retryAllText}>
            ↺ Reenviar todos os erros ({counts.error})
          </Text>
        </TouchableOpacity>
      )}

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.clientId}
        renderItem={({ item }) => (
          <OutboxItemCard item={item} onRetry={handleRetrySingle} />
        )}
        refreshing={isLoading}
        onRefresh={reload}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum item encontrado</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function SummaryChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipCount, { color }]}>{count}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  chip: {
    alignItems: 'center',
  },
  chipCount: {
    fontSize: 24,
    fontWeight: '700',
  },
  chipLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  retryAllBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#ef4444',
    margin: 16,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  retryAllBtnDisabled: {
    opacity: 0.5,
  },
  retryAllText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  tabActive: {
    backgroundColor: '#0ea5e9',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  list: {
    paddingVertical: 8,
    paddingBottom: 32,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
  },
});
