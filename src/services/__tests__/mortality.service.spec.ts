import { isRecordedAtTooFarInFuture, saveOfflineMortality } from '../mortality.service';

jest.mock('../../database/repositories/outbox.repository', () => ({
  outboxRepository: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../api', () => ({
  getActiveFarmId: jest.fn(),
}));

import { outboxRepository } from '../../database/repositories/outbox.repository';
import { getActiveFarmId } from '../api';

describe('mortality.service', () => {
  const payload = {
    cycleId: 'cycle-1',
    pondId: 'pond-1',
    quantity: 12,
    recordedAt: '2026-08-14T09:00:00.000Z',
    responsibleId: 'user-1',
    responsibleName: 'João Silva',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (outboxRepository.enqueue as jest.Mock).mockResolvedValue(undefined);
    (getActiveFarmId as jest.Mock).mockResolvedValue('farm-1');
  });

  it('captures the active farm at creation time and stores it on the outbox item', async () => {
    await saveOfflineMortality(payload);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.farmId).toBe('farm-1');
  });

  it('refuses to queue a record when there is no active farm resolved yet', async () => {
    (getActiveFarmId as jest.Mock).mockResolvedValue(null);

    await expect(saveOfflineMortality(payload)).rejects.toThrow('Nenhuma fazenda ativa');
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('queues the mortality record under the entity the API route expects', async () => {
    await saveOfflineMortality(payload);

    // pushOutbox posts to /v1/<entity> and the API exposes POST /v1/mortality
    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.entity).toBe('mortality');
  });

  it('carries a clientUuid so a replayed sync does not duplicate the record', async () => {
    const clientId = await saveOfflineMortality(payload);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.payload.clientUuid).toBe(clientId);
    expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates a fresh client_id on every call', async () => {
    const first = await saveOfflineMortality(payload);
    const second = await saveOfflineMortality(payload);
    expect(first).not.toBe(second);
  });

  it('sends what the mortality endpoint requires and nothing that is not a field', async () => {
    await saveOfflineMortality({ ...payload, observation: 'lâmina de O2 baixa' });

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.payload).toEqual(
      expect.objectContaining({
        cycleId: 'cycle-1',
        pondId: 'pond-1',
        quantity: 12,
        recordedAt: '2026-08-14T09:00:00.000Z',
        responsibleId: 'user-1',
        observation: 'lâmina de O2 baixa',
      }),
    );
    // the operator name is only for the local screen, the API resolves the user
    expect(params.payload).not.toHaveProperty('responsibleName');
  });

  it('queues with the recordedAt as the measured_at value', async () => {
    await saveOfflineMortality(payload);
    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.measuredAt).toBe('2026-08-14T09:00:00.000Z');
  });

  it('rejects a record missing the pond', async () => {
    const { pondId, ...rest } = payload;
    await expect(saveOfflineMortality(rest as any)).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a record missing the cycle', async () => {
    const { cycleId, ...rest } = payload;
    await expect(saveOfflineMortality(rest as any)).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a record missing the responsible', async () => {
    const { responsibleId, ...rest } = payload;
    await expect(saveOfflineMortality(rest as any)).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a quantity that is not above zero', async () => {
    await expect(saveOfflineMortality({ ...payload, quantity: 0 })).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a negative quantity', async () => {
    await expect(saveOfflineMortality({ ...payload, quantity: -5 })).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a non-integer quantity', async () => {
    await expect(saveOfflineMortality({ ...payload, quantity: 3.5 })).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a missing quantity', async () => {
    const { quantity, ...rest } = payload;
    await expect(saveOfflineMortality(rest as any)).rejects.toThrow();
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });
});

describe('isRecordedAtTooFarInFuture', () => {
  const now = new Date('2026-08-14T12:00:00.000Z');

  it('accepts a timestamp at the current time', () => {
    expect(isRecordedAtTooFarInFuture(now, now)).toBe(false);
  });

  it('accepts a timestamp within the 5 min tolerance', () => {
    const recordedAt = new Date(now.getTime() + 4 * 60 * 1000);
    expect(isRecordedAtTooFarInFuture(recordedAt, now)).toBe(false);
  });

  it('accepts a timestamp in the past', () => {
    const recordedAt = new Date(now.getTime() - 60 * 60 * 1000);
    expect(isRecordedAtTooFarInFuture(recordedAt, now)).toBe(false);
  });

  it('rejects a timestamp past the 5 min tolerance', () => {
    const recordedAt = new Date(now.getTime() + 6 * 60 * 1000);
    expect(isRecordedAtTooFarInFuture(recordedAt, now)).toBe(true);
  });
});
