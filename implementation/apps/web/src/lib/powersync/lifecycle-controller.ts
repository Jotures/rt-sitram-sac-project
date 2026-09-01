import type { PowerSyncBackendConnector } from "@powersync/web";
import type { Session } from "@supabase/supabase-js";
import type { PowerSyncIdentityStore } from "./identity-store";

export interface PowerSyncLifecycleDatabase {
  readonly connected: boolean;
  init(): Promise<void>;
  connect(connector: PowerSyncBackendConnector): Promise<void>;
  disconnectAndClear(): Promise<void>;
}

export class PowerSyncLifecycle {
  private databasePrepared = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly database: PowerSyncLifecycleDatabase,
    private readonly connector: PowerSyncBackendConnector | null,
    private readonly identityStore: PowerSyncIdentityStore,
    private readonly beforeDestructiveClear: (() => Promise<void>) | null = null,
  ) {}

  transitionToSession(session: Session | null): Promise<void> {
    this.queue = this.queue.catch(() => undefined).then(async () => this.applySession(session));

    return this.queue;
  }

  private async applySession(session: Session | null): Promise<void> {
    await this.database.init();
    const nextUserId = session?.user.id ?? null;

    if (nextUserId === null) {
      if (this.databasePrepared || this.database.connected || this.identityStore.read() !== null) {
        await this.beforeDestructiveClear?.();
        await this.database.disconnectAndClear();
      }

      this.identityStore.clear();
      this.databasePrepared = true;

      return;
    }

    const storedUserId = this.identityStore.read();
    const needsCleanup = storedUserId !== nextUserId;

    if (needsCleanup) {
      await this.beforeDestructiveClear?.();
      await this.database.disconnectAndClear();
      this.identityStore.write(nextUserId);
    }

    this.databasePrepared = true;
    if (this.connector !== null && !this.database.connected) {
      await this.database.connect(this.connector);
    }
  }
}
