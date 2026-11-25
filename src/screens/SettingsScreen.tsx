import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Category, EntryType } from '../db/types';
import { db, updateSettings } from '../db/db';
import { forSettings, reorderCategories } from '../db/categoryRepo';
import { CategorySheet } from '../components/CategorySheet';
import { RecurringSection } from '../components/RecurringSection';
import { BudgetSection } from '../components/BudgetSection';
import { formatExportedAt, LedgerImportButton } from '../components/LedgerImport';
import { useCategories, useSettings } from '../hooks/useData';
import { todayYmd } from '../lib/date';
import { periodLabel, periodOf } from '../lib/period';

export function SettingsScreen() {
  const settings = useSettings();
  const categories = useCategories();
  const [type, setType] = useState<EntryType>('expense');
  const [editing, setEditing] = useState<{ category?: Category } | null>(null);
  const list = forSettings(categories, type);
  const ledger = useLiveQuery(async () => ({ trips: await db.tripLedger.count(), entries: await db.tripEntries.count() }));

  const move = (i: number, d: -1 | 1) => {
    const ids = list.map((c) => c.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void reorderCategories(ids);
  };

  const sample = periodOf(todayYmd(), settings.monthStartDay);

  return (
    <>
      <RecurringSection />
      <BudgetSection />

      <section className="card">
        <h3 className="card-title">月の始まり</h3>
        <label className="field">
          <span className="label">毎月の開始日</span>
          <select value={settings.monthStartDay} onChange={(e) => void updateSettings({ monthStartDay: Number(e.target.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}日{d === 1 ? '（ふつうの月）' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">
          給料日にそろえたいときに変えます。今月は「{periodLabel(sample, settings.monthStartDay)}」。変えると過去の月も新しい区切りで集計し直します（記録は変わりません）。
        </p>
      </section>

      <section className="card">
        <div className="settle-head">
          <h3 className="card-title">カテゴリ</h3>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing({})}>
            ＋ 追加
          </button>
        </div>
        <div className="seg type-seg">
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} type="button" className={`${type === t ? 'active' : ''} ${t}`} onClick={() => setType(t)}>
              {t === 'expense' ? '支出' : '収入'}
            </button>
          ))}
        </div>
        <p className="muted small">記録の入力では、よく使う順に並びます。タップで名前・アイコンの変更や非表示・削除ができます。</p>
        <ul className="setting-list">
          {list.map((c, i) => (
            <li key={c.id} className="setting-item">
              <button type="button" className="setting-row" onClick={() => setEditing({ category: c })}>
                <span className="setting-icon">{c.icon}</span>
                <span className="setting-name">{c.name}</span>
                {c.hidden && <span className="tag">非表示</span>}
                <span className="muted">›</span>
              </button>
              <span className="order-btns">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${c.name}を上へ`}>
                  ↑
                </button>
                <button type="button" className="icon-btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`${c.name}を下へ`}>
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3 className="card-title">たびメモとの連携</h3>
        <p className="small">
          {settings.ledgerExportedAt
            ? `${formatExportedAt(settings.ledgerExportedAt)} 時点のデータ（旅行${ledger?.trips ?? 0}件・支出${ledger?.entries ?? 0}件）`
            : 'まだ取り込んでいません'}
        </p>
        <p className="muted small">
          たびメモの「設定」で「💴 家計簿に送る」を押してから、ここで取り込みます。毎回まるごと入れ替わるので、何度取り込んでも二重にはなりません。旅行の支出を直すときは、たびメモで直してから送り直してください。
        </p>
        <LedgerImportButton />
      </section>

      {editing && <CategorySheet type={type} category={editing.category} onClose={() => setEditing(null)} />}
    </>
  );
}
