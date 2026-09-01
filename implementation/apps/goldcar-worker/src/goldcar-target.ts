import { GpsProviderError } from "@rt-sitram/integrations";

const goldcarPortalNamePrefix = "PORTAL-NAME:";
const goldcarPortalVisibleNamePattern = /^[A-Z0-9][A-Z0-9_-]{0,115}$/u;

/**
 * The sensor diagnostic has one approved selector namespace. It prevents a
 * canonical integration identifier from being mistaken for visible DOM text
 * or from becoming an arbitrary locator supplied through configuration.
 */
export function normalizeGoldcarPortalNameCanonicalId(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized.startsWith(goldcarPortalNamePrefix)) {
    throw invalidGoldcarPortalNameTarget();
  }
  const visibleName = normalized.slice(goldcarPortalNamePrefix.length);
  if (!goldcarPortalVisibleNamePattern.test(visibleName)) {
    throw invalidGoldcarPortalNameTarget();
  }
  return `${goldcarPortalNamePrefix}${visibleName}`;
}

/**
 * Converts only the approved canonical namespace to the exact visible name
 * expected in the authenticated Goldcar DOM. It never returns or accepts a
 * route, query, or arbitrary selector.
 */
export function deriveGoldcarPortalVisibleTarget(canonicalId: string): string {
  return normalizeGoldcarPortalNameCanonicalId(canonicalId).slice(goldcarPortalNamePrefix.length);
}

function invalidGoldcarPortalNameTarget(): GpsProviderError {
  return new GpsProviderError(
    "CONFIGURATION",
    "El identificador canónico de la unidad aprobada debe usar el selector PORTAL-NAME seguro.",
  );
}
