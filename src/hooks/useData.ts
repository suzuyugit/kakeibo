import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS } from '../db/db';
import type { Settings } from '../db/types';
import { toRows, type Row } from '../lib/aggregate';

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export function useCategories() {
  return useLiveQuery(() => db.categories.toArray()) ?? [];
}

/** 全部の記録と旅行の支出を混ぜた一覧（新しい日が上）。読み込み中は undefined */
export function useRows(): Row[] | undefined {
  return useLiveQuery(async () => {
    const [entries, tripEntries, trips, categories] = await Promise.all([
      db.entries.toArray(),
      db.tripEntries.toArray(),
      db.tripLedger.toArray(),
      db.categories.toArray(),
    ]);
    return toRows(entries, tripEntries, trips, categories);
  });
}
