// カードの引き落とし：月末締めで、翌月の決めた日に口座から出る
import type { Row } from './aggregate';
import { addMonths, dateFor, monthOf } from './recurring';

/** カードで払った記録か（家計簿の記録・取り込んだ旅行の支出のどちらも） */
export function isCard(r: Row): boolean {
  return r.type === 'expense' && (r.entry?.paymentMethod ?? r.trip?.paymentMethod) === 'card';
}

/** その日に使ったカードの分が引き落とされる日 */
export function withdrawalDate(date: string, cardPayDay: number): string {
  return dateFor(addMonths(monthOf(date), 1), cardPayDay);
}

/** お金が実際に口座から出入りする日。カードは引き落とし日、それ以外は記録の日 */
export function moneyDate(r: Row, cardPayDay: number | undefined): string {
  return cardPayDay && isCard(r) ? withdrawalDate(r.date, cardPayDay) : r.date;
}

/** 今日より後に引き落とされるカードの分（引き落とし日ごと、日付の順） */
export function pendingCard(rows: Row[], cardPayDay: number | undefined, today: string): { date: string; amount: number }[] {
  if (!cardPayDay) return [];
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!isCard(r)) continue;
    const d = withdrawalDate(r.date, cardPayDay);
    if (d > today) m.set(d, (m.get(d) ?? 0) + r.amount);
  }
  return [...m.entries()].map(([date, amount]) => ({ date, amount })).sort((a, b) => (a.date < b.date ? -1 : 1));
}
