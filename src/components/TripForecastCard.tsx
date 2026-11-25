import type { TripForecast } from '../lib/forecast';
import { formatMd } from '../lib/date';
import { yen } from '../lib/money';

/** 旅行ごとの見込み：出発日の貯金見込み・必要な額・足りる／毎月あと○円 */
export function TripForecastBody({ f }: { f: TripForecast }) {
  const ok = f.after >= 0;
  return (
    <div className="trip-forecast">
      <div className="forecast-row">
        <span className="muted small">{f.ongoing ? '今の貯金' : `出発日 ${formatMd(f.trip.startDate)} の貯金見込み`}</span>
        <b>{yen(f.atStart)}</b>
      </div>
      <div className="forecast-row">
        <span className="muted small">旅行に必要な額{f.trip.budgetYen !== undefined ? '（予算 − 使った額）' : '（見積もり − 使った額）'}</span>
        <b>−{yen(f.need)}</b>
      </div>
      <div className={`forecast-verdict ${ok ? 'ok' : 'short'}`}>
        {ok ? (
          <>✅ 足りる（{yen(f.after)} 残る）</>
        ) : (
          <>
            ⚠️ {yen(-f.after)} 足りない
            {f.perMonth !== undefined && <span className="small">→ 毎月あと {yen(f.perMonth)} 多く貯めれば間に合う</span>}
          </>
        )}
      </div>
    </div>
  );
}
