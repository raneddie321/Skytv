import { describe, expect, it } from 'vitest';
import { findBest, isInDirection, type Rect } from '@/navigation/geometry';

const r = (left: number, top: number, width = 100, height = 60): Rect => ({ left, top, width, height });

describe('spatial geometry', () => {
  const row = [r(0, 0), r(120, 0), r(240, 0), r(360, 0)];
  const below = [r(0, 100, 200, 100), r(220, 100, 200, 100), r(440, 100, 200, 100)];

  it('detects direction', () => {
    expect(isInDirection(row[0], row[1], 'right')).toBe(true);
    expect(isInDirection(row[1], row[0], 'right')).toBe(false);
    expect(isInDirection(row[0], below[0], 'down')).toBe(true);
    expect(isInDirection(below[0], row[0], 'up')).toBe(true);
  });

  it('moves to the nearest neighbour on the same row', () => {
    const best = findBest(row[1], row.map((rect, i) => ({ id: i, rect })).filter((c) => c.id !== 1), 'right');
    expect(best?.id).toBe(2);
  });

  it('moves down to the item under the current centre', () => {
    const best = findBest(row[2], below.map((rect, i) => ({ id: i, rect })), 'down');
    // row[2] spans 240..340 (centre 290) → below[1] spans 220..420
    expect(best?.id).toBe(1);
  });

  it('prefers the EPG cell covering the current time when moving vertically', () => {
    const current = r(300, 0, 200, 50); // centre x = 400
    const nextRow = [r(0, 60, 350, 50), r(352, 60, 300, 50), r(654, 60, 100, 50)];
    expect(findBest(current, nextRow.map((rect, i) => ({ id: i, rect })), 'down')?.id).toBe(1);
  });

  it('returns null when nothing is in that direction', () => {
    expect(findBest(row[0], row.slice(1).map((rect, i) => ({ id: i, rect })), 'left')).toBeNull();
  });

  it('reaches off-screen items in long carousels', () => {
    const long = Array.from({ length: 40 }, (_, i) => ({ id: i, rect: r(i * 120 - 2000, 0) }));
    expect(findBest(long[20].rect, long.filter((c) => c.id !== 20), 'right')?.id).toBe(21);
    expect(findBest(long[20].rect, long.filter((c) => c.id !== 20), 'left')?.id).toBe(19);
  });
});
