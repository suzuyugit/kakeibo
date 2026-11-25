import { describe, expect, it } from 'vitest';
import { daysOf, inPeriod, periodByKey, periodLabel, periodOf, shiftKey } from './period';

describe('月の区切り', () => {
  it('開始日が1日なら普通の月', () => {
    expect(periodOf('2026-11-25', 1)).toEqual({ key: '2026-11', start: '2026-11-01', end: '2026-11-30' });
    expect(periodOf('2026-02-28', 1)).toEqual({ key: '2026-02', start: '2026-02-01', end: '2026-02-28' });
  });

  it('開始日が25日なら「11月」は 11/25〜12/24', () => {
    expect(periodOf('2026-11-25', 25)).toEqual({ key: '2026-11', start: '2026-11-25', end: '2026-12-24' });
    expect(periodOf('2026-12-24', 25).key).toBe('2026-11');
    expect(periodOf('2026-11-24', 25).key).toBe('2026-10');
  });

  it('年をまたぐ', () => {
    expect(periodOf('2027-01-10', 25)).toEqual({ key: '2026-12', start: '2026-12-25', end: '2027-01-24' });
    expect(periodByKey('2026-12', 1)).toEqual({ key: '2026-12', start: '2026-12-01', end: '2026-12-31' });
    expect(shiftKey('2026-12', 1)).toBe('2027-01');
    expect(shiftKey('2026-01', -1)).toBe('2025-12');
    expect(shiftKey('2026-05', -12)).toBe('2025-05');
  });

  it('期間の日付と判定', () => {
    const p = periodByKey('2026-02', 28);
    expect(p).toEqual({ key: '2026-02', start: '2026-02-28', end: '2026-03-27' });
    expect(daysOf(p)).toHaveLength(28);
    expect(inPeriod('2026-03-27', p)).toBe(true);
    expect(inPeriod('2026-03-28', p)).toBe(false);
  });

  it('名前', () => {
    expect(periodLabel(periodByKey('2026-11', 1), 1, 2026)).toBe('11月');
    expect(periodLabel(periodByKey('2026-11', 25), 25, 2026)).toBe('11月（11/25〜12/24）');
    expect(periodLabel(periodByKey('2025-11', 1), 1, 2026)).toBe('2025年11月');
  });
});
