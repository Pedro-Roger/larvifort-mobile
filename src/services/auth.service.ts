import * as SecureStore from 'expo-secure-store';
import { api } from './api';
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
