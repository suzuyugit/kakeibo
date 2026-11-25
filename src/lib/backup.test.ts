import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { saveEntry } from '../db/entryRepo';
import { backupSummary, checkBackup, exportBackup, restoreBackup } from './backup';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('バックアップ', () => {
  it('書き出して、消して、元に戻せる', async () => {
    await saveEntry({ type: 'expense', date: '2026-11-25', amount: 680, categoryId: 'ex-01-food' });
    await db.tripLedger.put({ tripId: 't', name: 'ソウル', startDate: '2026-12-01', endDate: '2026-12-03', estimateYen: 0, spentYen: 0 });
    const b = JSON.parse(JSON.stringify(await exportBackup('2026-11-25T00:00:00Z')));
    const c = checkBackup(b);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(backupSummary(c.backup)).toBe('記録 1件・固定 0件・旅行 1件');
    await db.entries.clear();
    await saveEntry({ type: 'expense', date: '2026-11-26', amount: 1, categoryId: 'ex-01-food' });
    await restoreBackup(c.backup);
    expect((await db.entries.toArray()).map((e) => e.amount)).toEqual([680]);
    expect(await db.categories.count()).toBe(17);
  });

  it('ほかのファイルは読まない', () => {
    expect(checkBackup({ app: 'tabi' })).toMatchObject({ ok: false });
    expect(checkBackup({ app: 'kakeibo', version: 2, tables: {} })).toMatchObject({ ok: false });
    expect(checkBackup({ app: 'kakeibo', version: 1, tables: { entries: [] } })).toMatchObject({ ok: false });
  });
});
