// JSON バックアップと復元（家計簿のデータだけ。取り込んだ旅行の分も入れる）
import { db } from '../db/db';

export const BACKUP_TABLES = ['entries', 'categories', 'recurrings', 'settings', 'tripLedger', 'tripEntries'] as const;
type TableName = (typeof BACKUP_TABLES)[number];

export type Backup = {
  app: 'kakeibo';
  version: 1;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
};

export async function exportBackup(now = new Date().toISOString()): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const t of BACKUP_TABLES) tables[t] = await db.table(t).toArray();
  return { app: 'kakeibo', version: 1, exportedAt: now, tables };
}

/** バックアップとして読めるか。読めなければメッセージ */
export function checkBackup(json: unknown): { ok: true; backup: Backup } | { ok: false; message: string } {
  const b = json as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== 'kakeibo') return { ok: false, message: '家計簿のバックアップではありませんでした' };
  if (b.version !== 1) return { ok: false, message: 'このバージョンでは読めないバックアップです。アプリを最新にしてください' };
  if (!b.tables || BACKUP_TABLES.some((t) => !Array.isArray(b.tables![t]))) return { ok: false, message: 'バックアップの中身が壊れています' };
  return { ok: true, backup: b as Backup };
}

export function backupSummary(b: Backup): string {
  const n = (t: TableName) => b.tables[t].length;
  return `記録 ${n('entries')}件・固定 ${n('recurrings')}件・旅行 ${n('tripLedger')}件`;
}

/** 今のデータを全部消して、バックアップの中身に置き換える */
export async function restoreBackup(b: Backup): Promise<void> {
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkPut(b.tables[t]);
    }
  });
}

export function backupFileName(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `kakeibo-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}
