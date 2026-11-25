import { describe, expect, it } from 'vitest';
import { press } from './AmountPad';

const type = (keys: string[]) => keys.reduce((v, k) => press(v, k), '');

describe('金額のキーボード', () => {
  it('数字と計算式', () => {
    expect(type(['1', '2', '0', '0', '+', '3', '8', '0'])).toBe('1200+380');
    expect(type(['1', '2', '0', '0', '+', '3', '8', '0', '='])).toBe('1580');
    expect(type(['3', '00', '0', '÷', '3', '='])).toBe('1000');
  });
  it('演算子が続いたら置き換え、先頭には置けない', () => {
    expect(type(['5', '+', '×'])).toBe('5×');
    expect(type(['+', '5'])).toBe('5');
    expect(type(['00', '5'])).toBe('5');
  });
  it('0 を重ねない、消す', () => {
    expect(type(['0', '0', '7'])).toBe('7');
    expect(type(['1', '+', '0', '0'])).toBe('1+0');
    expect(type(['1', '2', '⌫'])).toBe('1');
    expect(type(['1', '2', 'C'])).toBe('');
  });
});
