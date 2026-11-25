import { describe, expect, it } from 'vitest';
import { ticks } from './SavingsChart';

describe('グラフの目盛り', () => {
  it('最大値・最小値をはみ出さない', () => {
    for (const [min, max] of [[0, 236400], [0, 286400], [-20000, 150000], [0, 1]]) {
      const t = ticks(min, max);
      expect(t[0]).toBeLessThanOrEqual(min);
      expect(t.at(-1)!).toBeGreaterThanOrEqual(max);
    }
  });
});
