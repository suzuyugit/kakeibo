import { db } from './db';
import type { Recurring } from './types';
import { newId } from '../lib/id';
import { dueEntries, planSave, planStop, type RecurringInput } from '../lib/recurring';

/** 今日までに入るはずの固定の記録を作る（アプリを開いたとき・固定を保存したとき）。作った件数を返す */
export async function applyRecurring(today: string): Promise<number> {
  return db.transaction('rw', db.recurrings, db.entries, async () => {
    const recurrings = await db.recurrings.toArray();
    if (recurrings.length === 0) return 0;
    const made = await db.entries.filter((e) => !!e.recurringId).toArray();
    const existing = new Set(made.map((e) => `${e.recurringId}|${e.recurringMonth}`));
    const due = dueEntries(recurrings, existing, today);
    // id は固定と月から決まるので、同時に2回動いても二重にならない
    await db.entries.bulkPut(due);
    return due.length;
  });
}

export async function saveRecurring(input: RecurringInput, existing: Recurring | undefined, today: string): Promise<void> {
  const p = planSave(input, existing, today, newId);
  await db.transaction('rw', db.recurrings, async () => {
    if (p.update) await db.recurrings.put(p.update);
    if (p.add) await db.recurrings.put(p.add);
  });
  await applyRecurring(today);
}

export async function stopRecurring(existing: Recurring, today: string): Promise<void> {
  const p = planStop(existing, today);
  if (p.remove) await db.recurrings.delete(p.remove);
  if (p.update) await db.recurrings.put(p.update);
}
