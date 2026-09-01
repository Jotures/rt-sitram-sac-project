import type { PowerSyncBackendConnector } from "@powersync/web";
import type { Session } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { PowerSyncIdentityStore } from "./identity-store";
import { PowerSyncLifecycle, type PowerSyncLifecycleDatabase } from "./lifecycle-controller";

function session(userId: string): Session {
  return { user: { id: userId } } as unknown as Session;
}

function identityStore(initialUserId: string | null = null): PowerSyncIdentityStore {
  let userId = initialUserId;

  return {
    read: vi.fn(() => userId),
    write: vi.fn((nextUserId: string) => {
      userId = nextUserId;
    }),
    clear: vi.fn(() => {
      userId = null;
    }),
  };
}

function database(): PowerSyncLifecycleDatabase {
  return {
    connected: false,
    init: vi.fn(async () => undefined),
    connect: vi.fn(async () => undefined),
    disconnectAndClear: vi.fn(async () => undefined),
  };
}

function connector(): PowerSyncBackendConnector {
  return {
    fetchCredentials: vi.fn(async () => null),
    uploadData: vi.fn(async () => undefined),
  };
}

describe("PowerSync identity lifecycle", () => {
  it("keeps SQLite on application restart for the same persisted identity", async () => {
    const databaseForRestart = database();
    const lifecycle = new PowerSyncLifecycle(
      databaseForRestart,
      connector(),
      identityStore("user-a"),
    );

    await lifecycle.transitionToSession(session("user-a"));

    expect(databaseForRestart.disconnectAndClear).not.toHaveBeenCalled();
    expect(databaseForRestart.connect).toHaveBeenCalledTimes(1);
  });

  it("clears SQLite when the identity is unknown, changes, or logs out", async () => {
    const lifecycleDatabase = database();
    const store = identityStore();
    const lifecycle = new PowerSyncLifecycle(lifecycleDatabase, connector(), store);

    await lifecycle.transitionToSession(session("user-a"));
    await lifecycle.transitionToSession(session("user-b"));
    await lifecycle.transitionToSession(null);

    expect(lifecycleDatabase.disconnectAndClear).toHaveBeenCalledTimes(3);
    expect(lifecycleDatabase.connect).toHaveBeenCalledTimes(2);
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it("never clears an identity database when local recovery work blocks cleanup", async () => {
    const lifecycleDatabase = database();
    const store = identityStore("user-a");
    const guard = vi.fn(async () => {
      throw new Error("Hay trabajo local pendiente.");
    });
    const lifecycle = new PowerSyncLifecycle(lifecycleDatabase, connector(), store, guard);

    await expect(lifecycle.transitionToSession(null)).rejects.toThrow("trabajo local pendiente");

    expect(guard).toHaveBeenCalledTimes(1);
    expect(lifecycleDatabase.disconnectAndClear).not.toHaveBeenCalled();
    expect(store.clear).not.toHaveBeenCalled();
  });
});
