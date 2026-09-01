import { outboxRepository } from '../database/repositories/outbox.repository';
import { generateUUID } from '../utils/uuid';
import { getActiveFarmId } from './api';

/**
 * Feeding is what the field records most, and it is the number that moves
 * stock, so it has to survive a phone with no signal: every entry goes to the
 * local outbox first and is pushed when the connection comes back.
 */

export interface FeedingOfflinePayload {
  cycleId: string;
  pondId: string;
  productId: string;
  feedKg: number;
  fedAt: string;
  responsibleId: string;
  /** Shown on the local screen only — the API resolves the user from the id. */
  responsibleName?: string;
  observation?: string;
}

/** pushOutbox posts to `/v1/<entity>`, so the entity holds the whole path. */
const FEEDING_ENTITY = 'feeding/express';

export async function saveOfflineFeeding(payload: FeedingOfflinePayload): Promise<string> {
  if (!Number.isFinite(payload.feedKg) || payload.feedKg <= 0) {
    throw new Error('Quantidade de ração deve ser maior que zero');
  }

  const clientId = generateUUID();

  // Multi-fazenda: captura a fazenda ativa AGORA, no momento da criação —
  // ver EnqueueParams.farmId e biometric.service.ts.
  const farmId = await getActiveFarmId();
  if (!farmId) {
    throw new Error('Nenhuma fazenda ativa. Aguarde a sincronização de fazendas antes de registrar.');
  }

  // clientUuid makes the push idempotent: if the sync retries after a timeout,
  // the API returns the record it already has instead of feeding twice.
  const body = {
    cycleId: payload.cycleId,
    pondId: payload.pondId,
    productId: payload.productId,
    feedKg: payload.feedKg,
    fedAt: payload.fedAt,
    responsibleId: payload.responsibleId,
    observation: payload.observation,
    clientUuid: clientId,
  };

  await outboxRepository.enqueue({
    clientId,
    entity: FEEDING_ENTITY,
    payload: body,
    measuredAt: payload.fedAt,
    farmId,
  });

  return clientId;
}

/**
 * Feed already recorded on this phone but not yet synced. The screen adds it to
 * what the server knows, so the operator never sees a total that ignores what
 * they just typed.
 */
export async function getPendingFeedKgForPond(pondId: string): Promise<number> {
  const items = await outboxRepository.findPendingByEntity(FEEDING_ENTITY);

  return items.reduce((total, item) => {
    const parsed = item.payload as { pondId?: string; feedKg?: number };
    if (parsed.pondId !== pondId) return total;
    return total + (Number(parsed.feedKg) || 0);
  }, 0);
}
