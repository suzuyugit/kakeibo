// 金額はすべて円の整数

/** 例：12,300円。マイナスは「−12,300円」 */
export function yen(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n)).toLocaleString('ja-JP')}円`;
}

/** 符号つき。例：+12,300円／−12,300円 */
export function signedYen(n: number): string {
  return n > 0 ? `+${yen(n)}` : yen(n);
}

/** 入力欄の文字列 → 円。空なら undefined、不正なら NaN。全角・カンマ・「円」可 */
export function parseYen(s: string): number | undefined {
  const t = s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[,，\s円]/g, '');
  if (t === '') return undefined;
  if (!/^\d+$/.test(t)) return NaN;
  return Number(t);
}

/** 入力中の表示用にカンマを付ける（数字以外はそのまま返す） */
export function withCommas(s: string): string {
  const n = parseYen(s);
  return n === undefined || Number.isNaN(n) ? s : n.toLocaleString('ja-JP');
}
