import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Recurring } from '../db/types';
import { db } from '../db/db';
import { useCategories } from '../hooks/useData';
import { todayYmd } from '../lib/date';
import { yen } from '../lib/money';
import { dateFor, isActive } from '../lib/recurring';
import { RecurringSheet } from './RecurringSheet';

/** 例：「・12/10から」「・〜2027/3/10まで」。ずっと続いて、もう始まっているものは何も出さない */
function periodText(r: Recurring, today: string): string {
  const md = (ymd: string) => `${ymd.slice(0, 4) !== today.slice(0, 4) ? `${ymd.slice(0, 4)}/` : ''}${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}`;
  const start = dateFor(r.startMonth, r.dayOfMonth);
  const parts: string[] = [];
  if (start > today) parts.push(`${md(start)}から`);
  if (r.endMonth) parts.push(`〜${md(dateFor(r.endMonth, r.dayOfMonth))}まで`);
  return parts.length ? `・${parts.join('')}` : '';
}

/** 設定の「固定の収入・支出」 */
export function RecurringSection() {
  const all = useLiveQuery(() => db.recurrings.toArray()) ?? [];
  const categories = useCategories();
  const [editing, setEditing] = useState<{ recurring?: Recurring } | null>(null);
  const today = todayYmd();
  const list = all.filter((r) => isActive(r, today)).sort((a, b) => (a.type !== b.type ? (a.type === 'income' ? -1 : 1) : a.dayOfMonth - b.dayOfMonth));
  const sum = (t: Recurring['type']) => list.filter((r) => r.type === t).reduce((a, r) => a + r.amount, 0);

  return (
    <section className="card">
      <div className="settle-head">
        <h3 className="card-title">固定の収入・支出</h3>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing({})}>
          ＋ 追加
        </button>
      </div>
      {list.length === 0 ? (
        <p className="muted small">「毎月25日にバイト代 5万円」「毎月27日にスマホ代 8,000円」のように決めておくと、その日に自動で記録されます。</p>
      ) : (
        <>
          <ul className="setting-list">
            {list.map((r) => {
              const c = categories.find((x) => x.id === r.categoryId);
              return (
                <li key={r.id}>
                  <button type="button" className="setting-row" onClick={() => setEditing({ recurring: r })}>
                    <span className="setting-icon">{c?.icon ?? '🔁'}</span>
                    <span className="setting-name">
                      {r.name}
                      <span className="muted small recurring-day">
                        毎月{r.dayOfMonth}日{r.type === 'income' && r.payFor === 'prev' ? '（前の月の分）' : ''}
                        {periodText(r, today)}
                      </span>
                    </span>
                    <b className={r.type === 'income' ? 'income' : ''}>
                      {r.type === 'income' ? '+' : '−'}
                      {yen(r.amount)}
                    </b>
                    <span className="muted">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="small recurring-sum">
            毎月 <span className="income">+{yen(sum('income'))}</span> ／ −{yen(sum('expense'))}
          </p>
        </>
      )}
      {editing && <RecurringSheet recurring={editing.recurring} onClose={() => setEditing(null)} />}
    </section>
  );
}
