import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const allowedRoles = new Set(["management", "administration", "driver", "accounting"]);
const passwordSetupPath = "/auth/establecer-clave?intent=invite";

function parseAppOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.pathname !== "/" ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function response(status: number, body: Record<string, unknown>, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    },
  });
}

Deno.serve(async (request) => {
  const configuredOrigin = parseAppOrigin(Deno.env.get("APP_ORIGIN"));
  const inviteRedirectTo =
    configuredOrigin === null ? null : new URL(passwordSetupPath, configuredOrigin).toString();
  const requestOrigin = request.headers.get("Origin");
  const corsOrigin =
    requestOrigin !== null && configuredOrigin !== null && requestOrigin === configuredOrigin
      ? requestOrigin
      : undefined;

  if (request.method === "OPTIONS") {
    if (!corsOrigin) return response(403, { error: "Origin not allowed" });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }
  if (request.method !== "POST") return response(405, { error: "Method not allowed" }, corsOrigin);
  if (requestOrigin && !corsOrigin) return response(403, { error: "Origin not allowed" });
  if (inviteRedirectTo === null) {
    return response(500, { error: "APP_ORIGIN is not configured correctly" }, corsOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return response(401, { error: "Authentication is required" }, corsOrigin);
  }

  const actorClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await actorClient.auth.getUser();
  if (authError || !authData.user) return response(401, { error: "Invalid session" }, corsOrigin);

  const { data: actor, error: actorError } = await adminClient
    .from("profiles")
    .select("company_id, role, active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (actorError || !actor || !actor.active || actor.role !== "management") {
    return response(403, { error: "Active management role is required" }, corsOrigin);
  }

  let input: { email?: unknown; display_name?: unknown; role?: unknown };
  try {
    input = await request.json();
  } catch {
    return response(400, { error: "Invalid JSON body" }, corsOrigin);
  }
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const displayName = typeof input.display_name === "string" ? input.display_name.trim() : "";
  const role = typeof input.role === "string" ? input.role : "";
  if (
    !/^\S+@\S+\.\S+$/u.test(email) ||
    displayName.length === 0 ||
    displayName.length > 200 ||
    !allowedRoles.has(role)
  ) {
    return response(
      400,
      { error: "email, display_name and a valid role are required" },
      corsOrigin,
    );
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { display_name: displayName },
      redirectTo: inviteRedirectTo,
    },
  );
  if (inviteError || !invited.user) {
    return response(
      409,
      { error: inviteError?.message ?? "User could not be invited" },
      corsOrigin,
    );
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: invited.user.id,
    company_id: actor.company_id,
    display_name: displayName,
    role,
    active: true,
  });
  if (profileError) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(invited.user.id);
    if (deleteError) {
      await adminClient.auth.admin.updateUserById(invited.user.id, {
        ban_duration: "876000h",
        app_metadata: { provisioning_failed: true },
      });
    }
    return response(
      500,
      { error: "Profile provisioning failed; invited identity was rolled back or disabled" },
      corsOrigin,
    );
  }

  return response(201, { user_id: invited.user.id }, corsOrigin);
});
