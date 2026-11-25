import { describe, expect, it } from 'vitest';
import type { Recurring } from '../db/types';
import { addMonths, dateFor, dueEntries, isActive, nextMonthFrom, planSave, planStop } from './recurring';

const r = (extra: Partial<Recurring> = {}): Recurring => ({
  id: 'r', type: 'income', name: 'バイト代', amount: 50000, categoryId: 'in-01-salary', dayOfMonth: 25, startMonth: '2026-09', skippedMonths: [], ...extra,
});

describe('日付', () => {
  it('ない日は月末', () => {
    expect(dateFor('2026-02', 31)).toBe('2026-02-28');
    expect(dateFor('2028-02', 30)).toBe('2028-02-29');
    expect(dateFor('2026-11', 25)).toBe('2026-11-25');
  });
  it('月の足し算と次に入る月', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(nextMonthFrom(25, '2026-11-25')).toBe('2026-11');
    expect(nextMonthFrom(24, '2026-11-25')).toBe('2026-12');
  });
});

describe('自動で入る記録', () => {
  it('何か月も開かなくても、開いた日までの分がまとめて入る', () => {
    const due = dueEntries([r()], new Set(), '2026-11-24', 'now');
    expect(due.map((e) => [e.date, e.recurringMonth])).toEqual([
      ['2026-09-25', '2026-09'],
      ['2026-10-25', '2026-10'],
    ]);
    expect(due[0]).toMatchObject({ id: 'rec-r-2026-09', type: 'income', amount: 50000, memo: 'バイト代', recurringId: 'r' });
    expect(due[0].paymentMethod).toBeUndefined();
  });

  it('その日になったら入る。もうあるもの・消した月・止めたあとは入らない', () => {
    expect(dueEntries([r()], new Set(['r|2026-09']), '2026-11-25').map((e) => e.recurringMonth)).toEqual(['2026-10', '2026-11']);
    expect(dueEntries([r({ skippedMonths: ['2026-10'] })], new Set(), '2026-11-25').map((e) => e.recurringMonth)).toEqual(['2026-09', '2026-11']);
    expect(dueEntries([r({ endMonth: '2026-09' })], new Set(), '2026-11-25').map((e) => e.recurringMonth)).toEqual(['2026-09']);
  });

  it('支出には支払い方法を付ける', () => {
    const e = dueEntries([r({ type: 'expense', paymentMethod: 'card', dayOfMonth: 31, startMonth: '2026-11' })], new Set(), '2026-11-30');
    expect(e[0]).toMatchObject({ date: '2026-11-30', paymentMethod: 'card' });
  });
});

describe('保存・金額を変える・止める', () => {
  let n = 0;
  const id = () => `new${++n}`;
  const input = { type: 'income' as const, name: 'バイト代', amount: 60000, categoryId: 'in-01-salary', dayOfMonth: 25 };

  it('新しく作ると次に入る月から', () => {
    expect(planSave(input, undefined, '2026-11-26', id).add).toMatchObject({ startMonth: '2026-12', amount: 60000 });
    expect(planSave(input, undefined, '2026-11-25', id).add).toMatchObject({ startMonth: '2026-11' });
  });

  it('金額を変えると、今月がもう入っていれば来月から', () => {
    const p = planSave(input, r(), '2026-11-26', id);
    expect(p.update).toMatchObject({ id: 'r', amount: 50000, endMonth: '2026-11' });
    expect(p.add).toMatchObject({ startMonth: '2026-12', amount: 60000 });
  });

  it('今月がまだなら今月から', () => {
    const p = planSave(input, r(), '2026-11-20', id);
    expect(p.update!.endMonth).toBe('2026-10');
    expect(p.add!.startMonth).toBe('2026-11');
  });

  it('金額が同じならそのまま直す。まだ一度も入っていなければそのまま直す', () => {
    expect(planSave({ ...input, amount: 50000, name: '給料' }, r(), '2026-11-26', id)).toEqual({ update: { ...r(), name: '給料' } });
    expect(planSave(input, r({ startMonth: '2026-12' }), '2026-11-26', id).add).toBeUndefined();
  });

  it('今日が入る日なら、今日の分はもう入っているので次の回は来月', () => {
    const p = planSave(input, r(), '2026-11-25', id);
    expect(p.update!.endMonth).toBe('2026-11');
    expect(p.add!.startMonth).toBe('2026-12');
    // 今日作ったばかり（今日の分が入った）の固定でも同じ
    expect(planSave(input, r({ startMonth: '2026-11' }), '2026-11-25', id).add!.startMonth).toBe('2026-12');
    expect(planStop(r({ startMonth: '2026-11' }), '2026-11-25')).toEqual({ update: { ...r({ startMonth: '2026-11' }), endMonth: '2026-11' } });
  });

  it('止める', () => {
    expect(planStop(r(), '2026-11-26')).toEqual({ update: { ...r(), endMonth: '2026-11' } });
    expect(planStop(r(), '2026-11-20')).toEqual({ update: { ...r(), endMonth: '2026-10' } });
    expect(planStop(r({ startMonth: '2026-12' }), '2026-11-26')).toEqual({ remove: 'r' });
    expect(isActive(r({ endMonth: '2026-11' }), '2026-11-26')).toBe(false);
    expect(isActive(r({ endMonth: '2026-11' }), '2026-11-20')).toBe(true);
  });
});
