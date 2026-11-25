// 貯金（SPEC「計算のルール／今の貯金」）
import type { Settings } from '../db/types';
import type { Row } from './aggregate';
import { toYmd } from './date';

export type SavingsNow = {
  base: number; // 入力した額
  asOf: string; // その額がいつの終わりの額か
  change: number; // その翌日から今日までの収支（収入 − 支出 − 旅行の負担分）
  total: number; // 今の貯金
};

/**
 * 今の貯金 = 入力した額 + 入力した時点より後の（収入 − 支出）。
 * - 「いつの額」の日より前の日付の記録と、その日の記録のうち貯金を入れる前に記録したものは、もう入っているとみなして足さない
 *   （「いつの額」を過去の日にしたときは、その日の記録はすべて入っているとみなす）
 * - 先の日付の記録はまだ足さない
 * 貯金をまだ入れていなければ undefined
 */
export type SavingsBase = Pick<Settings, 'savingsAmount' | 'savingsAsOf' | 'savingsSetAt'>;

/** その記録が、入れた貯金のあとの増減に入るか（先の日付・入れる前のものは入らない） */
export function countsTowardSavings(r: Row, settings: SavingsBase, today: string, setAtDate?: string): boolean {
  const asOf = settings.savingsAsOf;
  if (!asOf || r.date > today || r.date < asOf) return false;
  if (r.date > asOf) return true;
  // 入れた日と同じ日の記録は、入れたあとに記録したものだけ（旅行の支出は入っているとみなす）
  const setAt = settings.savingsSetAt;
  const setDay = setAtDate ?? (setAt ? toYmd(new Date(setAt)) : undefined);
  return !!(setAt && setDay === asOf && r.entry && r.entry.createdAt > setAt);
}

export function savingsNow(settings: SavingsBase, rows: Row[], today: string, setAtDate?: string): SavingsNow | undefined {
  if (settings.savingsAmount === undefined || !settings.savingsAsOf) return undefined;
  let change = 0;
  for (const r of rows) {
    if (countsTowardSavings(r, settings, today, setAtDate)) change += r.type === 'income' ? r.amount : -r.amount;
  }
  return { base: settings.savingsAmount, asOf: settings.savingsAsOf, change, total: settings.savingsAmount + change };
}
