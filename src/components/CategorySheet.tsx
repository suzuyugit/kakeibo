import { useState } from 'react';
import type { Category, EntryType } from '../db/types';
import { TRAVEL_CATEGORY } from '../db/db';
import { addCategory, deleteCategory, updateCategory } from '../db/categoryRepo';
import { Sheet } from './Sheet';
import { todayYmd } from '../lib/date';
import { closingMonth, nextMonthPayDate } from '../lib/card';
import { addMonths, dateFor } from '../lib/recurring';
import { addDays } from '../lib/forecast';
import { showToast } from './Toast';

type Props = {
  type: EntryType;
  category?: Category;
  onClose: () => void;
  onSaved?: (id: string) => void;
};

const ICONS_EXPENSE = ['🍙', '🍜', '☕', '🧴', '🚃', '🎮', '🍻', '👕', '💄', '🏠', '💡', '📱', '🔁', '📚', '💊', '🐶', '🎁', '📦'];
const ICONS_INCOME = ['💼', '📮', '🎉', '🎓', '🏦', '🧾', '💰'];

/** 例：「11/16〜12/15 に働いた分が 1/10 に振込」 */
function payExample(closeDay: number | undefined, payDay: number): string {
  const today = todayYmd();
  const m = closingMonth(today, closeDay);
  const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8))}`;
  const end = closeDay ? `${m}-${String(closeDay).padStart(2, '0')}` : dateFor(m, 31);
  const start = closeDay ? addDays(`${addMonths(m, -1)}-${String(closeDay).padStart(2, '0')}`, 1) : `${m}-01`;
  return `${md(start)}〜${md(end)} に働いた分が ${md(nextMonthPayDate(end, payDay, closeDay))} に振込`;
}

/** カテゴリの追加・編集 */
export function CategorySheet({ type, category, onClose, onSaved }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? (type === 'expense' ? '📦' : '💰'));
  const [hidden, setHidden] = useState(!!category?.hidden);
  // 収入：翌月の決めた日に振り込まれるか（バイト先ごとに違う給料日など）
  const [deferred, setDeferred] = useState(!!category?.payDay);
  const [payDay, setPayDay] = useState(category?.payDay ?? 25);
  const [payClose, setPayClose] = useState(category?.payCloseDay ?? 0);
  const [error, setError] = useState('');
  const travel = category?.id === TRAVEL_CATEGORY;

  const pay = type === 'income' && deferred ? { payDay, payCloseDay: payClose || undefined } : { payDay: undefined, payCloseDay: undefined };

  const save = async () => {
    if (!name.trim()) return setError('名前を入れてください');
    if (category) {
      await updateCategory(category.id, { name, icon, hidden, ...pay });
      onSaved?.(category.id);
    } else {
      onSaved?.(await addCategory(type, name, icon, pay));
    }
    onClose();
  };

  const remove = async () => {
    if (!category) return;
    if (!confirm(`「${category.name}」を削除しますか？`)) return;
    if (await deleteCategory(category.id)) {
      showToast('削除しました');
      onClose();
    } else {
      setError('記録や固定の収入・支出で使っているので削除できません。「入力で出さない」にすると選べなくなります。');
    }
  };

  return (
    <Sheet
      title={category ? 'カテゴリを編集' : `${type === 'expense' ? '支出' : '収入'}のカテゴリを追加`}
      onClose={onClose}
      action={
        <button type="button" className="btn btn-primary btn-small" onClick={save}>
          保存
        </button>
      }
    >
      <div className="form">
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span className="label">名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'income' ? '例：○○居酒屋' : '例：本'} autoFocus={!category} />
        </label>
        <div className="field">
          <span className="label">アイコン</span>
          <div className="icon-pick">
            {(type === 'expense' ? ICONS_EXPENSE : ICONS_INCOME).map((i) => (
              <button key={i} type="button" className={`pick ${icon === i ? 'active' : ''}`} onClick={() => setIcon(i)}>
                {i}
              </button>
            ))}
            <input className="icon-input" value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="好きな絵文字" />
          </div>
        </div>
        {type === 'income' && (
          <div className="field">
            <span className="label">振り込まれる日</span>
            <div className="chips" role="radiogroup">
              <button type="button" role="radio" aria-checked={!deferred} className={`pick ${!deferred ? 'active' : ''}`} onClick={() => setDeferred(false)}>
                記録した日に入る
              </button>
              <button type="button" role="radio" aria-checked={deferred} className={`pick ${deferred ? 'active' : ''}`} onClick={() => setDeferred(true)}>
                翌月に振込
              </button>
            </div>
            {deferred && (
              <>
                <div className="pay-row">
                  <select value={payClose} onChange={(e) => setPayClose(Number(e.target.value))} aria-label="締め日">
                    <option value={0}>月末締め</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}日締め
                      </option>
                    ))}
                  </select>
                  <span>翌月</span>
                  <select value={payDay} onChange={(e) => setPayDay(Number(e.target.value))} aria-label="振込の日">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}日
                      </option>
                    ))}
                  </select>
                  <span>払い</span>
                </div>
                <span className="muted small">
                  例：{payExample(payClose || undefined, payDay)}。このカテゴリで記録すると、振込日が自動で入ります（働いた日はカレンダーに、お金は振込日に貯金へ）。
                </span>
              </>
            )}
          </div>
        )}
        {category && !travel && (
          <label className="switch-row">
            <input type="checkbox" role="switch" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            <span className="switch" aria-hidden="true" />
            <span className="label">入力で出さない（非表示）</span>
          </label>
        )}
        {travel && <p className="muted small">「旅行」は、たびメモから取り込んだ支出が入るカテゴリです。削除や手入力はできません。</p>}
        {category && !travel && (
          <button type="button" className="btn btn-danger-outline btn-block" onClick={remove}>
            このカテゴリを削除
          </button>
        )}
      </div>
    </Sheet>
  );
}
