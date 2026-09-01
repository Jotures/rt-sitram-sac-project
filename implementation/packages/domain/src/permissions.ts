export type Role = "management" | "administration" | "driver" | "accounting";

export type PresentationPermission =
  | "VIEW_FULL_DASHBOARD"
  | "VIEW_OWN_TRIP"
  | "VIEW_FINANCIAL_DOCUMENTS"
  | "VIEW_PROFITABILITY"
  | "MANAGE_MASTER_DATA"
  | "MANAGE_TRIPS"
  | "RECORD_OWN_TRIP_ACTIVITY"
  | "REVIEW_EXPENSES"
  | "CLOSE_SETTLEMENT"
  | "MANAGE_MAINTENANCE"
  | "MANAGE_RECEIVABLES"
  | "EXPORT_ACCOUNTING"
  | "MANAGE_USERS"
  | "APPROVE_MARGIN_EXCEPTION"
  | "REOPEN_CLOSED_RECORDS";

const rolePermissions: Readonly<Record<Role, ReadonlySet<PresentationPermission>>> = {
  management: new Set<PresentationPermission>([
    "VIEW_FULL_DASHBOARD",
    "VIEW_OWN_TRIP",
    "VIEW_FINANCIAL_DOCUMENTS",
    "VIEW_PROFITABILITY",
    "MANAGE_MASTER_DATA",
    "MANAGE_TRIPS",
    "RECORD_OWN_TRIP_ACTIVITY",
    "REVIEW_EXPENSES",
    "CLOSE_SETTLEMENT",
    "MANAGE_MAINTENANCE",
    "MANAGE_RECEIVABLES",
    "EXPORT_ACCOUNTING",
    "MANAGE_USERS",
    "APPROVE_MARGIN_EXCEPTION",
    "REOPEN_CLOSED_RECORDS",
  ]),
  administration: new Set<PresentationPermission>([
    "VIEW_FULL_DASHBOARD",
    "VIEW_FINANCIAL_DOCUMENTS",
    "VIEW_PROFITABILITY",
    "MANAGE_MASTER_DATA",
    "MANAGE_TRIPS",
    "REVIEW_EXPENSES",
    "CLOSE_SETTLEMENT",
    "MANAGE_MAINTENANCE",
    "MANAGE_RECEIVABLES",
    "EXPORT_ACCOUNTING",
  ]),
  driver: new Set<PresentationPermission>(["VIEW_OWN_TRIP", "RECORD_OWN_TRIP_ACTIVITY"]),
  accounting: new Set<PresentationPermission>(["VIEW_FINANCIAL_DOCUMENTS", "EXPORT_ACCOUNTING"]),
};

export function canPresent(role: Role, permission: PresentationPermission): boolean {
  return rolePermissions[role].has(permission);
}

export function getPresentationPermissions(role: Role): readonly PresentationPermission[] {
  return [...rolePermissions[role]];
}

export function canPresentProfile(input: {
  readonly actorRole: Role;
  readonly actorCompanyId: string;
  readonly actorProfileId: string;
  readonly targetCompanyId: string;
  readonly targetProfileId: string;
}): boolean {
  if (input.actorCompanyId !== input.targetCompanyId) {
    return false;
  }

  if (input.actorRole === "management" || input.actorRole === "administration") {
    return true;
  }

  return input.actorProfileId === input.targetProfileId;
}
