import { useLiveQuery } from 'dexie-react-hooks';
import type { Entry } from '../db/types';
import { db } from '../db/db';
import { RowList } from '../components/RowList';
import { SavingsCard } from '../components/SavingsCard';
import { formatExportedAt, LedgerImportButton } from '../components/LedgerImport';
import { useRows, useSettings } from '../hooks/useData';
import { totalsIn } from '../lib/aggregate';
import { dayCount, formatMd, todayYmd } from '../lib/date';
import { yen, signedYen } from '../lib/money';
import { periodLabel, periodOf } from '../lib/period';
import { navigate, tabimemoMoneyUrl } from '../router';

type Props = { onEdit: (e: Entry) => void };

export function HomeScreen({ onEdit }: Props) {
  const settings = useSettings();
  const rows = useRows();
  const trips = useLiveQuery(() => db.tripLedger.orderBy('startDate').toArray()) ?? [];
  if (!rows) return null;

  const today = todayYmd();
  const period = periodOf(today, settings.monthStartDay);
  const todayTotal = totalsIn(rows, { start: today, end: today });
  const month = totalsIn(rows, period);
  const budget = settings.monthlyBudget;
  const left = budget !== undefined ? budget - month.expense : undefined;
  const recent = rows.filter((r) => r.date <= today).slice(0, 5);
  // 次の旅行：旅行中か、これからの旅行でいちばん近いもの
  const next = trips.find((t) => t.endDate >= today);

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

      {settings.savingsAmount !== undefined && <SavingsCard settings={settings} rows={rows} />}

      {next && (
        <a className="card trip-card" href={tabimemoMoneyUrl(next.tripId)}>
          <div className="settle-head">
            <h3 className="card-title">✈️ {next.name}</h3>
            <b className="trip-days">{next.startDate > today ? `あと${dayCount(today, next.startDate) - 1}日` : '旅行中'}</b>
          </div>
          <div className="muted small">
            {formatMd(next.startDate)}〜{formatMd(next.endDate)}
          </div>
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
          <div className="muted small trip-link">たびメモで開く ›</div>
        </a>
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
