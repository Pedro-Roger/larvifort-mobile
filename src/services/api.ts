import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'aquafort_token';
/**
 * Multi-fazenda (Entrega 4): fazenda ativa persistida aqui, no mesmo padrão
 * do token. Todo endpoint de domínio agora exige o header `X-Farm-Id`
 * (backend FarmScopeGuard) — sem ele, 403. Quem escreve essa chave é
 * src/hooks/useFarm.ts (via src/services/farm.service.ts).
 */
export const ACTIVE_FARM_KEY = 'aquafort_active_farm_id';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Um request que já chega com X-Farm-Id definido (ex: sync.service
  // reenviando um item da outbox com o farmId capturado na criação) tem
  // prioridade sobre a fazenda ativa agora — ver sync.service.ts.
  if (!config.headers['X-Farm-Id']) {
    const farmId = await SecureStore.getItemAsync(ACTIVE_FARM_KEY);
    if (farmId) {
      config.headers['X-Farm-Id'] = farmId;
    }
  }

  return config;
});

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveActiveFarmId(farmId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_FARM_KEY, farmId);
}

export async function getActiveFarmId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_FARM_KEY);
}

export async function clearActiveFarmId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_FARM_KEY);
}
