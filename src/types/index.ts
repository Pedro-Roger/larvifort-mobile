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
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface FeedProduct {
  id: string;
  name: string;
  priceKg?: number | null;
  bagWeightKg?: number | null;
  active?: boolean;
}
