import { describe, expect, it } from 'vitest';
import { parseYen, signedYen, withCommas, yen } from './money';

describe('money', () => {
  it('表示', () => {
    expect(yen(12300)).toBe('12,300円');
    expect(yen(-500)).toBe('−500円');
    expect(signedYen(500)).toBe('+500円');
    expect(signedYen(0)).toBe('0円');
  });
  it('入力', () => {
    expect(parseYen('')).toBeUndefined();
    expect(parseYen('１，２００円')).toBe(1200);
    expect(parseYen('12.5')).toBeNaN();
    expect(withCommas('12000')).toBe('12,000');
  });
});
