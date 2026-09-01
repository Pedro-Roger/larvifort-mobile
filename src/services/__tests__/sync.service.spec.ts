jest.mock('../api', () => ({
  api: { post: jest.fn(), get: jest.fn() },
  getActiveFarmId: jest.fn(),
}));
jest.mock('../../database/db', () => ({
  getDb: jest.fn(),
}));
jest.mock('@react-native-community/netinfo', () => ({
  default: { fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }) },
}));

import { pushOutbox } from '../sync.service';
import { api, getActiveFarmId } from '../api';
import { getDb } from '../../database/db';

const mockDb = {
  getAllAsync: jest.fn(),
  runAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn(),
};

describe('pushOutbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'server-id' } });
    (getActiveFarmId as jest.Mock).mockResolvedValue(null);
  });

  it('should POST biometric to /v1/biometrics (not /v1/biometric)', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        client_id: 'uuid-1',
        entity: 'biometrics',
        payload: JSON.stringify({ cycleId: 'c1', averageWeightG: 5.5 }),
        attempts: 0,
      },
    ]);

    await pushOutbox();

    expect(api.post).toHaveBeenCalledWith('/v1/biometrics', expect.objectContaining({ cycleId: 'c1' }));
  });

  it('should POST water-quality to /v1/water-quality (not /v1/water-quality/readings)', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        client_id: 'uuid-2',
        entity: 'water-quality',
        payload: JSON.stringify({ cycleId: 'c1', doMgL: 5.0 }),
        attempts: 0,
      },
    ]);

    await pushOutbox();

    expect(api.post).toHaveBeenCalledWith('/v1/water-quality', expect.objectContaining({ cycleId: 'c1' }));
  });

  it('should POST mortality to /v1/mortality, matching the mortality.service outbox entity', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        client_id: 'uuid-3',
        entity: 'mortality',
        payload: JSON.stringify({ cycleId: 'c1', quantity: 12 }),
        attempts: 0,
      },
    ]);

    await pushOutbox();

    expect(api.post).toHaveBeenCalledWith('/v1/mortality', expect.objectContaining({ cycleId: 'c1' }));
  });

  it('should mark item as synced after successful POST', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { client_id: 'uuid-1', entity: 'biometrics', payload: '{}', attempts: 0 },
    ]);

    await pushOutbox();

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'synced'"),
      ['uuid-1'],
    );
  });

  it('should mark as error after 3 failed attempts', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('Network error'));
    mockDb.getAllAsync.mockResolvedValue([
      { client_id: 'uuid-fail', entity: 'biometrics', payload: '{}', attempts: 2 },
    ]);

    await pushOutbox();

    const calls = (mockDb.runAsync as jest.Mock).mock.calls;
    const errorCall = calls.find((c: any[]) => c[0].includes("status = 'error'"));
    expect(errorCall).toBeDefined();
  });

  it('should not block remaining items when one fails', async () => {
    (api.post as jest.Mock)
      .mockRejectedValueOnce(new Error('first fails'))
      .mockResolvedValueOnce({ data: {} });

    mockDb.getAllAsync.mockResolvedValue([
      { client_id: 'fail-1', entity: 'biometrics', payload: '{}', attempts: 0 },
      { client_id: 'ok-2', entity: 'biometrics', payload: '{}', attempts: 0 },
    ]);

    const result = await pushOutbox();

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────
  // Multi-fazenda (Entrega 4) — achado crítico: um registro criado offline
  // precisa sincronizar com o farmId capturado NO MOMENTO DA CRIAÇÃO, não
  // com a fazenda ativa no momento do sync (que pode ter mudado no
  // intervalo). Ver src/services/sync.service.ts e
  // src/database/repositories/outbox.repository.ts (EnqueueParams.farmId).
  // ───────────────────────────────────────────────────────────────────────

  it('syncs an item with the farmId captured at creation time (farm A), even if the active farm changed to B before sync', async () => {
    // Fazenda ativa MUDOU pra B entre a criação do registro e o sync.
    (getActiveFarmId as jest.Mock).mockResolvedValue('farm-B');

    mockDb.getAllAsync.mockResolvedValue([
      {
        client_id: 'uuid-offline-1',
        entity: 'biometrics',
        payload: JSON.stringify({ cycleId: 'c1' }),
        attempts: 0,
        farm_id: 'farm-A', // capturado na criação, quando a fazenda ativa era A
      },
    ]);

    await pushOutbox();

    expect(api.post).toHaveBeenCalledWith(
      '/v1/biometrics',
      expect.objectContaining({ cycleId: 'c1' }),
      { headers: { 'X-Farm-Id': 'farm-A' } },
    );
  });

  it('falls back to the currently active farm only for legacy items enqueued before farm_id existed', async () => {
    (getActiveFarmId as jest.Mock).mockResolvedValue('farm-current');

    mockDb.getAllAsync.mockResolvedValue([
      {
        client_id: 'uuid-legacy',
        entity: 'biometrics',
        payload: JSON.stringify({ cycleId: 'c1' }),
        attempts: 0,
        farm_id: null,
      },
    ]);

    await pushOutbox();

    expect(api.post).toHaveBeenCalledWith(
      '/v1/biometrics',
      expect.objectContaining({ cycleId: 'c1' }),
      { headers: { 'X-Farm-Id': 'farm-current' } },
    );
  });
});
