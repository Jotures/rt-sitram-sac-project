/**
 * Technical workspace helper. It is intentionally not a product-domain contract.
 */
export function formatBuildLabel(applicationName: string, version: string): string {
  return `${applicationName} · ${version}`;
}
