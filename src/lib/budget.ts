// 月の予算（SPEC「その月の予算」）
import type { Category, Settings } from '../db/types';
import { TRAVEL_CATEGORY } from '../db/db';
import type { Row } from './aggregate';
import { inPeriod, type Period } from './period';

export type CategoryBudget = { category: Category; budget: number; spent: number; left: number };

export type BudgetStatus = {
  /** 全体の予算（旅行は別）。決めていなければ undefined */
  total?: { budget: number; spent: number; left: number };
  /** 予算を決めたカテゴリだけ（並び順） */
  categories: CategoryBudget[];
};

/**
 * - 全体の予算は、旅行以外の支出と比べる（旅行はたびメモの予算で見る）。固定費も入る
 * - カテゴリの予算は、そのカテゴリの支出と比べる。「旅行」に予算を決めたときは、取り込んだ旅行の支出と比べる
 */
export function budgetStatus(rows: Row[], period: Pick<Period, 'start' | 'end'>, settings: Pick<Settings, 'monthlyBudget'>, categories: Category[]): BudgetStatus {
  const spentBy = new Map<string, number>();
  let living = 0;
  for (const r of rows) {
    if (r.type !== 'expense' || !inPeriod(r.date, period)) continue;
    const id = r.trip ? TRAVEL_CATEGORY : (r.entry?.categoryId ?? '');
    spentBy.set(id, (spentBy.get(id) ?? 0) + r.amount);
    if (id !== TRAVEL_CATEGORY) living += r.amount;
  }
  const total = settings.monthlyBudget !== undefined ? { budget: settings.monthlyBudget, spent: living, left: settings.monthlyBudget - living } : undefined;
  const cats = categories
    .filter((c) => c.type === 'expense' && c.monthlyBudget !== undefined)
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const spent = spentBy.get(c.id) ?? 0;
      return { category: c, budget: c.monthlyBudget!, spent, left: c.monthlyBudget! - spent };
    });
  return { total, categories: cats };
}
