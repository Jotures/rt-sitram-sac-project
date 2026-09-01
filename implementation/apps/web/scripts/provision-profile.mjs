import { createClient } from "@supabase/supabase-js";

const allowedRoles = new Set(["management", "administration", "driver", "accounting"]);
const args = Object.fromEntries(
  process.argv.slice(2).map((value) => {
    const separator = value.indexOf("=");
    if (separator < 3 || !value.startsWith("--")) throw new Error(`Invalid argument: ${value}`);
    return [value.slice(2, separator), value.slice(separator + 1)];
  }),
);

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = args["user-id"];
const companyLegalName = args["company-legal-name"] ?? "R&T SITRAM SAC";
const displayName = args["display-name"];
const role = args.role;

if (!url || !serviceRoleKey || !userId || !displayName || !role || !allowedRoles.has(role)) {
  throw new Error(
    "VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, --user-id, --display-name and a valid --role are required.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: authUser, error: authError } = await admin.auth.admin.getUserById(userId);
if (authError || !authUser.user) throw new Error("The Auth user does not exist in this project.");

const { data: company, error: companyError } = await admin
  .from("companies")
  .select("id")
  .eq("legal_name", companyLegalName)
  .eq("active", true)
  .single();
if (companyError || !company) throw new Error("The requested active company does not exist.");

const { data: existing, error: existingError } = await admin
  .from("profiles")
  .select("id")
  .eq("id", userId)
  .maybeSingle();
if (existingError) throw existingError;
if (existing)
  throw new Error(
    "Profile already exists; role/company changes require an audited administrative workflow.",
  );

const { error: insertError } = await admin
  .from("profiles")
  .insert({ id: userId, company_id: company.id, display_name: displayName, role });
if (insertError) throw insertError;
console.log(`Profile provisioned for Auth user ${userId}. No credential was stored.`);
