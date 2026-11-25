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
export function savingsNow(
  settings: Pick<Settings, 'savingsAmount' | 'savingsAsOf' | 'savingsSetAt'>,
  rows: Row[],
  today: string,
  setAtDate?: string, // savingsSetAt の端末の日付（テスト用に渡せる）
): SavingsNow | undefined {
  if (settings.savingsAmount === undefined || !settings.savingsAsOf) return undefined;
  const asOf = settings.savingsAsOf;
  const setAt = settings.savingsSetAt;
  const setDay = setAtDate ?? (setAt ? toYmd(new Date(setAt)) : undefined);
  let change = 0;
  for (const r of rows) {
    if (r.date > today || r.date < asOf) continue;
    if (r.date === asOf) {
      // 入れた日と同じ日の記録は、入れたあとに記録したものだけ（旅行の支出は入っているとみなす）
      const after = setAt && setDay === asOf && r.entry && r.entry.createdAt > setAt;
      if (!after) continue;
    }
    change += r.type === 'income' ? r.amount : -r.amount;
  }
  return { base: settings.savingsAmount, asOf, change, total: settings.savingsAmount + change };
}
