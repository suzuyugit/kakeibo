import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Row } from '../lib/aggregate';
import { formatMd } from '../lib/date';
import { yen } from '../lib/money';
import { PAYMENT_LABEL } from '../lib/labels';
import { Sheet } from './Sheet';
import { removeTrip, removeTripEntry } from './ledgerActions';

/** 取り込んだ旅行の支出の詳しい内容（家計簿では直せない） */
export function TripEntrySheet({ row, onClose }: { row: Row; onClose: () => void }) {
  const t = row.trip!;
  const trip = useLiveQuery(() => db.tripLedger.get(t.tripId), [t.tripId]);

  return (
    <Sheet title="旅行の支出" onClose={onClose}>
      <div className="form">
        <div className="trip-entry-head">
          <span className="trip-entry-icon">{t.categoryIcon}</span>
          <div>
            <div className="trip-entry-cat">{t.categoryName}</div>
            <div className="muted small">
              {formatMd(row.date)}
              {t.paymentMethod && `・${PAYMENT_LABEL[t.paymentMethod]}`}
            </div>
          </div>
          <b className="trip-entry-amount">{yen(row.amount)}</b>
        </div>
        {row.sub && <p className="trip-entry-memo">📝 {row.sub}</p>}
        <p className="muted small">自分の負担分を円にした額です（割り勘のときは自分の分だけ）。</p>

        {trip && (
          <div className="trip-entry-trip">
            <div className="settle-head">
              <b>✈️ {trip.name}</b>
              <span className="muted small">
                {formatMd(trip.startDate)}〜{formatMd(trip.endDate)}
              </span>
            </div>
            <div className="month-stats">
              <div>
                <span className="muted small">予算</span>
                <b>{trip.budgetYen !== undefined ? yen(trip.budgetYen) : '―'}</b>
              </div>
              <div>
                <span className="muted small">見積もり</span>
                <b>{yen(trip.estimateYen)}</b>
              </div>
              <div>
                <span className="muted small">もう使った</span>
                <b>{yen(trip.spentYen)}</b>
              </div>
            </div>
          </div>
        )}

        <p className="notice small">
          旅行の支出は家計簿では直せません。直すときは、ホーム画面の<b>たびメモ</b>を開いて直し、設定の「家計簿に送る」→ 家計簿で「取り込む」をしてください。
        </p>

        <button
          type="button"
          className="btn btn-danger-outline btn-block"
          onClick={async () => {
            if (await removeTripEntry(row.key.replace(/^trip-/, ''))) onClose();
          }}
        >
          この支出を家計簿から削除
        </button>
        {trip && (
          <button
            type="button"
            className="btn-text danger-text"
            onClick={async () => {
              if (await removeTrip(trip.tripId, trip.name)) onClose();
            }}
          >
            「{trip.name}」を旅行ごと削除
          </button>
        )}
        <p className="muted small">家計簿から消すだけで、たびメモのデータは消えません。次に取り込んでも、消したものは入りません（設定の「たびメモとの連携」から戻せます）。</p>
      </div>
    </Sheet>
  );
}
