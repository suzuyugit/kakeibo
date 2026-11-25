import { useState } from 'react';
import type { Slice } from '../lib/chartData';
import { yen } from '../lib/money';

const SERIES = 8;

/** 色はカテゴリの並び順で決める（金額の順位では決めない。月が変わっても同じカテゴリはなるべく同じ色） */
function colorsFor(slices: Slice[]): Map<string, string> {
  const m = new Map<string, string>();
  const ordered = slices.filter((s) => s.key !== '__rest').sort((a, b) => a.order - b.order);
  ordered.forEach((s, i) => m.set(s.key, `var(--series-${(i % SERIES) + 1})`));
  m.set('__rest', 'var(--series-rest)');
  return m;
}

const R = 80;
const W = 28;
const C = 100;

function arc(start: number, end: number): string {
  // 円周上の角度（0 = 真上、時計回り）→ ドーナツの1切れ
  const p = (a: number, r: number) => [C + r * Math.sin(a), C - r * Math.cos(a)];
  const large = end - start > Math.PI ? 1 : 0;
  const [x1, y1] = p(start, R);
  const [x2, y2] = p(end, R);
  const [x3, y3] = p(end, R - W);
  const [x4, y4] = p(start, R - W);
  return `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R - W},${R - W} 0 ${large} 0 ${x4},${y4} Z`;
}

type Props = { slices: Slice[]; label: string; empty: string };

/** 円グラフ（ドーナツ）。真ん中に合計、タップした切れはその額と割合。下に一覧（色・名前・割合・額） */
export function DonutChart({ slices, label, empty }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return <p className="empty">{empty}</p>;
  const colors = colorsFor(slices);
  const selected = slices.find((s) => s.key === sel);
  const pct = (v: number) => `${Math.round((v / total) * 1000) / 10}%`;

  let a = 0;
  const arcs = slices.map((s) => {
    const start = a;
    a += (s.value / total) * Math.PI * 2;
    return { s, start, end: a };
  });

  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" className="donut-svg" role="img" aria-label={`${label}の内訳 合計 ${yen(total)}`}>
        {arcs.length === 1 ? (
          <circle cx={C} cy={C} r={R - W / 2} fill="none" stroke={colors.get(arcs[0].s.key)} strokeWidth={W} onClick={() => setSel(sel ? null : arcs[0].s.key)} />
        ) : (
          arcs.map(({ s, start, end }) => (
            <path
              key={s.key}
              d={arc(start, end)}
              fill={colors.get(s.key)}
              className={`donut-slice ${sel && sel !== s.key ? 'dim' : ''}`}
              onClick={() => setSel(sel === s.key ? null : s.key)}
            />
          ))
        )}
        <text x={C} y={C - 8} textAnchor="middle" className="donut-cap">
          {selected ? `${selected.icon} ${selected.label}` : label}
        </text>
        <text x={C} y={C + 14} textAnchor="middle" className="donut-num">
          {yen(selected ? selected.value : total)}
        </text>
        {selected && (
          <text x={C} y={C + 32} textAnchor="middle" className="donut-cap">
            {pct(selected.value)}
          </text>
        )}
      </svg>
      <ul className="donut-legend">
        {slices.map((s) => (
          <li key={s.key}>
            <button type="button" className={`donut-row ${sel === s.key ? 'active' : ''}`} onClick={() => setSel(sel === s.key ? null : s.key)}>
              <span className="swatch-dot" style={{ background: colors.get(s.key) }} />
              <span className="donut-name">
                {s.icon} {s.label}
              </span>
              <span className="muted small">{pct(s.value)}</span>
              <b>{yen(s.value)}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
