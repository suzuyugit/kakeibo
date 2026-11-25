import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteEntry, saveEntry } from './entryRepo';
import { applyRecurring, saveRecurring, stopRecurring } from './recurringRepo';

const input = { type: 'expense' as const, name: 'スマホ', amount: 8000, categoryId: 'ex-10-phone', dayOfMonth: 27, paymentMethod: 'card' as const };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('固定の自動入力', () => {
  it('月に1回だけ入り、開かなかった月の分はまとめて入る', async () => {
    await saveRecurring({ ...input, startDate: '2026-09-01' }, undefined, '2026-09-01'); // 9月から
    expect(await db.entries.count()).toBe(0);
    expect(await applyRecurring('2026-09-27')).toBe(1);
    expect(await applyRecurring('2026-09-28')).toBe(0); // 同じ月に2回は入らない
    await Promise.all([applyRecurring('2026-12-27'), applyRecurring('2026-12-27')]); // 同時に動いても二重にならない
    expect((await db.entries.orderBy('date').toArray()).map((e) => e.date)).toEqual(['2026-09-27', '2026-10-27', '2026-11-27', '2026-12-27']);
  });

  it('自動で入った記録を直しても消しても、その月は作り直さない', async () => {
    await saveRecurring({ ...input, startDate: '2026-11-01' }, undefined, '2026-11-01');
    await applyRecurring('2026-11-27');
    const [e] = await db.entries.toArray();
    await saveEntry({ type: 'expense', date: e.date, amount: 7600, categoryId: e.categoryId }, e.id);
    await applyRecurring('2026-11-28');
    expect((await db.entries.toArray()).map((x) => x.amount)).toEqual([7600]);
    await deleteEntry(e.id);
    await applyRecurring('2026-11-29');
    expect(await db.entries.count()).toBe(0);
  });

  it('金額を変えると次の回から。止めるとそのあとは入らない', async () => {
    await saveRecurring({ ...input, startDate: '2026-10-01' }, undefined, '2026-10-01');
    await applyRecurring('2026-11-28');
    const [r] = await db.recurrings.toArray();
    await saveRecurring({ ...{ ...input, amount: 9000 }, startDate: '2026-11-28' }, r, '2026-11-28');
    await applyRecurring('2027-01-27');
    expect((await db.entries.orderBy('date').toArray()).map((e) => [e.date, e.amount])).toEqual([
      ['2026-10-27', 8000],
      ['2026-11-27', 8000],
      ['2026-12-27', 9000],
      ['2027-01-27', 9000],
    ]);
    const current = (await db.recurrings.toArray()).find((x) => !x.endMonth)!;
    await stopRecurring(current, '2027-01-28');
    await applyRecurring('2027-03-27');
    expect(await db.entries.count()).toBe(4);
  });
});
