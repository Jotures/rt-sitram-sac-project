import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(
  scriptDirectory,
  "..",
  "..",
  "..",
  "supabase",
  "functions",
  "invite-company-user",
  "index.ts",
);
const source = await readFile(sourcePath, "utf8");

assert.match(source, /auth\.getUser\(\)/u, "caller JWT must be verified inside the function");
assert.match(source, /actor\.role !== "management"/u, "caller must be active management");
assert.match(
  source,
  /company_id: actor\.company_id/u,
  "company must be resolved from caller profile",
);
assert.doesNotMatch(
  source,
  /input\.company_id/u,
  "company_id must never be accepted from the request",
);
assert.doesNotMatch(source, /input\.password/u, "password must never be accepted from the request");
assert.match(source, /inviteUserByEmail/u, "Auth invitation flow must be used");
assert.match(
  source,
  /Deno\.env\.get\("APP_ORIGIN"\)/u,
  "the trusted application origin must come from Edge Function configuration",
);
assert.doesNotMatch(
  source,
  /Deno\.env\.get\("SITE_URL"\)/u,
  "the invitation redirect must not silently fall back to another setting",
);
assert.match(
  source,
  /\/auth\/establecer-clave\?intent=invite/u,
  "invitations must land on the explicit password setup route",
);
assert.match(
  source,
  /redirectTo: inviteRedirectTo/u,
  "the invite API must receive only the server-derived callback URL",
);
assert.doesNotMatch(
  source,
  /input\.(?:redirect|redirect_to|redirectTo)/u,
  "the request must not control the invitation redirect",
);
assert.match(source, /deleteUser/u, "profile failure must attempt rollback");
assert.match(source, /ban_duration/u, "rollback failure must disable the identity");
assert.match(source, /Access-Control-Allow-Origin/u, "CORS must be explicit");

console.log("invite-company-user security contract verified.");
