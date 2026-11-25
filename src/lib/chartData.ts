// グラフ用のデータ（円グラフ・月末の貯金の棒グラフ）
import type { Category, EntryType } from '../db/types';
import { TRAVEL_CATEGORY } from '../db/db';
import type { Row } from './aggregate';
import { inPeriod, type Period } from './period';

export type Slice = { key: string; label: string; icon: string; value: number; order: number };

/**
 * その期間の収入か支出を、カテゴリごとの割合にする。
 * 多い順に maxSlices − 1 個まで出し、残りは「その他」にまとめる（並び順は多い順、その他は最後）
 */
export function slicesFor(rows: Row[], p: Pick<Period, 'start' | 'end'>, type: EntryType, categories: Category[], maxSlices = 8): Slice[] {
  const cat = new Map(categories.map((c) => [c.id, c]));
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.type !== type || !inPeriod(r.date, p)) continue;
    const id = r.trip ? TRAVEL_CATEGORY : (r.entry?.categoryId ?? '?');
    m.set(id, (m.get(id) ?? 0) + r.amount);
  }
  const all = [...m.entries()]
    .map(([id, value]) => {
      const c = cat.get(id);
      return { key: id, label: c?.name ?? 'その他', icon: c?.icon ?? '📦', value, order: c?.order ?? 999 };
    })
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  if (all.length <= maxSlices) return all;
  const head = all.slice(0, maxSlices - 1);
  const rest = all.slice(maxSlices - 1).reduce((a, s) => a + s.value, 0);
  return [...head, { key: '__rest', label: 'そのほか', icon: '…', value: rest, order: 9999 }];
}

/** 月末の日付の一覧（from の月から to の月まで） */
export function monthEnds(fromMonth: string, toMonth: string): { month: string; end: string }[] {
  const out: { month: string; end: string }[] = [];
  let [y, m] = fromMonth.split('-').map(Number);
  for (let i = 0; i < 36; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (key > toMonth) break;
    const last = new Date(y, m, 0).getDate();
    out.push({ month: key, end: `${key}-${String(last).padStart(2, '0')}` });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
