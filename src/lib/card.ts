// カードの引き落とし：締め日までに使った分が、締めた月の翌月の決めた日に口座から出る
import type { Row } from './aggregate';
import { addMonths, dateFor, monthOf } from './recurring';

/** カードで払った記録か（家計簿の記録・取り込んだ旅行の支出のどちらも） */
export function isCard(r: Row): boolean {
  return r.type === 'expense' && (r.entry?.paymentMethod ?? r.trip?.paymentMethod) === 'card';
}

export type CardRule = { cardPayDay?: number; cardCloseDay?: number };

/** その日に使った分を締める月。締め日（なければ月末）を過ぎていれば次の月 */
export function closingMonth(date: string, closeDay?: number): string {
  const m = monthOf(date);
  return closeDay && Number(date.slice(8)) > closeDay ? addMonths(m, 1) : m;
}

/** その日に使ったカードの分が引き落とされる日：締めた月の翌月の引き落とし日 */
export function withdrawalDate(date: string, cardPayDay: number, closeDay?: number): string {
  return dateFor(addMonths(closingMonth(date, closeDay), 1), cardPayDay);
}

/** お金が実際に口座から出入りする日。カードは引き落とし日、あとで振り込まれる収入は振込日、それ以外は記録の日 */
export function moneyDate(r: Row, rule: CardRule): string {
  if (r.type === 'income' && r.entry?.payDate) return r.entry.payDate;
  return rule.cardPayDay && isCard(r) ? withdrawalDate(r.date, rule.cardPayDay, rule.cardCloseDay) : r.date;
}

/** 今日より後に振り込まれる収入（振込日ごと、日付の順） */
export function pendingPay(rows: Row[], today: string): { date: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const d = r.type === 'income' ? r.entry?.payDate : undefined;
    if (d && d > today) m.set(d, (m.get(d) ?? 0) + r.amount);
  }
  return [...m.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** 働いた日（記録の日）から、翌月の決めた日の振込日 */
export function nextMonthPayDate(date: string, payDay: number): string {
  return dateFor(addMonths(monthOf(date), 1), payDay);
}

/** 今日より後に引き落とされるカードの分（引き落とし日ごと、日付の順） */
export function pendingCard(rows: Row[], rule: CardRule, today: string): { date: string; amount: number }[] {
  if (!rule.cardPayDay) return [];
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!isCard(r)) continue;
    const d = withdrawalDate(r.date, rule.cardPayDay, rule.cardCloseDay);
    if (d > today) m.set(d, (m.get(d) ?? 0) + r.amount);
  }
  return [...m.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => (a.date < b.date ? -1 : 1));
}
