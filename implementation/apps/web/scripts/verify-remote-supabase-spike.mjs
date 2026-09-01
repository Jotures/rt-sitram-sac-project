import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createStorage() {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createTechnicalClient(storage = createStorage()) {
  return {
    client: createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true, storage },
    }),
    storage,
  };
}

const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const password = `RtSpike!${randomBytes(18).toString("base64url")}`;
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const userAEmail = `technical-user-a-${suffix}@example.test`;
const userBEmail = `technical-user-b-${suffix}@example.test`;
const { data: userAResult, error: userAError } = await admin.auth.admin.createUser({
  email: userAEmail,
  password,
  email_confirm: true,
  user_metadata: { technical_label: "USER A" },
});
const { data: userBResult, error: userBError } = await admin.auth.admin.createUser({
  email: userBEmail,
  password,
  email_confirm: true,
  user_metadata: { technical_label: "USER B" },
});

assert(userAError === null && userAResult.user !== null, "Could not create technical USER A.");
assert(userBError === null && userBResult.user !== null, "Could not create technical USER B.");

const userAId = userAResult.user.id;
const userBId = userBResult.user.id;
const aInitial = createTechnicalClient();
const bInitial = createTechnicalClient();

const { data: loginA, error: loginAError } = await aInitial.client.auth.signInWithPassword({
  email: userAEmail,
  password,
});
assert(loginAError === null && loginA.session?.user.id === userAId, "USER A login failed.");

const aReloaded = createTechnicalClient(aInitial.storage);
const { data: reloadedSession, error: reloadError } = await aReloaded.client.auth.getSession();
assert(
  reloadError === null && reloadedSession.session?.user.id === userAId,
  "USER A session did not persist.",
);

const wrongPasswordClient = createTechnicalClient().client;
const { error: wrongPasswordError } = await wrongPasswordClient.auth.signInWithPassword({
  email: userAEmail,
  password: `${password}-wrong`,
});
assert(wrongPasswordError !== null, "Incorrect password was accepted.");

const { data: loginB, error: loginBError } = await bInitial.client.auth.signInWithPassword({
  email: userBEmail,
  password,
});
assert(loginBError === null && loginB.session?.user.id === userBId, "USER B login failed.");

const { data: recordA, error: createAError } = await aReloaded.client
  .from("spike_records")
  .insert({ value: "USER A remote RLS technical spike" })
  .select()
  .single();
assert(
  createAError === null && recordA.owner_id === userAId,
  "USER A could not create its record.",
);

const { data: aReadsA, error: aReadsAError } = await aReloaded.client
  .from("spike_records")
  .select("id")
  .eq("id", recordA.id);
assert(aReadsAError === null && aReadsA.length === 1, "USER A could not read its record.");

const { data: bReadsA, error: bReadsAError } = await bInitial.client
  .from("spike_records")
  .select("id")
  .eq("id", recordA.id);
assert(bReadsAError === null && bReadsA.length === 0, "USER B read USER A record.");

const { data: bUpdatesA, error: bUpdatesAError } = await bInitial.client
  .from("spike_records")
  .update({ value: "forbidden" })
  .eq("id", recordA.id)
  .select("id");
assert(bUpdatesAError === null && bUpdatesA.length === 0, "USER B modified USER A record.");

const { data: bDeletesA, error: bDeletesAError } = await bInitial.client
  .from("spike_records")
  .delete()
  .eq("id", recordA.id)
  .select("id");
assert(bDeletesAError === null && bDeletesA.length === 0, "USER B deleted USER A record.");

const { error: spoofError } = await bInitial.client
  .from("spike_records")
  .insert({ owner_id: userAId, value: "owner spoof must fail" });
assert(spoofError !== null, "USER B created a record with USER A owner_id.");

const { data: recordB, error: createBError } = await bInitial.client
  .from("spike_records")
  .insert({ value: "USER B remote RLS technical spike" })
  .select()
  .single();
assert(
  createBError === null && recordB.owner_id === userBId,
  "USER B could not create its record.",
);

const { data: bReadsB, error: bReadsBError } = await bInitial.client
  .from("spike_records")
  .select("id")
  .eq("id", recordB.id);
assert(bReadsBError === null && bReadsB.length === 1, "USER B could not read its record.");

const { data: aReadsB, error: aReadsBError } = await aReloaded.client
  .from("spike_records")
  .select("id")
  .eq("id", recordB.id);
assert(aReadsBError === null && aReadsB.length === 0, "USER A read USER B record.");

const { error: logoutError } = await aReloaded.client.auth.signOut({ scope: "local" });
assert(logoutError === null, "USER A local logout failed.");
const { data: signedOutSession } = await aReloaded.client.auth.getSession();
assert(signedOutSession.session === null, "USER A local session was retained after logout.");

console.log("Remote Auth and RLS technical spike passed.");
