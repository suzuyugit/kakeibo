import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteEntry, restoreEntry, saveEntry, validateEntry, type EntryInput } from './entryRepo';

const input: EntryInput = { type: 'expense', date: '2026-11-25', amount: 680, categoryId: 'ex-01-food', paymentMethod: 'cash' };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('entryRepo', () => {
  it('初回はカテゴリと設定の初期値が入る', async () => {
    expect(await db.categories.count()).toBe(17);
    expect((await db.settings.get('settings'))!.monthStartDay).toBe(1);
  });

  it('保存でカテゴリの usageCount が増える。編集で createdAt は変わらない', async () => {
    const id = await saveEntry(input, undefined, '2026-11-25T10:00:00Z');
    await saveEntry({ ...input, amount: 700 }, id, '2026-11-25T11:00:00Z');
    const e = (await db.entries.get(id))!;
    expect(e).toMatchObject({ amount: 700, createdAt: '2026-11-25T10:00:00Z', updatedAt: '2026-11-25T11:00:00Z' });
    expect((await db.categories.get('ex-01-food'))!.usageCount).toBe(1);
  });

  it('収入には支払い方法を持たせない。空のメモは入れない', async () => {
    const id = await saveEntry({ type: 'income', date: '2026-11-25', amount: 50000, categoryId: 'in-01-salary', paymentMethod: 'cash', memo: '  ' });
    const e = (await db.entries.get(id))!;
    expect(e.paymentMethod).toBeUndefined();
    expect(e.memo).toBeUndefined();
  });

  it('固定から入った記録を消すとその月は作り直さない。元に戻すと解除', async () => {
    await db.recurrings.add({ id: 'r', type: 'expense', name: 'スマホ', amount: 8000, categoryId: 'ex-10-phone', dayOfMonth: 27, startMonth: '2026-01', skippedMonths: [] });
    await db.entries.add({ id: 'e', type: 'expense', date: '2026-11-27', amount: 8000, categoryId: 'ex-10-phone', recurringId: 'r', recurringMonth: '2026-11', createdAt: '', updatedAt: '' });
    // 編集しても固定の印は残る
    await saveEntry({ type: 'expense', date: '2026-11-27', amount: 7500, categoryId: 'ex-10-phone' }, 'e');
    expect((await db.entries.get('e'))!.recurringId).toBe('r');
    const deleted = (await deleteEntry('e'))!;
    expect((await db.recurrings.get('r'))!.skippedMonths).toEqual(['2026-11']);
    await restoreEntry(deleted);
    expect((await db.entries.get('e'))!.amount).toBe(7500);
    expect((await db.recurrings.get('r'))!.skippedMonths).toEqual([]);
  });

  it('入力のチェック', () => {
    expect(validateEntry(input)).toBeUndefined();
    expect(validateEntry({ ...input, amount: 0 })).toBe('金額を入れてください');
    expect(validateEntry({ ...input, categoryId: '' })).toBe('カテゴリを選んでください');
  });
});
