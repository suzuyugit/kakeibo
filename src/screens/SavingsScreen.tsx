import { SavingsCard } from '../components/SavingsCard';
import { SavingsChart } from '../components/SavingsChart';
import { TripForecastBody } from '../components/TripForecastCard';
import { LedgerImportButton } from '../components/LedgerImport';
import { removeTrip } from '../components/ledgerActions';
import { useRows, useSettings } from '../hooks/useData';
import { useForecast } from '../hooks/useForecast';
import { yen } from '../lib/money';
import { pastSeries } from '../lib/forecast';
import { countsTowardSavings } from '../lib/savings';
import { navigate } from '../router';

export function SavingsScreen() {
  const settings = useSettings();
  const rows = useRows();
  const fc = useForecast(settings, rows);
  if (!rows || !fc) return null;

  if (!fc.savings || !fc.input) {
    return <SavingsCard settings={settings} rows={rows} />;
  }

  const past = pastSeries(fc.savings.base, fc.savings.asOf, rows, fc.today, (r) => countsTowardSavings(r, settings, fc.today));
  const perMonth = Math.round(fc.daily.perDay * 30);
  const fixedIn = fc.recurrings.filter((r) => r.type === 'income' && !r.endMonth).reduce((a, r) => a + r.amount, 0);
  const fixedOut = fc.recurrings.filter((r) => r.type === 'expense' && !r.endMonth).reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <SavingsCard settings={settings} rows={rows} />

      {fc.forecasts.length === 0 ? (
        <section className="card">
          <h3 className="card-title">✈️ 予定の旅行</h3>
          <p className="muted small">予定の旅行がありません。たびメモで旅行を作って「家計簿に送る」→ ここで取り込むと、出発日までに貯金がいくらあるかが出ます。</p>
          <LedgerImportButton className="btn btn-ghost btn-block" />
        </section>
      ) : (
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
        ))
      )}

      <section className="card">
        <h3 className="card-title">貯金の見込み</h3>
        <SavingsChart past={past} input={fc.input} marks={fc.forecasts.map((f) => ({ date: f.ongoing ? fc.today : f.trip.startDate, name: f.trip.name }))} />
      </section>

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
          <li>旅行の分は、予算（なければ見積もり）からもう使った額を引いて、出発日に出ていくとみなします</li>
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
