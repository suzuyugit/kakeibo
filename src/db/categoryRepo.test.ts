import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, TRAVEL_CATEGORY } from './db';
import { addCategory, deleteCategory, forPicker, forSettings, reorderCategories } from './categoryRepo';
import { saveEntry } from './entryRepo';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('categoryRepo', () => {
  it('クイック入力はよく使う順。非表示と旅行は出さない', async () => {
    await saveEntry({ type: 'expense', date: '2026-11-25', amount: 1, categoryId: 'ex-05-hobby' });
    await db.categories.update('ex-01-food', { hidden: true });
    const picked = forPicker(await db.categories.toArray(), 'expense');
    expect(picked[0].id).toBe('ex-05-hobby');
    expect(picked.map((c) => c.id)).not.toContain('ex-01-food');
    expect(picked.map((c) => c.id)).not.toContain(TRAVEL_CATEGORY);
  });

  it('追加は最後、並べ替えできる', async () => {
    const id = await addCategory('income', ' 奨学金 ', '🎓');
    let list = forSettings(await db.categories.toArray(), 'income');
    expect(list.at(-1)).toMatchObject({ id, name: '奨学金' });
    await reorderCategories([id, ...list.filter((c) => c.id !== id).map((c) => c.id)]);
    list = forSettings(await db.categories.toArray(), 'income');
    expect(list[0].id).toBe(id);
  });

  it('使っているカテゴリと旅行は消せない', async () => {
    await saveEntry({ type: 'expense', date: '2026-11-25', amount: 1, categoryId: 'ex-05-hobby' });
    expect(await deleteCategory('ex-05-hobby')).toBe(false);
    expect(await deleteCategory(TRAVEL_CATEGORY)).toBe(false);
    expect(await deleteCategory('ex-06-social')).toBe(true);
    expect(await db.categories.get('ex-06-social')).toBeUndefined();
  });

  it('収入カテゴリに振込日（締め日）を持たせられる。支出には付けない', async () => {
    const a = await addCategory('income', '○○居酒屋', '🍺', { payDay: 15 });
    const b = await addCategory('income', '△△ラーメン', '🍜', { payDay: 25, payCloseDay: 20 });
    const c = await addCategory('expense', '本', '📚', { payDay: 15 });
    expect(await db.categories.get(a)).toMatchObject({ payDay: 15 });
    expect(await db.categories.get(b)).toMatchObject({ payDay: 25, payCloseDay: 20 });
    expect((await db.categories.get(c))!.payDay).toBeUndefined();
  });
});
