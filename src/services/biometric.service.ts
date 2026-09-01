import { outboxRepository } from '../database/repositories/outbox.repository';
import { generateUUID } from '../utils/uuid';
import { getActiveFarmId } from './api';

export interface BiometricOfflinePayload {
  cycleId: string;
  measuredAt: string;
  sampleCount: number;
  averageWeightG: number;
  survivalRatePct?: number;
  responsibleId: string;
  responsibleName: string;
}

/** How far into the future a measurement can be timestamped before we ask the
 * operator to confirm — guards against a phone with the wrong clock, not a
 * hard rejection, since a few minutes of drift is normal. */
export const MEASURED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function isMeasuredAtTooFarInFuture(measuredAt: Date, now: Date = new Date()): boolean {
  return measuredAt.getTime() > now.getTime() + MEASURED_AT_FUTURE_TOLERANCE_MS;
}

export async function saveOfflineBiometric(payload: BiometricOfflinePayload): Promise<string> {
  const clientId = generateUUID();

  // Multi-fazenda: captura a fazenda ativa AGORA, no momento da criação —
  // não pode ser lida de novo no sync.service, porque a fazenda ativa pode
  // mudar antes do registro sincronizar. Ver EnqueueParams.farmId.
  const farmId = await getActiveFarmId();
  if (!farmId) {
    throw new Error('Nenhuma fazenda ativa. Aguarde a sincronização de fazendas antes de registrar.');
  }

  // Mirrors CreateBiometricDto in aquafort-api (POST /v1/biometrics). The API
  // rejects unknown fields (forbidNonWhitelisted), so responsibleName stays
  // out of the body — it's only for the local screen; the outbox list
  // resolves the name from responsibleId via the local users cache.
  const body = {
    cycleId: payload.cycleId,
    measuredAt: payload.measuredAt,
    sampleCount: payload.sampleCount,
    averageWeightG: payload.averageWeightG,
    survivalRatePct: payload.survivalRatePct,
    responsibleId: payload.responsibleId,
  };

  await outboxRepository.enqueue({
    clientId,
    entity: 'biometrics',
    payload: body,
    measuredAt: payload.measuredAt,
    farmId,
  });

  return clientId;
}
