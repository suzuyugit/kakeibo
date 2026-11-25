// たびメモから送られてくるデータ（たびメモの src/lib/ledger.ts と同じ形。形を変えるときは両方を同時に直す）
import type { LedgerEntry, LedgerTrip } from '../db/types';

export const LEDGER_HEADER = 'TABIMEMO-LEDGER';
export const LEDGER_SCHEMA = 1;

export type LedgerPayload = {
  schema: typeof LEDGER_SCHEMA;
  exportedAt: string;
  trips: LedgerTrip[];
  entries: LedgerEntry[];
};

export type LedgerError = 'not-ledger' | 'unknown-schema';

export const LEDGER_ERROR_MESSAGE: Record<LedgerError, string> = {
  'not-ledger': 'たびメモのデータではありませんでした。たびメモの設定で「家計簿に送る」を押してから、もう一度試してください。',
  'unknown-schema': 'たびメモと家計簿のバージョンが合いません。両方のアプリを最新にしてください（開き直すと「更新」が出ます）。',
};

const isStr = (v: unknown) => typeof v === 'string';
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** クリップボードの文字列を読む。1行目が TABIMEMO-LEDGER、2行目から JSON */
export function decodeLedger(text: string): LedgerPayload | { error: LedgerError } {
  const t = text.trim();
  if (!t.startsWith(`${LEDGER_HEADER}\n`) && !t.startsWith(`${LEDGER_HEADER}\r\n`)) return { error: 'not-ledger' };
  let json: unknown;
  try {
    json = JSON.parse(t.slice(t.indexOf('\n') + 1));
  } catch {
    return { error: 'not-ledger' };
  }
  const p = json as Partial<LedgerPayload> | null;
  if (!p || typeof p !== 'object' || !Array.isArray(p.trips) || !Array.isArray(p.entries)) return { error: 'not-ledger' };
  if (p.schema !== LEDGER_SCHEMA) return { error: 'unknown-schema' };
  const tripsOk = p.trips.every((x) => x && isStr(x.tripId) && isStr(x.name) && isStr(x.startDate) && isStr(x.endDate) && isNum(x.spentYen) && isNum(x.estimateYen));
  const entriesOk = p.entries.every((x) => x && isStr(x.id) && isStr(x.tripId) && isStr(x.date) && isNum(x.myShareYen));
  if (!tripsOk || !entriesOk || !isStr(p.exportedAt)) return { error: 'not-ledger' };
  return p as LedgerPayload;
}
