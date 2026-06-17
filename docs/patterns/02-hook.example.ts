/**
 * PATTERN: Custom Hook — Aquafort Mobile
 *
 * Localização: src/hooks/use<Feature>.ts
 *
 * RESPONSABILIDADE: Toda a lógica de acesso a dados.
 *   - React Query para cache + revalidação
 *   - Fallback offline para SQLite
 *   - Mutações com otimistic update
 *   - Exposição simples para as Screens
 *
 * CLEAN CODE:
 *   - Um arquivo por feature
 *   - Cada hook exportado faz UMA coisa
 *   - Screens nunca sabem se os dados vêm da API ou do cache
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { api } from '../services/api';
import { outboxRepository } from '../database/repositories/outbox.repository';
import { readingsRepository } from '../database/repositories/readings.repository';
import type { WaterQualityReading, CreateReadingPayload } from '../types/api.types';

// ─────────────────────────────────────────────────────────────────────────────
// CHAVES DE QUERY — centralizadas para invalidação consistente
// ─────────────────────────────────────────────────────────────────────────────

export const waterQualityKeys = {
  all: ['water-quality'] as const,
  byPond: (pondId: string | null) => [...waterQualityKeys.all, 'pond', pondId] as const,
  status: (pondId: string | null) => [...waterQualityKeys.all, 'status', pondId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// useWaterQuality — lê leituras com fallback offline
// ─────────────────────────────────────────────────────────────────────────────

export function useWaterQuality(pondId: string | null) {
  const query = useQuery({
    queryKey: waterQualityKeys.byPond(pondId),
    queryFn: () => fetchReadings(pondId!),
    enabled: !!pondId,
    staleTime: 1000 * 60 * 2, // 2 min — dados de campo mudam devagar
    // placeholderData mantém dados antigos enquanto recarrega (sem flash de loading)
    placeholderData: (previousData) => previousData,
  });

  // O₂ status calculado localmente (não precisa de endpoint separado)
  const latestReading = query.data?.[0];
  const o2Status = latestReading?.oxygenMgL
    ? classifyO2(latestReading.oxygenMgL)
    : 'DESCONHECIDO';

  return {
    readings: query.data ?? [],
    o2Status,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

async function fetchReadings(pondId: string): Promise<WaterQualityReading[]> {
  const { isConnected } = await NetInfo.fetch();

  if (isConnected) {
    // Online: busca da API e salva cache local
    const response = await api.get<WaterQualityReading[]>('/v1/water-quality/readings', {
      params: { pondId, limit: 50 },
    });
    await readingsRepository.upsertMany(response.data); // salva para uso offline
    return response.data;
  }

  // Offline: retorna do cache SQLite
  return readingsRepository.findByPond(pondId, { limit: 50 });
}

// ─────────────────────────────────────────────────────────────────────────────
// useCreateReading — cria com suporte offline
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateReading() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReadingPayload) => submitReading(data),

    // Optimistic update: adiciona a leitura na lista antes da confirmação
    onMutate: async (newReading) => {
      await queryClient.cancelQueries({ queryKey: waterQualityKeys.byPond(newReading.pondId) });

      const previous = queryClient.getQueryData<WaterQualityReading[]>(
        waterQualityKeys.byPond(newReading.pondId),
      );

      queryClient.setQueryData<WaterQualityReading[]>(
        waterQualityKeys.byPond(newReading.pondId),
        (old) => [
          {
            id: `temp-${Date.now()}`, // ID temporário até confirmação
            ...newReading,
            synced: false,
          } as any,
          ...(old ?? []),
        ],
      );

      return { previous }; // contexto para rollback
    },

    // Rollback se falhar (erro de rede inesperado)
    onError: (_error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(waterQualityKeys.byPond(variables.pondId), context.previous);
      }
    },

    // Revalida após sucesso (substitui o temp ID pelo real)
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: waterQualityKeys.byPond(variables.pondId) });
    },
  });
}

async function submitReading(data: CreateReadingPayload): Promise<WaterQualityReading> {
  const clientUuid = Crypto.randomUUID();
  const { isConnected } = await NetInfo.fetch();

  if (isConnected) {
    const response = await api.post<WaterQualityReading>('/v1/water-quality/readings', {
      ...data,
      clientUuid,
    });
    return response.data;
  }

  // Offline: salva na fila de sync
  await outboxRepository.enqueue({
    clientUuid,
    entity: 'water_quality_reading',
    endpoint: '/v1/water-quality/readings',
    payload: { ...data, clientUuid },
  });

  // Retorna objeto "fake" para o optimistic update não quebrar
  return {
    id: clientUuid,
    ...data,
    synced: false,
    createdAt: new Date().toISOString(),
  } as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// useNetworkStatus — detecta online/offline
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}

// ─────────────────────────────────────────────────────────────────────────────
// useSync — controla a fila de sincronização
// ─────────────────────────────────────────────────────────────────────────────

import { startSyncMonitor, syncBatch } from '../services/sync';

export function useSync() {
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Atualiza contagem de pendentes ao montar
    outboxRepository.countPending().then(setPendingCount);
  }, []);

  useEffect(() => {
    // Dispara sync automático quando reconecta
    const stop = startSyncMonitor(() => runSync());
    return stop;
  }, []);

  async function runSync() {
    const pending = await outboxRepository.findAllPending();
    if (pending.length === 0) return;

    setIsSyncing(true);

    // Agrupa por endpoint para batch eficiente
    const byEndpoint = groupBy(pending, (item) => item.endpoint);

    for (const [endpoint, items] of Object.entries(byEndpoint)) {
      const { accepted, failed } = await syncBatch(items, endpoint);

      if (accepted.length > 0) {
        await outboxRepository.markSynced(accepted);
      }
      if (failed.length > 0) {
        await outboxRepository.incrementAttempts(failed);
      }
    }

    const remaining = await outboxRepository.countPending();
    setPendingCount(remaining);
    setIsSyncing(false);

    // Invalida queries para refletir dados sincronizados
    queryClient.invalidateQueries({ queryKey: waterQualityKeys.all });
  }

  return { pendingCount, isSyncing, syncNow: runSync };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS LOCAIS
// ─────────────────────────────────────────────────────────────────────────────

function classifyO2(oxygenMgL: number): 'VERDE' | 'AMARELO' | 'VERMELHO' {
  if (oxygenMgL >= 5.0) return 'VERDE';
  if (oxygenMgL >= 3.5) return 'AMARELO';
  return 'VERMELHO';
}

function groupBy<T>(array: T[], key: (item: T) => string): Record<string, T[]> {
  return array.reduce(
    (acc, item) => {
      const k = key(item);
      acc[k] = acc[k] ?? [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}
