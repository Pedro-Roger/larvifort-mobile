import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { OutboxItem } from '../types';
import { SyncStatus } from '../types';

interface OutboxItemCardProps {
  item: OutboxItem;
  onRetry?: (clientId: string) => void;
}

const STATUS_CONFIG: Record<SyncStatus, { icon: string; color: string; label: string }> = {
  [SyncStatus.PENDING]: { icon: '⏳', color: '#f59e0b', label: 'Pendente' },
  [SyncStatus.SYNCED]: { icon: '✓', color: '#22c55e', label: 'Sincronizado' },
  [SyncStatus.ERROR]: { icon: '✗', color: '#ef4444', label: 'Erro' },
};

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function OutboxItemCard({ item, onRetry }: OutboxItemCardProps) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG[SyncStatus.PENDING];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.statusBadge, { borderColor: config.color }]}>
          <Text style={[styles.statusIcon, { color: config.color }]}>{config.icon}</Text>
          <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={styles.entity}>{item.entity}</Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          Coleta: {formatDate(item.measuredAt)}
        </Text>
        <Text style={styles.detailText}>
          Criado: {formatDate(item.createdAt)}
        </Text>
        {item.attempts > 0 && (
          <Text style={styles.attempts}>Tentativas: {item.attempts}</Text>
        )}
        {item.lastError && (
          <Text style={styles.error} numberOfLines={2}>{item.lastError}</Text>
        )}
      </View>

      {item.status === SyncStatus.ERROR && onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={() => onRetry(item.clientId)}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 4,
  },
  statusIcon: {
    fontSize: 13,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  entity: {
    color: '#64748b',
    fontSize: 12,
  },
  details: {
    gap: 3,
  },
  detailText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  attempts: {
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 4,
  },
  error: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  retryText: {
    color: '#0ea5e9',
    fontSize: 13,
    fontWeight: '600',
  },
});
