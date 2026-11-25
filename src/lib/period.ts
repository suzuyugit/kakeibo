// 月の区切り（SPEC「計算のルール／月の区切り」）
// monthStartDay が 25 なら「11月」は 11/25〜12/24。月は期間が始まる月で呼ぶ。キーは YYYY-MM。
import { parseYmd, toYmd } from './date';

export type Period = { key: string; start: string; end: string };

const pad = (n: number) => String(n).padStart(2, '0');

function keyOf(y: number, m: number): string {
  // m は 0 始まり。範囲外は年に繰り上げる
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** キー（YYYY-MM）の期間 */
export function periodByKey(key: string, startDay: number): Period {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(y, m - 1, startDay);
  const end = new Date(y, m, startDay - 1); // 次の月の開始日の前の日
  return { key, start: toYmd(start), end: toYmd(end) };
}

/** その日が入る期間 */
export function periodOf(ymd: string, startDay: number): Period {
  const d = parseYmd(ymd);
  const key = d.getDate() >= startDay ? keyOf(d.getFullYear(), d.getMonth()) : keyOf(d.getFullYear(), d.getMonth() - 1);
  return periodByKey(key, startDay);
}

/** n か月ずらしたキー */
export function shiftKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  return keyOf(y, m - 1 + n);
}

/** 期間の日付の一覧（start〜end） */
export function daysOf(p: Pick<Period, 'start' | 'end'>): string[] {
  const out: string[] = [];
  const d = parseYmd(p.start);
  const end = parseYmd(p.end);
  while (d <= end) {
    out.push(toYmd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function inPeriod(ymd: string, p: Pick<Period, 'start' | 'end'>): boolean {
  return ymd >= p.start && ymd <= p.end;
}

/** 画面に出す名前。例：「11月」、開始日が1日でなければ「11月（11/25〜12/24）」。今年でなければ「2025年11月」 */
export function periodLabel(p: Period, startDay: number, thisYear = new Date().getFullYear()): string {
  const [y, m] = p.key.split('-').map(Number);
  const head = y === thisYear ? `${m}月` : `${y}年${m}月`;
  if (startDay === 1) return head;
  const md = (ymd: string) => {
    const d = parseYmd(ymd);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return `${head}（${md(p.start)}〜${md(p.end)}）`;
}
