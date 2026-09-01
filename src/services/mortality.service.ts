import { z } from 'zod';
import { outboxRepository } from '../database/repositories/outbox.repository';
import { generateUUID } from '../utils/uuid';
import { getActiveFarmId } from './api';

/**
 * Mortality feeds the survival math the whole cycle depends on (current
 * population, biomass estimate), so a bad record — wrong pond, no
 * responsible, a fractional death count — is worse than no record at all.
 * Validate before it ever reaches the outbox.
 */

// Mirrors CreateMortalityDto in aquafort-api (POST /v1/mortality).
const mortalityPayloadSchema = z.object({
  cycleId: z.string().min(1, 'Selecione um ciclo'),
  pondId: z.string().min(1, 'Selecione um viveiro'),
  quantity: z
    .number()
    .int('Quantidade deve ser um número inteiro')
    .positive('Quantidade deve ser maior que zero'),
  recordedAt: z.string().min(1, 'Informe a data/hora do registro'),
  cause: z.string().optional(),
  observation: z.string().optional(),
  responsibleId: z.string().min(1, 'Selecione o responsável'),
  /** Shown on the local screen only — the API resolves the user from the id. */
  responsibleName: z.string().optional(),
});

export type MortalityOfflinePayload = z.infer<typeof mortalityPayloadSchema>;

/** pushOutbox posts to `/v1/<entity>`, so the entity holds the whole path. */
const MORTALITY_ENTITY = 'mortality';

/** How far into the future a record can be timestamped before we ask the
 * operator to confirm — guards against a phone with the wrong clock, not a
 * hard rejection, since a few minutes of drift is normal. */
export const RECORDED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function isRecordedAtTooFarInFuture(recordedAt: Date, now: Date = new Date()): boolean {
  return recordedAt.getTime() > now.getTime() + RECORDED_AT_FUTURE_TOLERANCE_MS;
}

export async function saveOfflineMortality(payload: MortalityOfflinePayload): Promise<string> {
  const result = mortalityPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Dados inválidos para registro de mortalidade');
  }
  const data = result.data;

  const clientId = generateUUID();

  // Multi-fazenda: captura a fazenda ativa AGORA, no momento da criação —
  // ver EnqueueParams.farmId e biometric.service.ts.
  const farmId = await getActiveFarmId();
  if (!farmId) {
    throw new Error('Nenhuma fazenda ativa. Aguarde a sincronização de fazendas antes de registrar.');
  }

  // clientUuid makes the push idempotent: if the sync retries after a timeout,
  // the API returns the record it already has instead of counting the deaths twice.
  const body = {
    cycleId: data.cycleId,
    pondId: data.pondId,
    quantity: data.quantity,
    recordedAt: data.recordedAt,
    cause: data.cause,
    observation: data.observation,
    responsibleId: data.responsibleId,
    clientUuid: clientId,
  };

  await outboxRepository.enqueue({
    clientId,
    entity: MORTALITY_ENTITY,
    payload: body,
    measuredAt: data.recordedAt,
    farmId,
  });

  return clientId;
}
