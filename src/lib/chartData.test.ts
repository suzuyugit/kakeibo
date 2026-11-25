import { describe, expect, it } from 'vitest';
import type { Category, Entry } from '../db/types';
import type { Row } from './aggregate';
import { monthEnds, slicesFor } from './chartData';

const cats: Category[] = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, type: 'expense', name: id.toUpperCase(), icon: '', usageCount: 0, order: i }));
const row = (cat: string, amount: number, date = '2026-11-10', type: Row['type'] = 'expense'): Row => ({
  key: cat + amount + date, date, type, amount, icon: '', title: '', entry: { categoryId: cat } as Entry,
});
const p = { start: '2026-11-01', end: '2026-11-30' };

describe('円グラフ', () => {
  it('カテゴリごとに多い順。期間外と収入は入らない', () => {
    const s = slicesFor([row('a', 100), row('b', 300), row('a', 50), row('c', 999, '2026-10-31'), row('d', 5, '2026-11-02', 'income')], p, 'expense', cats);
    expect(s.map((x) => [x.key, x.value])).toEqual([
      ['b', 300],
      ['a', 150],
    ]);
  });
  it('多すぎるときは残りを「そのほか」にまとめる', () => {
    const s = slicesFor([row('a', 40), row('b', 30), row('c', 20), row('d', 10)], p, 'expense', cats, 3);
    expect(s.map((x) => [x.label, x.value])).toEqual([
      ['A', 40],
      ['B', 30],
      ['そのほか', 30],
    ]);
  });
});

describe('月末', () => {
  it('年をまたいで並べる', () => {
    expect(monthEnds('2026-11', '2027-02')).toEqual([
      { month: '2026-11', end: '2026-11-30' },
      { month: '2026-12', end: '2026-12-31' },
      { month: '2027-01', end: '2027-01-31' },
      { month: '2027-02', end: '2027-02-28' },
    ]);
  });
});
