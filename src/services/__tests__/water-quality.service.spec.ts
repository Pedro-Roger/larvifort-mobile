import { buildWaterQualityApiPayload, saveOffline } from '../water-quality.service';

jest.mock('../../database/repositories/outbox.repository', () => ({
  outboxRepository: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

import { outboxRepository } from '../../database/repositories/outbox.repository';

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
  beforeEach(() => {
    jest.clearAllMocks();
    (outboxRepository.enqueue as jest.Mock).mockResolvedValue(undefined);
  });

  it('queues the API-shaped payload under the water-quality entity', async () => {
    await saveOffline({
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
    });

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.entity).toBe('water-quality');
    expect(params.payload).toEqual(
      expect.objectContaining({ doMgL: 5.2, salinity: 25, source: 'manual' }),
    );
    expect(params.payload).not.toHaveProperty('pondId');
    expect(params.payload).not.toHaveProperty('responsibleName');
  });
});
