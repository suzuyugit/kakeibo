import type { Entry } from '../db/types';
import { RowList } from '../components/RowList';
import { useRows, useSettings } from '../hooks/useData';
import { totalsIn } from '../lib/aggregate';
import { todayYmd } from '../lib/date';
import { yen, signedYen } from '../lib/money';
import { periodLabel, periodOf } from '../lib/period';
import { navigate } from '../router';

type Props = { onEdit: (e: Entry) => void };

export function HomeScreen({ onEdit }: Props) {
  const settings = useSettings();
  const rows = useRows();
  if (!rows) return null;

  const today = todayYmd();
  const period = periodOf(today, settings.monthStartDay);
  const todayTotal = totalsIn(rows, { start: today, end: today });
  const month = totalsIn(rows, period);
  const budget = settings.monthlyBudget;
  const left = budget !== undefined ? budget - month.expense : undefined;
  const recent = rows.filter((r) => r.date <= today).slice(0, 5);

  return (
    <>
      <section className="card">
        <div className="card-label">今日使った額</div>
        <div className="hero">
          <span className="hero-num">{yen(todayTotal.expense)}</span>
        </div>
        {todayTotal.income > 0 && <div className="muted small">今日の収入 {signedYen(todayTotal.income)}</div>}
      </section>

      <section className="card">
        <div className="card-label">{periodLabel(period, settings.monthStartDay)}</div>
        {left !== undefined && (
          <>
            <div className="hero">
              <span className="muted small">あと </span>
              <span className={`hero-num ${left < 0 ? 'over' : ''}`}>{yen(left)}</span>
              <span className="muted small"> 使える（予算 {yen(budget!)}）</span>
            </div>
            <div className="bar bar-lg">
              <div className={`bar-fill ${left < 0 ? 'over' : ''}`} style={{ width: `${Math.min(100, (month.expense / Math.max(1, budget!)) * 100)}%` }} />
            </div>
          </>
        )}
        <div className="month-stats">
          <div>
            <span className="muted small">収入</span>
            <b className="income">{yen(month.income)}</b>
          </div>
          <div>
            <span className="muted small">支出</span>
            <b>{yen(month.expense)}</b>
          </div>
          <div>
            <span className="muted small">差し引き</span>
            <b className={month.balance < 0 ? 'over' : ''}>{signedYen(month.balance)}</b>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">最近の記録</h3>
        {recent.length === 0 ? (
          <p className="empty">まだ記録がありません。右下の ＋ から記録できます。</p>
        ) : (
          <RowList rows={recent} onEdit={onEdit} showDate />
        )}
        <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate({ name: 'calendar' })}>
          📅 カレンダーで見る
        </button>
      </section>
    </>
  );
}
