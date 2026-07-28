export const productionIgnoredRouteFiles = ["routes/**"];

export function legacyBusinessRoutesEnabled(mode: string): boolean {
  return mode === "development";
}

export function ignoredLegacyRouteFiles(mode: string): string[] {
  return legacyBusinessRoutesEnabled(mode)
    ? []
    : [...productionIgnoredRouteFiles];
}
