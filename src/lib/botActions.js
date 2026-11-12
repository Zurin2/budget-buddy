'use client';

import { getSupabase } from '@/utils/supabase/client';
import { createLog } from '@/lib/data';

// The chatbots' hands. Each runXxxAction(action, deps) executes ONE action and
// returns a short human string used as the chat feedback. Every action does its
// own fresh read-modify-write against Supabase, so a batch of sequential
// actions always computes from current balances.

// ── shared helpers ────────────────────────────────────────────────────────

export const toNumber = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const walletOf = (v) =>
  typeof v === 'string' && /\bcash\b/i.test(v) ? 'cash' : 'gcash';

export const fieldOf = (w) => (w === 'cash' ? 'cash_balance' : 'gcash_balance');

export const peso = (v) => `₱${Number(v || 0).toFixed(2)}`;

export const normalize = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[n];
}

export function wordScore(token, word) {
  const t = normalize(token);
  const w = normalize(word);
  if (!t || !w) return 0;
  if (t === w) return 1;
  if (t.length >= 2 && (w.startsWith(t) || t.startsWith(w))) return 0.85;
  if (t.length >= 3 && (w.includes(t) || t.includes(w))) return 0.7;
  const sim = 1 - levenshtein(t, w) / Math.max(t.length, w.length);
  return sim >= 0.6 ? sim * 0.9 : 0;
}

const STOP_WORDS = new Set([
  'add', 'subtract', 'minus', 'less', 'deduct', 'transfer', 'move', 'put', 'send',
  'from', 'to', 'into', 'in', 'on', 'the', 'a', 'an', 'my', 'me', 'some', 'of',
  'for', 'and', 'plus', 'fund', 'funds', 'money', 'budget', 'wallet', 'gcash',
  'cash', 'hand', 'all', 'expense', 'expenses', 'bill', 'bills', 'please',
]);

export function scoreCategory(name, query) {
  const n = normalize(name);
  const q = normalize(query);
  if (!n || !q) return 0;
  if (n === q) return 1;
  if (q.includes(n) || n.includes(q)) return 0.96;
  const tokens = q.split(' ').filter((t) => t && !STOP_WORDS.has(t));
  if (!tokens.length) return 0;
  const words = n.split(' ');
  let best = 0;
  let matched = 0;
  for (const token of tokens) {
    const s = Math.max(...words.map((w) => wordScore(token, w)));
    if (s > 0) matched++;
    best = Math.max(best, s);
  }
  return best * 0.7 + (matched / tokens.length) * 0.3;
}

// Exact normalized match first, else the highest-scoring category at >= 0.6.
export function resolveCategory(list, query) {
  const q = normalize(query);
  if (!q) return null;
  const exact = list.find((c) => normalize(c.name) === q);
  if (exact) return exact;
  let best = null;
  let bestScore = 0;
  for (const c of list) {
    const s = scoreCategory(c.name, query);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

export const categoryList = (list) =>
  list
    .slice(0, 8)
    .map((c) => c.name)
    .join(', ');

export const refreshHome = (qc) => {
  qc.invalidateQueries({ queryKey: ['categories'] });
  qc.invalidateQueries({ queryKey: ['logs'] });
};

export const refreshPlan = (qc) => qc.invalidateQueries({ queryKey: ['budgetPlan'] });

export const refreshNotes = (qc) => qc.invalidateQueries({ queryKey: ['notes'] });

// ── row access ────────────────────────────────────────────────────────────

async function loadCategories() {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    ...row,
    gcash_balance: Number(row.gcash_balance) || 0,
    cash_balance: Number(row.cash_balance) || 0,
  }));
}

async function updateCategory(id, patch) {
  const { data, error } = await getSupabase()
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, gcash_balance: Number(data.gcash_balance) || 0, cash_balance: Number(data.cash_balance) || 0 };
}

const walletLabel = (w) => (w === 'cash' ? 'Cash on Hand' : 'GCash');

// ── Home (Buddy) ──────────────────────────────────────────────────────────

export async function runHomeAction(action, { budgetPlan, queryClient }) {
  const supabase = getSupabase();
  const p = action.params || {};
  const types = {
    add_funds: 'add',
    subtract_funds: 'subtract',
    transfer_funds: 'transfer',
    remove_category: 'remove_category',
    auto_add_from_budget: 'auto_add',
  };

  switch (action.type) {
    case 'add_funds': {
      const name = String(p.category || '').trim();
      if (!name) return 'Which category should I add funds to?';
      const amount = toNumber(p.amount);
      if (amount <= 0) return `How much should I add to ${name}? Give me a peso amount.`;
      const wallet = walletOf(p.cash_type);
      const field = fieldOf(wallet);
      const cats = await loadCategories();
      const cat = resolveCategory(cats, name);
      let previous = 0;
      let categoryName = name;
      if (cat) {
        previous = cat[field];
        categoryName = cat.name;
        await updateCategory(cat.id, { [field]: previous + amount });
      } else {
        const { error } = await supabase.from('categories').insert({ name, [field]: amount });
        if (error) throw new Error(error.message);
      }
      await createLog(
        `Added ${peso(amount)} (${walletLabel(wallet)}) to ${categoryName}`,
        types.add_funds,
        { category_name: categoryName, amount, cash_type: wallet, previous_balance: previous }
      );
      refreshHome(queryClient);
      return `Added ${peso(amount)} to ${categoryName} ${walletLabel(wallet)}.`;
    }

    case 'subtract_funds': {
      const cats = await loadCategories();
      const cat = resolveCategory(cats, p.category);
      if (!cat) {
        return cats.length
          ? `I couldn't find that category. You have: ${categoryList(cats)}.`
          : 'There are no categories yet — add funds first on the Home page.';
      }
      const amount = toNumber(p.amount);
      if (amount <= 0) return `How much should I subtract from ${cat.name}?`;
      const wallet = walletOf(p.cash_type);
      const field = fieldOf(wallet);
      if (amount > cat[field]) {
        return `${cat.name} only has ${peso(cat[field])} in ${walletLabel(wallet)} — I can't subtract ${peso(amount)}.`;
      }
      await updateCategory(cat.id, { [field]: cat[field] - amount });
      await createLog(
        `Subtracted ${peso(amount)} (${walletLabel(wallet)}) from ${cat.name}`,
        types.subtract_funds,
        { category_id: cat.id, category_name: cat.name, amount, cash_type: wallet, previous_balance: cat[field] }
      );
      refreshHome(queryClient);
      return `Subtracted ${peso(amount)} from ${cat.name} ${walletLabel(wallet)}. Now ${peso(cat[field] - amount)}.`;
    }

    case 'transfer_funds': {
      const cats = await loadCategories();
      const to = resolveCategory(cats, p.to_category || p.from_category);
      const from = p.from_category ? resolveCategory(cats, p.from_category) : to;
      if (!from || !to) {
        return cats.length
          ? `I need two categories I can find. You have: ${categoryList(cats)}.`
          : 'There are no categories yet — add funds first on the Home page.';
      }
      let fromWallet = walletOf(p.from_cash_type);
      let toWallet = walletOf(p.to_cash_type);
      // "transfer 3600 commitment to gcash" = wallet-to-wallet inside one
      // category. If the model still set both wallets the same, take the
      // source from the category's other wallet (when it can cover it).
      if (from.id === to.id && fromWallet === toWallet) {
        const other = fromWallet === 'cash' ? 'gcash' : 'cash';
        const otherBal = from[fieldOf(other)];
        if (otherBal > 0) fromWallet = other;
      }
      if (from.id === to.id && fromWallet === toWallet) {
        return 'Source and destination are the same wallet — nothing to move.';
      }
      const amount = toNumber(p.amount);
      if (amount <= 0) return 'How much should I transfer?';
      const fromField = fieldOf(fromWallet);
      if (amount > from[fromField]) {
        return `${from.name} only has ${peso(from[fromField])} in ${walletLabel(fromWallet)} — I can't move ${peso(amount)}.`;
      }
      const toField = fieldOf(toWallet);
      const fromPrev = from[fromField];
      const toPrev = to[toField];
      await updateCategory(from.id, { [fromField]: fromPrev - amount });
      await updateCategory(to.id, { [toField]: toPrev + amount });
      await createLog(
        `Transferred ${peso(amount)}: ${from.name} ${walletLabel(fromWallet)} → ${to.name} ${walletLabel(toWallet)}`,
        types.transfer_funds,
        {
          from_category_id: from.id,
          to_category_id: to.id,
          from_category_name: from.name,
          to_category_name: to.name,
          amount,
          from_cash_type: fromWallet,
          to_cash_type: toWallet,
          from_previous_balance: fromPrev,
          to_previous_balance: toPrev,
        }
      );
      refreshHome(queryClient);
      return `Moved ${peso(amount)} from ${from.name} ${walletLabel(fromWallet)} to ${to.name} ${walletLabel(toWallet)}.`;
    }

    case 'convert_all_to_gcash':
    case 'convert_all_to_cash': {
      const target = action.type === 'convert_all_to_gcash' ? 'gcash' : 'cash';
      const targetField = fieldOf(target);
      const sourceField = fieldOf(target === 'gcash' ? 'cash' : 'gcash');
      const cats = await loadCategories();
      let moved = 0;
      let count = 0;
      for (const cat of cats) {
        const source = cat[sourceField];
        if (source > 0) {
          await updateCategory(cat.id, { [targetField]: cat[targetField] + source, [sourceField]: 0 });
          moved += source;
          count++;
        }
      }
      await createLog(
        `Converted all balances to ${walletLabel(target)} (${count} categories, ${peso(moved)} moved)`,
        'other',
        {}
      );
      refreshHome(queryClient);
      return count
        ? `Moved ${peso(moved)} from ${count} categories into ${walletLabel(target)}.`
        : 'Everything is already in the right wallet — nothing to convert.';
    }

    case 'remove_category': {
      const cats = await loadCategories();
      const cat = resolveCategory(cats, p.category);
      if (!cat) {
        return cats.length
          ? `I couldn't find that category. You have: ${categoryList(cats)}.`
          : 'There are no categories to remove yet.';
      }
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) throw new Error(error.message);
      await createLog(`Removed category ${cat.name}`, types.remove_category, {
        category_name: cat.name,
        gcash_balance: cat.gcash_balance,
        cash_balance: cat.cash_balance,
      });
      refreshHome(queryClient);
      return `Removed ${cat.name} (${peso(cat.gcash_balance + cat.cash_balance)} total). You can undo this in Recent Actions.`;
    }

    case 'clear_all_balances': {
      const { error } = await supabase
        .from('categories')
        .update({ gcash_balance: 0, cash_balance: 0 });
      if (error) throw new Error(error.message);
      await createLog('Cleared all category balances to zero', 'other', {});
      refreshHome(queryClient);
      return 'Cleared every balance to ₱0.00.';
    }

    case 'auto_add_from_budget':
    case 'auto_subtract_from_budget': {
      const isAdd = action.type === 'auto_add_from_budget';
      const { data: freshPlan } = await supabase.from('budget_plans').select('*').maybeSingle();
      const plan = freshPlan || budgetPlan || null;
      const allocations = (plan && plan.allocations) || {};
      const entries = Object.entries(allocations);
      if (!entries.length) {
        return 'There is no budget plan with allocations yet — set one up on the Budget Planning page first.';
      }
      const cats = await loadCategories();
      let count = 0;
      for (const [name, alloc] of entries) {
        const gcashAmt = toNumber(alloc?.gcash);
        const cashAmt = toNumber(alloc?.cash);
        if (gcashAmt <= 0 && cashAmt <= 0) continue;
        let cat = resolveCategory(cats, name);
        if (!cat && isAdd) {
          const { data: created, error } = await supabase
            .from('categories')
            .insert({ name })
            .select()
            .single();
          if (error) throw new Error(error.message);
          cat = { ...created, gcash_balance: 0, cash_balance: 0 };
          cats.push(cat);
        }
        if (!cat) continue;
        const patch = {};
        if (gcashAmt > 0) {
          patch.gcash_balance = isAdd
            ? cat.gcash_balance + gcashAmt
            : Math.max(0, cat.gcash_balance - gcashAmt);
        }
        if (cashAmt > 0) {
          patch.cash_balance = isAdd
            ? cat.cash_balance + cashAmt
            : Math.max(0, cat.cash_balance - cashAmt);
        }
        const updated = await updateCategory(cat.id, patch);
        Object.assign(cat, updated);
        count++;
      }
      await createLog(
        isAdd
          ? `Auto-added budget allocations to ${count} categories`
          : `Auto-subtracted budget allocations from ${count} categories`,
        types[isAdd ? 'auto_add_from_budget' : 'auto_subtract_from_budget'],
        { allocations }
      );
      refreshHome(queryClient);
      return isAdd
        ? `Pushed the budget plan into ${count} categories.`
        : `Subtracted the budget plan from ${count} categories.`;
    }

    default:
      return null;
  }
}

// ── Budget Planning (Planner) ─────────────────────────────────────────────

async function loadPlan() {
  const supabase = getSupabase();
  const { data } = await supabase.from('budget_plans').select('*').maybeSingle();
  if (data) return data;
  const { data: created, error } = await supabase.from('budget_plans').insert({}).select().single();
  if (error) throw new Error(error.message);
  return created;
}

// Resolve a category name against existing allocation keys, keeping the
// original spelling of the stored key.
function resolveAllocationKey(allocations, query) {
  const keys = Object.keys(allocations).map((key) => ({ key }));
  const found = resolveCategory(keys, query);
  if (found) return found.key;
  const name = String(query || '').trim();
  if (!name) return null;
  return normalize(name) ? name : null;
}

export async function runPlanningAction(action, { queryClient }) {
  const supabase = getSupabase();
  const p = action.params || {};

  switch (action.type) {
    case 'set_total_budget': {
      const plan = await loadPlan();
      const wallet = walletOf(p.cash_type);
      const field = wallet === 'cash' ? 'total_cash_budget' : 'total_gcash_budget';
      const amount = toNumber(p.amount);
      if (amount < 0) return 'The budget can\'t be negative.';
      const { error } = await supabase
        .from('budget_plans')
        .update({ [field]: amount })
        .eq('id', plan.id);
      if (error) throw new Error(error.message);
      refreshPlan(queryClient);
      return `Set the ${walletLabel(wallet)} budget to ${peso(amount)}.`;
    }

    case 'allocate': {
      const plan = await loadPlan();
      const wallet = walletOf(p.cash_type);
      const total = wallet === 'cash' ? Number(plan.total_cash_budget) || 0 : Number(plan.total_gcash_budget) || 0;
      if (total <= 0) {
        return `Please set a ${walletLabel(wallet)} budget first — tell me the total, then I can allocate.`;
      }
      const key = resolveAllocationKey(plan.allocations || {}, p.category);
      if (!key) return 'Which category should I allocate to?';
      const amount = toNumber(p.amount);
      if (amount <= 0) return `How much of the ${walletLabel(wallet)} budget goes to ${key}?`;
      const allocations = { ...(plan.allocations || {}) };
      const entry = typeof allocations[key] === 'object' && allocations[key] ? { ...allocations[key] } : {};
      const current = toNumber(entry[wallet]);
      let allocatedForWallet = 0;
      for (const value of Object.values(allocations)) {
        allocatedForWallet += toNumber(value?.[wallet]);
      }
      if (allocatedForWallet - current + amount > total + 0.001) {
        const remaining = Math.max(0, total - (allocatedForWallet - current));
        return `That would exceed the ${walletLabel(wallet)} budget — only ${peso(remaining)} is left unallocated.`;
      }
      allocations[key] = { gcash: toNumber(entry.gcash), cash: toNumber(entry.cash), [wallet]: current + amount };
      const { error } = await supabase
        .from('budget_plans')
        .update({ allocations })
        .eq('id', plan.id);
      if (error) throw new Error(error.message);
      refreshPlan(queryClient);
      return `Allocated ${peso(amount)} of the ${walletLabel(wallet)} budget to ${key}.`;
    }

    case 'remove_allocation': {
      const plan = await loadPlan();
      const allocations = { ...(plan.allocations || {}) };
      const key = resolveAllocationKey(allocations, p.category);
      if (!key || !(key in allocations)) {
        const list = categoryList(Object.keys(allocations).map((k) => ({ name: k })));
        return list
          ? `That allocation doesn't exist. You have: ${list}.`
          : 'There are no allocations to remove yet.';
      }
      delete allocations[key];
      const { error } = await supabase
        .from('budget_plans')
        .update({ allocations })
        .eq('id', plan.id);
      if (error) throw new Error(error.message);
      refreshPlan(queryClient);
      return `Removed the ${key} allocation.`;
    }

    case 'clear_allocations': {
      const plan = await loadPlan();
      const { error } = await supabase
        .from('budget_plans')
        .update({ allocations: {} })
        .eq('id', plan.id);
      if (error) throw new Error(error.message);
      refreshPlan(queryClient);
      return 'Cleared all allocations (totals kept).';
    }

    case 'reset_plan': {
      const plan = await loadPlan();
      const { error } = await supabase
        .from('budget_plans')
        .update({ total_gcash_budget: 0, total_cash_budget: 0, allocations: {} })
        .eq('id', plan.id);
      if (error) throw new Error(error.message);
      refreshPlan(queryClient);
      return 'Reset the plan — totals back to ₱0.00 and allocations cleared.';
    }

    default:
      return null;
  }
}

// ── Notes (Scribble) ──────────────────────────────────────────────────────

export async function runNotesAction(action, { queryClient }) {
  const supabase = getSupabase();
  const p = action.params || {};
  const noteId = String(p.note_id || '').trim();
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId);

  switch (action.type) {
    case 'create_note': {
      const content = String(p.content || '').trim();
      if (!content) return 'What should the note say?';
      const { error } = await supabase.from('notes').insert({ content, pinned: false });
      if (error) throw new Error(error.message);
      refreshNotes(queryClient);
      return 'Noted that down.';
    }

    case 'update_note': {
      if (!uuidLike) return 'Which note should I update? Pick one from the list and I\'ll edit it.';
      const content = String(p.content || '').trim();
      if (!content) return 'What should the new text be?';
      const { data, error } = await supabase
        .from('notes')
        .update({ content })
        .eq('id', noteId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return 'That note id didn\'t match anything — copy it exactly from the list.';
      refreshNotes(queryClient);
      return 'Updated the note.';
    }

    case 'delete_note': {
      if (!uuidLike) return 'Which note should I delete? Pick one from the list and confirm.';
      const { data, error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return 'That note id didn\'t match anything — copy it exactly from the list.';
      refreshNotes(queryClient);
      return 'Deleted the note.';
    }

    case 'pin_note':
    case 'unpin_note': {
      if (!uuidLike) return 'Which note? Pick one from the list and I\'ll pin or unpin it.';
      const pinned = action.type === 'pin_note';
      const { data, error } = await supabase
        .from('notes')
        .update({ pinned })
        .eq('id', noteId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return 'That note id didn\'t match anything — copy it exactly from the list.';
      refreshNotes(queryClient);
      return pinned ? 'Pinned the note.' : 'Unpinned the note.';
    }

    default:
      return null;
  }
}
