import type { CommonPowerSyncDatabase } from "@powersync/web";
import { powerSyncDatabase } from "../../../lib/powersync/database";
import { powerSyncIdentityStore } from "../../../lib/powersync/identity-store";
import { getOfflineIdentity } from "../../../lib/powersync/offline-queries";
import { isAppRole } from "../identity-model";
import { loadCurrentIdentity, type IdentityLoadResult } from "./identity-gateway";

export async function loadIdentityFromPowerSync(
  userId: string,
  database: CommonPowerSyncDatabase = powerSyncDatabase,
): Promise<IdentityLoadResult> {
  await database.init();
  const row = await getOfflineIdentity(database, userId);

  if (row === null) {
    return {
      ok: false,
      reason: "NOT_FOUND",
      message: "La identidad todavía no está disponible en este dispositivo.",
    };
  }

  if (
    !isAppRole(row.role) ||
    ![0, 1].includes(row.profile_active) ||
    ![0, 1].includes(row.company_active)
  ) {
    return {
      ok: false,
      reason: "INVALID_DATA",
      message: "La identidad local no tiene una configuración válida.",
    };
  }

  return {
    ok: true,
    identity: {
      profile: {
        id: row.profile_id,
        companyId: row.company_id,
        displayName: row.display_name,
        role: row.role,
        active: row.profile_active === 1,
      },
      company: {
        id: row.company_id,
        legalName: row.legal_name,
        tradeName: row.trade_name,
        active: row.company_active === 1,
      },
    },
  };
}

export async function loadProductIdentity(userId: string): Promise<IdentityLoadResult> {
  const remote = await loadCurrentIdentity(userId);
  if (remote.ok || (remote.reason !== "QUERY_FAILED" && remote.reason !== "NOT_CONFIGURED"))
    return remote;

  // Never read a SQLite store that belongs to another authenticated identity.
  // The lifecycle clears it on account changes; this check also closes the
  // small mount-time race between the identity and PowerSync effects.
  if (powerSyncIdentityStore.read() !== userId) return remote;

  try {
    return await loadIdentityFromPowerSync(userId);
  } catch {
    return remote;
  }
}
