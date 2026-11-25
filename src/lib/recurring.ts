// 固定の収入・支出（SPEC「固定の収入・支出」）。月はカレンダーの月（YYYY-MM）で数える
import type { Entry, Recurring } from '../db/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** その月の dayOfMonth 日。ない日（31日など）はその月の最終日 */
export function dateFor(month: string, dayOfMonth: number): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month}-${pad(Math.min(dayOfMonth, last))}`;
}

/** 次に入る月：今月の日がまだ来ていない（今日を含む）なら今月、過ぎていれば来月 */
export function nextMonthFrom(dayOfMonth: number, today: string): string {
  const m = monthOf(today);
  return dateFor(m, dayOfMonth) >= today ? m : addMonths(m, 1);
}

/** 今ある固定の次の回の月：今日の分はもう入っているので、今月の日が今日より後なら今月、そうでなければ来月 */
export function upcomingMonth(dayOfMonth: number, today: string): string {
  const m = monthOf(today);
  return dateFor(m, dayOfMonth) > today ? m : addMonths(m, 1);
}

/** まだ止めていない（これからも入る）か */
export function isActive(r: Pick<Recurring, 'endMonth' | 'dayOfMonth'>, today: string): boolean {
  return !r.endMonth || r.endMonth >= upcomingMonth(r.dayOfMonth, today);
}

/** 自動で入る記録のメモ。翌月払いの収入なら「バイト代（10月分）」 */
export function recurringMemo(r: Pick<Recurring, 'name' | 'type' | 'payFor'>, month: string): string {
  if (r.type !== 'income' || r.payFor !== 'prev') return r.name;
  const prev = Number(addMonths(month, -1).slice(5));
  return `${r.name}（${prev}月分）`;
}

/**
 * 今日までに入っているはずなのに、まだない記録。
 * startMonth から今月まで、日が来ていて、消した月（skippedMonths）でなく、まだ作っていない月の分
 */
export function dueEntries(
  recurrings: Recurring[],
  existing: Set<string>, // `${recurringId}|${recurringMonth}`
  today: string,
  now = new Date().toISOString(),
): Entry[] {
  const out: Entry[] = [];
  const thisMonth = monthOf(today);
  for (const r of recurrings) {
    const last = r.endMonth && r.endMonth < thisMonth ? r.endMonth : thisMonth;
    for (let m = r.startMonth; m <= last; m = addMonths(m, 1)) {
      if (r.skippedMonths.includes(m) || existing.has(`${r.id}|${m}`)) continue;
      const date = dateFor(m, r.dayOfMonth);
      if (date > today) continue;
      out.push({
        id: `rec-${r.id}-${m}`,
        type: r.type,
        date,
        amount: r.amount,
        categoryId: r.categoryId,
        ...(r.type === 'expense' && r.paymentMethod ? { paymentMethod: r.paymentMethod } : {}),
        memo: recurringMemo(r, m),
        recurringId: r.id,
        recurringMonth: m,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return out;
}

export type RecurringInput = Pick<Recurring, 'type' | 'name' | 'amount' | 'categoryId' | 'dayOfMonth' | 'paymentMethod' | 'payFor'>;

/**
 * 保存したときに、固定の一覧をどう変えるか。
 * - 新しく作る：次に入る月から
 * - 金額を変える：次の回から新しい額。今のものは前の月までで止め、新しいものを作る（もう入った記録は変えない）
 * - 金額以外だけ変える：そのまま直す
 */
export function planSave(
  input: RecurringInput,
  existing: Recurring | undefined,
  today: string,
  newId: () => string,
): { update?: Recurring; add?: Recurring; remove?: string } {
  const startNext = nextMonthFrom(input.dayOfMonth, today);
  if (!existing) {
    return { add: { ...input, id: newId(), startMonth: startNext, skippedMonths: [] } };
  }
  if (existing.amount === input.amount) {
    return { update: { ...existing, ...input } };
  }
  const from = upcomingMonth(existing.dayOfMonth, today);
  // まだ一度も入っていなければ、そのまま直す
  if (existing.startMonth >= from) return { update: { ...existing, ...input } };
  const next: Recurring = { ...input, id: newId(), startMonth: from, endMonth: existing.endMonth, skippedMonths: [] };
  if (next.endMonth && next.endMonth < from) return { update: { ...existing, ...input } };
  return { update: { ...existing, endMonth: addMonths(from, -1) }, add: next };
}

/** 止める：次の回から入らないようにする。一度も入っていなければ消す */
export function planStop(existing: Recurring, today: string): { update?: Recurring; remove?: string } {
  const from = upcomingMonth(existing.dayOfMonth, today);
  if (existing.startMonth >= from) return { remove: existing.id };
  return { update: { ...existing, endMonth: addMonths(from, -1) } };
}
