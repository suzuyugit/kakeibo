import type { Entry } from '../db/types';
import type { Row } from '../lib/aggregate';
import { deleteEntry, restoreEntry } from '../db/entryRepo';
import { formatMd } from '../lib/date';
import { yen } from '../lib/money';
import { useState } from 'react';
import { TripEntrySheet } from './TripEntrySheet';
import { removeTripEntry } from './ledgerActions';
import { SwipeToDelete } from './SwipeToDelete';
import { showToast } from './Toast';

type Props = {
  rows: Row[];
  onEdit: (e: Entry) => void;
  /** 行に日付も出す（いろいろな日が混ざる一覧） */
  showDate?: boolean;
  /** 収入を「+」（赤）、支出を「−」（青）で出す（カレンダー） */
  signColors?: boolean;
};

/** 記録の一覧。タップで編集、左にスライドで削除（元に戻せる）。旅行の支出はタップで詳しく見る（直すのはたびメモ） */
export function RowList({ rows, onEdit, showDate, signColors }: Props) {
  const [tripRow, setTripRow] = useState<Row | null>(null);
  return (
    <>
    <ul className="expense-list">
      {rows.map((r) => {
        const body = (
          <>
            <span className="expense-icon">{r.icon}</span>
            <span className="expense-main">
              <span className="expense-title">
                {r.title}
                {r.scheduled ? <span className="tag tag-plan">予定</span> : r.fixed && <span className="tag">固定</span>}
              </span>
              {(showDate || r.sub || r.trip) && (
                <span className="expense-sub">
                  {[showDate ? formatMd(r.date) : '', r.sub ?? '', r.trip ? 'たびメモから' : ''].filter(Boolean).join('・')}
                </span>
              )}
            </span>
            {signColors ? (
              <span className={`expense-amount ${r.type === 'income' ? 'plus' : 'minus'}`}>
                {r.type === 'income' ? '+' : '−'}
                {yen(r.amount)}
              </span>
            ) : (
              <span className={`expense-amount ${r.type === 'income' ? 'income' : ''}`}>
                {r.type === 'income' ? '+' : ''}
                {yen(r.amount)}
              </span>
            )}
          </>
        );
        if (r.scheduled) {
          return (
            <li key={r.key}>
              <div className="expense-row scheduled-row">{body}</div>
            </li>
          );
        }
        if (r.trip) {
          return (
            <li key={r.key}>
              <SwipeToDelete onDelete={() => removeTripEntry(r.key.replace(/^trip-/, ''))}>
                <button type="button" className="expense-row" onClick={() => setTripRow(r)}>
                  {body}
                </button>
              </SwipeToDelete>
            </li>
          );
        }
        const entry = r.entry!;
        return (
          <li key={r.key}>
            <SwipeToDelete
              onDelete={async () => {
                const deleted = await deleteEntry(entry.id);
                if (deleted) showToast('削除しました', { label: '元に戻す', onClick: () => void restoreEntry(deleted) });
                return true;
              }}
            >
              <button type="button" className="expense-row" onClick={() => onEdit(entry)}>
                {body}
              </button>
            </SwipeToDelete>
          </li>
        );
      })}
    </ul>
    {tripRow && <TripEntrySheet row={tripRow} onClose={() => setTripRow(null)} />}
    </>
  );
}
