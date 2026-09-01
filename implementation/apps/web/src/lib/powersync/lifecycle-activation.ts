export type PowerSyncAuthResolutionStatus = "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED";

export function shouldManagePowerSyncLifecycle(status: PowerSyncAuthResolutionStatus): boolean {
  return status !== "INITIALIZING";
}
