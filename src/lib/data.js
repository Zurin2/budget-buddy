'use client';

import { getSupabase } from '@/utils/supabase/client';

// Thin data layer over the Supabase tables. Replaces the Base44 entities
// (Category / BudgetPlan / ActionLog / Note). Ownership is enforced by RLS,
// so no created_by filtering is needed here.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function fetchCategories() {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    ...row,
    gcash_balance: num(row.gcash_balance),
    cash_balance: num(row.cash_balance),
  }));
}

export async function fetchLogs(limit = 10) {
  const { data, error } = await getSupabase()
    .from('action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchBudgetPlan() {
  const { data, error } = await getSupabase().from('budget_plans').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    total_gcash_budget: num(data.total_gcash_budget),
    total_cash_budget: num(data.total_cash_budget),
    allocations: data.allocations && typeof data.allocations === 'object' ? data.allocations : {},
  };
}

// BudgetPlanning always needs a document to update: create it lazily on first visit.
export async function fetchOrCreateBudgetPlan() {
  const existing = await fetchBudgetPlan();
  if (existing) return existing;
  const { data, error } = await getSupabase().from('budget_plans').insert({}).select().single();
  if (error) throw new Error(error.message);
  return { ...data, total_gcash_budget: 0, total_cash_budget: 0, allocations: {} };
}

export async function fetchNotes() {
  const { data, error } = await getSupabase()
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

// Every money movement lands here so Recent Actions can undo it.
export async function createLog(message, action_type, action_data = {}) {
  const supabase = getSupabase();
  const { error } = await supabase.from('action_logs').insert({
    message,
    action_type,
    action_data,
  });
  if (error) throw new Error(error.message);
}
