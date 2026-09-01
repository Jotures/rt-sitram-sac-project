import { randomBytes, randomUUID } from "node:crypto";
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

function createAuthenticatedClient() {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: createStorage(),
    },
  });
}

const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const password = `RtIdentity!${randomBytes(18).toString("base64url")}`;
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];
const createdCompanyIds = [];
const createdBusinessIds = { clients: [], vehicles: [], drivers: [], categories: [], trips: [] };

async function createUser(label, role, companyId) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `technical-${label}-${suffix}@example.test`,
    password,
    email_confirm: true,
    user_metadata: { technical_label: label },
  });
  assert(error === null && data.user !== null, `Could not create ${label}.`);
  createdUserIds.push(data.user.id);

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    company_id: companyId,
    display_name: label,
    role,
  });
  assert(profileError === null, `Could not create ${label} profile.`);

  const client = createAuthenticatedClient();
  const { error: loginError } = await client.auth.signInWithPassword({
    email: data.user.email,
    password,
  });
  assert(
    loginError === null,
    `${label} login failed: ${loginError?.code ?? "unknown"} (${loginError?.message ?? "no detail"}).`,
  );

  return { client, id: data.user.id };
}

try {
  const signupProbe = createAuthenticatedClient();
  const { data: signupData, error: signupError } = await signupProbe.auth.signUp({
    email: `public-signup-probe-${suffix}@example.test`,
    password,
  });
  if (signupData.user) createdUserIds.push(signupData.user.id);
  assert(
    signupError !== null && signupData.user === null,
    "Public email signup is unexpectedly enabled.",
  );

  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .insert([
      { legal_name: `R&T TEST COMPANY A ${suffix}`, trade_name: `Company A ${suffix}` },
      { legal_name: `R&T TEST COMPANY B ${suffix}`, trade_name: `Company B ${suffix}` },
    ])
    .select("id, legal_name");
  assert(companiesError === null && companies?.length === 2, "Could not create test companies.");

  const companyA = companies.find((company) => company.legal_name.includes("COMPANY A"));
  const companyB = companies.find((company) => company.legal_name.includes("COMPANY B"));
  assert(companyA && companyB, "Could not identify test companies.");
  createdCompanyIds.push(companyA.id, companyB.id);

  const managementA = await createUser("MANAGEMENT-A", "management", companyA.id);
  const driverA = await createUser("DRIVER-A", "driver", companyA.id);
  const managementB = await createUser("MANAGEMENT-B", "management", companyB.id);

  const { data: managementACompanies, error: managementACompaniesError } = await managementA.client
    .from("companies")
    .select("id")
    .in("id", [companyA.id, companyB.id]);
  assert(
    managementACompaniesError === null &&
      managementACompanies.length === 1 &&
      managementACompanies[0].id === companyA.id,
    "MANAGEMENT A read another company.",
  );

  const { data: managementAProfiles, error: managementAProfilesError } = await managementA.client
    .from("profiles")
    .select("id")
    .in("id", [managementA.id, driverA.id, managementB.id]);
  assert(
    managementAProfilesError === null &&
      managementAProfiles.length === 2 &&
      !managementAProfiles.some((profile) => profile.id === managementB.id),
    "MANAGEMENT A profile access escaped COMPANY A.",
  );

  const { data: managementBCompanies, error: managementBCompaniesError } = await managementB.client
    .from("companies")
    .select("id")
    .in("id", [companyA.id, companyB.id]);
  assert(
    managementBCompaniesError === null &&
      managementBCompanies.length === 1 &&
      managementBCompanies[0].id === companyB.id,
    "MANAGEMENT B read another company.",
  );

  const { data: driverProfiles, error: driverProfilesError } = await driverA.client
    .from("profiles")
    .select("id")
    .in("id", [managementA.id, driverA.id]);
  assert(
    driverProfilesError === null &&
      driverProfiles.length === 1 &&
      driverProfiles[0].id === driverA.id,
    "DRIVER A listed other company profiles.",
  );

  const { error: profileMoveError } = await managementA.client
    .from("profiles")
    .update({ company_id: companyB.id })
    .eq("id", managementA.id);
  assert(profileMoveError !== null, "USER A changed company_id through the client.");

  const clientAId = randomUUID();
  const clientBId = randomUUID();
  const vehicleAId = randomUUID();
  const businessDriverAId = randomUUID();
  const categoryAId = randomUUID();
  const categoryBId = randomUUID();
  const tripAId = randomUUID();
  createdBusinessIds.clients.push(clientAId, clientBId);
  createdBusinessIds.vehicles.push(vehicleAId);
  createdBusinessIds.drivers.push(businessDriverAId);
  createdBusinessIds.categories.push(categoryAId, categoryBId);
  createdBusinessIds.trips.push(tripAId);

  const { error: businessFixtureError } = await admin.from("clients").insert([
    { id: clientAId, company_id: companyA.id, legal_name: `CLIENT A ${suffix}` },
    { id: clientBId, company_id: companyB.id, legal_name: `CLIENT B ${suffix}` },
  ]);
  assert(businessFixtureError === null, "Could not create client fixtures.");
  assert(
    (
      await admin
        .from("vehicles")
        .insert({ id: vehicleAId, company_id: companyA.id, plate: `T${suffix.slice(-6)}` })
    ).error === null,
    "Could not create vehicle fixture.",
  );
  assert(
    (
      await admin.from("drivers").insert({
        id: businessDriverAId,
        company_id: companyA.id,
        profile_id: driverA.id,
        display_name: "DRIVER A",
        current_status: "in_trip",
      })
    ).error === null,
    "Could not create driver fixture.",
  );
  assert(
    (
      await admin.from("expense_categories").insert([
        { id: categoryAId, company_id: companyA.id, code: `TEST-A-${suffix}`, name: "Test A" },
        { id: categoryBId, company_id: companyB.id, code: `TEST-B-${suffix}`, name: "Test B" },
      ])
    ).error === null,
    "Could not create category fixtures.",
  );
  assert(
    (
      await admin.from("trips").insert({
        id: tripAId,
        company_id: companyA.id,
        code: `TEST-${suffix}`,
        client_id: clientAId,
        vehicle_id: vehicleAId,
        driver_id: businessDriverAId,
        origin: "A",
        destination: "B",
        scheduled_at: new Date().toISOString(),
        operational_status: "in_transit",
        created_by: managementA.id,
      })
    ).error === null,
    "Could not create trip fixture.",
  );

  const { data: driverTrips, error: driverTripsError } = await driverA.client
    .from("trips")
    .select("id");
  assert(
    driverTripsError === null && driverTrips.length === 1 && driverTrips[0].id === tripAId,
    "Driver trip scope failed.",
  );

  const expenseId = randomUUID();
  const expenseIdempotency = randomUUID();
  const expenseParameters = {
    p_id: expenseId,
    p_trip_id: tripAId,
    p_category_id: categoryAId,
    p_supplier_id: null,
    p_incurred_at: new Date().toISOString(),
    p_amount: 10,
    p_currency: "PEN",
    p_receipt_type: null,
    p_receipt_number: null,
    p_receipt_file_id: null,
    p_description: "RLS verification",
    p_source_device_id: "verification",
    p_idempotency_key: expenseIdempotency,
  };
  assert(
    (await driverA.client.rpc("record_expense", expenseParameters)).error === null,
    "Driver could not record assigned-trip expense.",
  );
  assert(
    (await driverA.client.rpc("record_expense", expenseParameters)).error === null,
    "Idempotent expense retry failed.",
  );
  const { count: expenseCount, error: expenseCountError } = await admin
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyA.id)
    .eq("idempotency_key", expenseIdempotency);
  assert(
    expenseCountError === null && expenseCount === 1,
    "Idempotent expense retry created a duplicate.",
  );

  const crossCompanyExpense = await driverA.client.rpc("record_expense", {
    ...expenseParameters,
    p_id: randomUUID(),
    p_category_id: categoryBId,
    p_idempotency_key: randomUUID(),
  });
  assert(crossCompanyExpense.error !== null, "Driver used a category from COMPANY B.");

  console.log(
    "Signup lock, identity, company, driver-write, cross-company, and idempotency verification passed.",
  );
} finally {
  if (createdBusinessIds.trips.length > 0) {
    await admin.from("expenses").delete().in("trip_id", createdBusinessIds.trips);
    await admin.from("trips").delete().in("id", createdBusinessIds.trips);
  }
  if (createdBusinessIds.drivers.length > 0)
    await admin.from("drivers").delete().in("id", createdBusinessIds.drivers);
  if (createdBusinessIds.vehicles.length > 0)
    await admin.from("vehicles").delete().in("id", createdBusinessIds.vehicles);
  if (createdBusinessIds.categories.length > 0)
    await admin.from("expense_categories").delete().in("id", createdBusinessIds.categories);
  if (createdBusinessIds.clients.length > 0)
    await admin.from("clients").delete().in("id", createdBusinessIds.clients);
  if (createdUserIds.length > 0) {
    await admin.from("profiles").delete().in("id", createdUserIds);
  }

  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }

  for (const companyId of createdCompanyIds) {
    await admin.from("companies").delete().eq("id", companyId);
  }
}
