import type { MediaSummary } from '@/api/contracts/domain';

const ORDER = ['U', 'PG', '12', '12A', '15', '18'];

/**
 * Client-side guard on top of the catalog's kids filters: drops anything not flagged kids-safe or whose
 * certification exceeds the configured limit. Not a complete child-safety solution — enforce server-side too.
 */
export function kidsAllowed(item: Pick<MediaSummary, 'kidsSafe' | 'certification'>, max: 'U' | 'PG'): boolean {
  if (item.kidsSafe === false) return false;
  if (!item.certification) return true;
  const idx = ORDER.indexOf(item.certification);
  return idx >= 0 && idx <= ORDER.indexOf(max);
}
