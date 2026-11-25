import { useState } from 'react';
import type { EntryType, PaymentMethod, Recurring } from '../db/types';
import { forPicker } from '../db/categoryRepo';
import { saveRecurring, stopRecurring } from '../db/recurringRepo';
import { useCategories } from '../hooks/useData';
import { todayYmd } from '../lib/date';
import { PAYMENT_LABEL, PAYMENT_METHODS } from '../lib/labels';
import { parseYen, yen } from '../lib/money';
import { addMonths, dateFor, nextMonthFrom, upcomingMonth } from '../lib/recurring';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

type Props = { recurring?: Recurring; onClose: () => void };

/** 固定の収入・支出の追加・編集（「毎月25日に5万円」） */
export function RecurringSheet({ recurring, onClose }: Props) {
  const categories = useCategories();
  const [type, setType] = useState<EntryType>(recurring?.type ?? 'expense');
  const [name, setName] = useState(recurring?.name ?? '');
  const [amount, setAmount] = useState(recurring ? String(recurring.amount) : '');
  const [day, setDay] = useState(recurring?.dayOfMonth ?? 25);
  const [categoryId, setCategoryId] = useState(recurring?.categoryId ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(recurring?.paymentMethod ?? 'bank');
  const [payFor, setPayFor] = useState<'same' | 'prev'>(recurring?.payFor ?? 'same');
  const [error, setError] = useState('');
  const today = todayYmd();
  const picks = forPicker(categories, type);
  const current = categories.find((c) => c.id === categoryId);
  if (current && current.type === type && !picks.includes(current)) picks.unshift(current);
  const amountNum = parseYen(amount);
  const amountChanged = recurring && amountNum !== undefined && !Number.isNaN(amountNum) && amountNum !== recurring.amount;
  // 今ある固定は今日の分がもう入っているので、次の回は明日以降
  const nextMonth = recurring ? upcomingMonth(day, today) : nextMonthFrom(day, today);
  const nextDate = dateFor(nextMonth, day);

  const save = async () => {
    if (!name.trim()) return setError('名前を入れてください（例：バイト代、家賃）');
    if (amountNum === undefined || Number.isNaN(amountNum) || amountNum <= 0) return setError('金額を入れてください');
    if (!categoryId) return setError('カテゴリを選んでください');
    await saveRecurring(
      {
        type,
        name: name.trim(),
        amount: amountNum,
        categoryId,
        dayOfMonth: day,
        // 切り替えたときに前の値が残らないよう、使わないほうは undefined で上書きする
        paymentMethod: type === 'expense' ? paymentMethod : undefined,
        payFor: type === 'income' && payFor === 'prev' ? 'prev' : undefined,
      },
      recurring,
      today,
    );
    showToast(recurring ? '保存しました' : `毎月${day}日の${type === 'income' ? '収入' : '支出'}を追加しました`);
    onClose();
  };

  const stop = async () => {
    if (!recurring) return;
    if (!confirm(`「${recurring.name}」を止めますか？\nもう入った記録はそのまま残ります。`)) return;
    await stopRecurring(recurring, today);
    showToast('止めました');
    onClose();
  };

  return (
    <Sheet
      tall
      title={recurring ? '固定の収入・支出を編集' : '固定の収入・支出を追加'}
      onClose={onClose}
      action={
        <button type="button" className="btn btn-primary btn-small" onClick={save}>
          保存
        </button>
      }
    >
      <div className="form">
        <div className="seg type-seg">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`${type === t ? 'active' : ''} ${t}`}
              onClick={() => {
                if (t !== type) setCategoryId('');
                setType(t);
              }}
            >
              {t === 'expense' ? '出る（支出）' : '入る（収入）'}
            </button>
          ))}
        </div>
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span className="label">名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'income' ? '例：バイト代' : '例：スマホ代'} />
        </label>
        <div className="recurring-line">
          <span>毎月</span>
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="毎月の日">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}日
              </option>
            ))}
          </select>
          <span>に</span>
          <label className={`amount-field small-amount ${type}`}>
            <span className="yen">¥</span>
            <input className="amount-input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" aria-label="金額" />
          </label>
        </div>
        {type === 'income' && (
          <div className="field">
            <span className="label">いつの分？</span>
            <div className="chips" role="radiogroup">
              <button type="button" role="radio" aria-checked={payFor === 'same'} className={`pick ${payFor === 'same' ? 'active' : ''}`} onClick={() => setPayFor('same')}>
                その月の分
              </button>
              <button type="button" role="radio" aria-checked={payFor === 'prev'} className={`pick ${payFor === 'prev' ? 'active' : ''}`} onClick={() => setPayFor('prev')}>
                前の月の分（翌月払い）
              </button>
            </div>
            {payFor === 'prev' && (
              <p className="muted small">
                例：{Number(addMonths(nextMonth, -1).slice(5))}月に働いた分が {Number(nextMonth.slice(5))}/{Number(nextDate.slice(8))} に入ります。記録には「{name.trim() || 'バイト代'}（{Number(addMonths(nextMonth, -1).slice(5))}月分）」と書きます。
              </p>
            )}
          </div>
        )}
        {day >= 29 && <p className="muted small">{day}日がない月は、その月の最終日に入ります。</p>}
        {amountChanged ? (
          <p className="notice small">金額は次の回（{nextDate.slice(5).replace('-', '/')}）から {yen(amountNum!)} になります。もう入った記録は変わりません。</p>
        ) : (
          !recurring && <p className="muted small">最初は {nextDate.slice(5).replace('-', '/')} に入ります。</p>
        )}

        <div className="field">
          <span className="label">カテゴリ</span>
          <div className="cat-row cat-wrap" role="radiogroup">
            {picks.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === categoryId}
                className={`cat-btn ${c.id === categoryId ? 'active' : ''}`}
                onClick={() => setCategoryId(c.id)}
              >
                <span className="cat-icon">{c.icon}</span>
                <span className="cat-name">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {type === 'expense' && (
          <div className="field">
            <span className="label">支払い方法</span>
            <div className="chips">
              {PAYMENT_METHODS.map((pm) => (
                <button key={pm} type="button" className={`pick ${pm === paymentMethod ? 'active' : ''}`} onClick={() => setPaymentMethod(pm)}>
                  {PAYMENT_LABEL[pm]}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="muted small">自動で入った記録は、あとから金額を直せます（毎月変わるバイト代など）。</p>

        {recurring && (
          <button type="button" className="btn btn-danger-outline btn-block" onClick={stop}>
            止める（次の回から入らない）
          </button>
        )}
      </div>
    </Sheet>
  );
}
