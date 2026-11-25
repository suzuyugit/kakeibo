import { describe, expect, it } from 'vitest';
import type { Category, Entry, LedgerEntry, LedgerTrip } from '../db/types';
import { expenseByCategory, toRows, totalsByDay, totalsIn, travelByCategory } from './aggregate';

const cats: Category[] = [
  { id: 'ex-01-food', type: 'expense', name: '食費', icon: '🍙', usageCount: 0, order: 1 },
  { id: 'in-01-salary', type: 'income', name: 'バイト代', icon: '💼', usageCount: 0, order: 1 },
];
const e = (id: string, type: Entry['type'], date: string, amount: number, categoryId: string, extra: Partial<Entry> = {}): Entry => ({
  id, type, date, amount, categoryId, createdAt: `${date}T10:00:00Z`, updatedAt: '', ...extra,
});
const entries = [
  e('a', 'expense', '2026-11-25', 680, 'ex-01-food', { memo: 'おにぎり' }),
  e('b', 'income', '2026-11-25', 50000, 'in-01-salary', { recurringId: 'r' }),
  e('c', 'expense', '2026-12-01', 1200, 'ex-01-food'),
];
const trips: LedgerTrip[] = [{ tripId: 't', name: 'ソウル', startDate: '2026-12-01', endDate: '2026-12-03', estimateYen: 0, spentYen: 3000 }];
const tripEntries: LedgerEntry[] = [
  { id: 'x', tripId: 't', date: '2026-12-01', categoryName: '交通', categoryIcon: '🚃', myShareYen: 3000, paymentMethod: 'card' },
];

describe('集計', () => {
  const rows = toRows(entries, tripEntries, trips, cats);

  it('記録と旅行の支出を混ぜ、新しい日が上', () => {
    expect(rows.map((r) => [r.date, r.title])).toEqual([
      ['2026-12-01', '食費'],
      ['2026-12-01', 'ソウル・交通'],
      ['2026-11-25', '食費'],
      ['2026-11-25', 'バイト代'],
    ]);
    expect(rows.find((r) => r.trip)).toMatchObject({ icon: '✈️', amount: 3000, trip: { tripId: 't', name: 'ソウル', categoryName: '交通' } });
    expect(rows.find((r) => r.key === 'b')!.fixed).toBe(true);
  });

  it('日ごとと期間の合計', () => {
    expect(totalsByDay(rows).get('2026-12-01')).toEqual({ expense: 4200, income: 0 });
    expect(totalsIn(rows, { start: '2026-11-01', end: '2026-11-30' })).toEqual({ income: 50000, expense: 680, balance: 49320 });
  });

  it('カテゴリ別は旅行を「旅行」にまとめ、多い順', () => {
    expect(expenseByCategory(rows, { start: '2026-12-01', end: '2026-12-31' })).toEqual([
      { categoryId: 'cat-travel', amount: 3000 },
      { categoryId: 'ex-01-food', amount: 1200 },
    ]);
  });

  it('旅行の内訳はたびメモのカテゴリ別', () => {
    expect(travelByCategory(rows, { start: '2026-12-01', end: '2026-12-31' })).toEqual([{ name: '交通', icon: '🚃', amount: 3000 }]);
  });
});
