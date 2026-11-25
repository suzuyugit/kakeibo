import { useState } from 'react';
import { DonutChart } from '../components/DonutChart';
import { useCategories, useRows, useSettings } from '../hooks/useData';
import { totalsIn } from '../lib/aggregate';
import { slicesFor } from '../lib/chartData';
import { todayYmd } from '../lib/date';
import { signedYen, yen } from '../lib/money';
import { periodByKey, periodLabel, periodOf, shiftKey } from '../lib/period';

/** グラフ：その月の支出と収入の内訳（円グラフ） */
export function ChartsScreen() {
  const settings = useSettings();
  const rows = useRows();
  const categories = useCategories();
  const startDay = settings.monthStartDay;
  const [key, setKey] = useState(() => periodOf(todayYmd(), startDay).key);
  if (!rows) return null;
  const period = periodByKey(key, startDay);
  const t = totalsIn(rows, period);

  return (
    <>
      <section className="card">
        <div className="month-nav">
          <button type="button" className="icon-btn" onClick={() => setKey(shiftKey(key, -1))} aria-label="前の月">
            ‹
          </button>
          <div className="month-title">
            <b>{periodLabel(period, startDay)}</b>
          </div>
          <button type="button" className="icon-btn" onClick={() => setKey(shiftKey(key, 1))} aria-label="次の月">
            ›
          </button>
        </div>
        <div className="month-stats cal-month-stats">
          <div>
            <span className="muted small">収入</span>
            <b className="plus">+{yen(t.income)}</b>
          </div>
          <div>
            <span className="muted small">支出</span>
            <b className="minus">−{yen(t.expense)}</b>
          </div>
          <div>
            <span className="muted small">合計</span>
            <b className={t.balance > 0 ? 'plus' : t.balance < 0 ? 'minus' : ''}>{signedYen(t.balance)}</b>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">支出の内訳</h3>
        <DonutChart key={`ex-${key}`} slices={slicesFor(rows, period, 'expense', categories)} label="支出" empty="この月の支出はまだありません" />
      </section>

      <section className="card">
        <h3 className="card-title">収入の内訳</h3>
        <DonutChart key={`in-${key}`} slices={slicesFor(rows, period, 'income', categories)} label="収入" empty="この月の収入はまだありません" />
      </section>
    </>
  );
}
