import { describe, expect, it } from 'vitest';
import type { Entry } from '../db/types';
import type { Row } from './aggregate';
import { moneyDate, nextMonthPayDate, pendingCard, pendingPay, withdrawalDate } from './card';
import { projectedAt } from './forecast';
import { savingsNow } from './savings';

const row = (date: string, amount: number, pm: Entry['paymentMethod'], createdAt = ''): Row => ({
  key: date + amount, date, type: 'expense', amount, icon: '', title: '', entry: { paymentMethod: pm, createdAt } as Entry,
});
const tripRow = (date: string, amount: number): Row => ({
  key: 't' + date, date, type: 'expense', amount, icon: '', title: '', trip: { tripId: 't', name: '', categoryName: '', categoryIcon: '', paymentMethod: 'card' },
});

describe('カードの引き落とし', () => {
  it('その月に使った分は翌月の決めた日', () => {
    expect(withdrawalDate('2026-11-03', 27)).toBe('2026-12-27');
    expect(withdrawalDate('2026-11-30', 27)).toBe('2026-12-27');
    expect(withdrawalDate('2027-01-15', 31)).toBe('2027-02-28');
    expect(moneyDate(row('2026-11-03', 1, 'card'), { cardPayDay: 27 })).toBe('2026-12-27');
    expect(moneyDate(row('2026-11-03', 1, 'cash'), { cardPayDay: 27 })).toBe('2026-11-03');
    expect(moneyDate(row('2026-11-03', 1, 'card'), {})).toBe('2026-11-03');
    expect(moneyDate(tripRow('2026-11-03', 1), { cardPayDay: 10 })).toBe('2026-12-10');
  });

  it('締め日（15日締め・翌月10日払い）：11/16〜12/15 の分が 1/10', () => {
    expect(withdrawalDate('2026-11-15', 10, 15)).toBe('2026-12-10');
    expect(withdrawalDate('2026-11-16', 10, 15)).toBe('2027-01-10');
    expect(withdrawalDate('2026-12-15', 10, 15)).toBe('2027-01-10');
    expect(withdrawalDate('2026-12-31', 10, 15)).toBe('2027-02-10');
  });

  it('今の貯金は、引き落とされるまでカードの分を引かない', () => {
    const rows = [row('2026-11-10', 3000, 'card'), row('2026-11-11', 500, 'cash'), row('2026-10-20', 2000, 'card')];
    const base = { savingsAmount: 100000, savingsAsOf: '2026-11-01', cardPayDay: 27 };
    // 10月のカード 2,000円は 11/27 に引き落とし
    expect(savingsNow(base, rows, '2026-11-26')!.total).toBe(100000 - 500);
    expect(savingsNow(base, rows, '2026-11-27')!.total).toBe(100000 - 500 - 2000);
    expect(savingsNow(base, rows, '2026-12-27')!.total).toBe(100000 - 500 - 2000 - 3000);
    // 設定しなければ使った日に減る（入れる前の 10月の分は入らない）
    expect(savingsNow({ ...base, cardPayDay: undefined }, rows, '2026-11-26')!.total).toBe(100000 - 3500);
  });

  it('これからの引き落としを見込みで引く', () => {
    const rows = [row('2026-11-10', 3000, 'card'), row('2026-11-20', 1000, 'card'), row('2026-12-01', 400, 'card')];
    expect(pendingCard(rows, { cardPayDay: 27 }, '2026-11-26')).toEqual([
      { date: '2026-12-27', amount: 4000 },
      { date: '2027-01-27', amount: 400 },
    ]);
    const input = { savings: 50000, today: '2026-11-26', recurrings: [], perDay: 0, trips: [], cardOut: pendingCard(rows, { cardPayDay: 27 }, '2026-11-26') };
    expect(projectedAt(input, '2026-12-26')).toBe(50000);
    expect(projectedAt(input, '2026-12-27')).toBe(46000);
    expect(projectedAt(input, '2027-01-31')).toBe(45600);
  });

  it('給料の振込日（バイト先ごと）', () => {
    expect(nextMonthPayDate('2026-11-25', 15)).toBe('2026-12-15'); // 月末締め・翌月15日
    expect(nextMonthPayDate('2026-11-25', 25, 20)).toBe('2027-01-25'); // 20日締め・翌月25日
    expect(nextMonthPayDate('2026-11-20', 25, 20)).toBe('2026-12-25');
    const r = { ...row('2026-11-25', 8000, undefined), type: 'income' as const };
    r.entry = { ...r.entry!, payDate: '2026-12-15' };
    expect(moneyDate(r, {})).toBe('2026-12-15');
    expect(pendingPay([r], '2026-11-30')).toEqual([{ date: '2026-12-15', amount: 8000 }]);
    expect(pendingPay([r], '2026-12-15')).toEqual([]);
  });
});
