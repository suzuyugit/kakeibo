import { describe, expect, it } from 'vitest';
import type { Category, Entry } from '../db/types';
import type { Row } from './aggregate';
import { budgetStatus } from './budget';

const cat = (id: string, monthlyBudget?: number, order = 1): Category => ({ id, type: 'expense', name: id, icon: '', usageCount: 0, order, monthlyBudget });
const row = (date: string, amount: number, categoryId: string, trip = false): Row => ({
  key: `${date}${amount}`, date, type: 'expense', amount, icon: '', title: '',
  ...(trip ? { trip: { tripId: 't', name: '', categoryName: '', categoryIcon: '' } } : { entry: { categoryId } as Entry }),
});

describe('予算', () => {
  const rows = [row('2026-11-02', 3000, 'food'), row('2026-11-03', 5000, 'hobby'), row('2026-11-04', 20000, '', true), row('2026-10-31', 999, 'food')];
  const p = { start: '2026-11-01', end: '2026-11-30' };

  it('全体の予算は旅行以外の支出と比べる', () => {
    expect(budgetStatus(rows, p, { monthlyBudget: 50000 }, []).total).toEqual({ budget: 50000, spent: 8000, left: 42000, excludesFixed: false });
    expect(budgetStatus(rows, p, {}, []).total).toBeUndefined();
  });

  it('カテゴリの予算は決めたものだけ。旅行は取り込んだ支出と比べる', () => {
    const s = budgetStatus(rows, p, {}, [cat('food', 2000, 1), cat('hobby'), cat('cat-travel', 30000, 99)]);
    expect(s.categories.map((c) => [c.category.id, c.spent, c.left])).toEqual([
      ['food', 3000, -1000],
      ['cat-travel', 20000, 10000],
    ]);
  });

  it('固定費を除いた予算（自由に使える額）なら、固定から入った記録は比べない', () => {
    const fixed: Row = { ...row('2026-11-27', 20000, 'home'), entry: { categoryId: 'home', recurringId: 'r' } as Entry };
    expect(budgetStatus([...rows, fixed], p, { monthlyBudget: 50000 }, []).total!.spent).toBe(28000);
    expect(budgetStatus([...rows, fixed], p, { monthlyBudget: 50000, budgetExcludesFixed: true }, []).total).toEqual({ budget: 50000, spent: 8000, left: 42000, excludesFixed: true });
  });
});
