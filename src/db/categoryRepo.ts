import { db, TRAVEL_CATEGORY } from './db';
import type { Category, EntryType } from './types';
import { newId } from '../lib/id';

/** クイック入力に出す順：よく使う順（同じなら並び順）。非表示と「旅行」は出さない */
export function forPicker(cats: Category[], type: EntryType): Category[] {
  return cats
    .filter((c) => c.type === type && !c.hidden && c.id !== TRAVEL_CATEGORY)
    .sort((a, b) => b.usageCount - a.usageCount || a.order - b.order);
}

/** 設定画面の並び（並び順） */
export function forSettings(cats: Category[], type: EntryType): Category[] {
  return cats.filter((c) => c.type === type).sort((a, b) => a.order - b.order);
}

export type PayRule = Pick<Category, 'payDay' | 'payCloseDay'>;

export async function addCategory(type: EntryType, name: string, icon: string, pay: PayRule = {}): Promise<string> {
  const id = newId();
  const max = (await db.categories.where('type').equals(type).toArray())
    .filter((c) => c.id !== TRAVEL_CATEGORY)
    .reduce((m, c) => Math.max(m, c.order), 0);
  await db.categories.add({ id, type, name: name.trim(), icon: icon || '📦', usageCount: 0, order: max + 1, ...(type === 'income' && pay.payDay ? pay : {}) });
  return id;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'icon' | 'hidden' | 'payDay' | 'payCloseDay'>>): Promise<void> {
  await db.categories.update(id, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) });
}

/** 記録か固定の収入・支出で使っているか。「旅行」はいつも使っている扱い */
export async function isCategoryInUse(id: string): Promise<boolean> {
  if (id === TRAVEL_CATEGORY) return true;
  if ((await db.entries.where('categoryId').equals(id).count()) > 0) return true;
  return (await db.recurrings.filter((r) => r.categoryId === id).count()) > 0;
}

/** 使っていなければ消す。使っていれば false（代わりに非表示にする） */
export async function deleteCategory(id: string): Promise<boolean> {
  if (await isCategoryInUse(id)) return false;
  await db.categories.delete(id);
  return true;
}

/** 並べ替え：ids の順に order を振り直す */
export async function reorderCategories(ids: string[]): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    for (const [i, id] of ids.entries()) await db.categories.update(id, { order: i + 1 });
  });
}
