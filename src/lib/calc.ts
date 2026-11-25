// 金額の計算式（例：1200+380、3000÷3、980×2−100）。eval は使わず自分で読む
export const OPS = ['+', '−', '×', '÷'] as const;
export type Op = (typeof OPS)[number];

/** 入力のゆれをそろえる：全角数字、*, /, -, x、カンマ・空白・円 */
export function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[＋]/g, '+')
    .replace(/[-ー－]/g, '−')
    .replace(/[*＊xX]/g, '×')
    .replace(/[/／]/g, '÷')
    .replace(/[,，\s円]/g, '');
}

/** 式に演算子が入っているか（「= ○円」を出すかどうか） */
export function hasOperator(s: string): boolean {
  return /[+−×÷]/.test(normalize(s).replace(/^−/, ''));
}

/**
 * 式を計算して円（整数・四捨五入）にする。空なら undefined、読めなければ NaN。
 * かけ算・わり算を先に計算する。最後の演算子は無視する（「1200+」は 1200）
 */
export function evaluate(input: string): number | undefined {
  let s = normalize(input);
  if (s === '') return undefined;
  s = s.replace(/[+−×÷]+$/, '');
  if (s === '') return NaN;
  const tokens = s.match(/\d+(?:\.\d+)?|[+−×÷]/g);
  if (!tokens || tokens.join('') !== s) return NaN;
  // 数・演算子・数… の形か
  const nums: number[] = [];
  const ops: Op[] = [];
  let expectNum = true;
  let neg = false;
  for (const t of tokens) {
    if (expectNum) {
      if (t === '−' && !neg && nums.length === 0) {
        neg = true;
        continue;
      }
      if (!/^\d/.test(t)) return NaN;
      nums.push(neg ? -Number(t) : Number(t));
      neg = false;
      expectNum = false;
    } else {
      ops.push(t as Op);
      expectNum = true;
    }
  }
  if (expectNum) return NaN;
  // × ÷ を先に
  const n2: number[] = [nums[0]];
  const o2: Op[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const v = nums[i + 1];
    if (op === '×') n2[n2.length - 1] *= v;
    else if (op === '÷') {
      if (v === 0) return NaN;
      n2[n2.length - 1] /= v;
    } else {
      o2.push(op);
      n2.push(v);
    }
  }
  let r = n2[0];
  for (let i = 0; i < o2.length; i++) r = o2[i] === '+' ? r + n2[i + 1] : r - n2[i + 1];
  return Math.round(r);
}

/** 画面に出す式（数字にカンマ） */
export function prettyExpr(s: string): string {
  return normalize(s).replace(/\d+(?:\.\d+)?/g, (n) => (n.includes('.') ? n : Number(n).toLocaleString('ja-JP')));
}
