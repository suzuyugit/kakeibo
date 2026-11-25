import { useState } from 'react';
import { updateSettings } from '../db/db';
import { formatMd, todayYmd } from '../lib/date';
import { parseYen, yen } from '../lib/money';
import { showToast } from './Toast';

type Props = {
  initialAmount?: number;
  onSaved?: () => void;
  autoFocus?: boolean;
};

/** 今の貯金を入れる欄。入れた日の記録までは口座に反映済みとして扱う */
export function SavingsForm({ initialAmount, onSaved, autoFocus }: Props) {
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : '');
  const [asOf, setAsOf] = useState(todayYmd());
  const [error, setError] = useState('');
  const today = todayYmd();

  const save = async () => {
    const n = parseYen(amount);
    if (n === undefined || Number.isNaN(n)) return setError('金額を数字で入れてください');
    await updateSettings({ savingsAmount: n, savingsAsOf: asOf, savingsSetAt: new Date().toISOString() });
    showToast(`今の貯金を ${yen(n)} にしました`);
    onSaved?.();
  };

  return (
    <div className="form savings-form">
      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}
      <div className="savings-input-row">
        <label className="amount-field">
          <span className="yen">¥</span>
          <input
            className="amount-input"
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            placeholder="0"
            autoFocus={autoFocus}
            aria-label="今の貯金"
          />
        </label>
      </div>
      <label className="field field-inline">
        <span className="label">いつの額？</span>
        <input type="date" value={asOf} max={today} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
      </label>
      <p className="muted small">
        口座や財布にあるお金の合計を入れてください。{asOf === today ? 'これから記録する収入と支出で増減します。' : `${formatMd(asOf)}までの記録はこの額にもう入っているものとして、その次の日からの収入と支出で増減します。`}
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={save}>
        保存
      </button>
    </div>
  );
}
