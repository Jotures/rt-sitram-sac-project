const ACTIVE_USER_STORAGE_KEY = "rt-sitram.powersync.active-user-id";

export interface PowerSyncIdentityStore {
  read(): string | null;
  write(userId: string): void;
  clear(): void;
}

export class BrowserPowerSyncIdentityStore implements PowerSyncIdentityStore {
  read(): string | null {
    return window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
  }

  write(userId: string): void {
    window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
  }

  clear(): void {
    window.localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
  }
}

export const powerSyncIdentityStore = new BrowserPowerSyncIdentityStore();
