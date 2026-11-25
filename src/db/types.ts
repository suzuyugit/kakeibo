// SPEC.md「データ設計」のとおり。金額はすべて円の整数、日付は YYYY-MM-DD、日時は ISO 文字列。

export type EntryType = 'expense' | 'income';
export type PaymentMethod = 'cash' | 'card' | 'paypay' | 'bank' | 'other';

/** 家計簿の記録（旅行の支出はここに入れず、取り込んだ tripEntries から毎回混ぜる） */
export type Entry = {
  id: string;
  type: EntryType;
  date: string;
  amount: number; // 円（プラスの数）
  categoryId: string;
  paymentMethod?: PaymentMethod; // 支出のとき
  payDate?: string; // 収入のとき、実際に振り込まれる日（例：働いた日の翌月25日）。なければ date の日に入る
  memo?: string;
  recurringId?: string; // 固定の収入・支出から自動で作ったもの
  recurringMonth?: string; // YYYY-MM（カレンダーの月）。二重に作らないため
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  type: EntryType;
  name: string;
  icon: string;
  monthlyBudget?: number; // 支出カテゴリだけ
  hidden?: boolean;
  payDay?: number; // 収入カテゴリだけ：翌月のこの日に振り込まれる（例：○○居酒屋は15日）。なければその日に入る
  payCloseDay?: number; // 収入カテゴリだけ：締め日（1〜28）。なければ月末締め
  usageCount: number;
  order: number;
};

/** 固定の収入・支出（「毎月25日に5万円」） */
export type Recurring = {
  id: string;
  type: EntryType;
  name: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number; // 1〜31。ない日はその月の最終日
  paymentMethod?: PaymentMethod;
  startMonth: string; // YYYY-MM
  endMonth?: string; // 止めた・金額を変えた・終わりの日を決めたとき（この月まで）
  startDate?: string; // 画面で選んだ始まりの日（YYYY-MM-DD）。表示用
  endDate?: string; // 画面で選んだ終わりの日。なければずっと
  skippedMonths: string[]; // 自動で入った記録を消した月
  /** 収入のとき、どの月の分か。'prev' = 前の月の分（バイト代の翌月払いなど）。なければその月の分 */
  payFor?: 'same' | 'prev';
};

export type Settings = {
  key: 'settings';
  monthStartDay: number; // 1〜28
  monthlyBudget?: number; // 全体の予算
  cardPayDay?: number; // カードの引き落とし日（1〜31）。締めた月の翌月のこの日に口座から出る。なければ使った日に減る
  cardCloseDay?: number; // カードの締め日（1〜28）。なければ月末締め
  defaultPayDay?: number; // 収入を「翌月に振込」にするときのいつもの振込日（1〜31）。なければ25日
  defaultPayCloseDay?: number; // そのときのいつもの締め日（1〜28）。なければ月末締め
  savingsAmount?: number; // 入力した貯金の額
  savingsAsOf?: string; // その額がいつの時点の額か（YYYY-MM-DD）
  savingsSetAt?: string; // 貯金を入れた日時（ISO）。入れた日と同じ日の記録は、これより後に記録したものだけ足す
  ledgerExportedAt?: string; // 最後に取り込んだ、たびメモのデータを送った日時
  excludedTripIds?: string[]; // 家計簿で削除した旅行（次に取り込んでも入れない）
  excludedEntryIds?: string[]; // 家計簿で削除した旅行の支出（次に取り込んでも入れない）
};

/** たびメモから取り込んだ旅行（取り込むたびに全部入れ直す） */
export type LedgerTrip = {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
  budgetYen?: number;
  estimateYen: number;
  spentYen: number;
};

/** たびメモから取り込んだ支出（自分の負担分） */
export type LedgerEntry = {
  id: string;
  tripId: string;
  date: string;
  categoryName: string;
  categoryIcon: string;
  myShareYen: number;
  paymentMethod: 'cash' | 'card' | 'paypay' | 'other';
  memo?: string;
};
