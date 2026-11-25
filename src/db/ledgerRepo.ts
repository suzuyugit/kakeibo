import { db, getSettings } from './db';
import type { LedgerEntry, LedgerTrip } from './types';
import type { LedgerPayload } from '../lib/ledger';

/**
 * 家計簿で削除したものを除いて入れる形にする。
 * 削除した支出の分は、その旅行の「もう使った額」と見積もりからも引く
 */
export function applyExclusions(p: LedgerPayload, excludedTripIds: string[], excludedEntryIds: string[]): { trips: LedgerTrip[]; entries: LedgerEntry[] } {
  const xTrips = new Set(excludedTripIds);
  const xEntries = new Set(excludedEntryIds);
  const removed = new Map<string, number>();
  const entries: LedgerEntry[] = [];
  for (const e of p.entries) {
    if (xTrips.has(e.tripId)) continue;
    if (xEntries.has(e.id)) {
      removed.set(e.tripId, (removed.get(e.tripId) ?? 0) + e.myShareYen);
      continue;
    }
    entries.push(e);
  }
  const trips = p.trips
    .filter((t) => !xTrips.has(t.tripId))
    .map((t) => {
      const r = removed.get(t.tripId) ?? 0;
      return r ? { ...t, spentYen: Math.max(0, t.spentYen - r), estimateYen: Math.max(0, t.estimateYen - r) } : t;
    });
  return { trips, entries };
}

/** たびメモのデータを取り込む。旅行の分は毎回まるごと入れ替える（何度取り込んでも二重にならない）。家計簿で削除したものは入れない */
export async function importLedger(p: LedgerPayload): Promise<{ trips: number; entries: number }> {
  return db.transaction('rw', db.tripLedger, db.tripEntries, db.settings, async () => {
    const s = await getSettings();
    const { trips, entries } = applyExclusions(p, s.excludedTripIds ?? [], s.excludedEntryIds ?? []);
    await db.tripLedger.clear();
    await db.tripEntries.clear();
    await db.tripLedger.bulkPut(trips);
    await db.tripEntries.bulkPut(entries);
    await db.settings.put({ ...s, ledgerExportedAt: p.exportedAt });
    return { trips: trips.length, entries: entries.length };
  });
}

export type DeletedLedger = { trips: LedgerTrip[]; entries: LedgerEntry[]; tripIds: string[]; entryIds: string[] };

/** 取り込んだ旅行の支出を1件消す。次に取り込んでも入らない */
export async function deleteTripEntry(id: string): Promise<DeletedLedger | undefined> {
  return db.transaction('rw', db.tripLedger, db.tripEntries, db.settings, async () => {
    const e = await db.tripEntries.get(id);
    if (!e) return undefined;
    const t = await db.tripLedger.get(e.tripId);
    await db.tripEntries.delete(id);
    if (t) await db.tripLedger.put({ ...t, spentYen: Math.max(0, t.spentYen - e.myShareYen), estimateYen: Math.max(0, t.estimateYen - e.myShareYen) });
    const s = await getSettings();
    await db.settings.put({ ...s, excludedEntryIds: [...new Set([...(s.excludedEntryIds ?? []), id])] });
    return { trips: t ? [t] : [], entries: [e], tripIds: [], entryIds: [id] };
  });
}

/** 取り込んだ旅行を、その支出ごと消す。次に取り込んでも入らない */
export async function deleteTrip(tripId: string): Promise<DeletedLedger | undefined> {
  return db.transaction('rw', db.tripLedger, db.tripEntries, db.settings, async () => {
    const t = await db.tripLedger.get(tripId);
    if (!t) return undefined;
    const entries = await db.tripEntries.where('tripId').equals(tripId).toArray();
    await db.tripLedger.delete(tripId);
    await db.tripEntries.bulkDelete(entries.map((e) => e.id));
    const s = await getSettings();
    await db.settings.put({ ...s, excludedTripIds: [...new Set([...(s.excludedTripIds ?? []), tripId])] });
    return { trips: [t], entries, tripIds: [tripId], entryIds: [] };
  });
}

/** 削除を元に戻す（消す前の状態に戻し、取り込みで除く一覧からも外す） */
export async function restoreLedger(d: DeletedLedger): Promise<void> {
  await db.transaction('rw', db.tripLedger, db.tripEntries, db.settings, async () => {
    await db.tripLedger.bulkPut(d.trips);
    await db.tripEntries.bulkPut(d.entries);
    const s = await getSettings();
    await db.settings.put({
      ...s,
      excludedTripIds: (s.excludedTripIds ?? []).filter((x) => !d.tripIds.includes(x)),
      excludedEntryIds: (s.excludedEntryIds ?? []).filter((x) => !d.entryIds.includes(x)),
    });
  });
}

/** 家計簿で削除した旅行・支出を、次の取り込みでまた入るようにする */
export async function clearExclusions(): Promise<void> {
  const s = await getSettings();
  await db.settings.put({ ...s, excludedTripIds: [], excludedEntryIds: [] });
}
