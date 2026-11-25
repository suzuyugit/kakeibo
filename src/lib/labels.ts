import type { PaymentMethod } from '../db/types';

/**
 * 支払い方法は「即時払い」と「カード（翌月払い）」の2つだけ。
 * 前に記録した現金・PayPay・口座・その他は、どれも即時払いとして扱う（データはそのまま）
 */
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: '即時払い',
  card: 'カード（翌月払い）',
  paypay: '即時払い',
  bank: '即時払い',
  other: '即時払い',
};
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card'];

/** 選ぶボタン用：カードでなければ即時払い（cash）にそろえる */
export function payKind(m: PaymentMethod | undefined): 'cash' | 'card' {
  return m === 'card' ? 'card' : 'cash';
}
