import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const passwordSetupPath = "/auth/establecer-clave?intent=invite";

function parseAppOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      url.username.length === 0 && url.password.length === 0 && url.pathname === "/" &&
      url.search.length === 0 && url.hash.length === 0
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function response(status: number, body: Record<string, unknown>, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}) },
  });
}

Deno.serve(async (request) => {
  const configuredOrigin = parseAppOrigin(Deno.env.get("APP_ORIGIN"));
  const requestOrigin = request.headers.get("Origin");
  const corsOrigin = requestOrigin !== null && configuredOrigin !== null && requestOrigin === configuredOrigin
    ? requestOrigin
    : undefined;
  if (request.method === "OPTIONS") {
    if (!corsOrigin) return response(403, { error: "Origin not allowed" });
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": corsOrigin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" } });
  }
  if (request.method !== "POST") return response(405, { error: "Method not allowed" }, corsOrigin);
  if (requestOrigin && !corsOrigin) return response(403, { error: "Origin not allowed" });
  if (configuredOrigin === null) return response(500, { error: "APP_ORIGIN is not configured correctly" }, corsOrigin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return response(401, { error: "Authentication is required" }, corsOrigin);
  const actorClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await actorClient.auth.getUser();
  if (authError || !authData.user) return response(401, { error: "Invalid session" }, corsOrigin);
  const { data: input, error: inputError } = await request.json().then((value) => ({ data: value, error: null })).catch(() => ({ data: null, error: true }));
  const profileId = input !== null && typeof input === "object" && typeof input.profile_id === "string" ? input.profile_id : "";
  if (inputError || profileId.length === 0) return response(400, { error: "profile_id is required" }, corsOrigin);

  const { data: actor, error: actorError } = await adminClient.from("profiles").select("company_id, role, active").eq("id", authData.user.id).maybeSingle();
  if (actorError || !actor || !actor.active || actor.role !== "management") return response(403, { error: "Active management role is required" }, corsOrigin);
  const { data: target, error: targetError } = await adminClient.from("profiles").select("id, active").eq("id", profileId).eq("company_id", actor.company_id).maybeSingle();
  if (targetError || !target) return response(404, { error: "Profile not found in your company" }, corsOrigin);
  if (!target.active) return response(409, { error: "Reactivate the profile before sending an invitation" }, corsOrigin);

  const { data: identity, error: identityError } = await adminClient.auth.admin.getUserById(profileId);
  if (identityError || !identity.user?.email) return response(404, { error: "User identity email is unavailable" }, corsOrigin);
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(identity.user.email, { redirectTo: new URL(passwordSetupPath, configuredOrigin).toString() });
  if (inviteError) return response(409, { error: inviteError.message }, corsOrigin);
  const { error: auditError } = await adminClient.from("audit_events").insert({ company_id: actor.company_id, actor_id: authData.user.id, action: "PROFILE_INVITATION_RESENT", entity_type: "profile", entity_id: profileId, reason: "Invitation resent by management" });
  if (auditError) return response(500, { error: "Invitation was sent but could not be audited" }, corsOrigin);
  return response(200, { profile_id: profileId }, corsOrigin);
});
