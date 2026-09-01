// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  FIELD_WORKER = 'FIELD_WORKER',
}

export enum PondStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum CyclePhase {
  PRE_BERCARIO = 'PRE_BERCARIO',
  BERCARIO = 'BERCARIO',
  ENGORDA = 'ENGORDA',
}

export enum CycleStatus {
  PLANEJADO = 'PLANEJADO',
  ATIVO = 'ATIVO',
  COLHIDO = 'COLHIDO',
  CANCELADO = 'CANCELADO',
}

export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  ERROR = 'error',
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  active: boolean;
  updatedAt: string;
}

export interface Pond {
  id: string;
  code: string;
  name: string;
  type: string;
  areaHa: number;
  status: PondStatus;
  updatedAt: string;
}

export interface Cycle {
  id: string;
  pondId: string;
  phase: CyclePhase;
  status: CycleStatus;
  supplier?: string;
  stockDate?: string;
  updatedAt: string;
  // computed / joined
  pondCode?: string;
  pondName?: string;
  daysOfCulture?: number;
}

export interface WaterQualityRecord {
  clientId: string;
  pondId: string;
  cycleId: string;
  responsibleId: string;
  responsibleName?: string;
  oxygenMgL?: number;
  ph?: number;
  salinityPpt?: number;
  temperatureC?: number;
  ammoniaMgL?: number;
  measuredAt: string;
  origin: 'MANUAL' | 'VOZ';
}

export interface OutboxItem {
  clientId: string;
  entity: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  attempts: number;
  measuredAt: string;
  createdAt: string;
  lastError?: string;
  /**
   * Multi-fazenda: fazenda ativa no momento em que o registro foi CRIADO
   * offline, não a fazenda ativa no momento do sync (que pode ter mudado
   * entre a captura em campo e a sincronização). `undefined` só ocorre em
   * registros legados enfileirados antes desta coluna existir — ver
   * sync.service.ts para o fallback aplicado a esses casos.
   */
  farmId?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-fazenda (Entrega 4)
// ─────────────────────────────────────────────────────────────────────────────

export type FarmMembershipStatus = 'ACTIVE' | 'INACTIVE';

/** Espelha o response de GET /v1/me/farms. */
export interface Farm {
  farmId: string;
  farmName: string;
  role: UserRole;
  status: FarmMembershipStatus;
}

/** Espelha o response de POST /v1/auth/switch-farm. */
export interface SwitchFarmResult {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  farmId: string;
  role: UserRole;
  farmStatus: FarmMembershipStatus;
}

export interface FeedProduct {
  id: string;
  name: string;
  priceKg?: number | null;
  bagWeightKg?: number | null;
  active?: boolean;
}
