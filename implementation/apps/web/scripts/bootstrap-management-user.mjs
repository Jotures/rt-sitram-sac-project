import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((value) => value !== "--")
    .map((value) => {
      const separator = value.indexOf("=");
      if (separator < 3 || !value.startsWith("--")) throw new Error(`Invalid argument: ${value}`);
      return [value.slice(2, separator), value.slice(separator + 1)];
    }),
);

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = args.email?.trim().toLowerCase();
const displayName = args["display-name"]?.trim();
const redirectTo = args["redirect-to"]?.trim();
const companyLegalName = args["company-legal-name"]?.trim() || "R&T SITRAM SAC";

if (!url || !serviceRoleKey || !email || !displayName || !redirectTo) {
  throw new Error(
    "VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, --email, --display-name and --redirect-to are required.",
  );
}

const redirectUrl = new URL(redirectTo);
if (!new Set(["http:", "https:"]).has(redirectUrl.protocol) || redirectUrl.username) {
  throw new Error("--redirect-to must be a plain HTTP(S) application URL.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: company, error: companyError } = await admin
  .from("companies")
  .select("id")
  .eq("legal_name", companyLegalName)
  .eq("active", true)
  .single();
if (companyError || !company) throw new Error("The requested active company does not exist.");

const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (usersError) throw usersError;

let authUser = usersPage.users.find((candidate) => candidate.email?.toLowerCase() === email);
let createdAuthUser = false;

if (!authUser) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
    redirectTo: redirectUrl.toString(),
  });
  if (error || !data.user) throw error ?? new Error("The management invitation failed.");
  authUser = data.user;
  createdAuthUser = true;
}

try {
  const { data: existingProfile, error: profileReadError } = await admin
    .from("profiles")
    .select("id,company_id,display_name,role,active")
    .eq("id", authUser.id)
    .maybeSingle();
  if (profileReadError) throw profileReadError;

  if (existingProfile) {
    if (
      existingProfile.company_id !== company.id ||
      existingProfile.role !== "management" ||
      !existingProfile.active
    ) {
      throw new Error("The existing profile is not the active management profile for R&T SITRAM.");
    }

    console.log(`Management bootstrap already exists for ${email}; no credential was changed.`);
  } else {
    const { error: insertError } = await admin.from("profiles").insert({
      id: authUser.id,
      company_id: company.id,
      display_name: displayName,
      role: "management",
      active: true,
    });
    if (insertError) throw insertError;

    console.log(
      `Management invitation and profile provisioned for ${email}. No password was stored.`,
    );
  }
} catch (error) {
  if (createdAuthUser) await admin.auth.admin.deleteUser(authUser.id);
  throw error;
}
