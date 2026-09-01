import { PowerSyncDatabase } from "@powersync/web";
import { powerSyncSchema } from "./schema";

// PowerSync owns the browser persistence and SQLite/WASM lifecycle. Application
// code must never open or emulate this database through browser storage APIs.
export const powerSyncDatabase = new PowerSyncDatabase({
  schema: powerSyncSchema,
  database: {
    // Keep the existing filename so upgrades migrate/clear the same identity-bound
    // SQLite store instead of leaving the technical-spike database orphaned.
    dbFilename: "rt-sitram-technical-spike.db",
  },
});
