import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { todayYmd } from '../lib/date';
import { yen } from '../lib/money';
import { isActive } from '../lib/recurring';
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
  // カテゴリごとの毎月の固定費（今も続いている固定の支出の合計）。予算にそのまま入れられるように
  const recurrings = useLiveQuery(() => db.recurrings.toArray()) ?? [];
  const today = todayYmd();
  const fixedByCat = new Map<string, number>();
  for (const r of recurrings) {
    if (r.type !== 'expense' || !isActive(r, today)) continue;
    fixedByCat.set(r.categoryId, (fixedByCat.get(r.categoryId) ?? 0) + r.amount);
  }
  const fillable = list.filter((c) => (fixedByCat.get(c.id) ?? 0) > 0 && c.monthlyBudget !== fixedByCat.get(c.id));
  const fillAll = () => {
    for (const c of fillable) setCat(c, fixedByCat.get(c.id));
  };

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
        <>
          {fillable.length > 1 && (
            <button type="button" className="btn btn-ghost btn-block btn-small" onClick={fillAll}>
              固定費のあるカテゴリ（{fillable.length}つ）に、固定費の額をまとめて入れる
            </button>
          )}
          <ul className="budget-cats">
            {list.map((c) => {
              const fixed = fixedByCat.get(c.id) ?? 0;
              return (
                <li key={c.id} className="budget-cat">
                  <div className="budget-row">
                    <span>
                      {c.icon} {c.name}
                    </span>
                    <BudgetInput key={c.monthlyBudget ?? 'none'} value={c.monthlyBudget} onSave={(v) => setCat(c, v)} label={`${c.name}の予算`} />
                  </div>
                  {fixed > 0 && (
                    <div className="budget-fixed small">
                      <span className="muted">固定費 毎月 {yen(fixed)}</span>
                      {c.monthlyBudget !== fixed && (
                        <button type="button" className="btn-text small" onClick={() => setCat(c, fixed)}>
                          この額を入れる
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
