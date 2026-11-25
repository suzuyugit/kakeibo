// 旅行の日の貯金見込み（SPEC「旅行の日の貯金見込み」）
import type { LedgerTrip, Recurring, Settings } from '../db/types';
import type { Row } from './aggregate';
import { dayCount, parseYmd, toYmd } from './date';
import { addMonths, dateFor, isActive, monthOf } from './recurring';

export function addDays(ymd: string, n: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

/** after より後、until まで（両端：after は含まない、until は含む）に入る固定の収入・支出の日付と額 */
export function fixedBetween(recurrings: Recurring[], after: string, until: string): { date: string; signed: number }[] {
  const out: { date: string; signed: number }[] = [];
  if (until <= after) return out;
  const last = monthOf(until);
  for (const r of recurrings) {
    let m = r.startMonth > monthOf(after) ? r.startMonth : monthOf(after);
    for (; m <= last && (!r.endMonth || m <= r.endMonth); m = addMonths(m, 1)) {
      if (r.skippedMonths.includes(m)) continue;
      const date = dateFor(m, r.dayOfMonth);
      if (date > after && date <= until) out.push({ date, signed: r.type === 'income' ? r.amount : -r.amount });
    }
  }
  return out;
}

export type DailySpend = {
  perDay: number; // 1日あたりの変動費（固定と旅行以外の支出）
  basis: 'actual' | 'budget' | 'few' | 'none';
  days: number; // 平均に使った日数
};

/**
 * 1日あたりの変動費。
 * - 記録が30日以上あれば、直近90日（最大）の固定と旅行以外の支出の平均
 * - 30日未満で月の予算があれば、（予算 − 固定費）÷ 30
 * - 予算もなければ、7日以上あれば記録の平均（少なめの記録）、それもなければ 0
 */
export function dailySpend(rows: Row[], today: string, settings: Pick<Settings, 'monthlyBudget'>, recurrings: Recurring[]): DailySpend {
  const variable = rows.filter((r) => r.type === 'expense' && r.entry && !r.entry.recurringId && r.date <= today);
  const first = variable.reduce<string | undefined>((m, r) => (!m || r.date < m ? r.date : m), undefined);
  const days = first ? Math.min(90, dayCount(first, today)) : 0;
  const from = addDays(today, -(days - 1));
  const sum = variable.filter((r) => r.date >= from).reduce((a, r) => a + r.amount, 0);
  if (days >= 30) return { perDay: sum / days, basis: 'actual', days };
  if (settings.monthlyBudget !== undefined) {
    const fixedOut = recurrings.filter((r) => r.type === 'expense' && isActive(r, today)).reduce((a, r) => a + r.amount, 0);
    return { perDay: Math.max(0, settings.monthlyBudget - fixedOut) / 30, basis: 'budget', days };
  }
  if (days >= 7) return { perDay: sum / days, basis: 'few', days };
  return { perDay: 0, basis: 'none', days };
}

/** 旅行に必要な額 = 予算（なければ見積もり）− もう使った額。マイナスなら 0 */
export function tripNeed(t: Pick<LedgerTrip, 'budgetYen' | 'estimateYen' | 'spentYen'>): number {
  return Math.max(0, (t.budgetYen ?? t.estimateYen) - t.spentYen);
}

/** 旅行で出ていく日：これからの旅行は出発日、旅行中の旅行は今日 */
function outDate(t: Pick<LedgerTrip, 'startDate'>, today: string): string {
  return t.startDate > today ? t.startDate : today;
}

export type ForecastInput = {
  savings: number; // 今の貯金
  today: string;
  recurrings: Recurring[];
  perDay: number;
  trips: LedgerTrip[];
  /** これから引き落とされるカードの分（もう使った分） */
  cardOut?: { date: string; amount: number }[];
};

/** その日の終わりの貯金の見込み（今日より後の日）。その日に出ていく旅行の分は、引く前（includeTripsOn=false）か後か */
export function projectedAt(input: ForecastInput, date: string, includeTripsOn = true): number {
  const { savings, today, recurrings, perDay, trips } = input;
  if (date <= today) return savings;
  const fixed = fixedBetween(recurrings, today, date).reduce((a, f) => a + f.signed, 0);
  const card = (input.cardOut ?? []).filter((c) => c.date > today && c.date <= date).reduce((a, c) => a + c.amount, 0);
  const days = dayCount(today, date) - 1;
  const tripsOut = trips
    .filter((t) => t.endDate >= today)
    .filter((t) => {
      const d = outDate(t, today);
      return includeTripsOn ? d <= date : d < date;
    })
    .reduce((a, t) => a + tripNeed(t), 0);
  return Math.round(savings + fixed - card - perDay * days - tripsOut);
}

export type Breakdown = {
  start: number; // 今の貯金
  fixedIn: number; // 固定の収入
  fixedOut: number; // 固定費
  daily: number; // ふだんの支出（1日あたり × 日数）
  card: number; // カードの引き落とし（もう使った分）
  trips: { name: string; amount: number }[]; // 出ていく旅行
  total: number; // その日の終わりの見込み
};

/** その日の見込みの内訳（projectedAt と同じ計算） */
export function breakdownAt(input: ForecastInput, date: string): Breakdown {
  const { savings, today, recurrings, perDay, trips } = input;
  if (date <= today) return { start: savings, fixedIn: 0, fixedOut: 0, daily: 0, card: 0, trips: [], total: savings };
  const fixed = fixedBetween(recurrings, today, date);
  const fixedIn = fixed.filter((f) => f.signed > 0).reduce((a, f) => a + f.signed, 0);
  const fixedOut = -fixed.filter((f) => f.signed < 0).reduce((a, f) => a + f.signed, 0);
  const daily = Math.round(perDay * (dayCount(today, date) - 1));
  const card = (input.cardOut ?? []).filter((c) => c.date > today && c.date <= date).reduce((a, c) => a + c.amount, 0);
  const out = trips
    .filter((t) => t.endDate >= today && outDate(t, today) <= date)
    .map((t) => ({ name: t.name, amount: tripNeed(t) }))
    .filter((t) => t.amount > 0);
  return { start: savings, fixedIn, fixedOut, daily, card, trips: out, total: projectedAt(input, date) };
}

export type TripForecast = {
  trip: LedgerTrip;
  daysLeft: number; // 出発まであと何日（旅行中は 0）
  ongoing: boolean;
  need: number; // 旅行に必要な額
  atStart: number; // 出発日の貯金見込み（この旅行の分を引く前）
  after: number; // この旅行の分を引いたあと
  perMonth?: number; // 足りないとき、毎月あと何円貯めれば間に合うか（100円単位で切り上げ）
};

/** 予定の旅行（旅行中を含む）ごとの見込み。出発日が近い順 */
export function tripForecasts(input: ForecastInput): TripForecast[] {
  const { today } = input;
  return [...input.trips]
    .filter((t) => t.endDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
    .map((t) => {
      const ongoing = t.startDate <= today;
      const d = outDate(t, today);
      const need = tripNeed(t);
      // 出発日の見込み：その日より前に出ていく旅行は引き、この旅行と同じ日に出ていくほかの旅行は…
      // 同じ日に出発する旅行が複数あるときは、出発日の近い順（同じなら一覧の順）に引いていく
      const sameDayBefore = input.trips.filter((x) => x !== t && x.endDate >= today && outDate(x, today) === d && x.tripId < t.tripId);
      const atStart = projectedAt(input, d, false) - sameDayBefore.reduce((a, x) => a + tripNeed(x), 0);
      const after = atStart - need;
      let perMonth: number | undefined;
      if (after < 0) {
        const months = Math.max(1, Math.ceil((dayCount(today, d) - 1) / 30));
        perMonth = Math.ceil(-after / months / 100) * 100;
      }
      return { trip: t, daysLeft: ongoing ? 0 : dayCount(today, t.startDate) - 1, ongoing, need, atStart, after, perMonth };
    });
}

/** グラフ用：これまで（入れた日から今日まで）の貯金の推移。dateOf はお金が出入りした日（カードは引き落とし日） */
export function pastSeries(
  base: number,
  asOf: string,
  rows: Row[],
  today: string,
  change: (r: Row) => boolean,
  dateOf: (r: Row) => string = (r) => r.date,
): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  let v = base;
  const byDay = new Map<string, number>();
  for (const r of rows) {
    if (!change(r)) continue;
    const d = dateOf(r);
    byDay.set(d, (byDay.get(d) ?? 0) + (r.type === 'income' ? r.amount : -r.amount));
  }
  for (let d = asOf; d <= today; d = addDays(d, 1)) {
    v += byDay.get(d) ?? 0;
    out.push({ date: d, value: v });
  }
  return out;
}
