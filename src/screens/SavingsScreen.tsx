import { SavingsCard } from '../components/SavingsCard';
import { SavingsAtMonth } from '../components/SavingsAtMonth';
import { isActive, monthOf } from '../lib/recurring';
import { TripForecastBody } from '../components/TripForecastCard';
import { removeTrip } from '../components/ledgerActions';
import { useRows, useSettings } from '../hooks/useData';
import { useForecast } from '../hooks/useForecast';
import { yen } from '../lib/money';
import { pastSeries } from '../lib/forecast';
import { countsTowardSavings } from '../lib/savings';
import { moneyDate } from '../lib/card';
import { navigate } from '../router';

export function SavingsScreen() {
  const settings = useSettings();
  const rows = useRows();
  const fc = useForecast(settings, rows);
  if (!rows || !fc) return null;

  if (!fc.savings || !fc.input) {
    return <SavingsCard settings={settings} rows={rows} />;
  }

  const past = pastSeries(fc.savings.base, fc.savings.asOf, rows, fc.today, (r) => countsTowardSavings(r, settings, fc.today), (r) => moneyDate(r, settings));
  const perMonth = Math.round(fc.daily.perDay * 30);

  // 旅行で出ていく月（月を選ぶ欄に ✈️ を出す）
  const tripMonths = new Map<string, string[]>();
  for (const f of fc.forecasts) {
    const m = monthOf(f.ongoing ? fc.today : f.trip.startDate);
    tripMonths.set(m, [...(tripMonths.get(m) ?? []), f.trip.name]);
  }
  const fixedIn = fc.recurrings.filter((r) => r.type === 'income' && isActive(r, fc.today)).reduce((a, r) => a + r.amount, 0);
  const fixedOut = fc.recurrings.filter((r) => r.type === 'expense' && isActive(r, fc.today)).reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <SavingsCard settings={settings} rows={rows} />


      <SavingsAtMonth
        input={fc.input}
        tripMonths={tripMonths}
        past={past}
        marks={fc.forecasts.map((f) => ({ date: f.ongoing ? fc.today : f.trip.startDate, name: f.trip.name }))}
        budget={settings.monthlyBudget}
        fixedOut={fixedOut}
      />

      {/* 予定の旅行があるときだけ、旅行ごとの見込みを出す（たびメモからの取り込みはホームの下と設定にある） */}
      {fc.forecasts.length > 0 &&
        fc.forecasts.map((f) => (
          <section key={f.trip.tripId} className="card">
            <div className="settle-head">
              <h3 className="card-title">✈️ {f.trip.name}</h3>
              <b className="trip-days">{f.ongoing ? '旅行中' : `あと${f.daysLeft}日`}</b>
            </div>
            <TripForecastBody f={f} />
            <button type="button" className="btn-text danger-text small" onClick={() => void removeTrip(f.trip.tripId, f.trip.name)}>
              この旅行を家計簿から削除
            </button>
          </section>
        ))}

      <section className="card">
        <h3 className="card-title">見込みの出し方</h3>
        <ul className="basis-list small">
          <li>
            固定の収入 <b className="income">+{yen(fixedIn)}</b>・固定費 <b>−{yen(fixedOut)}</b>（毎月、その日に）
          </li>
          <li>
            ふだんの支出 <b>約 {yen(perMonth)}／月</b>
            <span className="muted">
              {fc.daily.basis === 'actual' && `（直近${fc.daily.days}日の記録の平均。固定費と旅行を除く）`}
              {fc.daily.basis === 'budget' && '（記録がまだ30日分ないので、月の予算 − 固定費）'}
              {fc.daily.basis === 'few' && `（記録が${fc.daily.days}日分しかないので、まだ目安です）`}
              {fc.daily.basis === 'none' && '（記録が少ないので 0 円で計算しています。見込みは多めに出ています）'}
            </span>
          </li>
          {fc.forecasts.length > 0 && <li>旅行の分は、予算（なければ見積もり）からもう使った額を引いて、出発日に出ていくとみなします</li>}
          {settings.cardPayDay ? (
            <li>カードで払った分は、{settings.cardCloseDay ? `${settings.cardCloseDay}日` : '月末'}締め・翌月{settings.cardPayDay}日の引き落とし日に減ります</li>
          ) : null}
        </ul>
        {fc.daily.basis === 'none' && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate({ name: 'settings' })}>
            月の予算を決める
          </button>
        )}
      </section>
    </>
  );
}
