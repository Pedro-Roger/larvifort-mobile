jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { api, ACTIVE_FARM_KEY } from '../api';

/**
 * O interceptor de request é `async`, registrado via
 * `api.interceptors.request.use(...)` — chama o handler direto, sem
 * disparar uma requisição HTTP de verdade.
 */
function runRequestInterceptor(config: Record<string, unknown>) {
  const handler = (api.interceptors.request as any).handlers[0].fulfilled;
  return handler(config);
}

describe('api request interceptor — X-Farm-Id (multi-fazenda)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('injects X-Farm-Id from the farm persisted in SecureStore', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key === ACTIVE_FARM_KEY ? 'farm-1' : null),
    );

    const config = await runRequestInterceptor({ headers: {} });

    expect(config.headers['X-Farm-Id']).toBe('farm-1');
  });

  it('does not overwrite an X-Farm-Id already set on the request', async () => {
    // sync.service.ts define X-Farm-Id explicitamente pra reenviar um item
    // da outbox com o farmId capturado na criação — não pode ser
    // sobrescrito pela fazenda ativa agora.
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
      Promise.resolve(key === ACTIVE_FARM_KEY ? 'farm-current' : null),
    );

    const config = await runRequestInterceptor({ headers: { 'X-Farm-Id': 'farm-captured' } });

    expect(config.headers['X-Farm-Id']).toBe('farm-captured');
  });

  it('does not set X-Farm-Id when there is no active farm persisted yet', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    const config = await runRequestInterceptor({ headers: {} });

    expect(config.headers['X-Farm-Id']).toBeUndefined();
  });

  it('still injects Authorization alongside X-Farm-Id', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) => {
      if (key === ACTIVE_FARM_KEY) return Promise.resolve('farm-1');
      return Promise.resolve('token-abc');
    });

    const config = await runRequestInterceptor({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer token-abc');
    expect(config.headers['X-Farm-Id']).toBe('farm-1');
  });
});
