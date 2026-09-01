import * as SecureStore from 'expo-secure-store';
import { api, clearActiveFarmId } from './api';
import type { AuthUser } from '../types';

const ACCESS_TOKEN_KEY = 'aquafort_token';
const REFRESH_TOKEN_KEY = 'aquafort_refresh_token';
const USER_KEY = 'aquafort_user';

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await api.post<LoginResponse>('/v1/auth/login', { email, password });
  const { accessToken, refreshToken, user } = response.data;

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

  return user;
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  // Sem isso, o próximo login neste aparelho herdaria a fazenda ativa do
  // usuário anterior até /me/farms resolver (RN-02 cobre esse fallback, mas
  // não há motivo pra depender dele aqui).
  await clearActiveFarmId();
}

/**
 * Multi-fazenda: POST /v1/auth/switch-farm rotaciona o par de tokens (o novo
 * JWT carrega as mesmas farms/role de sempre, só re-assinado) — mesmo
 * comportamento do aquafort-web (`setAuth()` em FarmProvider.switchFarm).
 * Exportado para farm.service.ts chamar depois de uma troca de fazenda bem
 * sucedida, sem duplicar as chaves do SecureStore aqui.
 */
export async function updateTokens(accessToken: string, refreshToken?: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

export async function getMe(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function fetchMe(): Promise<AuthUser> {
  const response = await api.get<AuthUser>('/v1/auth/me');
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.data));
  return response.data;
}
