import { canPresent, type PresentationPermission, type Role } from "@rt-sitram/domain";

export interface ActorContext {
  readonly profileId: string;
  readonly companyId: string;
  readonly role: Role;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export function requirePermission(actor: ActorContext, permission: PresentationPermission): void {
  if (!canPresent(actor.role, permission)) {
    throw new Error("No tienes permiso para realizar esta operación.");
  }
}

export function requireSameCompany(actor: ActorContext, companyId: string): void {
  if (actor.companyId !== companyId) {
    throw new Error("No se puede operar información de otra empresa.");
  }
}

export function toIsoTimestamp(value: Date): string {
  if (!Number.isFinite(value.getTime())) {
    throw new Error("La fecha debe ser válida.");
  }
  return value.toISOString();
}

export function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized === "") {
    throw new Error(`${label} es obligatorio.`);
  }
  return normalized;
}

export function requireFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número finito no negativo.`);
  }
}
