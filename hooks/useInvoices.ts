import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { InvoiceRecord, InvoiceStatus } from '../types';

export function useInvoices() {
  const {
    user,
    setInvoices,
    addInvoiceRecord,
    removeInvoiceRecord,
    updateInvoiceRecord,
    setInvoicesLoading,
  } = useAppStore();

  async function fetchInvoices() {
    if (!user) return;
    setInvoicesLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('issued_date', { ascending: false })
      .order('created_at', { ascending: false });
    setInvoicesLoading(false);
    if (!error && data) {
      const records = data as InvoiceRecord[];
      // Auto-mark pending invoices as overdue if due_date is in the past
      const today = new Date().toISOString().split('T')[0];
      const toMarkOverdue = records.filter(
        (r) => r.status === 'pending' && r.due_date && r.due_date < today
      );
      if (toMarkOverdue.length > 0) {
        // Batch update in Supabase
        await supabase
          .from('invoices')
          .update({ status: 'overdue' })
          .in(
            'id',
            toMarkOverdue.map((r) => r.id)
          );
        // Apply locally too
        const updated = records.map((r) =>
          toMarkOverdue.some((o) => o.id === r.id) ? { ...r, status: 'overdue' as InvoiceStatus } : r
        );
        setInvoices(updated);
      } else {
        setInvoices(records);
      }
    }
  }

  async function addInvoice(
    record: Omit<InvoiceRecord, 'id' | 'user_id' | 'created_at'>
  ) {
    if (!user) return { data: null, error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('invoices')
      .insert({ ...record, user_id: user.id })
      .select()
      .single();
    if (!error && data) {
      addInvoiceRecord(data as InvoiceRecord);
    }
    return { data, error };
  }

  async function updateInvoice(
    id: string,
    updates: Partial<Omit<InvoiceRecord, 'id' | 'user_id' | 'created_at'>>
  ) {
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      updateInvoiceRecord(id, data as InvoiceRecord);
    }
    return { data, error };
  }

  async function deleteInvoice(id: string) {
    console.log('[deleteInvoice] deleting id:', id);
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    console.log('[deleteInvoice] result — error:', error);
    if (!error) {
      removeInvoiceRecord(id);
    }
    return { error };
  }

  async function markAsPaid(id: string) {
    const today = new Date().toISOString().split('T')[0];
    return updateInvoice(id, { status: 'paid', paid_date: today });
  }

  return { fetchInvoices, addInvoice, updateInvoice, deleteInvoice, markAsPaid };
}
