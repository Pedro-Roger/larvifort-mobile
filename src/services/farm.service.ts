import { api, saveActiveFarmId, getActiveFarmId, clearActiveFarmId } from './api';
import { updateTokens } from './auth.service';
import type { Farm, SwitchFarmResult } from '../types';

/** GET /v1/me/farms — fazendas e papéis do usuário logado. */
export async function getMyFarms(): Promise<Farm[]> {
  const response = await api.get<Farm[]>('/v1/me/farms');
  return response.data;
}

/**
 * POST /v1/auth/switch-farm — troca a fazenda ativa. Rotaciona o par de
 * tokens (o backend reassina o JWT com a fazenda selecionada) e persiste a
 * nova fazenda ativa no SecureStore, que é o que o interceptor de
 * src/services/api.ts lê pra injetar X-Farm-Id nas próximas requisições.
 */
export async function switchFarmRequest(farmId: string): Promise<SwitchFarmResult> {
  const response = await api.post<SwitchFarmResult>('/v1/auth/switch-farm', { farmId });
  const { accessToken, refreshToken } = response.data;

  await updateTokens(accessToken, refreshToken);
  await saveActiveFarmId(farmId);

  return response.data;
}

export { getActiveFarmId, saveActiveFarmId, clearActiveFarmId };
