import { deleteTrip, deleteTripEntry, restoreLedger } from '../db/ledgerRepo';
import { showToast } from './Toast';

/** 旅行の支出を1件消して「元に戻す」を出す */
export async function removeTripEntry(id: string): Promise<boolean> {
  const d = await deleteTripEntry(id);
  if (!d) return false;
  showToast('削除しました', { label: '元に戻す', onClick: () => void restoreLedger(d) });
  return true;
}

/** 旅行をその支出ごと消す（確認つき）。消したら「元に戻す」を出す */
export async function removeTrip(tripId: string, name: string): Promise<boolean> {
  if (!confirm(`「${name}」を、旅行で使った支出ごと家計簿から削除しますか？\nたびメモのデータは消えません。次に取り込んでも、この旅行は入りません。`)) return false;
  const d = await deleteTrip(tripId);
  if (!d) return false;
  showToast(`「${name}」を削除しました`, { label: '元に戻す', onClick: () => void restoreLedger(d) });
  return true;
}
