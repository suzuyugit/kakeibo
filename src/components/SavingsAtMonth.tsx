import { useState } from 'react';
import { breakdownAt, type ForecastInput } from '../lib/forecast';
import { monthEnds } from '../lib/chartData';
import { signedYen, yen } from '../lib/money';
import { addMonths, monthOf } from '../lib/recurring';

/** 好きな月を選ぶと「このままいけば ○月末には ○円」と内訳を出す */
export function SavingsAtMonth({ input, tripMonths }: { input: ForecastInput; tripMonths: Map<string, string[]> }) {
  const months = monthEnds(monthOf(input.today), addMonths(monthOf(input.today), 35));
  const [month, setMonth] = useState(() => addMonths(monthOf(input.today), 1));
  const end = months.find((m) => m.month === month)!.end;
  const b = breakdownAt(input, end);
  const label = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;

  return (
    <section className="card">
      <h3 className="card-title">好きな月の貯金を見る</h3>
      <label className="field">
        <span className="label">見たい月</span>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              {label(m.month)}末{m.month === monthOf(input.today) ? '（今月）' : ''}
              {tripMonths.get(m.month) ? `　✈️ ${tripMonths.get(m.month)!.join('・')}` : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="at-month">
        <span className="muted small">このままいけば {label(month)}末には</span>
        <span className={`hero-num ${b.total < 0 ? 'over' : ''}`}>{yen(b.total)}</span>
        <span className="small">
          今より <b className={b.total - b.start >= 0 ? 'plus' : 'minus'}>{signedYen(b.total - b.start)}</b>
        </span>
      </div>
      <ul className="at-month-list small">
        <li>
          <span>今の貯金</span>
          <b>{yen(b.start)}</b>
        </li>
        {b.fixedIn > 0 && (
          <li>
            <span>固定の収入</span>
            <b className="plus">+{yen(b.fixedIn)}</b>
          </li>
        )}
        {b.fixedOut > 0 && (
          <li>
            <span>固定費</span>
            <b className="minus">−{yen(b.fixedOut)}</b>
          </li>
        )}
        {b.daily > 0 && (
          <li>
            <span>ふだんの支出（見込み）</span>
            <b className="minus">−{yen(b.daily)}</b>
          </li>
        )}
        {b.card > 0 && (
          <li>
            <span>カードの引き落とし（もう使った分）</span>
            <b className="minus">−{yen(b.card)}</b>
          </li>
        )}
        {b.trips.map((t) => (
          <li key={t.name}>
            <span>✈️ {t.name}</span>
            <b className="minus">−{yen(t.amount)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
