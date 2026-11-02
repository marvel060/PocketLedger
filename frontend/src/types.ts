export type TransactionType = "income" | "expense";

export interface Transaction {
  id: number;
  type: TransactionType;
  amount_minor: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

export interface TransactionPayload {
  type: TransactionType;
  amount_minor: number;
  category: string;
  description: string;
  date: string;
}

export interface CategoryTotal {
  category: string;
  type: TransactionType;
  total_minor: number;
  transaction_count: number;
}

export interface Summary {
  currency: string;
  income_total_minor: number;
  expense_total_minor: number;
  balance_minor: number;
  transaction_count: number;
  by_category: CategoryTotal[];
}

export interface TransactionFilters {
  type: TransactionType | "all";
  category: string;
}

export interface AppConfig {
  apiBaseUrl: string;
  currency: string;
  locale: string;
}
