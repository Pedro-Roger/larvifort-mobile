import { buildWaterQualityApiPayload, saveOffline } from '../water-quality.service';

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

describe('buildWaterQualityApiPayload', () => {
  // Mirrors CreateWaterQualityDto in aquafort-api (POST /v1/water-quality).
  it('maps the local form fields to the DTO field names the API expects', () => {
    const payload = buildWaterQualityApiPayload(
      {
        pondId: 'pond-1',
        cycleId: 'cycle-1',
        responsibleId: 'user-1',
        responsibleName: 'João Silva',
        oxygenMgL: 5.2,
        ph: 7.8,
        salinityPpt: 25,
        temperatureC: 28.5,
        ammoniaMgL: 0.1,
        measuredAt: '2026-08-14T09:00:00.000Z',
        origin: 'MANUAL',
      },
      'client-1',
    );

    expect(payload).toEqual({
      cycleId: 'cycle-1',
      responsibleId: 'user-1',
      doMgL: 5.2,
      ph: 7.8,
      salinity: 25,
      temperatureC: 28.5,
      ammoniaMgL: 0.1,
      measuredAt: '2026-08-14T09:00:00.000Z',
      source: 'manual',
      clientId: 'client-1',
    });
  });

  it('does not carry pondId or responsibleName — not part of the DTO', () => {
    const payload = buildWaterQualityApiPayload(
      {
        pondId: 'pond-1',
        cycleId: 'cycle-1',
        responsibleId: 'user-1',
        responsibleName: 'João Silva',
        measuredAt: '2026-08-14T09:00:00.000Z',
        origin: 'VOZ',
      },
      'client-2',
    );

    expect(payload).not.toHaveProperty('pondId');
    expect(payload).not.toHaveProperty('responsibleName');
    expect(payload.source).toBe('voz');
  });
});

describe('saveOffline', () => {
  const record = {
    pondId: 'pond-1',
    cycleId: 'cycle-1',
    responsibleId: 'user-1',
    responsibleName: 'João Silva',
    oxygenMgL: 5.2,
    ph: 7.8,
    salinityPpt: 25,
    temperatureC: 28.5,
    ammoniaMgL: 0.1,
    measuredAt: '2026-08-14T09:00:00.000Z',
    origin: 'MANUAL' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (outboxRepository.enqueue as jest.Mock).mockResolvedValue(undefined);
    (getActiveFarmId as jest.Mock).mockResolvedValue('farm-1');
  });

  it('queues the API-shaped payload under the water-quality entity', async () => {
    await saveOffline(record);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.entity).toBe('water-quality');
    expect(params.payload).toEqual(
      expect.objectContaining({ doMgL: 5.2, salinity: 25, source: 'manual' }),
    );
    expect(params.payload).not.toHaveProperty('pondId');
    expect(params.payload).not.toHaveProperty('responsibleName');
  });

  it('captures the active farm at creation time and stores it on the outbox item', async () => {
    await saveOffline(record);

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.farmId).toBe('farm-1');
  });

  it('refuses to queue a record when there is no active farm resolved yet', async () => {
    (getActiveFarmId as jest.Mock).mockResolvedValue(null);

    await expect(saveOffline(record)).rejects.toThrow('Nenhuma fazenda ativa');
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });
});
