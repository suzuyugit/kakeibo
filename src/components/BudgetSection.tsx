import { useState } from 'react';
import type { Category } from '../db/types';
import { db, updateSettings } from '../db/db';
import { forSettings } from '../db/categoryRepo';
import { useCategories, useSettings } from '../hooks/useData';
import { AmountInput } from './AmountInput';

/** 予算の欄。タップで計算式も使えるキーボード。空にすると予算なし */
function BudgetInput({ value, onSave, label }: { value?: number; onSave: (v: number | undefined) => void; label: string }) {
  return <AmountInput value={value} onChange={(v) => v !== value && onSave(v)} label={label} allowEmpty placeholder="なし" className="budget-amount" />;
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
      <div className="chips budget-mode" role="radiogroup" aria-label="予算に固定費を含めるか">
        <button
          type="button"
          role="radio"
          aria-checked={!settings.budgetExcludesFixed}
          className={`pick ${!settings.budgetExcludesFixed ? 'active' : ''}`}
          onClick={() => void updateSettings({ budgetExcludesFixed: undefined })}
        >
          固定費込み
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!!settings.budgetExcludesFixed}
          className={`pick ${settings.budgetExcludesFixed ? 'active' : ''}`}
          onClick={() => void updateSettings({ budgetExcludesFixed: true })}
        >
          固定費抜き（自由に使える額）
        </button>
      </div>
      <div className="budget-row">
        <span>{settings.budgetExcludesFixed ? '1か月に自由に使える額' : '1か月に使う額'}</span>
        <BudgetInput key={settings.monthlyBudget ?? 'none'} value={settings.monthlyBudget} onSave={(v) => void updateSettings({ monthlyBudget: v })} label="1か月に使う額" />
      </div>
      <p className="muted small">
        {settings.budgetExcludesFixed
          ? '家賃や通信などの固定費を除いた、旅行以外の支出の予算です（固定から自動で入った記録は数えません）。'
          : '家賃や通信などの固定費も含めた、旅行以外の支出の予算です。'}
        ホームに「今月あと○円使える」が出ます。空にすると予算なしになります。
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
