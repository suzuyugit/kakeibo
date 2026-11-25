import { db } from './db';
import type { Entry, EntryType, PaymentMethod } from './types';
import { newId } from '../lib/id';

const LAST_PAYMENT_KEY = 'kakeibo.lastPaymentMethod';

/** 前回使った支払い方法（クイック入力の初期値） */
export function lastPaymentMethod(): PaymentMethod {
  try {
    const v = localStorage.getItem(LAST_PAYMENT_KEY);
    if (v === 'cash' || v === 'card' || v === 'paypay' || v === 'bank' || v === 'other') return v;
  } catch {
    // 使えない環境では初期値
  }
  return 'cash';
}

function rememberPaymentMethod(m: PaymentMethod) {
  try {
    localStorage.setItem(LAST_PAYMENT_KEY, m);
  } catch {
    // 覚えられなくても動作に影響はない
  }
}

export type EntryInput = {
  type: EntryType;
  date: string;
  amount: number;
  categoryId: string;
  paymentMethod?: PaymentMethod;
  memo?: string;
};

/** 保存できるかのチェック。問題があればメッセージ */
export function validateEntry(e: Partial<EntryInput>): string | undefined {
  if (!e.amount || !Number.isInteger(e.amount) || e.amount <= 0) return '金額を入れてください';
  if (!e.categoryId) return 'カテゴリを選んでください';
  if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return '日付を選んでください';
  return undefined;
}

/**
 * 記録を保存する（id があれば更新）。
 * - カテゴリの usageCount を +1（新規のとき、または編集でカテゴリを変えたとき）
 * - 収入には支払い方法を持たせない
 * - 固定から自動で作った記録は、編集しても固定の印（recurringId）を残す
 */
export async function saveEntry(input: EntryInput, id?: string, now = new Date().toISOString()): Promise<string> {
  const entryId = id ?? newId();
  await db.transaction('rw', db.entries, db.categories, async () => {
    const prev = id ? await db.entries.get(id) : undefined;
    const e: Entry = {
      ...(prev ?? {}),
      id: entryId,
      type: input.type,
      date: input.date,
      amount: input.amount,
      categoryId: input.categoryId,
      paymentMethod: input.type === 'expense' ? input.paymentMethod : undefined,
      memo: input.memo?.trim() || undefined,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    if (!e.paymentMethod) delete e.paymentMethod;
    if (!e.memo) delete e.memo;
    await db.entries.put(e);
    if (!prev || prev.categoryId !== e.categoryId) {
      await db.categories.where('id').equals(e.categoryId).modify((c) => {
        c.usageCount += 1;
      });
    }
  });
  if (input.type === 'expense' && input.paymentMethod) rememberPaymentMethod(input.paymentMethod);
  return entryId;
}

/**
 * 記録を消す。消したものを返す（「元に戻す」に使う）。
 * 固定から自動で作った記録なら、その月は作り直さないよう skippedMonths に入れる
 */
export async function deleteEntry(id: string): Promise<Entry | undefined> {
  return db.transaction('rw', db.entries, db.recurrings, async () => {
    const e = await db.entries.get(id);
    if (!e) return undefined;
    await db.entries.delete(id);
    if (e.recurringId && e.recurringMonth) {
      const month = e.recurringMonth;
      await db.recurrings.where('id').equals(e.recurringId).modify((r) => {
        if (!r.skippedMonths.includes(month)) r.skippedMonths.push(month);
      });
    }
    return e;
  });
}

/** 消した記録を元に戻す */
export async function restoreEntry(e: Entry): Promise<void> {
  await db.transaction('rw', db.entries, db.recurrings, async () => {
    await db.entries.put(e);
    if (e.recurringId && e.recurringMonth) {
      const month = e.recurringMonth;
      await db.recurrings.where('id').equals(e.recurringId).modify((r) => {
        r.skippedMonths = r.skippedMonths.filter((m) => m !== month);
      });
    }
  });
}
