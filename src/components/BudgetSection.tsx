import { useState } from 'react';
import type { Category } from '../db/types';
import { db, updateSettings } from '../db/db';
import { forSettings } from '../db/categoryRepo';
import { useCategories, useSettings } from '../hooks/useData';
import { parseYen } from '../lib/money';

/** 金額の欄。フォーカスが外れたら保存。空にすると予算なし */
function BudgetInput({ value, onSave, label }: { value?: number; onSave: (v: number | undefined) => void; label: string }) {
  const [text, setText] = useState(value !== undefined ? value.toLocaleString('ja-JP') : '');
  const commit = () => {
    const n = parseYen(text);
    if (n !== undefined && Number.isNaN(n)) {
      setText(value !== undefined ? value.toLocaleString('ja-JP') : '');
      return;
    }
    if (n !== value) onSave(n);
    setText(n !== undefined ? n.toLocaleString('ja-JP') : '');
  };
  return (
    <label className="budget-input">
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => setText(e.target.value.replace(/,/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="なし"
        aria-label={label}
      />
      <span>円</span>
    </label>
  );
}

export function BudgetSection() {
  const settings = useSettings();
  const categories = useCategories();
  const [open, setOpen] = useState(categories.some((c) => c.monthlyBudget !== undefined));
  const list = forSettings(categories, 'expense').filter((c) => !c.hidden);
  const setCat = (c: Category, v: number | undefined) => void db.categories.update(c.id, { monthlyBudget: v });

  return (
    <section className="card">
      <h3 className="card-title">月の予算</h3>
      <div className="budget-row">
        <span>1か月に使う額</span>
        <BudgetInput key={settings.monthlyBudget ?? 'none'} value={settings.monthlyBudget} onSave={(v) => void updateSettings({ monthlyBudget: v })} label="1か月に使う額" />
      </div>
      <p className="muted small">
        家賃や通信などの固定費も含めた、旅行以外の支出の予算です。ホームに「今月あと○円使える」が出ます。空にすると予算なしになります。
      </p>
      <button type="button" className="btn-text" onClick={() => setOpen((v) => !v)}>
        {open ? '▲ カテゴリごとの予算を閉じる' : '▼ カテゴリごとにも決める（なくてもよい）'}
      </button>
      {open && (
        <ul className="budget-cats">
          {list.map((c) => (
            <li key={c.id} className="budget-row">
              <span>
                {c.icon} {c.name}
              </span>
              <BudgetInput key={c.monthlyBudget ?? 'none'} value={c.monthlyBudget} onSave={(v) => setCat(c, v)} label={`${c.name}の予算`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
