/**
 * How many a "Show N more" link adds to a list: as many again as are showing, or what's left if
 * that's fewer. With 20 in all: 6 showing → "Show 6 more", then 12 showing → "Show 8 more".
 */
export function moreCount(shown: number, total: number): number {
  return Math.max(0, Math.min(shown, total - shown));
}
