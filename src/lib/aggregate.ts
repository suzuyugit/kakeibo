// 集計（記録と、たびメモから取り込んだ旅行の支出を混ぜる）
import type { Category, Entry, LedgerEntry, LedgerTrip, Recurring } from '../db/types';
import { addMonths, dateFor, recurringMemo } from './recurring';
import { TRAVEL_CATEGORY } from '../db/db';
import { inPeriod, type Period } from './period';

/** 一覧の1行（記録か、旅行の支出） */
export type Row = {
  key: string;
  date: string;
  type: 'expense' | 'income';
  amount: number;
  icon: string;
  title: string;
  sub?: string;
  entry?: Entry; // 家計簿の記録（編集できる）
  trip?: { tripId: string; name: string; categoryName: string; categoryIcon: string; paymentMethod?: LedgerEntry['paymentMethod'] }; // 旅行の支出（たびメモで直す）
  fixed?: boolean; // 固定から自動で入った
  scheduled?: boolean; // これから固定で入る予定（まだ記録はない）
};

export function toRows(entries: Entry[], tripEntries: LedgerEntry[], trips: LedgerTrip[], categories: Category[]): Row[] {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const tripName = new Map(trips.map((t) => [t.tripId, t.name]));
  const rows: Row[] = entries.map((e) => {
    const c = cat.get(e.categoryId);
    return {
      key: e.id,
      date: e.date,
      type: e.type,
      amount: e.amount,
      icon: c?.icon ?? '📦',
      title: c?.name ?? 'その他',
      sub: e.memo,
      entry: e,
      fixed: !!e.recurringId,
    };
  });
  for (const t of tripEntries) {
    const name = tripName.get(t.tripId) ?? '旅行';
    rows.push({
      key: `trip-${t.id}`,
      date: t.date,
      type: 'expense',
      amount: t.myShareYen,
      icon: '✈️',
      title: `${name}・${t.categoryName}`,
      sub: t.memo,
      trip: { tripId: t.tripId, name, categoryName: t.categoryName, categoryIcon: t.categoryIcon, paymentMethod: t.paymentMethod },
    });
  }
  // 新しい日が上。同じ日は記録した順（新しいものが上）
  return rows.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.entry?.createdAt ?? '').localeCompare(a.entry?.createdAt ?? ''),
  );
}

/** 日ごとの合計 */
export function totalsByDay(rows: Row[]): Map<string, { expense: number; income: number }> {
  const m = new Map<string, { expense: number; income: number }>();
  for (const r of rows) {
    const t = m.get(r.date) ?? { expense: 0, income: 0 };
    t[r.type] += r.amount;
    m.set(r.date, t);
  }
  return m;
}

export type PeriodTotals = { income: number; expense: number; balance: number };

export function totalsIn(rows: Row[], p: Pick<Period, 'start' | 'end'>): PeriodTotals {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (!inPeriod(r.date, p)) continue;
    if (r.type === 'income') income += r.amount;
    else expense += r.amount;
  }
  return { income, expense, balance: income - expense };
}

/** その期間の、支出カテゴリ別の合計（多い順）。旅行の支出は「旅行」にまとめる */
export function expenseByCategory(rows: Row[], p: Pick<Period, 'start' | 'end'>): { categoryId: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== 'expense' || !inPeriod(r.date, p)) continue;
    const id = r.trip ? TRAVEL_CATEGORY : (r.entry?.categoryId ?? 'unknown');
    m.set(id, (m.get(id) ?? 0) + r.amount);
  }
  return [...m.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
}

/** その期間の旅行の支出を、たびメモのカテゴリ別に（多い順） */
export function travelByCategory(rows: Row[], p: Pick<Period, 'start' | 'end'>): { name: string; icon: string; amount: number }[] {
  const m = new Map<string, { name: string; icon: string; amount: number }>();
  for (const r of rows) {
    if (!r.trip || !inPeriod(r.date, p)) continue;
    const k = r.trip.categoryName;
    const cur = m.get(k) ?? { name: k, icon: r.trip.categoryIcon, amount: 0 };
    cur.amount += r.amount;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}

/**
 * これから固定で入る予定（今日より後で、まだ記録がないもの）を、from〜to の一覧の行にする。
 * 止めた月・消した月・もう記録がある月は出さない
 */
export function scheduledRows(recurrings: Recurring[], entries: Entry[], categories: Category[], from: string, to: string, today: string): Row[] {
  const made = new Set(entries.filter((e) => e.recurringId).map((e) => `${e.recurringId}|${e.recurringMonth}`));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const out: Row[] = [];
  for (const r of recurrings) {
    for (let m = r.startMonth < from.slice(0, 7) ? from.slice(0, 7) : r.startMonth; m <= to.slice(0, 7); m = addMonths(m, 1)) {
      if (r.endMonth && m > r.endMonth) break;
      if (r.skippedMonths.includes(m) || made.has(`${r.id}|${m}`)) continue;
      const date = dateFor(m, r.dayOfMonth);
      if (date <= today || date < from || date > to) continue;
      const c = cat.get(r.categoryId);
      out.push({
        key: `sch-${r.id}-${m}`,
        date,
        type: r.type,
        amount: r.amount,
        icon: c?.icon ?? '🔁',
        title: c?.name ?? r.name,
        sub: recurringMemo(r, m),
        fixed: true,
        scheduled: true,
      });
    }
  }
  return out;
}
