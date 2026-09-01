import { saveOfflineBiometric } from '../biometric.service';

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

describe('biometric.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (outboxRepository.enqueue as jest.Mock).mockResolvedValue(undefined);
    (getActiveFarmId as jest.Mock).mockResolvedValue('farm-1');
  });

  // Multi-fazenda: farmId é capturado NA CRIAÇÃO, não relido no sync — ver
  // sync.service.spec.ts para o cenário completo de fazenda ativa mudando
  // antes do sync.
  it('captures the active farm at creation time and stores it on the outbox item', async () => {
    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 30,
      averageWeightG: 5.5,
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
    });

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.farmId).toBe('farm-1');
  });

  it('refuses to queue a record when there is no active farm resolved yet', async () => {
    (getActiveFarmId as jest.Mock).mockResolvedValue(null);

    await expect(
      saveOfflineBiometric({
        cycleId: 'cycle-1',
        measuredAt: '2026-06-18T10:00:00.000Z',
        sampleCount: 30,
        averageWeightG: 5.5,
        responsibleId: 'user-1',
        responsibleName: 'João Silva',
      }),
    ).rejects.toThrow('Nenhuma fazenda ativa');
    expect(outboxRepository.enqueue).not.toHaveBeenCalled();
  });

  it('should insert a biometric record into the outbox under the biometrics entity', async () => {
    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 30,
      averageWeightG: 5.5,
      survivalRatePct: 85,
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
    });

    expect(outboxRepository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'biometrics' }),
    );
  });

  it('should generate a client_id UUID', async () => {
    const clientId = await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 20,
      averageWeightG: 6.0,
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
    });

    // UUID v4 pattern
    expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.clientId).toBe(clientId);
  });

  it('should store responsible_id in payload but keep responsible_name out of it (RF-12 / API contract)', async () => {
    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 25,
      averageWeightG: 7.2,
      responsibleId: 'user-42',
      responsibleName: 'Maria Costa',
    });

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.payload.responsibleId).toBe('user-42');
    // CreateBiometricDto on the API doesn't whitelist responsibleName — the
    // request pipeline (forbidNonWhitelisted) would reject the whole POST if
    // it were sent. The name is only for the local form/screen.
    expect(params.payload).not.toHaveProperty('responsibleName');
  });

  it('should queue with the measuredAt as the measured_at value', async () => {
    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 15,
      averageWeightG: 4.8,
      responsibleId: 'user-1',
      responsibleName: 'Test',
    });

    const [params] = (outboxRepository.enqueue as jest.Mock).mock.calls[0];
    expect(params.measuredAt).toBe('2026-06-18T10:00:00.000Z');
  });
});
