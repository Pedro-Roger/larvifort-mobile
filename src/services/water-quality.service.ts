import { getDb } from '../database/db';
import type { WaterQualityRecord } from '../types';

function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function saveOffline(
  data: Omit<WaterQualityRecord, 'clientId'>,
): Promise<string> {
  const db = await getDb();
  const clientId = generateUUID();
  const payload = { ...data, clientId };

  await db.runAsync(
    `INSERT INTO outbox (client_id, entity, payload, status, measured_at, created_at)
     VALUES (?, ?, ?, 'pending', ?, datetime('now'))`,
    [
      clientId,
      'water-quality',
      JSON.stringify(payload),
      data.measuredAt,
    ],
  );

  return clientId;
}
