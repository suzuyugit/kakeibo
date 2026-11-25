import { useState } from 'react';
import type { Entry, EntryType, PaymentMethod } from '../db/types';
import { deleteEntry, lastPaymentMethod, restoreEntry, saveEntry, validateEntry } from '../db/entryRepo';
import { forPicker } from '../db/categoryRepo';
import { useCategories, useSettings } from '../hooks/useData';
import { db } from '../db/db';
import { nextMonthPayDate, withdrawalDate } from '../lib/card';
import { formatMd, parseYmd, todayYmd, toYmd } from '../lib/date';
import { yen } from '../lib/money';
import { evaluate } from '../lib/calc';
import { AmountPad } from './AmountPad';
import { PAYMENT_LABEL, PAYMENT_METHODS } from '../lib/labels';
import { CategorySheet } from './CategorySheet';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

type Props = {
  entry?: Entry;
  /** 新しく記録するときの日付（カレンダーで選んでいる日） */
  initialDate?: string;
  onClose: () => void;
};

function yesterdayYmd(): string {
  const d = parseYmd(todayYmd());
  d.setDate(d.getDate() - 1);
  return toYmd(d);
}

/** 収入・支出のクイック入力（編集にも使う）。最短で「金額 → カテゴリ → 保存」 */
export function EntrySheet({ entry, initialDate, onClose }: Props) {
  const categories = useCategories();
  const settings = useSettings();
  const [type, setType] = useState<EntryType>(entry?.type ?? 'expense');
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(entry?.paymentMethod ?? lastPaymentMethod());
  const [date, setDate] = useState(entry?.date ?? initialDate ?? todayYmd());
  const [memo, setMemo] = useState(entry?.memo ?? '');
  // 収入：その日に入るか、翌月の決めた日に振り込まれるか（給料など）。前回の選び方を覚えておく
  // カテゴリに振込日が決めてあれば、そのカテゴリを選んだときに入れる
  const entryCat = entry ? categories.find((c) => c.id === entry.categoryId) : undefined;
  const [deferred, setDeferred] = useState(!!entry?.payDate);
  const [payDay, setPayDay] = useState(entry?.payDate ? Number(entry.payDate.slice(8)) : 25);
  const [payClose, setPayClose] = useState<number | undefined>(entryCat?.payCloseDay);
  const payDate = nextMonthPayDate(date, payDay, payClose);
  const applyPayRule = (id: string, cats = categories) => {
    const c = cats.find((x) => x.id === id);
    if (!c || c.type !== 'income') return;
    if (c.payDay) {
      setDeferred(true);
      setPayDay(c.payDay);
      setPayClose(c.payCloseDay);
    } else if (categories.find((x) => x.id === categoryId)?.payDay) {
      // 振込日のあるカテゴリから、ないカテゴリに変えたときだけ戻す（自分で選んだ「翌月に振込」は残す）
      setDeferred(false);
      setPayClose(undefined);
    }
  };
  const [error, setError] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const today = todayYmd();
  const yesterday = yesterdayYmd();
  const picks = forPicker(categories, type);
  // 編集中の記録のカテゴリが非表示でも、選んだまま見えるように
  const current = categories.find((c) => c.id === categoryId);
  if (current && current.type === type && !picks.includes(current)) picks.unshift(current);
  const amountNum = evaluate(amount);

  const switchType = (t: EntryType) => {
    if (t === type) return;
    setType(t);
    setCategoryId('');
    setError('');
  };

  const save = async () => {
    const input = {
      type,
      date,
      amount: amountNum ?? 0,
      categoryId,
      paymentMethod: type === 'expense' ? paymentMethod : undefined,
      payDate: type === 'income' && deferred ? payDate : undefined,
      memo,
    };
    const msg = Number.isNaN(amountNum) ? '計算式が正しくありません' : amountNum !== undefined && amountNum <= 0 ? '金額が0円以下です' : validateEntry(input);
    if (msg) return setError(msg);
    await saveEntry(input, entry?.id);
    showToast(entry ? '保存しました' : `${type === 'expense' ? '支出' : '収入'} ${yen(input.amount)} を記録しました`);
    onClose();
  };

  const remove = async () => {
    if (!entry) return;
    const deleted = await deleteEntry(entry.id);
    onClose();
    if (deleted) showToast('削除しました', { label: '元に戻す', onClick: () => void restoreEntry(deleted) });
  };

  return (
    <Sheet
      tall
      title={entry ? '記録を編集' : '記録する'}
      onClose={onClose}
      action={
        <button type="button" className="btn btn-primary btn-small" onClick={save}>
          保存
        </button>
      }
    >
      <div className="form expense-form">
        <div className="seg type-seg" role="radiogroup" aria-label="支出か収入か">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={`${type === t ? 'active' : ''} ${t}`}
              // 金額欄からフォーカスを奪わない（キーボードを閉じない）
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => switchType(t)}
            >
              {t === 'expense' ? '支出' : '収入'}
            </button>
          ))}
        </div>

        <div className="date-row">
          <label className="date-field">
            <span aria-hidden="true">📅</span>
            <input
              type="date"
              className="date-input"
              value={date}
              max="2100-12-31"
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="日付を選ぶ"
            />
          </label>
          <button
            type="button"
            className={`pick ${date === today ? 'active' : ''}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setDate(today)}
          >
            今日
          </button>
          <button
            type="button"
            className={`pick ${date === yesterday ? 'active' : ''}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setDate(yesterday)}
          >
            昨日
          </button>
        </div>

        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}

        <AmountPad
          value={amount}
          type={type}
          onChange={(v) => {
            setAmount(v);
            setError('');
          }}
        />

        <div className="cat-grid" role="radiogroup" aria-label="カテゴリ">
          {picks.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === categoryId}
              className={`cat-btn ${c.id === categoryId ? 'active' : ''}`}
              onClick={() => {
                setCategoryId(c.id);
                applyPayRule(c.id);
                setError('');
              }}
            >
              <span className="cat-icon">{c.icon}</span>
              <span className="cat-name">{c.name}</span>
              {c.type === 'income' && c.payDay && <span className="cat-sub">翌月{c.payDay}日</span>}
            </button>
          ))}
          <button type="button" className="cat-btn add-tile" onClick={() => setAddingCat(true)}>
            <span className="cat-icon">＋</span>
            <span className="cat-name">追加</span>
          </button>
        </div>

        {type === 'income' && (
          <div className="field">
            <span className="label">入る日</span>
            <div className="chips" role="radiogroup">
              <button type="button" role="radio" aria-checked={!deferred} className={`pick ${!deferred ? 'active' : ''}`} onClick={() => setDeferred(false)}>
                この日に入る
              </button>
              <button type="button" role="radio" aria-checked={deferred} className={`pick ${deferred ? 'active' : ''}`} onClick={() => setDeferred(true)}>
                翌月に振込（給料など）
              </button>
            </div>
            {deferred && (
              <div className="pay-row">
                <select value={payClose ?? 0} onChange={(e) => setPayClose(Number(e.target.value) || undefined)} aria-label="締め日">
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
                <span className="muted small">→ 💴 {formatMd(payDate)} に振込</span>
              </div>
            )}
            {deferred && <span className="muted small">カレンダーには働いた日（{formatMd(date)}）に出て、貯金は振込の日に増えます。</span>}
            {deferred && !categories.find((c) => c.id === categoryId)?.payDay && (
              <span className="muted small">いつも同じ振込日なら、カテゴリの編集で振込日を決めておくと毎回自動で入ります。</span>
            )}
          </div>
        )}

        {type === 'expense' && (
          <div className="field">
            <span className="label">支払い方法</span>
            <div className="chips" role="radiogroup">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm}
                  type="button"
                  role="radio"
                  aria-checked={pm === paymentMethod}
                  className={`pick ${pm === paymentMethod ? 'active' : ''}`}
                  onClick={() => setPaymentMethod(pm)}
                >
                  {PAYMENT_LABEL[pm]}
                </button>
              ))}
            </div>
            {paymentMethod === 'card' && settings.cardPayDay && (
              <span className="muted small">💳 {formatMd(withdrawalDate(date, settings.cardPayDay, settings.cardCloseDay))} に引き落とし</span>
            )}
          </div>
        )}

        <label className="field">
          <span className="label">メモ（なくてもよい）</span>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={type === 'expense' ? '例：コンビニ' : '例：11月分'} />
        </label>

        {entry?.recurringId && <p className="muted small">🔁 固定の収入・支出から自動で入った記録です。金額を直しても、ほかの月には影響しません。</p>}

        {entry && (
          <button type="button" className="btn btn-danger-outline btn-block" onClick={remove}>
            この記録を削除
          </button>
        )}
      </div>
      {addingCat && (
        <CategorySheet
          type={type}
          onClose={() => setAddingCat(false)}
          onSaved={(id) => {
            setCategoryId(id);
            // 足したばかりのカテゴリは一覧にまだないので、DB から読んで振込日を入れる
            void db.categories.get(id).then((c) => c && applyPayRule(id, [c]));
            setError('');
          }}
        />
      )}
    </Sheet>
  );
}
