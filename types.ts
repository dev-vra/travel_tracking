export enum ExpenseCategory {
  FOOD = 'Alimentação',
  TRANSPORT = 'Transporte',
  STAY = 'Estadia',
  OTHER = 'Outros',
}

export enum Currency {
  BRL = 'BRL',
  USD = 'USD',
  EUR = 'EUR',
}

export interface Expense {
  id?: string;
  uid: string;
  description: string;
  amount: number;
  currency: Currency;
  date: string;
  category: ExpenseCategory;
  receiptUrl?: string;
  createdAt: number;
}

export interface CategorySummary {
  name: string;
  value: number;
  color: string;
  [key: string]: any;
}

export type ViewState = 'AUTH' | 'DASHBOARD' | 'ADD_EXPENSE';