import { useMemo, useState } from 'react';
import { SavingsChart } from './SavingsChart';
import { breakdownAt, type ForecastInput } from '../lib/forecast';
import { monthEnds } from '../lib/chartData';
import { signedYen, yen } from '../lib/money';
import { AmountInput } from './AmountInput';
import { addMonths, monthOf } from '../lib/recurring';

type Props = {
  input: ForecastInput;
  tripMonths: Map<string, string[]>;
  past: { date: string; value: number }[];
  marks: { date: string; name: string }[];
  /** 月の予算（全体）。決めていれば、そこから固定費を引いた額を初期値にする */
  budget?: number;
  /** 月の予算が固定費を除いた額（自由に使える額）か */
  budgetExcludesFixed?: boolean;
  /** 毎月の固定費の合計 */
  fixedOut: number;
  /** 毎月の固定の収入の合計 */
  fixedIn: number;
  /** 記録からの、固定以外の収入の1か月あたりの平均 */
  incomeAverage: number;
};

const PLAN_KEY = 'kakeibo.forecastPlan';

/** 見込みに使う1か月の収入と支出（自分で変えた分だけ。なければ初期値） */
type Plan = { income?: number; incomeWithFixed: boolean; spend?: number; spendWithFixed?: boolean };

function loadPlan(): Plan {
  try {
    const v = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null');
    if (v && typeof v === 'object') return { incomeWithFixed: v.incomeWithFixed !== false, income: v.income, spend: v.spend, spendWithFixed: v.spendWithFixed };
  } catch {
    // 読めなければ初期値
  }
  return { incomeWithFixed: true };
}

function savePlan(p: Plan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(p));
  } catch {
    // 覚えられなくてもよい
  }
}

/** 1か月の額の欄（−1万・+1万・直接入力）と「固定を含む／含まない」 */
function MonthlyField(props: {
  label: string;
  value: number;
  withFixed: boolean;
  fixed: number;
  fixedLabel: string;
  note: string;
  changed: boolean;
  onChange: (v: number) => void;
  onMode: (withFixed: boolean) => void;
  onReset: () => void;
}) {
  const { label, value, withFixed, fixed, fixedLabel, note, changed, onChange, onMode, onReset } = props;
  return (
    <div className="spend-field">
      <span className="label">{label}</span>
      <div className="spend-row">
        <button type="button" className="icon-btn" onClick={() => onChange(Math.max(0, value - 10000))} aria-label={`${label}を1万円へらす`}>
          −1万
        </button>
        <AmountInput value={value} onChange={(v) => onChange(v ?? 0)} label={label} className="spend-amount" />
        <button type="button" className="icon-btn" onClick={() => onChange(value + 10000)} aria-label={`${label}を1万円ふやす`}>
          +1万
        </button>
      </div>
      <div className="chips">
        <button type="button" className={`pick ${withFixed ? 'active' : ''}`} onClick={() => onMode(true)}>
          {fixedLabel}を含む
        </button>
        <button type="button" className={`pick ${!withFixed ? 'active' : ''}`} onClick={() => onMode(false)}>
          含まない
        </button>
      </div>
      <span className="muted small">
        {fixed > 0 && (withFixed ? `毎月の${fixedLabel} ${yen(fixed)} も、この額に入っているとして計算します。` : `毎月の${fixedLabel} ${yen(fixed)} は、この額とは別に計算します。`)}
        {note}
        {changed && (
          <button type="button" className="btn-text small" onClick={onReset}>
            初めの額に戻す
          </button>
        )}
      </span>
    </div>
  );
}

/**
 * 貯金の見込み：1か月の収入と支出を決めると、グラフと、スライドして選んだ月の「このままいけば ○円」と内訳が出る。
 * 収入・支出それぞれ、固定の収入・固定費を含めた額か、含めない額かを選べる
 */
export function SavingsAtMonth({ input: base, tripMonths, past, marks, budget, budgetExcludesFixed, fixedOut, fixedIn, incomeAverage }: Props) {
  const recordAverage = Math.round(base.perDay * 30); // 記録からの支出の平均（固定費を含まない）
  const [plan, setPlan] = useState<Plan>(loadPlan);
  const update = (p: Plan) => {
    setPlan(p);
    savePlan(p);
  };
  // 支出の初めの額：予算を決めていれば予算（予算の決め方に合わせて固定費を含む／含まない）、なければ記録の平均（含まない）
  const budgetWithFixed = budget !== undefined && !budgetExcludesFixed;
  const spendWithFixed = plan.spendWithFixed ?? budgetWithFixed;
  const budgetFree = budget === undefined ? undefined : budgetExcludesFixed ? budget : Math.max(0, budget - fixedOut); // 固定費を除いた額
  const spendDefault = spendWithFixed ? (budgetFree ?? recordAverage) + fixedOut : (budgetFree ?? recordAverage);
  const spend = plan.spend ?? spendDefault;
  // 収入：固定の収入 + 記録からの固定以外の収入の平均
  const incomeDefault = plan.incomeWithFixed ? fixedIn + incomeAverage : incomeAverage;
  const income = plan.income ?? incomeDefault;
  const input = useMemo<ForecastInput>(
    () => ({
      ...base,
      perDay: spend / 30,
      incomePerDay: income / 30,
      skipFixedExpense: spendWithFixed,
      skipFixedIncome: plan.incomeWithFixed,
    }),
    [base, spend, income, spendWithFixed, plan.incomeWithFixed],
  );
  const monthlyNet = (plan.incomeWithFixed ? income : income + fixedIn) - (spendWithFixed ? spend : spend + fixedOut);
  const months = monthEnds(monthOf(input.today), addMonths(monthOf(input.today), 35));
  const [idx, setIdx] = useState(1); // 0 = 今月
  const month = months[idx].month;
  const end = months[idx].end;
  const trip = tripMonths.get(month);
  const b = breakdownAt(input, end);
  const label = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;

  return (
    <section className="card">
      <h3 className="card-title">貯金の見込み</h3>
      <div className="spend-box">
        <MonthlyField
          label="1か月の収入"
          value={income}
          withFixed={plan.incomeWithFixed}
          fixed={fixedIn}
          fixedLabel="固定の収入"
          note={incomeAverage > 0 ? `（初めの額は、固定以外の収入の平均 約${yen(incomeAverage)} を足した額）` : ''}
          changed={plan.income !== undefined}
          onChange={(v) => update({ ...plan, income: v })}
          onMode={(w) => w !== plan.incomeWithFixed && update({ ...plan, incomeWithFixed: w, income: plan.income === undefined ? undefined : Math.max(0, plan.income + (w ? fixedIn : -fixedIn)) })}
          onReset={() => update({ ...plan, income: undefined })}
        />
        <MonthlyField
          label="1か月の支出"
          value={spend}
          withFixed={spendWithFixed}
          fixed={fixedOut}
          fixedLabel="固定費"
          note={budget !== undefined ? `（初めの額は月の予算 ${yen(budget)}${budgetExcludesFixed ? '（固定費を除く）' : '（固定費を含む）'} から）` : '（初めの額は、これまでの記録の平均から）'}
          changed={plan.spend !== undefined}
          onChange={(v) => update({ ...plan, spend: v, spendWithFixed })}
          onMode={(w) => w !== spendWithFixed && update({ ...plan, spendWithFixed: w, spend: plan.spend === undefined ? undefined : Math.max(0, plan.spend + (w ? fixedOut : -fixedOut)) })}
          onReset={() => update({ ...plan, spend: undefined })}
        />
        <div className="monthly-net">
          <span>毎月</span>
          <b className={monthlyNet >= 0 ? 'plus' : 'minus'}>{signedYen(monthlyNet)}</b>
          <span>{monthlyNet >= 0 ? 'ずつ貯まる計算' : 'ずつ減る計算'}</span>
          <span className="muted small">（旅行・カードの引き落とし・振込予定は別）</span>
        </div>
      </div>
      <SavingsChart past={past} input={input} marks={marks} focus={end} />
      <p className="muted small slider-help">下のつまみを左右にスライドすると、その月の終わりの貯金の見込みが出ます。</p>
      <div className="slider-head">
        <button type="button" className="icon-btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="前の月">
          ‹
        </button>
        <b className="slider-month">
          {label(month)}末{idx === 0 ? '（今月）' : ''}
          {trip && <span className="small"> ✈️ {trip.join('・')}</span>}
        </b>
        <button type="button" className="icon-btn" disabled={idx === months.length - 1} onClick={() => setIdx(idx + 1)} aria-label="次の月">
          ›
        </button>
      </div>
      <input
        type="range"
        className="month-slider"
        min={0}
        max={months.length - 1}
        step={1}
        value={idx}
        onChange={(e) => setIdx(Number(e.target.value))}
        aria-label="見たい月"
        aria-valuetext={`${label(month)}末 ${yen(b.total)}`}
      />
      <div className="slider-scale muted small">
        <span>今月</span>
        <span>1年後</span>
        <span>2年後</span>
        <span>3年後</span>
      </div>
      <div className="at-month">
        <span className="muted small">このままいけば {label(month)}末には</span>
        <span className={`hero-num ${b.total < 0 ? 'over' : ''}`}>{yen(b.total)}</span>
        <span className="small">
          今より <b className={b.total - b.start >= 0 ? 'plus' : 'minus'}>{signedYen(b.total - b.start)}</b>
        </span>
      </div>
      <ul className="at-month-list small">
        <li>
          <span>今の貯金</span>
          <b>{yen(b.start)}</b>
        </li>
        {b.fixedIn > 0 && (
          <li>
            <span>固定の収入</span>
            <b className="plus">+{yen(b.fixedIn)}</b>
          </li>
        )}
        {b.fixedOut > 0 && (
          <li>
            <span>固定費</span>
            <b className="minus">−{yen(b.fixedOut)}</b>
          </li>
        )}
        {b.income > 0 && (
          <li>
            <span>収入（1か月 {yen(income)}）</span>
            <b className="plus">+{yen(b.income)}</b>
          </li>
        )}
        {b.daily > 0 && (
          <li>
            <span>支出（1か月 {yen(spend)}）</span>
            <b className="minus">−{yen(b.daily)}</b>
          </li>
        )}
        {b.payIn > 0 && (
          <li>
            <span>給料などの振込（もう記録した分）</span>
            <b className="plus">+{yen(b.payIn)}</b>
          </li>
        )}
        {b.card > 0 && (
          <li>
            <span>カードの引き落とし（もう使った分）</span>
            <b className="minus">−{yen(b.card)}</b>
          </li>
        )}
        {b.trips.map((t) => (
          <li key={t.name}>
            <span>✈️ {t.name}</span>
            <b className="minus">−{yen(t.amount)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
