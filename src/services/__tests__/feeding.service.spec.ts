import { getPendingFeedKgForPond, saveOfflineFeeding } from '../feeding.service';

jest.mock('../../database/db', () => ({
  getDb: jest.fn(),
}));

import { getDb } from '../../database/db';

describe('feeding.service', () => {
  const mockDb = {
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
  };

  const payload = {
    cycleId: 'cycle-1',
    pondId: 'pond-1',
    productId: 'product-1',
    feedKg: 81.36,
    fedAt: '2026-07-25T07:00:00.000Z',
    responsibleId: 'user-1',
    responsibleName: 'João Silva',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
  });

  it('queues the feeding under the express route the API exposes', async () => {
    await saveOfflineFeeding(payload);

    const [sql, params] = mockDb.runAsync.mock.calls[0];
    expect(sql).toContain('INSERT OR REPLACE INTO outbox');
    // pushOutbox posts to /v1/<entity>, so the entity carries the full path
    expect(params).toContain('feeding/express');
  });

  it('carries a clientUuid so a replayed sync does not feed the pond twice', async () => {
    const clientId = await saveOfflineFeeding(payload);

    const body = JSON.parse(mockDb.runAsync.mock.calls[0][1][2]);
    expect(body.clientUuid).toBe(clientId);
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends what the express endpoint requires and nothing that is not a field', async () => {
    await saveOfflineFeeding({ ...payload, observation: 'coroa' });

    const body = JSON.parse(mockDb.runAsync.mock.calls[0][1][2]);
    expect(body).toEqual(
      expect.objectContaining({
        cycleId: 'cycle-1',
        pondId: 'pond-1',
        productId: 'product-1',
        feedKg: 81.36,
        fedAt: '2026-07-25T07:00:00.000Z',
        responsibleId: 'user-1',
        observation: 'coroa',
      }),
    );
    // the operator name is only for the local screen, the API resolves the user
    expect(body).not.toHaveProperty('responsibleName');
  });

  it('refuses a quantity that is not above zero', async () => {
    await expect(saveOfflineFeeding({ ...payload, feedKg: 0 })).rejects.toThrow('maior que zero');
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('sums what is still queued for a pond, so the field sees it before it syncs', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { payload: JSON.stringify({ pondId: 'pond-1', feedKg: 30 }) },
      { payload: JSON.stringify({ pondId: 'pond-1', feedKg: 51.36 }) },
      { payload: JSON.stringify({ pondId: 'pond-2', feedKg: 12 }) },
    ]);

    await expect(getPendingFeedKgForPond('pond-1')).resolves.toBeCloseTo(81.36, 2);
  });

  it('reports zero pending when the queue is empty', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await expect(getPendingFeedKgForPond('pond-1')).resolves.toBe(0);
  });
});
