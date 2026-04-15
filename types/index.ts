export interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
}

export interface IncomeRecord {
  id: string;
  user_id: string;
  amount: number;
  platform: string;
  category: string;
  date: string; // YYYY-MM-DD
  description?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
}

export interface ExpenseRecord {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  receipt_url?: string;
  is_recurring: boolean;
  created_at: string;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  period: 'month' | 'quarter' | 'year';
}

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceRecord {
  id: string;
  user_id: string;
  brand_name: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issued_date: string; // YYYY-MM-DD
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
}
