import { useMemo, useRef, useState } from 'react';
import type { ForecastInput } from '../lib/forecast';
import { addDays, projectedAt } from '../lib/forecast';
import { formatMd, parseYmd } from '../lib/date';
import { yen } from '../lib/money';

type Point = { date: string; value: number; future: boolean };

type Props = {
  past: { date: string; value: number }[];
  input: ForecastInput;
  /** グラフに印を付ける旅行（出発日・名前） */
  marks: { date: string; name: string }[];
};

const W = 360;
const H = 200;
const PAD = { top: 22, right: 12, bottom: 24, left: 44 };

/** 万円の短い表記。例：12.3万 */
function man(n: number): string {
  if (Math.abs(n) < 10000) return n.toLocaleString('ja-JP');
  return `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万`;
}

/** きりのいい目盛り（4本くらい） */
function ticks(min: number, max: number): number[] {
  const span = Math.max(1, max - min);
  const raw = span / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step / 2; v += step) out.push(v);
  return out;
}

/** これまでの貯金（実線）とこれからの見込み（点線）。旅行で出ていく日は下がる */
export function SavingsChart({ past, input, marks }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = useMemo<Point[]>(() => {
    // これまでは最大60日分、これからは最後の旅行の1週間後か、2か月後までの長いほう
    const shownPast = past.slice(-60).map((p) => ({ ...p, future: false }));
    const lastMark = marks.reduce((m, x) => (x.date > m ? x.date : m), input.today);
    const end = [addDays(lastMark, 7), addDays(input.today, 60)].sort().at(-1)!;
    const fut: Point[] = [];
    for (let d = addDays(input.today, 1); d <= end; d = addDays(d, 1)) fut.push({ date: d, value: projectedAt(input, d), future: true });
    return [...shownPast, ...fut];
  }, [past, input, marks]);

  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const yt = ticks(Math.min(0, ...values), Math.max(...values));
  const y0 = yt[0];
  const y1 = yt[yt.length - 1];
  const t0 = parseYmd(points[0].date).getTime();
  const t1 = parseYmd(points[points.length - 1].date).getTime();
  const x = (date: string) => PAD.left + ((parseYmd(date).getTime() - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - y0) / Math.max(1, y1 - y0)) * (H - PAD.top - PAD.bottom);
  const path = (ps: Point[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const todayIdx = points.findIndex((p) => p.future) - 1;
  const pastPts = todayIdx >= 0 ? points.slice(0, todayIdx + 1) : [];
  const futPts = todayIdx >= 0 ? points.slice(todayIdx) : points;

  // 月の始まりに目盛り
  const months = points.filter((p, i) => i > 0 && p.date.endsWith('-01'));

  const onMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].date) - sx) < Math.abs(x(points[best].date) - sx)) best = i;
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  const markOn = hp ? marks.find((m) => m.date === hp.date) : undefined;

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="savings-chart"
        role="img"
        aria-label={`貯金の推移と見込み。今日 ${yen(pastPts.at(-1)?.value ?? input.savings)}、${formatMd(points.at(-1)!.date)} に ${yen(points.at(-1)!.value)} の見込み`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-zero' : 'grid'} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="tick">
              {man(v)}
            </text>
          </g>
        ))}
        {months.map((p) => (
          <text key={p.date} x={x(p.date)} y={H - 6} textAnchor="middle" className="tick">
            {Number(p.date.slice(5, 7))}月
          </text>
        ))}
        {marks.map((m) =>
          m.date >= points[0].date && m.date <= points.at(-1)!.date ? (
            <g key={m.date + m.name}>
              <line x1={x(m.date)} x2={x(m.date)} y1={PAD.top - 6} y2={H - PAD.bottom} className="trip-line" />
              <text x={Math.min(W - PAD.right, Math.max(PAD.left, x(m.date)))} y={PAD.top - 9} textAnchor="middle" className="trip-label">
                ✈️ {m.name}
              </text>
            </g>
          ) : null,
        )}
        {pastPts.length > 1 && <path d={path(pastPts)} className="line-past" />}
        <path d={path(futPts)} className="line-future" />
        {todayIdx >= 0 && <circle cx={x(points[todayIdx].date)} cy={y(points[todayIdx].value)} r={4} className="dot-today" />}
        {hp && (
          <g>
            <line x1={x(hp.date)} x2={x(hp.date)} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
            <circle cx={x(hp.date)} cy={y(hp.value)} r={4.5} className="dot-hover" />
          </g>
        )}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: `${Math.min(70, Math.max(5, (x(hp.date) / W) * 100 - 15))}%` }}>
          <b>{formatMd(hp.date)}</b>
          <span>
            {hp.future ? '見込み' : '貯金'} {yen(hp.value)}
          </span>
          {markOn && <span>✈️ {markOn.name} の分を引いたあと</span>}
        </div>
      )}
      <div className="chart-key muted small">
        <span className="key-solid" /> これまで <span className="key-dash" /> これからの見込み
      </div>
    </div>
  );
}
