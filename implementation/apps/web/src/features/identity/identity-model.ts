export const APP_ROLES = ["management", "administration", "driver", "accounting"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface CurrentCompany {
  readonly id: string;
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly active: boolean;
}

export interface CurrentProfile {
  readonly id: string;
  readonly companyId: string;
  readonly displayName: string;
  readonly role: AppRole;
  readonly active: boolean;
}

export interface CurrentIdentity {
  readonly company: CurrentCompany;
  readonly profile: CurrentProfile;
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.some((role) => role === value);
}

export function isIdentityActive(identity: CurrentIdentity): boolean {
  return identity.company.active && identity.profile.active;
}
