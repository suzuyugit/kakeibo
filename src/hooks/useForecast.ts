import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { LedgerTrip, Recurring, Settings } from '../db/types';
import type { Row } from '../lib/aggregate';
import { todayYmd } from '../lib/date';
import { dailySpend, tripForecasts, type DailySpend, type ForecastInput, type TripForecast } from '../lib/forecast';
import { savingsNow, type SavingsNow } from '../lib/savings';
import { pendingCard } from '../lib/card';

export type ForecastData = {
  today: string;
  savings?: SavingsNow;
  daily: DailySpend;
  cardOut: { date: string; amount: number }[]; // これから引き落とされるカードの分
  input?: ForecastInput; // 貯金を入れていなければ undefined
  trips: LedgerTrip[];
  forecasts: TripForecast[];
  recurrings: Recurring[];
};

export function useForecast(settings: Settings, rows: Row[] | undefined): ForecastData | undefined {
  const recurrings = useLiveQuery(() => db.recurrings.toArray());
  const trips = useLiveQuery(() => db.tripLedger.toArray());
  if (!rows || !recurrings || !trips) return undefined;
  const today = todayYmd();
  const savings = savingsNow(settings, rows, today);
  const daily = dailySpend(rows, today, settings, recurrings);
  const cardOut = pendingCard(rows, settings.cardPayDay, today);
  const input = savings ? { savings: savings.total, today, recurrings, perDay: daily.perDay, trips, cardOut } : undefined;
  return { today, savings, daily, cardOut, input, trips, forecasts: input ? tripForecasts(input) : [], recurrings };
}
