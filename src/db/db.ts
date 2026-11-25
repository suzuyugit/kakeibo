import Dexie, { type EntityTable } from 'dexie';
import type { Category, Entry, LedgerEntry, LedgerTrip, Recurring, Settings } from './types';

/** 「✈️ 旅行」カテゴリ。たびメモから取り込んだ支出はすべてここに入る。消せず、手入力では選べない */
export const TRAVEL_CATEGORY = 'cat-travel';

// ID の数字は usageCount が同じときの並び順（初期値の順）
export const DEFAULT_CATEGORIES: Omit<Category, 'usageCount'>[] = [
  { id: 'ex-01-food', type: 'expense', name: '食費', icon: '🍙', order: 1 },
  { id: 'ex-02-eatout', type: 'expense', name: '外食', icon: '🍜', order: 2 },
  { id: 'ex-03-daily', type: 'expense', name: '日用品', icon: '🧴', order: 3 },
  { id: 'ex-04-transport', type: 'expense', name: '交通', icon: '🚃', order: 4 },
  { id: 'ex-05-hobby', type: 'expense', name: '趣味', icon: '🎮', order: 5 },
  { id: 'ex-06-social', type: 'expense', name: '交際費', icon: '🍻', order: 6 },
  { id: 'ex-07-fashion', type: 'expense', name: '服・美容', icon: '👕', order: 7 },
  { id: 'ex-08-home', type: 'expense', name: '住まい', icon: '🏠', order: 8 },
  { id: 'ex-09-utility', type: 'expense', name: '光熱費', icon: '💡', order: 9 },
  { id: 'ex-10-phone', type: 'expense', name: '通信', icon: '📱', order: 10 },
  { id: 'ex-11-subscription', type: 'expense', name: 'サブスク', icon: '🔁', order: 11 },
  { id: 'ex-12-other', type: 'expense', name: 'その他', icon: '📦', order: 12 },
  { id: TRAVEL_CATEGORY, type: 'expense', name: '旅行', icon: '✈️', order: 99 },
  { id: 'in-01-salary', type: 'income', name: '給料・バイト代', icon: '💼', order: 1 },
  { id: 'in-02-allowance', type: 'income', name: '仕送り', icon: '📮', order: 2 },
  { id: 'in-03-extra', type: 'income', name: '臨時収入', icon: '🎉', order: 3 },
  { id: 'in-04-other', type: 'income', name: 'その他', icon: '💰', order: 4 },
];

export const DEFAULT_SETTINGS: Settings = { key: 'settings', monthStartDay: 1 };

export class KakeiboDB extends Dexie {
  entries!: EntityTable<Entry, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  recurrings!: EntityTable<Recurring, 'id'>;
  settings!: EntityTable<Settings, 'key'>;
  tripLedger!: EntityTable<LedgerTrip, 'tripId'>;
  tripEntries!: EntityTable<LedgerEntry, 'id'>;

  constructor(name = 'kakeibo') {
    super(name);
    this.version(1).stores({
      entries: 'id, date, type, categoryId, [recurringId+recurringMonth]',
      categories: 'id, type, order',
      recurrings: 'id',
      settings: 'key',
      tripLedger: 'tripId, startDate',
      tripEntries: 'id, tripId, date',
    });

    // 初回作成時だけカテゴリと設定の初期値を入れる
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c, usageCount: 0 })));
      tx.table('settings').add(DEFAULT_SETTINGS);
    });
  }
}

export const db = new KakeiboDB();

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'key'>>): Promise<void> {
  const cur = await getSettings();
  await db.settings.put({ ...cur, ...patch, key: 'settings' });
}
