import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getMyFarms, switchFarmRequest, getActiveFarmId, saveActiveFarmId } from '../services/farm.service';
import type { Farm } from '../types';

export interface UseFarmReturn {
  farms: Farm[];
  activeFarm: Farm | null;
  /** Gate de carregamento: telas de domínio só podem montar depois que
   * /me/farms resolveu, senão disparam chamadas sem X-Farm-Id (403
   * mascarado de estado vazio — bug já visto no aquafort-web). */
  isLoading: boolean;
  isSwitching: boolean;
  switchFarm: (farmId: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Hook simples (useState/useEffect), mesmo padrão de useAuth.ts — sem
 * Redux/Context. Deve ser chamado uma única vez, no topo de
 * navigation/AppNavigator.tsx, e o retorno repassado por prop pra quem
 * precisa (ex: o seletor de fazenda no header), pra não disparar
 * `/me/farms` mais de uma vez por sessão nem duplicar estado.
 */
export function useFarm(isAuthenticated: boolean): UseFarmReturn {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const queryClient = useQueryClient();

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setFarms([]);
      setActiveFarmIdState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const list = await getMyFarms();
      setFarms(list);

      // RN-02: se a fazenda persistida não pertence (mais) ao usuário —
      // primeiro login, troca de operador no mesmo aparelho, fazenda
      // desvinculada — cai pra primeira fazenda vinculada.
      const persisted = await getActiveFarmId();
      const stillValid = list.some((f) => f.farmId === persisted);
      const resolved = stillValid ? persisted : (list[0]?.farmId ?? null);

      if (resolved && resolved !== persisted) {
        await saveActiveFarmId(resolved);
      }
      setActiveFarmIdState(resolved);
    } catch {
      setFarms([]);
      setActiveFarmIdState(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const switchFarm = useCallback(
    async (farmId: string) => {
      setIsSwitching(true);
      try {
        await switchFarmRequest(farmId);
        setActiveFarmIdState(farmId);
        // Todo dado carregado até aqui (cache do React Query) é da fazenda
        // anterior — descarta tudo pra recarregar sob o novo X-Farm-Id.
        queryClient.clear();
      } finally {
        setIsSwitching(false);
      }
    },
    [queryClient],
  );

  const activeFarm = farms.find((f) => f.farmId === activeFarmId) ?? null;

  return { farms, activeFarm, isLoading, isSwitching, switchFarm, reload: load };
}
