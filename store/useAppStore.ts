import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { IncomeRecord, ExpenseRecord } from '../types';

interface AppState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  income: IncomeRecord[];
  incomeLoading: boolean;
  expenses: ExpenseRecord[];
  expensesLoading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setIncome: (income: IncomeRecord[]) => void;
  setIncomeLoading: (loading: boolean) => void;
  addIncomeRecord: (record: IncomeRecord) => void;
  removeIncomeRecord: (id: string) => void;
  updateIncomeRecord: (id: string, updates: Partial<IncomeRecord>) => void;
  setExpenses: (expenses: ExpenseRecord[]) => void;
  setExpensesLoading: (loading: boolean) => void;
  addExpenseRecord: (record: ExpenseRecord) => void;
  removeExpenseRecord: (id: string) => void;
  updateExpenseRecord: (id: string, updates: Partial<ExpenseRecord>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  income: [],
  incomeLoading: false,
  expenses: [],
  expensesLoading: false,
  setSession: (session) =>
    set({ session, user: session?.user ?? null }),
  setLoading: (isLoading) => set({ isLoading }),
  setIncome: (income) => set({ income }),
  setIncomeLoading: (incomeLoading) => set({ incomeLoading }),
  addIncomeRecord: (record) =>
    set((state) => ({
      income: [record, ...state.income].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    })),
  removeIncomeRecord: (id) =>
    set((state) => ({ income: state.income.filter((r) => r.id !== id) })),
  updateIncomeRecord: (id, updates) =>
    set((state) => ({
      income: state.income
        .map((r) => (r.id === id ? { ...r, ...updates } : r))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    })),
  setExpenses: (expenses) => set({ expenses }),
  setExpensesLoading: (expensesLoading) => set({ expensesLoading }),
  addExpenseRecord: (record) =>
    set((state) => ({
      expenses: [record, ...state.expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    })),
  removeExpenseRecord: (id) =>
    set((state) => ({ expenses: state.expenses.filter((r) => r.id !== id) })),
  updateExpenseRecord: (id, updates) =>
    set((state) => ({
      expenses: state.expenses
        .map((r) => (r.id === id ? { ...r, ...updates } : r))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    })),
}));
