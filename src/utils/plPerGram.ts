/**
 * RN-09: PL/grama and average individual weight are exact inverses.
 * `pl_por_grama = 1 / avg_weight_g` and `avg_weight_g = 1 / pl_por_grama`.
 * Reference (Pedro, campo real): 800.000 PLs a 250 PL/g = 3.200 g de biomassa
 * total; peso individual = 3.200 / 800.000 = 0,004 g = 1/250 — confere.
 */
export function plPerGramToAverageWeightG(plPerGram: number): number {
  if (!Number.isFinite(plPerGram) || plPerGram <= 0) return 0;
  return 1 / plPerGram;
}

export function averageWeightGToPlPerGram(averageWeightG: number): number {
  if (!Number.isFinite(averageWeightG) || averageWeightG <= 0) return 0;
  return 1 / averageWeightG;
}

/**
 * RN-10: the unit biometry is entered in depends on the `type` of the
 * cycle's viveiro (`pond.type`). Only `bercario` (VB) enters as PL/g —
 * `engorda` and `reprodutor` (VE) keep grams, unchanged.
 */
export function isBercarioPondType(pondType?: string | null): boolean {
  return pondType === 'BERCARIO';
}

/**
 * RF-10/RF-11: the biometry form reads its weight field as PL/g for a
 * bercario cycle and converts it to `avg_weight_g` (RN-09) before it ever
 * reaches the offline payload; every other pond type is a no-op.
 */
export function resolveAverageWeightGInput(rawValue: number, pondType?: string | null): number {
  return isBercarioPondType(pondType) ? plPerGramToAverageWeightG(rawValue) : rawValue;
}
