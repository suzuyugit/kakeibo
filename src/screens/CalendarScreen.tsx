import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TRAVEL_CATEGORY } from '../db/db';
import type { Entry } from '../db/types';
import { RowList } from '../components/RowList';
import { useCategories, useRows, useSettings } from '../hooks/useData';
import { expenseByCategory, scheduledRows, totalsByDay, totalsIn, travelByCategory } from '../lib/aggregate';
import { formatMd, parseYmd, todayYmd } from '../lib/date';
import { yen } from '../lib/money';
import { daysOf, inPeriod, periodByKey, periodLabel, periodOf, shiftKey } from '../lib/period';

type Props = {
  selected: string;
  onSelect: (ymd: string) => void;
  onEdit: (e: Entry) => void;
  onAdd: (ymd: string) => void;
};

/** カレンダーのマスに入れる短い金額。1万以上は「1.2万」 */
function compactYen(n: number): string {
  if (n >= 10000) return `${(Math.floor(n / 1000) / 10).toLocaleString('ja-JP')}万`;
  return n.toLocaleString('ja-JP');
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function CalendarScreen({ selected, onSelect, onEdit, onAdd }: Props) {
  const settings = useSettings();
  const rows = useRows();
  const categories = useCategories();
  const recurrings = useLiveQuery(() => db.recurrings.toArray()) ?? [];
  const startDay = settings.monthStartDay;
  const [key, setKey] = useState(() => periodOf(selected, startDay).key);
  const [showTravel, setShowTravel] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  if (!rows) return null;
  const period = periodByKey(key, startDay);
  const today = todayYmd();
  const days = daysOf(period);
  // これから入る固定の予定もカレンダーに出す
  const entries = rows.flatMap((r) => (r.entry ? [r.entry] : []));
  const calRows = [...rows, ...scheduledRows(recurrings, entries, categories, period.start, period.end, today)];
  const byDay = totalsByDay(calRows);
  const month = totalsIn(calRows, period); // 固定の予定も含める（マスの額と合わせる）
  const lead = parseYmd(period.start).getDay();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  const move = (n: number) => {
    const next = shiftKey(key, n);
    setKey(next);
    const p = periodByKey(next, startDay);
    onSelect(inPeriod(today, p) ? today : p.start);
  };

  const dayRows = calRows.filter((r) => r.date === selected);
  const dayTotal = byDay.get(selected) ?? { expense: 0, income: 0 };
  const byCat = expenseByCategory(rows, period);
  const maxCat = byCat[0]?.amount ?? 1;
  const catOf = (id: string) => categories.find((c) => c.id === id);
  const travel = showTravel ? travelByCategory(rows, period) : [];

  return (
    <>
      <section className="card cal-card">
        <div className="month-nav">
          <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="前の月">
            ‹
          </button>
          <div className="month-title">
            <b>{periodLabel(period, startDay)}</b>
            <span className="small">
              <span className="plus">+{yen(month.income)}</span>　<span className="minus">−{yen(month.expense)}</span>
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={() => move(1)} aria-label="次の月">
            ›
          </button>
        </div>
        <div
          className="cal"
          onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) move(dx < 0 ? 1 : -1);
          }}
        >
          {WEEK.map((w, i) => (
            <div key={w} className={`cal-week ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`x${i}`} className="cal-cell empty-cell" />;
            const t = byDay.get(d);
            const dt = parseYmd(d);
            // 月の途中で月が変わるとき（開始日が1日でない）は「12/1」のように出す
            const label = dt.getDate() === 1 && startDay !== 1 ? `${dt.getMonth() + 1}/1` : String(dt.getDate());
            return (
              <button
                key={d}
                type="button"
                className={`cal-cell ${d === selected ? 'selected' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`}
                onClick={() => onSelect(d)}
                aria-label={`${formatMd(d)} 収入 ${yen(t?.income ?? 0)} 支出 ${yen(t?.expense ?? 0)}`}
              >
                <span className="cal-day">{label}</span>
                {t && t.income > 0 && <span className="cal-amount plus">+{compactYen(t.income)}</span>}
                {t && t.expense > 0 && <span className="cal-amount minus">−{compactYen(t.expense)}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="settle-head">
          <h3 className="card-title">{formatMd(selected)}</h3>
          <span className="muted small">
            {dayTotal.income > 0 && <span className="plus">+{yen(dayTotal.income)}</span>}
            {dayTotal.expense > 0 && dayTotal.income > 0 && '　'}
            {dayTotal.expense > 0 && <span className="minus">−{yen(dayTotal.expense)}</span>}
          </span>
        </div>
        {dayRows.length === 0 ? <p className="empty">この日の記録はありません</p> : <RowList rows={dayRows} onEdit={onEdit} signColors />}
        <button type="button" className="btn btn-ghost btn-block" onClick={() => onAdd(selected)}>
          ＋ この日に記録する
        </button>
      </section>

      <section className="card">
        <h3 className="card-title">カテゴリ別の支出</h3>
        {byCat.length === 0 ? (
          <p className="empty">この月の支出はまだありません</p>
        ) : (
          <ul className="cat-bars">
            {byCat.map((c) => {
              const cat = catOf(c.categoryId);
              const isTravel = c.categoryId === TRAVEL_CATEGORY;
              const head = (
                <>
                  <span className="cat-bar-head">
                    <span>
                      {cat?.icon ?? '📦'} {cat?.name ?? 'その他'}
                      {isTravel && <span className="muted small">{showTravel ? ' ▲' : ' ▼ 内訳'}</span>}
                    </span>
                    <b>{yen(c.amount)}</b>
                  </span>
                  <span className="bar">
                    <span className="bar-fill" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                  </span>
                </>
              );
              return (
                <li key={c.categoryId}>
                  {isTravel ? (
                    <button type="button" className="cat-bar-btn" onClick={() => setShowTravel((v) => !v)}>
                      {head}
                    </button>
                  ) : (
                    head
                  )}
                  {isTravel && showTravel && (
                    <ul className="travel-breakdown">
                      {travel.map((t) => (
                        <li key={t.name}>
                          <span>
                            {t.icon} {t.name}
                          </span>
                          <span>{yen(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
