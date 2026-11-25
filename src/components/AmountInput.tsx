import { useState } from 'react';
import { evaluate } from '../lib/calc';
import { AmountPad } from './AmountPad';
import { Sheet } from './Sheet';

type Props = {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  /** 欄の名前（シートの見出しと読み上げに使う） */
  label: string;
  /** 空にして「なし」にできるか（予算など） */
  allowEmpty?: boolean;
  placeholder?: string;
  type?: 'expense' | 'income';
  className?: string;
};

/**
 * 金額の欄。タップすると計算式も使える専用のキーボードが開き、「決定」で入る。
 * スマホのキーボード（＋や×がない）は使わない
 */
export function AmountInput({ value, onChange, label, allowEmpty, placeholder = '0', type = 'expense', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`amount-input-btn ${className}`} onClick={() => setOpen(true)} aria-label={`${label}：${value !== undefined ? `${value}円` : placeholder}`}>
        <span className="yen">¥</span>
        <span className={value === undefined ? 'placeholder' : ''}>{value !== undefined ? value.toLocaleString('ja-JP') : placeholder}</span>
      </button>
      {open && (
        <CalcSheet
          label={label}
          initial={value}
          allowEmpty={allowEmpty}
          type={type}
          onClose={() => setOpen(false)}
          onDone={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CalcSheet(props: {
  label: string;
  initial: number | undefined;
  allowEmpty?: boolean;
  type: 'expense' | 'income';
  onClose: () => void;
  onDone: (v: number | undefined) => void;
}) {
  const { label, initial, allowEmpty, type, onClose, onDone } = props;
  const [expr, setExpr] = useState(initial !== undefined && initial > 0 ? String(initial) : '');
  const [error, setError] = useState('');
  // 開いてすぐ数字を押したら打ち直し、＋などを押したら今の値に続けて計算
  const [fresh, setFresh] = useState(expr !== '');
  const done = () => {
    const n = evaluate(expr);
    if (n === undefined) {
      if (allowEmpty) return onDone(undefined);
      return onDone(0);
    }
    if (Number.isNaN(n)) return setError('計算式が正しくありません');
    if (n < 0) return setError('マイナスにはできません');
    onDone(n);
  };
  return (
    <Sheet
      title={label}
      onClose={onClose}
      action={
        <button type="button" className="btn btn-primary btn-small" onClick={done}>
          決定
        </button>
      }
    >
      <div className="form">
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <AmountPad
          value={expr}
          type={type}
          fresh={fresh}
          onChange={(v) => {
            setExpr(v);
            setFresh(false);
            setError('');
          }}
        />
        <p className="muted small">数字を押すと打ち直し、＋−×÷を押すと今の額に続けて計算します。{allowEmpty && ' C で消して「決定」を押すと「なし」になります。'}</p>
      </div>
    </Sheet>
  );
}
