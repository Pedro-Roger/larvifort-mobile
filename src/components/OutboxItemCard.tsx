import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { OutboxItem } from '../types';
import { SyncStatus } from '../types';
import { formatDateTime } from '../utils/date';

interface OutboxItemCardProps {
  item: OutboxItem;
  onRetry?: (clientId: string) => void;
  /** id -> nome, do cache local de usuários (ver `useUsersCache`). */
  usersById?: Record<string, string>;
}

const STATUS_CONFIG: Record<SyncStatus, { icon: string; color: string; label: string }> = {
  [SyncStatus.PENDING]: { icon: '⏳', color: '#f59e0b', label: 'Pendente' },
  [SyncStatus.SYNCED]: { icon: '✓', color: '#22c55e', label: 'Sincronizado' },
  [SyncStatus.ERROR]: { icon: '✗', color: '#ef4444', label: 'Erro' },
};

/**
 * RF-12: cada lançamento precisa mostrar quem coletou o dado. O payload é
 * genérico (`Record<string, unknown>`) e só carrega `responsibleId` — os
 * services de lançamento (feeding, biometric, mortality) deliberadamente não
 * mandam `responsibleName` pro outbox porque isso viraria o corpo do POST
 * (a API rejeita campo que não está no DTO). O nome vem do cache local de
 * usuários, resolvido pelo id; se o usuário ainda não foi sincronizado,
 * cai para o id cru em vez de esconder o campo.
 */
function getResponsibleLabel(
  payload: Record<string, unknown>,
  usersById: Record<string, string>,
): string | undefined {
  const id = payload.responsibleId;
  if (typeof id !== 'string' || id.trim().length === 0) return undefined;
  return usersById[id] ?? id;
}

export function OutboxItemCard({ item, onRetry, usersById = {} }: OutboxItemCardProps) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG[SyncStatus.PENDING];
  const responsible = getResponsibleLabel(item.payload, usersById);

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
        {responsible && (
          <Text style={styles.responsible}>Responsável: {responsible}</Text>
        )}
        <Text style={styles.detailText}>
          Coleta: {formatDateTime(item.measuredAt)}
        </Text>
        <Text style={styles.detailText}>
          Criado: {formatDateTime(item.createdAt)}
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
  responsible: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
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
