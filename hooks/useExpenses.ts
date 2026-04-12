import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { ExpenseRecord } from '../types';

export function useExpenses() {
  const {
    user,
    setExpenses,
    addExpenseRecord,
    removeExpenseRecord,
    updateExpenseRecord,
    setExpensesLoading,
  } = useAppStore();

  async function fetchExpenses() {
    if (!user) return;
    setExpensesLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    setExpensesLoading(false);
    if (!error && data) {
      setExpenses(data as ExpenseRecord[]);
    }
  }

  async function addExpense(
    record: Omit<ExpenseRecord, 'id' | 'user_id' | 'created_at'>
  ) {
    if (!user) return { data: null, error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...record, user_id: user.id })
      .select()
      .single();
    if (!error && data) {
      addExpenseRecord(data as ExpenseRecord);
    }
    return { data, error };
  }

  async function updateExpense(
    id: string,
    updates: Partial<Omit<ExpenseRecord, 'id' | 'user_id' | 'created_at'>>
  ) {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      updateExpenseRecord(id, data as ExpenseRecord);
    }
    return { data, error };
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      removeExpenseRecord(id);
    }
    return { error };
  }

  return { fetchExpenses, addExpense, updateExpense, deleteExpense };
}
