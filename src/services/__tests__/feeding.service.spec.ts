import { getPendingFeedKgForPond, saveOfflineFeeding } from '../feeding.service';

jest.mock('../../database/repositories/outbox.repository', () => ({
  outboxRepository: {
    enqueue: jest.fn().mockResolvedValue(undefined),
    findPendingByEntity: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../api', () => ({
  getActiveFarmId: jest.fn(),
}));

import { outboxRepository } from '../../database/repositories/outbox.repository';
import { getActiveFarmId } from '../api';

describe('feeding.service', () => {
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
    (outboxRepository.enqueue as jest.Mock).mockResolvedValue(undefined);
    (outboxRepository.findPendingByEntity as jest.Mock).mockResolvedValue([]);
    (getActiveFarmId as jest.Mock).mockResolvedValue('farm-1');
  });

  it('captures the active farm at creation time and stores it on the outbox item', async () => {
    await saveOfflineFeeding(payload);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.farmId).toBe('farm-1');
  });

  it('refuses to queue a record when there is no active farm resolved yet', async () => {
    (getActiveFarmId as jest.Mock).mockResolvedValue(null);

    await expect(saveOfflineFeeding(payload)).rejects.toThrow('Nenhuma fazenda ativa');
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('queues the feeding under the express route the API exposes', async () => {
    await saveOfflineFeeding(payload);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    // pushOutbox posts to /v1/<entity>, so the entity carries the full path
    expect(params.entity).toBe('feeding/express');
  });

  it('carries a clientUuid so a replayed sync does not feed the pond twice', async () => {
    const clientId = await saveOfflineFeeding(payload);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.payload.clientUuid).toBe(clientId);
    expect(clientId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends what the express endpoint requires and nothing that is not a field', async () => {
    await saveOfflineFeeding({ ...payload, observation: 'coroa' });

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.payload).toEqual(
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
    expect(params.payload).not.toHaveProperty('responsibleName');
  });

  it('refuses a quantity that is not above zero', async () => {
    await expect(saveOfflineFeeding({ ...payload, feedKg: 0 })).rejects.toThrow('maior que zero');
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('sums what is still queued for a pond, so the field sees it before it syncs', async () => {
    (outboxRepository.findPendingByEntity as jest.Mock).mockResolvedValue([
      { payload: { pondId: 'pond-1', feedKg: 30 } },
      { payload: { pondId: 'pond-1', feedKg: 51.36 } },
      { payload: { pondId: 'pond-2', feedKg: 12 } },
    ]);

    await expect(getPendingFeedKgForPond('pond-1')).resolves.toBeCloseTo(81.36, 2);
  });

  it('reports zero pending when the queue is empty', async () => {
    (outboxRepository.findPendingByEntity as jest.Mock).mockResolvedValue([]);

    await expect(getPendingFeedKgForPond('pond-1')).resolves.toBe(0);
  });
});
