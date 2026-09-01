import { readFileSync } from "node:fs";
import path from "node:path";

const knownProductionOrigin = "https://rt-sitram-centro-control.vercel.app";
const requiredNames = [
  "VITE_APP_ENV",
  "PILOT_TARGET_NAME",
  "PILOT_CONFIRMATION",
  "PILOT_SUPABASE_PROJECT_REF",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_POWERSYNC_URL",
  "PILOT_APP_ORIGIN",
];
const sensitiveNamePattern =
  /(?:^|_)(?:secret|service_role|password|token|pat|private_key)(?:_|$)/iu;
const placeholderPattern = /(?:replace|example|placeholder|change[-_]?me|your|todo|<|>)/iu;

function printUsage() {
  console.log(
    "Usage: node scripts/validate-pilot-environment.mjs --pilot-env-file <pilot-env-file>",
  );
}

function readArguments() {
  const [option, filePath, ...extra] = process.argv.slice(2);

  if (option === "--help" || option === "-h") {
    printUsage();
    process.exit(0);
  }

  if (option !== "--pilot-env-file" || !filePath || extra.length > 0) {
    printUsage();
    process.exit(2);
  }

  return path.resolve(process.cwd(), filePath);
}

function parseEnvironment(content) {
  const values = new Map();
  const errors = [];

  for (const [index, sourceLine] of content
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .entries()) {
    let line = sourceLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trim();
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) {
      errors.push(`Line ${index + 1} is not a supported environment assignment.`);
      continue;
    }

    const [, name, rawValue] = match;
    let value = rawValue.trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, "").trim();
    }

    if (values.has(name)) {
      errors.push(`${name} is declared more than once.`);
      continue;
    }

    values.set(name, value);
  }

  return { values, errors };
}

function hasPlaceholder(value) {
  return placeholderPattern.test(value);
}

function validatePublicUrl(name, value, errors) {
  if (!value || hasPlaceholder(value)) {
    errors.push(`${name} must be replaced with a pilot value.`);
    return null;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${name} must be a valid HTTPS URL.`);
    return null;
  }

  if (url.protocol !== "https:") {
    errors.push(`${name} must use HTTPS.`);
  }
  if (url.username || url.password || url.port || url.search || url.hash) {
    errors.push(
      `${name} must be a canonical origin without credentials, port, query, or fragment.`,
    );
  }
  if (url.pathname !== "/") {
    errors.push(`${name} must not include a path.`);
  }
  if (url.hostname === "localhost" || /^127(?:\.\d{1,3}){3}$/u.test(url.hostname)) {
    errors.push(`${name} must target the remote pilot environment, not localhost.`);
  }

  return url;
}

function validate(values, errors) {
  for (const name of requiredNames) {
    if (!values.get(name)) {
      errors.push(`${name} is required.`);
    }
  }

  for (const name of values.keys()) {
    if (sensitiveNamePattern.test(name) || name === "APP_ORIGIN") {
      errors.push(`${name} must not be stored in the local pilot manifest.`);
    }
  }

  if (values.get("VITE_APP_ENV") !== "pilot") {
    errors.push("VITE_APP_ENV must be exactly pilot.");
  }
  if (values.get("PILOT_CONFIRMATION") !== "I_CONFIRM_ISOLATED_PILOT") {
    errors.push("PILOT_CONFIRMATION must be exactly I_CONFIRM_ISOLATED_PILOT.");
  }

  const targetName = values.get("PILOT_TARGET_NAME") ?? "";
  if (
    hasPlaceholder(targetName) ||
    !/^[a-z0-9][a-z0-9-]{2,62}$/u.test(targetName) ||
    /^(?:prod|production|produccion)$/iu.test(targetName)
  ) {
    errors.push("PILOT_TARGET_NAME must be a non-production lowercase identifier.");
  }

  const projectRef = values.get("PILOT_SUPABASE_PROJECT_REF") ?? "";
  if (hasPlaceholder(projectRef) || !/^[a-z0-9]{8,64}$/u.test(projectRef)) {
    errors.push("PILOT_SUPABASE_PROJECT_REF must be a non-placeholder Supabase project reference.");
  }

  const supabaseUrl = validatePublicUrl(
    "VITE_SUPABASE_URL",
    values.get("VITE_SUPABASE_URL") ?? "",
    errors,
  );
  const powersyncUrl = validatePublicUrl(
    "VITE_POWERSYNC_URL",
    values.get("VITE_POWERSYNC_URL") ?? "",
    errors,
  );
  const pilotOrigin = validatePublicUrl(
    "PILOT_APP_ORIGIN",
    values.get("PILOT_APP_ORIGIN") ?? "",
    errors,
  );

  if (supabaseUrl && projectRef && supabaseUrl.hostname !== `${projectRef}.supabase.co`) {
    errors.push("VITE_SUPABASE_URL must match PILOT_SUPABASE_PROJECT_REF.");
  }
  if (powersyncUrl && supabaseUrl && powersyncUrl.hostname === supabaseUrl.hostname) {
    errors.push("VITE_POWERSYNC_URL must not point to the Supabase pilot host.");
  }
  if (pilotOrigin) {
    if (pilotOrigin.origin === knownProductionOrigin) {
      errors.push("PILOT_APP_ORIGIN must not use the known production origin.");
    }
    if (
      pilotOrigin.hostname === supabaseUrl?.hostname ||
      pilotOrigin.hostname === powersyncUrl?.hostname
    ) {
      errors.push("PILOT_APP_ORIGIN must use a dedicated web origin.");
    }
  }

  const publishableKey = values.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
  if (hasPlaceholder(publishableKey) || !/^sb_publishable_[A-Za-z0-9._-]+$/u.test(publishableKey)) {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY must contain a pilot publishable key.");
  }
}

const environmentPath = readArguments();
let content;
try {
  content = readFileSync(environmentPath, "utf8");
} catch {
  console.error("Unable to read the supplied pilot environment file.");
  process.exit(2);
}

const { values, errors } = parseEnvironment(content);
validate(values, errors);

if (errors.length > 0) {
  console.error("Pilot environment validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Pilot environment manifest passed local safety checks.");
console.log("No external service was contacted or verified by this command.");
