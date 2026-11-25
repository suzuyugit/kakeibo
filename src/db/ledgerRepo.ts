import { db, getSettings } from './db';
import type { LedgerPayload } from '../lib/ledger';

/** たびメモのデータを取り込む。旅行の分は毎回まるごと入れ替える（何度取り込んでも二重にならない） */
export async function importLedger(p: LedgerPayload): Promise<void> {
  await db.transaction('rw', db.tripLedger, db.tripEntries, db.settings, async () => {
    await db.tripLedger.clear();
    await db.tripEntries.clear();
    await db.tripLedger.bulkPut(p.trips);
    await db.tripEntries.bulkPut(p.entries);
    const s = await getSettings();
    await db.settings.put({ ...s, ledgerExportedAt: p.exportedAt });
  });
}
