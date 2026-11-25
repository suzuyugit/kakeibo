import type { Entry } from '../db/types';
import type { Row } from '../lib/aggregate';
import { deleteEntry, restoreEntry } from '../db/entryRepo';
import { formatMd } from '../lib/date';
import { yen } from '../lib/money';
import { tabimemoMoneyUrl } from '../router';
import { SwipeToDelete } from './SwipeToDelete';
import { showToast } from './Toast';

type Props = {
  rows: Row[];
  onEdit: (e: Entry) => void;
  /** 行に日付も出す（いろいろな日が混ざる一覧） */
  showDate?: boolean;
};

/** 記録の一覧。タップで編集、左にスライドで削除（元に戻せる）。旅行の支出はたびメモを開く */
export function RowList({ rows, onEdit, showDate }: Props) {
  return (
    <ul className="expense-list">
      {rows.map((r) => {
        const body = (
          <>
            <span className="expense-icon">{r.icon}</span>
            <span className="expense-main">
              <span className="expense-title">
                {r.title}
                {r.fixed && <span className="tag">固定</span>}
              </span>
              {(showDate || r.sub || r.trip) && (
                <span className="expense-sub">
                  {[showDate ? formatMd(r.date) : '', r.sub ?? '', r.trip ? 'たびメモで開く ›' : ''].filter(Boolean).join('・')}
                </span>
              )}
            </span>
            <span className={`expense-amount ${r.type === 'income' ? 'income' : ''}`}>
              {r.type === 'income' ? '+' : ''}
              {yen(r.amount)}
            </span>
          </>
        );
        if (r.trip) {
          return (
            <li key={r.key}>
              <a className="expense-row" href={tabimemoMoneyUrl(r.trip.tripId)}>
                {body}
              </a>
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
  );
}
