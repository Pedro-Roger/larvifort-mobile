import { saveOfflineBiometric } from '../biometric.service';

// Mock the db module
jest.mock('../../database/db', () => ({
  getDb: jest.fn(),
}));

import { getDb } from '../../database/db';

describe('biometric.service', () => {
  const mockDb = {
    runAsync: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDb as jest.Mock).mockResolvedValue(mockDb);
  });

  it('should insert a biometric record into the outbox', async () => {
    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 30,
      averageWeightG: 5.5,
      survivalRatePct: 85,
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
    });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO outbox'),
      expect.arrayContaining(['biometrics']),
    );
  });

  it('should generate a client_id UUID', async () => {
    const calls: any[] = [];
    mockDb.runAsync.mockImplementation((sql: string, params: any[]) => {
      calls.push({ sql, params });
      return Promise.resolve();
    });

    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 20,
      averageWeightG: 6.0,
      responsibleId: 'user-1',
      responsibleName: 'João Silva',
    });

    const clientId = calls[0].params[0];
    // UUID v4 pattern
    expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should store responsible_id and responsible_name in payload', async () => {
    const calls: any[] = [];
    mockDb.runAsync.mockImplementation((sql: string, params: any[]) => {
      calls.push({ sql, params });
      return Promise.resolve();
    });

    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 25,
      averageWeightG: 7.2,
      responsibleId: 'user-42',
      responsibleName: 'Maria Costa',
    });

    const payloadStr = calls[0].params.find((p: any) => typeof p === 'string' && p.includes('responsible'));
    expect(payloadStr).toBeDefined();
    const payload = JSON.parse(payloadStr);
    expect(payload.responsibleId).toBe('user-42');
    expect(payload.responsibleName).toBe('Maria Costa');
  });

  it('should set status to pending', async () => {
    const calls: any[] = [];
    mockDb.runAsync.mockImplementation((sql: string, params: any[]) => {
      calls.push({ sql, params });
      return Promise.resolve();
    });

    await saveOfflineBiometric({
      cycleId: 'cycle-1',
      measuredAt: '2026-06-18T10:00:00.000Z',
      sampleCount: 15,
      averageWeightG: 4.8,
      responsibleId: 'user-1',
      responsibleName: 'Test',
    });

    expect(calls[0].params).toContain('pending');
  });
});
