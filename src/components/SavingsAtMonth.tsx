import { useState } from 'react';
import { SavingsChart } from './SavingsChart';
import { breakdownAt, type ForecastInput } from '../lib/forecast';
import { monthEnds } from '../lib/chartData';
import { signedYen, yen } from '../lib/money';
import { addMonths, monthOf } from '../lib/recurring';

type Props = {
  input: ForecastInput;
  tripMonths: Map<string, string[]>;
  past: { date: string; value: number }[];
  marks: { date: string; name: string }[];
};

/** 貯金の見込み：グラフと、スライドして選んだ月の「このままいけば ○円」と内訳 */
export function SavingsAtMonth({ input, tripMonths, past, marks }: Props) {
  const months = monthEnds(monthOf(input.today), addMonths(monthOf(input.today), 35));
  const [idx, setIdx] = useState(1); // 0 = 今月
  const month = months[idx].month;
  const end = months[idx].end;
  const trip = tripMonths.get(month);
  const b = breakdownAt(input, end);
  const label = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;

  return (
    <section className="card">
      <h3 className="card-title">貯金の見込み</h3>
      <SavingsChart past={past} input={input} marks={marks} focus={end} />
      <p className="muted small slider-help">下のつまみを左右にスライドすると、その月の終わりの貯金の見込みが出ます。</p>
      <div className="slider-head">
        <button type="button" className="icon-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="前の月">
          ‹
        </button>
        <b className="slider-month">
          {label(month)}末{idx === 0 ? '（今月）' : ''}
          {trip && <span className="small"> ✈️ {trip.join('・')}</span>}
        </b>
        <button type="button" className="icon-btn" disabled={idx === months.length - 1} onClick={() => setIdx(idx + 1)} aria-label="次の月">
          ›
        </button>
      </div>
      <input
        type="range"
        className="month-slider"
        min={0}
        max={months.length - 1}
        step={1}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        aria-label="見たい月"
        aria-valuetext={`${label(month)}末 ${yen(b.total)}`}
      />
      <div className="slider-scale muted small">
        <span>今月</span>
        <span>1年後</span>
        <span>2年後</span>
        <span>3年後</span>
      </div>
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
        {b.payIn > 0 && (
          <li>
            <span>給料などの振込（もう記録した分）</span>
            <b className="plus">+{yen(b.payIn)}</b>
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
