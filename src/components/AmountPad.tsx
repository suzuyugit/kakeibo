import { useEffect } from 'react';
import { evaluate, hasOperator, normalize, prettyExpr } from '../lib/calc';
import { yen } from '../lib/money';

type Props = {
  value: string; // 入力中の式（例：1200+380）
  onChange: (v: string) => void;
  type: 'expense' | 'income';
  /** true のあいだは、最初に数字を押すと今の値を消して打ち直す（演算子なら今の値に続ける） */
  fresh?: boolean;
};

const MAX = 24;
const isOp = (c: string) => c === '+' || c === '−' || c === '×' || c === '÷';

/** 次の入力を足した式。演算子が続いたら置き換え、先頭に + × ÷ は置けない */
export function press(value: string, key: string): string {
  const v = normalize(value);
  if (key === 'C') return '';
  if (key === '⌫') return v.slice(0, -1);
  if (key === '=') {
    const n = evaluate(v);
    return n === undefined || Number.isNaN(n) || n < 0 ? v : String(n);
  }
  if (isOp(key)) {
    if (v === '') return key === '−' ? '' : '';
    return isOp(v.at(-1)!) ? v.slice(0, -1) + key : v + key;
  }
  // 数字：0 だけのところに 0 を重ねない
  const last = v.split(/[+−×÷]/).at(-1) ?? '';
  if (last === '0') return v.slice(0, -1) + (key === '00' ? '0' : key);
  if ((key === '0' || key === '00') && last === '' && v !== '') return v + '0';
  if (key === '00' && v === '') return '';
  return (v + key).slice(0, MAX);
}

const KEYS: { k: string; cls?: string; label?: string }[] = [
  { k: 'C', cls: 'fn' },
  { k: '÷', cls: 'op' },
  { k: '×', cls: 'op' },
  { k: '⌫', cls: 'fn', label: '⌫' },
  { k: '7' },
  { k: '8' },
  { k: '9' },
  { k: '−', cls: 'op' },
  { k: '4' },
  { k: '5' },
  { k: '6' },
  { k: '+', cls: 'op' },
  { k: '1' },
  { k: '2' },
  { k: '3' },
  { k: '=', cls: 'eq' },
  { k: '0', cls: 'zero' },
  { k: '00' },
];

/** 金額の入力（計算式も使える専用のキーボード） */
export function AmountPad({ value, onChange, type, fresh }: Props) {
  const apply = (k: string) => onChange(press(fresh && /^(\d|00)$/.test(k) ? '' : value, k));
  const n = evaluate(value);
  const withOp = hasOperator(value);

  // パソコンのキーボードでも打てるように
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const map: Record<string, string> = { '*': '×', x: '×', '/': '÷', '-': '−', Backspace: '⌫', Enter: '=', Escape: 'C' };
      const k = map[e.key] ?? e.key;
      if (/^[0-9]$/.test(k) || ['+', '−', '×', '÷', '⌫', '=', 'C'].includes(k)) {
        if (k === 'C' && e.key === 'Escape') return; // Esc はシートを閉じる
        e.preventDefault();
        apply(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, fresh]);

  return (
    <div className="amount-pad">
      <div className={`amount-display ${type}`} aria-live="polite">
        <span className="yen">¥</span>
        <span className={`amount-expr ${value ? '' : 'placeholder'} ${withOp ? 'with-op' : ''}`}>{value ? prettyExpr(value) : '0'}</span>
        {withOp && (
          <span className="amount-result">
            {n === undefined || Number.isNaN(n) ? '= ?' : `= ${yen(n)}`}
          </span>
        )}
      </div>
      <div className="pad" role="group" aria-label="金額のキーボード">
        {KEYS.map(({ k, cls, label }) => (
          <button
            key={k}
            type="button"
            className={`pad-key ${cls ?? ''}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => apply(k)}
            aria-label={k === '⌫' ? '1文字消す' : k === 'C' ? 'ぜんぶ消す' : k}
          >
            {label ?? k}
          </button>
        ))}
      </div>
    </div>
  );
}
