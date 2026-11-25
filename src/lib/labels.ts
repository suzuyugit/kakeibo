import type { PaymentMethod } from '../db/types';

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: '現金',
  card: 'カード',
  paypay: 'PayPay',
  bank: '口座',
  other: 'その他',
};
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'paypay', 'bank', 'other'];
