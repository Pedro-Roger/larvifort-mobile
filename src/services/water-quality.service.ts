import { outboxRepository } from '../database/repositories/outbox.repository';
import { generateUUID } from '../utils/uuid';
import type { WaterQualityRecord } from '../types';

/**
 * Body actually accepted by CreateWaterQualityDto (POST /v1/water-quality).
 * The local form/type uses different names for the same values (oxygenMgL,
 * salinityPpt, MANUAL/VOZ) — this is where the two contracts get reconciled.
 * pondId and responsibleName are dropped: pondId isn't in the DTO (the API
 * derives it from cycleId) and responsibleName isn't whitelisted, so sending
 * either would make the whole request fail with forbidNonWhitelisted.
 */
export interface WaterQualityApiPayload {
  cycleId: string;
  responsibleId: string;
  doMgL?: number;
  ph?: number;
  salinity?: number;
  temperatureC?: number;
  ammoniaMgL?: number;
  measuredAt: string;
  source: 'manual' | 'voz';
  clientId: string;
}

export function buildWaterQualityApiPayload(
  data: Omit<WaterQualityRecord, 'clientId'>,
  clientId: string,
): WaterQualityApiPayload {
  return {
    cycleId: data.cycleId,
    responsibleId: data.responsibleId,
    doMgL: data.oxygenMgL,
    ph: data.ph,
    salinity: data.salinityPpt,
    temperatureC: data.temperatureC,
    ammoniaMgL: data.ammoniaMgL,
    measuredAt: data.measuredAt,
    source: data.origin === 'VOZ' ? 'voz' : 'manual',
    clientId,
  };
}

export async function saveOffline(
  data: Omit<WaterQualityRecord, 'clientId'>,
): Promise<string> {
  const clientId = generateUUID();
  const payload = buildWaterQualityApiPayload(data, clientId);

  await outboxRepository.enqueue({
    clientId,
    entity: 'water-quality',
    payload: { ...payload },
    measuredAt: data.measuredAt,
  });

  return clientId;
}
