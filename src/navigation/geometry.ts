/** Pure geometry for spatial navigation (unit-tested independently of the DOM). */
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Candidate<T = string> {
  id: T;
  rect: Rect;
}

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;
const cx = (r: Rect) => r.left + r.width / 2;
const cy = (r: Rect) => r.top + r.height / 2;

/** Overlap of two 1-D ranges (negative when apart). */
function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.min(a2, b2) - Math.max(a1, b1);
}

/**
 * Returns true when `c` lies in `dir` from `from`. A small tolerance lets slightly overlapping
 * neighbours (e.g. scaled focused cards) still count.
 */
export function isInDirection(from: Rect, c: Rect, dir: Direction, tolerance = 2): boolean {
  switch (dir) {
    case 'left':
      return right(c) <= from.left + tolerance || (cx(c) < cx(from) && right(c) <= right(from) && c.left < from.left);
    case 'right':
      return c.left >= right(from) - tolerance || (cx(c) > cx(from) && c.left >= from.left && right(c) > right(from));
    case 'up':
      return bottom(c) <= from.top + tolerance || (cy(c) < cy(from) && bottom(c) <= bottom(from) && c.top < from.top);
    case 'down':
      return c.top >= bottom(from) - tolerance || (cy(c) > cy(from) && c.top >= from.top && bottom(c) > bottom(from));
  }
}

/** Distance from point `p` to the closed range [a, b] (0 when inside). */
function distToRange(p: number, a: number, b: number): number {
  return p < a ? a - p : p > b ? p - b : 0;
}

/**
 * Lower is better: the gap between facing edges on the movement axis, plus a weighted penalty for how far the
 * candidate is from the current element's centre line on the orthogonal axis (zero when the centre line passes
 * through the candidate). This keeps vertical moves "under" the current item — in card rows and in the EPG grid —
 * and horizontal moves on the same row.
 */
export function score(from: Rect, c: Rect, dir: Direction): number {
  const horizontal = dir === 'left' || dir === 'right';
  const primary = Math.max(
    0,
    dir === 'left' ? from.left - right(c) : dir === 'right' ? c.left - right(from) : dir === 'up' ? from.top - bottom(c) : c.top - bottom(from),
  );
  const ov = horizontal ? overlap(from.top, bottom(from), c.top, bottom(c)) : overlap(from.left, right(from), c.left, right(c));
  const centre = horizontal ? distToRange(cy(from), c.top, bottom(c)) : distToRange(cx(from), c.left, right(c));
  // Overlapping candidates are preferred strongly over non-overlapping ones.
  const orthogonal = ov > 0 ? centre * 0.5 : centre + (horizontal ? Math.abs(cy(c) - cy(from)) : Math.abs(cx(c) - cx(from)));
  return primary + orthogonal * (horizontal ? 3 : 2);
}

function primaryGap(from: Rect, c: Rect, dir: Direction): number {
  return Math.max(
    0,
    dir === 'left' ? from.left - right(c) : dir === 'right' ? c.left - right(from) : dir === 'up' ? from.top - bottom(c) : c.top - bottom(from),
  );
}

export function findBest<T>(from: Rect, candidates: Candidate<T>[], dir: Direction): Candidate<T> | null {
  let pool = candidates.filter((c) => isInDirection(from, c.rect, dir));
  if (!pool.length) return null;
  // Vertical moves go to the nearest row first (e.g. episodes → season pills, not the nav bar far above),
  // then pick the best-aligned item within that row band.
  if (dir === 'up' || dir === 'down') {
    const nearest = Math.min(...pool.map((c) => primaryGap(from, c.rect, dir)));
    const band = Math.max(24, from.height * 0.5);
    pool = pool.filter((c) => primaryGap(from, c.rect, dir) <= nearest + band);
  }
  let best: Candidate<T> | null = null;
  let bestScore = Infinity;
  for (const c of pool) {
    const s = score(from, c.rect, dir);
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}
