import { useLiveQuery } from 'dexie-react-hooks';
import type { Entry } from '../db/types';
import { db } from '../db/db';
import { RowList } from '../components/RowList';
import { SavingsCard } from '../components/SavingsCard';
import { formatExportedAt, LedgerImportButton } from '../components/LedgerImport';
import { useCategories, useRows, useSettings } from '../hooks/useData';
import { useForecast } from '../hooks/useForecast';
import { TripForecastBody } from '../components/TripForecastCard';
import { totalsIn } from '../lib/aggregate';
import { budgetStatus } from '../lib/budget';
import { dayCount, formatMd, todayYmd } from '../lib/date';
import { yen, signedYen } from '../lib/money';
import { periodLabel, periodOf } from '../lib/period';
import { navigate } from '../router';

type Props = { onEdit: (e: Entry) => void };

export function HomeScreen({ onEdit }: Props) {
  const settings = useSettings();
  const rows = useRows();
  const categories = useCategories();
  const fc = useForecast(settings, rows);
  const trips = useLiveQuery(() => db.tripLedger.orderBy('startDate').toArray()) ?? [];
  if (!rows) return null;

  const today = todayYmd();
  const period = periodOf(today, settings.monthStartDay);
  const todayTotal = totalsIn(rows, { start: today, end: today });
  const month = totalsIn(rows, period);
  const bs = budgetStatus(rows, period, settings, categories);
  const recent = rows.filter((r) => r.date <= today).slice(0, 5);
  // 次の旅行：旅行中か、これからの旅行でいちばん近いもの
  const next = trips.find((t) => t.endDate >= today);
  const nextFc = next ? fc?.forecasts.find((f) => f.trip.tripId === next.tripId) : undefined;

  return (
    <>
      {settings.savingsAmount === undefined && <SavingsCard settings={settings} rows={rows} />}

      <section className="card">
        <div className="card-label">今日使った額</div>
        <div className="hero">
          <span className="hero-num">{yen(todayTotal.expense)}</span>
        </div>
        {todayTotal.income > 0 && <div className="muted small">今日の収入 {signedYen(todayTotal.income)}</div>}
      </section>

      <section className="card">
        <div className="card-label">{periodLabel(period, settings.monthStartDay)}</div>
        {bs.total && (
          <>
            <div className="hero">
              <span className="muted small">あと </span>
              <span className={`hero-num ${bs.total.left < 0 ? 'over' : ''}`}>{yen(bs.total.left)}</span>
              <span className="muted small"> 使える</span>
            </div>
            <div className="bar bar-lg">
              <div className={`bar-fill ${bs.total.left < 0 ? 'over' : ''}`} style={{ width: `${Math.min(100, (bs.total.spent / Math.max(1, bs.total.budget)) * 100)}%` }} />
            </div>
            <div className="muted small">
              予算 {yen(bs.total.budget)} のうち {yen(bs.total.spent)}（旅行は別）
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
        {bs.categories.length > 0 && (
          <ul className="cat-bars budget-bars">
            {bs.categories.map((c) => (
              <li key={c.category.id}>
                <span className="cat-bar-head">
                  <span>
                    {c.category.icon} {c.category.name}
                  </span>
                  <span className={c.left < 0 ? 'over' : 'muted'}>
                    {c.left < 0 ? `${yen(-c.left)} オーバー` : `あと ${yen(c.left)}`}
                  </span>
                </span>
                <span className="bar">
                  <span className={`bar-fill ${c.left < 0 ? 'over' : ''}`} style={{ width: `${Math.min(100, (c.spent / Math.max(1, c.budget)) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settings.savingsAmount !== undefined && <SavingsCard settings={settings} rows={rows} />}

      {next && (
        <button type="button" className="card trip-card" onClick={() => navigate({ name: 'savings' })}>
          <div className="settle-head">
            <h3 className="card-title">✈️ {next.name}</h3>
            <b className="trip-days">{next.startDate > today ? `あと${dayCount(today, next.startDate) - 1}日` : '旅行中'}</b>
          </div>
          <div className="muted small">
            {formatMd(next.startDate)}〜{formatMd(next.endDate)}
          </div>
          {nextFc ? (
            <TripForecastBody f={nextFc} />
          ) : (
            <div className="month-stats">
              <div>
                <span className="muted small">予算</span>
                <b>{next.budgetYen !== undefined ? yen(next.budgetYen) : '―'}</b>
              </div>
              <div>
                <span className="muted small">見積もり</span>
                <b>{yen(next.estimateYen)}</b>
              </div>
              <div>
                <span className="muted small">もう使った</span>
                <b>{yen(next.spentYen)}</b>
              </div>
            </div>
          )}
          <div className="muted small trip-link">貯金の見込みを見る ›</div>
        </button>
      )}

      <section className="card">
        <div className="settle-head">
          <h3 className="card-title">たびメモの旅行</h3>
          <span className="muted small">{settings.ledgerExportedAt ? `${formatExportedAt(settings.ledgerExportedAt)} 時点` : 'まだ取り込んでいません'}</span>
        </div>
        <LedgerImportButton className="btn btn-ghost btn-block" />
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
