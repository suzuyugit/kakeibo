import { useState } from 'react';
import type { Settings } from '../db/types';
import type { Row } from '../lib/aggregate';
import { formatMd, todayYmd } from '../lib/date';
import { signedYen, yen } from '../lib/money';
import { savingsNow } from '../lib/savings';
import { pendingCard } from '../lib/card';
import { SavingsForm } from './SavingsForm';
import { Sheet } from './Sheet';

/** ホームの貯金カード。まだ入れていなければ、入れる欄を出す */
export function SavingsCard({ settings, rows }: { settings: Settings; rows: Row[] }) {
  const [editing, setEditing] = useState(false);
  const today = todayYmd();
  const s = savingsNow(settings, rows, today);
  const card = pendingCard(rows, settings.cardPayDay, today);

  if (!s) {
    return (
      <section className="card savings-first">
        <h3 className="card-title">💰 まず、今の貯金を入れてください</h3>
        <p className="muted small">ここから毎日の収入と支出で増減させて、旅行の日までにいくら貯まるかを出します。</p>
        <SavingsForm />
      </section>
    );
  }

  return (
    <section className="card">
      <div className="settle-head">
        <div className="card-label">💰 今の貯金</div>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
          入力し直す
        </button>
      </div>
      <div className="hero">
        <span className={`hero-num ${s.total < 0 ? 'over' : ''}`}>{yen(s.total)}</span>
      </div>
      <div className="muted small">
        {formatMd(s.asOf)}に入れた {yen(s.base)}
        {s.change !== 0 && <> ／ その後の収支 {signedYen(s.change)}</>}
      </div>
      {card.length > 0 && (
        <div className="card-pending">
          {card.map((c) => (
            <div key={c.date} className="forecast-row">
              <span className="muted small">💳 {formatMd(c.date)} にカードの引き落とし</span>
              <b>−{yen(c.amount)}</b>
            </div>
          ))}
          <div className="forecast-row">
            <span className="muted small">引き落としのあと</span>
            <b>{yen(s.total - card.reduce((a, c) => a + c.amount, 0))}</b>
          </div>
        </div>
      )}
      {editing && (
        <Sheet title="今の貯金を入力し直す" onClose={() => setEditing(false)}>
          <SavingsForm initialAmount={s.total} autoFocus onSaved={() => setEditing(false)} />
        </Sheet>
      )}
    </section>
  );
}
