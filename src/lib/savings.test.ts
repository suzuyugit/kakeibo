import { describe, expect, it } from 'vitest';
import type { Row } from './aggregate';
import { savingsNow } from './savings';

const row = (date: string, type: Row['type'], amount: number, trip = false): Row => ({
  key: `${date}-${amount}`, date, type, amount, icon: '', title: '', ...(trip ? { trip: { tripId: 't', name: '', categoryName: '', categoryIcon: '' } } : {}),
});

describe('今の貯金', () => {
  const rows = [
    row('2026-11-20', 'expense', 1000), // 入力した日：もう反映済み
    row('2026-11-21', 'expense', 680),
    row('2026-11-22', 'income', 50000),
    row('2026-11-23', 'expense', 30000, true), // 旅行の負担分も引く
    row('2026-12-01', 'expense', 9999), // 先の日付はまだ引かない
  ];

  it('入力した額 + 翌日から今日までの収支', () => {
    expect(savingsNow({ savingsAmount: 300000, savingsAsOf: '2026-11-20' }, rows, '2026-11-25')).toEqual({
      base: 300000,
      asOf: '2026-11-20',
      change: -680 + 50000 - 30000,
      total: 300000 - 680 + 50000 - 30000,
    });
  });

  it('入れていなければ undefined', () => {
    expect(savingsNow({}, rows, '2026-11-25')).toBeUndefined();
  });

  it('今日入れたら、今日の記録は入れたあとに記録したものだけ引く', () => {
    const before = { ...row('2026-11-25', 'expense', 500), entry: { createdAt: '2026-11-25T01:00:00.000Z' } as Row['entry'] };
    const after = { ...row('2026-11-25', 'expense', 700), entry: { createdAt: '2026-11-25T03:00:00.000Z' } as Row['entry'] };
    const s = { savingsAmount: 120000, savingsAsOf: '2026-11-25', savingsSetAt: '2026-11-25T02:00:00.000Z' };
    expect(savingsNow(s, [before, after], '2026-11-25', '2026-11-25')!.total).toBe(119300);
  });

  it('「いつの額」を昨日にしたら、昨日の記録は全部入っているとみなす', () => {
    const late = { ...row('2026-11-24', 'expense', 700), entry: { createdAt: '2026-11-25T03:00:00.000Z' } as Row['entry'] };
    const s = { savingsAmount: 120000, savingsAsOf: '2026-11-24', savingsSetAt: '2026-11-25T02:00:00.000Z' };
    expect(savingsNow(s, [late, row('2026-11-25', 'expense', 300)], '2026-11-25', '2026-11-25')!.total).toBe(119700);
  });
});
