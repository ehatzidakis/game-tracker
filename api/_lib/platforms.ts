/** IGDB platform IDs for the platforms the app cares about, in display order. PS5 is the default. */
export const PLATFORMS = [
  { key: 'ps5', igdbId: 167, label: 'PS5' },
  { key: 'xbox', igdbId: 169, label: 'Xbox Series' },
  { key: 'pc', igdbId: 6, label: 'PC' },
  { key: 'switch2', igdbId: 508, label: 'Switch 2' },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]['key'];

export function platformIgdbId(key: PlatformKey): number {
  return PLATFORMS.find((p) => p.key === key)!.igdbId;
}

export function platformLabel(key: PlatformKey): string {
  return PLATFORMS.find((p) => p.key === key)?.label ?? key;
}
