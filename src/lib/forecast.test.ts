import { describe, expect, it } from 'vitest';
import type { Entry, LedgerTrip, Recurring } from '../db/types';
import type { Row } from './aggregate';
import { breakdownAt, dailySpend, fixedBetween, pastSeries, projectedAt, tripForecasts, tripNeed } from './forecast';

const rec = (extra: Partial<Recurring>): Recurring => ({
  id: 'r', type: 'income', name: '', amount: 50000, categoryId: '', dayOfMonth: 25, startMonth: '2026-01', skippedMonths: [], ...extra,
});
const trip = (extra: Partial<LedgerTrip>): LedgerTrip => ({
  tripId: 't', name: 'ソウル', startDate: '2027-01-10', endDate: '2027-01-12', estimateYen: 0, spentYen: 0, ...extra,
});
const row = (date: string, amount: number, extra: Partial<Entry> = {}, type: Row['type'] = 'expense'): Row => ({
  key: date + amount, date, type, amount, icon: '', title: '', entry: { createdAt: '', ...extra } as Entry,
});

describe('固定の収入・支出の見込み', () => {
  it('今日より後、その日までに入る分', () => {
    const r = [rec({}), rec({ id: 'x', type: 'expense', amount: 8000, dayOfMonth: 27, endMonth: '2026-12' })];
    expect(fixedBetween(r, '2026-11-25', '2027-01-26')).toEqual([
      { date: '2026-12-25', signed: 50000 },
      { date: '2027-01-25', signed: 50000 },
      { date: '2026-11-27', signed: -8000 },
      { date: '2026-12-27', signed: -8000 },
    ]);
  });
});

describe('1日あたりの変動費', () => {
  const today = '2026-11-25';
  it('30日以上の記録があれば、固定と旅行以外の平均（最大90日）', () => {
    const rows = [row('2026-10-01', 3000), row('2026-11-25', 1500), row('2026-11-01', 8000, { recurringId: 'r' }), row('2026-11-02', 50000, {}, 'income')];
    const d = dailySpend(rows, today, {}, []);
    expect(d.basis).toBe('actual');
    expect(d.days).toBe(56);
    expect(d.perDay).toBeCloseTo(4500 / 56);
  });
  it('少ないときは予算から。予算もなければ少なめの記録か 0', () => {
    const rows = [row('2026-11-20', 600)];
    expect(dailySpend(rows, today, { monthlyBudget: 60000 }, [rec({ type: 'expense', amount: 30000 })])).toMatchObject({ basis: 'budget', perDay: 1000 });
    expect(dailySpend(rows, today, {}, [])).toMatchObject({ basis: 'none', perDay: 0 });
    expect(dailySpend([row('2026-11-15', 1100)], today, {}, [])).toMatchObject({ basis: 'few', perDay: 100 });
  });
});

describe('旅行の日の見込み', () => {
  const base = { savings: 100000, today: '2026-11-25', recurrings: [rec({})], perDay: 1000 };

  it('必要な額は予算（なければ見積もり）− 使った額', () => {
    expect(tripNeed({ budgetYen: 80000, estimateYen: 90000, spentYen: 30000 })).toBe(50000);
    expect(tripNeed({ estimateYen: 20000, spentYen: 30000 })).toBe(0);
  });

  it('出発日の見込み = 今の貯金 + 固定の収入 − 毎日の変動費 − 先に行く旅行', () => {
    // 11/26〜1/10 は 46日、固定の収入は 12/25 の 1回
    expect(projectedAt({ ...base, trips: [] }, '2027-01-10')).toBe(100000 + 50000 - 46000);
  });

  it('足りる・足りない（毎月あと○円）', () => {
    const early = trip({ tripId: 'a', name: '京都', startDate: '2026-12-20', endDate: '2026-12-21', budgetYen: 30000 });
    const later = trip({ tripId: 'b', startDate: '2027-01-10', endDate: '2027-01-12', budgetYen: 120000, spentYen: 30000 });
    const [kyoto, seoul] = tripForecasts({ ...base, trips: [later, early] });
    expect(kyoto).toMatchObject({ daysLeft: 25, need: 30000, atStart: 100000 - 25000, after: 45000, perMonth: undefined });
    // ソウル：104,000 − 京都 30,000 = 74,000。必要 90,000 → 16,000 足りない。出発まで 46日 → 2か月 → 毎月 8,000円
    expect(seoul).toMatchObject({ need: 90000, atStart: 74000, after: -16000, perMonth: 8000 });
  });

  it('旅行中の旅行は残りを今日出ていくとみなす', () => {
    const now = trip({ startDate: '2026-11-24', endDate: '2026-11-26', budgetYen: 50000, spentYen: 20000 });
    const [f] = tripForecasts({ ...base, trips: [now] });
    expect(f).toMatchObject({ ongoing: true, daysLeft: 0, atStart: 100000, after: 70000 });
    expect(projectedAt({ ...base, trips: [now] }, '2026-11-26')).toBe(100000 - 1000 - 30000);
  });
});

describe('任意の日の見込みの内訳', () => {
  it('内訳を足すと見込みと同じ', () => {
    const input = {
      savings: 100000, today: '2026-11-25', perDay: 1000,
      recurrings: [rec({}), rec({ id: 'x', type: 'expense', amount: 8000, dayOfMonth: 27 })],
      trips: [trip({ name: '京都', startDate: '2026-12-20', endDate: '2026-12-21', budgetYen: 30000 })],
      cardOut: [{ date: '2026-12-10', amount: 4000 }],
    };
    const b = breakdownAt(input, '2026-12-31');
    expect(b).toMatchObject({ fixedIn: 50000, fixedOut: 16000, income: 0, daily: 36000, card: 4000, trips: [{ name: '京都', amount: 30000 }] });
    expect(b.total).toBe(100000 + 50000 - 16000 - 36000 - 4000 - 30000);
    expect(b.total).toBe(projectedAt(input, '2026-12-31'));
  });
});

describe('1か月の収入と支出を決めたときの見込み', () => {
  const base = {
    savings: 100000, today: '2026-11-25', perDay: 0, trips: [],
    recurrings: [rec({ amount: 50000, dayOfMonth: 25 }), rec({ id: 'x', type: 'expense', amount: 20000, dayOfMonth: 27 })],
  };
  // 11/26〜12/25 は 30日。固定の収入 12/25、固定費 11/27
  it('固定を含まない：収入・支出に足して、固定は別に足し引きする', () => {
    const b = breakdownAt({ ...base, incomePerDay: 30000 / 30, perDay: 60000 / 30 }, '2026-12-25');
    expect(b).toMatchObject({ fixedIn: 50000, fixedOut: 20000, income: 30000, daily: 60000 });
    expect(b.total).toBe(100000 + 50000 - 20000 + 30000 - 60000);
  });
  it('固定を含む：固定は別に足し引きしない', () => {
    const b = breakdownAt({ ...base, incomePerDay: 80000 / 30, perDay: 60000 / 30, skipFixedIncome: true, skipFixedExpense: true }, '2026-12-25');
    expect(b).toMatchObject({ fixedIn: 0, fixedOut: 0, income: 80000, daily: 60000 });
    expect(b.total).toBe(120000);
  });
});

describe('これまでの推移', () => {
  it('入れた日から今日まで、1日ごと', () => {
    const rows = [row('2026-11-23', 500), row('2026-11-24', 2000, {}, 'income')];
    expect(pastSeries(10000, '2026-11-22', rows, '2026-11-24', () => true)).toEqual([
      { date: '2026-11-22', value: 10000 },
      { date: '2026-11-23', value: 9500 },
      { date: '2026-11-24', value: 11500 },
    ]);
  });
});
