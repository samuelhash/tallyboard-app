import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { IncomeRecord } from '../types';

export function useIncome() {
  const { user, setIncome, addIncomeRecord, removeIncomeRecord, updateIncomeRecord, setIncomeLoading } =
    useAppStore();

  async function fetchIncome() {
    if (!user) return;
    setIncomeLoading(true);
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    setIncomeLoading(false);
    if (!error && data) {
      setIncome(data as IncomeRecord[]);
    }
  }

  async function addIncome(
    record: Omit<IncomeRecord, 'id' | 'user_id' | 'created_at'>
  ) {
    if (!user) return { data: null, error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('income')
      .insert({ ...record, user_id: user.id })
      .select()
      .single();
    if (!error && data) {
      addIncomeRecord(data as IncomeRecord);
    }
    return { data, error };
  }

  async function updateIncome(
    id: string,
    updates: Partial<Omit<IncomeRecord, 'id' | 'user_id' | 'created_at'>>
  ) {
    const { data, error } = await supabase
      .from('income')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      updateIncomeRecord(id, data as IncomeRecord);
    }
    return { data, error };
  }

  async function deleteIncome(id: string) {
    console.log('[deleteIncome] deleting id:', id);
    const { error } = await supabase.from('income').delete().eq('id', id);
    console.log('[deleteIncome] result:', { error });
    if (!error) {
      removeIncomeRecord(id);
    }
    return { error };
  }

  return { fetchIncome, addIncome, updateIncome, deleteIncome };
}
