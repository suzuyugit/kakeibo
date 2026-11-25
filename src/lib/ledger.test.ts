import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { clearExclusions, deleteTrip, deleteTripEntry, importLedger, restoreLedger } from '../db/ledgerRepo';
import { decodeLedger, type LedgerPayload } from './ledger';

// たびメモの「家計簿に送る」が作るのと同じ形
const payload: LedgerPayload = {
  schema: 1,
  exportedAt: '2026-11-20T10:00:00.000Z',
  trips: [{ tripId: 't1', name: 'ソウル', startDate: '2026-12-01', endDate: '2026-12-03', budgetYen: 80000, estimateYen: 43333, spentYen: 31333 }],
  entries: [
    { id: 'e1', tripId: 't1', date: '2026-10-05', categoryName: '交通', categoryIcon: '🚃', myShareYen: 30000, paymentMethod: 'card' },
    { id: 'e2', tripId: 't1', date: '2026-12-01', categoryName: '食事', categoryIcon: '🍚', myShareYen: 1333, paymentMethod: 'cash', memo: '焼肉' },
  ],
};
const text = (p: unknown) => `TABIMEMO-LEDGER\n${JSON.stringify(p)}`;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('たびメモからの取り込み', () => {
  it('読める', () => {
    expect(decodeLedger(text(payload))).toEqual(payload);
    expect(decodeLedger(`  ${text(payload)}\n`)).toEqual(payload);
  });

  it('ほかの文字列・壊れたデータ・知らない schema は読まない', () => {
    expect(decodeLedger('https://example.com')).toEqual({ error: 'not-ledger' });
    expect(decodeLedger('TABIMEMO-LEDGER\n{')).toEqual({ error: 'not-ledger' });
    expect(decodeLedger(text({ ...payload, entries: [{ id: 'x' }] }))).toEqual({ error: 'not-ledger' });
    expect(decodeLedger(text({ ...payload, schema: 2 }))).toEqual({ error: 'unknown-schema' });
  });

  it('取り込むたびに入れ替わる（二重にならず、消えた支出は消える）', async () => {
    await importLedger(payload);
    await importLedger(payload);
    expect(await db.tripEntries.count()).toBe(2);
    await importLedger({ ...payload, exportedAt: '2026-11-21T10:00:00.000Z', entries: [payload.entries[0]] });
    expect((await db.tripEntries.toArray()).map((e) => e.id)).toEqual(['e1']);
    expect((await db.settings.get('settings'))!.ledgerExportedAt).toBe('2026-11-21T10:00:00.000Z');
    expect((await db.settings.get('settings'))!.monthStartDay).toBe(1);
  });

  it('家計簿で消した支出は、次に取り込んでも入らない。使った額からも引く。元に戻せる', async () => {
    await importLedger(payload);
    const d = (await deleteTripEntry('e1'))!;
    expect(await db.tripEntries.count()).toBe(1);
    expect((await db.tripLedger.get('t1'))!.spentYen).toBe(1333);
    expect(await importLedger(payload)).toEqual({ trips: 1, entries: 1 });
    expect((await db.tripLedger.get('t1'))!).toMatchObject({ spentYen: 1333, estimateYen: 13333 });
    await restoreLedger(d);
    expect(await db.tripEntries.count()).toBe(2);
    await importLedger(payload);
    expect((await db.tripLedger.get('t1'))!.spentYen).toBe(31333);
  });

  it('家計簿で消した旅行は、支出ごと入らない。戻すと次の取り込みで入る', async () => {
    await importLedger(payload);
    await deleteTrip('t1');
    expect(await db.tripEntries.count()).toBe(0);
    expect(await importLedger(payload)).toEqual({ trips: 0, entries: 0 });
    await clearExclusions();
    expect(await importLedger(payload)).toEqual({ trips: 1, entries: 2 });
  });
});
