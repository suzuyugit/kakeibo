import { describe, expect, it } from 'vitest';
import { evaluate, hasOperator, prettyExpr } from './calc';

describe('金額の計算式', () => {
  it('数だけ', () => {
    expect(evaluate('')).toBeUndefined();
    expect(evaluate('1200')).toBe(1200);
    expect(evaluate('１，２００円')).toBe(1200);
  });
  it('たし算・ひき算・かけ算・わり算（かけ算・わり算が先）', () => {
    expect(evaluate('1200+380')).toBe(1580);
    expect(evaluate('3000÷3')).toBe(1000);
    expect(evaluate('980×2−100')).toBe(1860);
    expect(evaluate('100+200×3')).toBe(700);
    expect(evaluate('1000/3')).toBe(333);
    expect(evaluate('1000*2-500')).toBe(1500);
  });
  it('最後の演算子は無視、読めないものは NaN', () => {
    expect(evaluate('1200+')).toBe(1200);
    expect(evaluate('1200++3')).toBeNaN();
    expect(evaluate('100÷0')).toBeNaN();
    expect(evaluate('abc')).toBeNaN();
    expect(evaluate('−500+800')).toBe(300);
  });
  it('表示', () => {
    expect(hasOperator('1200')).toBe(false);
    expect(hasOperator('1200+380')).toBe(true);
    expect(prettyExpr('12000+3800')).toBe('12,000+3,800');
  });
});
