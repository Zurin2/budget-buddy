'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Minus, ArrowLeftRight, Zap, FileDown, ImageDown, Trash2, Eraser,
  ArrowDownToLine, ArrowUpFromLine, Undo2,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import AlertMessage from '@/components/AlertMessage';
import SummaryCards from '@/components/SummaryCards';
import CategoryCard from '@/components/CategoryCard';
import {
  Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, CashTypeRadio,
} from '@/components/ui';
import ChatBot from '@/components/chat/ChatBot';
import { HOME_BOT } from '@/components/chat/botConfigs';
import { useAuthUser, useLogout } from '@/lib/useUser';
import { fetchCategories, fetchLogs, fetchBudgetPlan, createLog } from '@/lib/data';
import { getSupabase } from '@/utils/supabase/client';
import { runHomeAction } from '@/lib/botActions';

const peso = (v) => `₱${Number(v || 0).toFixed(2)}`;

function HomeContent() {
  const user = useAuthUser();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const [addForm, setAddForm] = useState({ category: '', amount: '', cashType: 'gcash' });
  const [subtractForm, setSubtractForm] = useState({ categoryId: '', amount: '', cashType: 'gcash' });
  const [transferForm, setTransferForm] = useState({
    fromCategory: '', toCategory: '', amount: '', fromCashType: 'gcash', toCashType: 'cash',
  });
  const [alert, setAlert] = useState({ type: 'info', message: '' });
  const [busy, setBusy] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: fetchCategories,
    enabled: !!user,
  });
  const logsQuery = useQuery({
    queryKey: ['logs', user?.id],
    queryFn: () => fetchLogs(10),
    enabled: !!user,
  });
  const budgetPlanQuery = useQuery({
    queryKey: ['budgetPlan', user?.id],
    queryFn: fetchBudgetPlan,
    enabled: !!user,
  });

  const categories = categoriesQuery.data || [];
  const logs = logsQuery.data || [];
  const budgetPlan = budgetPlanQuery.data;

  // ── derived values ─────────────────────────────────────────────────────
  const totalGCash = categories.reduce((sum, c) => sum + (Number(c.gcash_balance) || 0), 0);
  const totalCash = categories.reduce((sum, c) => sum + (Number(c.cash_balance) || 0), 0);
  const totalBalance = totalGCash + totalCash;
  const sortedCategories = [...categories].sort(
    (a, b) => b.gcash_balance + b.cash_balance - (a.gcash_balance + a.cash_balance)
  );

  const stats = [
    { label: 'Total Balance', value: peso(totalBalance) },
    { label: 'GCash Balance', value: peso(totalGCash) },
    { label: 'Cash on Hand', value: peso(totalCash) },
    { label: 'Categories', value: String(categories.length) },
    { label: 'Recent Actions', value: String(logs.length) },
  ];

  const show = (type, message) => setAlert({ type, message });
  const onError = (error, fallback) => show('error', error?.message ? `Error: ${error.message}` : fallback);
  const afterWrite = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  };

  const updateCategory = async (id, patch) => {
    const { error } = await getSupabase().from('categories').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  };

  // ── Add Funds ──────────────────────────────────────────────────────────
  const addFunds = useMutation({
    mutationFn: async () => {
      const name = addForm.category.trim();
      const amount = Number(addForm.amount);
      const cashType = addForm.cashType;
      if (!name) throw new Error('Please enter a category name.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter an amount greater than zero.');
      const field = cashType === 'cash' ? 'cash_balance' : 'gcash_balance';
      const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      let previous = 0;
      let categoryName = name;
      if (existing) {
        previous = Number(existing[field]) || 0;
        categoryName = existing.name;
        await updateCategory(existing.id, { [field]: previous + amount });
      } else {
        const { error } = await getSupabase().from('categories').insert({ name, [field]: amount });
        if (error) throw new Error(error.message);
      }
      await createLog(
        `Added ${peso(amount)} (${cashType === 'cash' ? 'Cash on Hand' : 'GCash'}) to ${categoryName}`,
        'add',
        { category_name: categoryName, amount, cash_type: cashType, previous_balance: previous }
      );
    },
    onSuccess: () => {
      afterWrite();
      show('success', 'Funds added.');
      setAddForm({ category: '', amount: '', cashType: addForm.cashType });
    },
    onError,
  });

  // ── Subtract Funds (clamped at zero, never blocked) ────────────────────
  const subtractFunds = useMutation({
    mutationFn: async () => {
      const amount = Number(subtractForm.amount);
      const cashType = subtractForm.cashType;
      const cat = categories.find((c) => c.id === subtractForm.categoryId);
      if (!cat) throw new Error('Please choose a category.');
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter an amount greater than zero.');
      const field = cashType === 'cash' ? 'cash_balance' : 'gcash_balance';
      const previous = Number(cat[field]) || 0;
      await updateCategory(cat.id, { [field]: Math.max(0, previous - amount) });
      await createLog(
        `Subtracted ${peso(amount)} (${cashType === 'cash' ? 'Cash on Hand' : 'GCash'}) from ${cat.name}`,
        'subtract',
        { category_id: cat.id, category_name: cat.name, amount, cash_type: cashType, previous_balance: previous }
      );
    },
    onSuccess: () => {
      afterWrite();
      show('success', 'Funds subtracted.');
      setSubtractForm((f) => ({ ...f, amount: '' }));
    },
    onError,
  });

  // ── Transfer Funds (overdraft blocked) ─────────────────────────────────
  const transferFunds = useMutation({
    mutationFn: async () => {
      const amount = Number(transferForm.amount);
      const { fromCategory, toCategory, fromCashType, toCashType } = transferForm;
      const from = categories.find((c) => c.id === fromCategory);
      const to = categories.find((c) => c.id === toCategory);
      if (!from || !to) throw new Error('Please choose both categories.');
      if (from.id === to.id && fromCashType === toCashType) {
        throw new Error('Source and destination are the same — pick two different wallets or categories.');
      }
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter an amount greater than zero.');
      const fromField = fromCashType === 'cash' ? 'cash_balance' : 'gcash_balance';
      const toField = toCashType === 'cash' ? 'cash_balance' : 'gcash_balance';
      const fromPrev = Number(from[fromField]) || 0;
      const toPrev = Number(to[toField]) || 0;
      if (amount > fromPrev) throw new Error(`${from.name} only has ${peso(fromPrev)} in that wallet.`);
      await updateCategory(from.id, { [fromField]: fromPrev - amount });
      await updateCategory(to.id, { [toField]: toPrev + amount });
      await createLog(
        `Transferred ${peso(amount)}: ${from.name} (${fromCashType === 'cash' ? 'Cash' : 'GCash'}) → ${to.name} (${toCashType === 'cash' ? 'Cash' : 'GCash'})`,
        'transfer',
        {
          from_category_id: from.id,
          to_category_id: to.id,
          from_category_name: from.name,
          to_category_name: to.name,
          amount,
          from_cash_type: fromCashType,
          to_cash_type: toCashType,
          from_previous_balance: fromPrev,
          to_previous_balance: toPrev,
        }
      );
    },
    onSuccess: () => {
      afterWrite();
      show('success', 'Transfer complete.');
      setTransferForm((f) => ({ ...f, amount: '' }));
    },
    onError,
  });

  // ── Quick Actions ──────────────────────────────────────────────────────
  const withPlan = () => {
    if (!budgetPlan) {
      show('warning', 'No budget plan yet — visit the Budget Planning page first.');
      return false;
    }
    const entries = Object.entries(budgetPlan.allocations || {});
    if (!entries.length) {
      show('warning', 'Your budget plan has no allocations yet.');
      return false;
    }
    return entries;
  };

  const ensureCategory = async (name, cats) => {
    let cat = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!cat) {
      const { data, error } = await getSupabase().from('categories').insert({ name }).select().single();
      if (error) throw new Error(error.message);
      cat = { ...data, gcash_balance: 0, cash_balance: 0 };
      cats.push(cat);
    }
    return cat;
  };

  const autoAdd = async () => {
    const entries = withPlan();
    if (!entries) return;
    if (!window.confirm('Push every budget allocation into the tracker?')) return;
    try {
      setBusy('auto-add');
      const cats = [...categories];
      for (const [name, alloc] of entries) {
        const gcash = Number(alloc?.gcash) || 0;
        const cash = Number(alloc?.cash) || 0;
        if (gcash <= 0 && cash <= 0) continue;
        const cat = await ensureCategory(name, cats);
        await updateCategory(cat.id, {
          gcash_balance: (Number(cat.gcash_balance) || 0) + gcash,
          cash_balance: (Number(cat.cash_balance) || 0) + cash,
        });
        cat.gcash_balance += gcash;
        cat.cash_balance += cash;
      }
      await createLog('Auto-added budget plan into the tracker', 'auto_add', {
        allocations: budgetPlan.allocations,
      });
      afterWrite();
      show('success', 'Budget plan pushed into the tracker.');
    } catch (error) {
      onError(error, 'Error running auto-add.');
    } finally {
      setBusy('');
    }
  };

  const autoSubtract = async () => {
    const entries = withPlan();
    if (!entries) return;
    if (!window.confirm('Subtract every budget allocation from the tracker?')) return;
    try {
      setBusy('auto-sub');
      const cats = [...categories];
      for (const [name, alloc] of entries) {
        const gcash = Number(alloc?.gcash) || 0;
        const cash = Number(alloc?.cash) || 0;
        if (gcash <= 0 && cash <= 0) continue;
        const cat = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (!cat) continue;
        await updateCategory(cat.id, {
          gcash_balance: Math.max(0, (Number(cat.gcash_balance) || 0) - gcash),
          cash_balance: Math.max(0, (Number(cat.cash_balance) || 0) - cash),
        });
        cat.gcash_balance = Math.max(0, (Number(cat.gcash_balance) || 0) - gcash);
        cat.cash_balance = Math.max(0, (Number(cat.cash_balance) || 0) - cash);
      }
      await createLog('Auto-subtracted budget plan from the tracker', 'other', {
        allocations: budgetPlan.allocations,
      });
      afterWrite();
      show('success', 'Budget plan subtracted from the tracker.');
    } catch (error) {
      onError(error, 'Error running auto-subtract.');
    } finally {
      setBusy('');
    }
  };

  const convertAll = async (target) => {
    if (!window.confirm(`Move every category's other wallet into ${target === 'gcash' ? 'GCash' : 'Cash on Hand'}?`)) return;
    try {
      setBusy(`convert-${target}`);
      const targetField = target === 'gcash' ? 'gcash_balance' : 'cash_balance';
      const sourceField = target === 'gcash' ? 'cash_balance' : 'gcash_balance';
      for (const cat of categories) {
        const source = Number(cat[sourceField]) || 0;
        if (source > 0) {
          await updateCategory(cat.id, {
            [targetField]: (Number(cat[targetField]) || 0) + source,
            [sourceField]: 0,
          });
        }
      }
      await createLog(
        `Converted all balances to ${target === 'gcash' ? 'GCash' : 'Cash on Hand'}`,
        'other',
        {}
      );
      afterWrite();
      show('success', 'Converted all balances.');
    } catch (error) {
      onError(error, 'Error converting balances.');
    } finally {
      setBusy('');
    }
  };

  const removeZeroBalances = async () => {
    const zeroed = categories.filter((c) => (Number(c.gcash_balance) || 0) + (Number(c.cash_balance) || 0) === 0);
    if (!zeroed.length) {
      show('info', 'No zero-balance categories to remove.');
      return;
    }
    if (!window.confirm(`Remove ${zeroed.length} zero-balance categor${zeroed.length === 1 ? 'y' : 'ies'}?`)) return;
    try {
      setBusy('rm-zero');
      for (const cat of zeroed) {
        const { error } = await getSupabase().from('categories').delete().eq('id', cat.id);
        if (error) throw new Error(error.message);
      }
      await createLog(`Removed ${zeroed.length} zero-balance categories`, 'other', {});
      afterWrite();
      show('success', 'Removed zero-balance categories.');
    } catch (error) {
      onError(error, 'Error removing categories.');
    } finally {
      setBusy('');
    }
  };

  const clearAllBalances = async () => {
    if (!categories.length) return show('info', 'Nothing to clear.');
    if (!window.confirm('Set every balance to ₱0.00?')) return;
    try {
      setBusy('clear');
      const { error } = await getSupabase().from('categories').update({ gcash_balance: 0, cash_balance: 0 });
      if (error) throw new Error(error.message);
      await createLog('Cleared all category balances to zero', 'other', {});
      afterWrite();
      show('success', 'All balances cleared.');
    } catch (error) {
      onError(error, 'Error clearing balances.');
    } finally {
      setBusy('');
    }
  };

  // ── Exports ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    try {
      setBusy('pdf');
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF();
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('Budget Tracker Report', 14, 13);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString(), 14, 21);

      doc.setTextColor(15, 23, 42);
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, 38, 182, 22);
      doc.setFontSize(11);
      doc.text(`Total: ${peso(totalBalance)}`, 20, 46);
      doc.text(`GCash: ${peso(totalGCash)}`, 20, 54);
      doc.text(`Cash on Hand: ${peso(totalCash)}`, 110, 54);

      let y = 70;
      doc.setFontSize(12);
      sortedCategories.forEach((cat) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(37, 99, 235);
        doc.rect(14, y - 6, 2, 14, 'F');
        doc.text(cat.name, 20, y);
        doc.setFontSize(10);
        doc.text(`GCash ${peso(cat.gcash_balance)} | Cash ${peso(cat.cash_balance)} | Total ${peso(Number(cat.gcash_balance) + Number(cat.cash_balance))}`, 20, y + 6);
        doc.setFontSize(12);
        y += 20;
      });
      if (!sortedCategories.length) doc.text('No categories yet.', 20, y);

      doc.save('budget-tracker-report.pdf');
      show('success', 'PDF exported.');
    } catch (error) {
      onError(error, 'Error exporting the PDF.');
    } finally {
      setBusy('');
    }
  };

  const exportPNG = async () => {
    try {
      setBusy('png');
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, { scale: 2, backgroundColor: '#f8fafc' });
      const link = document.createElement('a');
      link.download = 'budget-tracker-screenshot.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      show('success', 'PNG exported.');
    } catch (error) {
      onError(error, 'Error exporting the PNG.');
    } finally {
      setBusy('');
    }
  };

  // ── Remove category ────────────────────────────────────────────────────
  const removeCategory = async (cat) => {
    if (!window.confirm(`Remove ${cat.name} and its balances?`)) return;
    try {
      const { error } = await getSupabase().from('categories').delete().eq('id', cat.id);
      if (error) throw new Error(error.message);
      await createLog(`Removed category ${cat.name}`, 'remove_category', {
        category_name: cat.name,
        gcash_balance: Number(cat.gcash_balance) || 0,
        cash_balance: Number(cat.cash_balance) || 0,
      });
      afterWrite();
      show('success', `Removed ${cat.name}.`);
    } catch (error) {
      onError(error, 'Error removing the category.');
    }
  };

  // ── Undo (restores previous balances; aborts without deleting the log on failure) ──
  const handleUndoAction = async (log) => {
    if (!window.confirm(`Undo: ${log.message}?`)) return;
    const data = log.action_data || {};
    const supabase = getSupabase();
    try {
      setBusy(`undo-${log.id}`);
      switch (log.action_type) {
        case 'add':
        case 'subtract': {
          const field = data.cash_type === 'cash' ? 'cash_balance' : 'gcash_balance';
          const { error } = await supabase
            .from('categories')
            .update({ [field]: Number(data.previous_balance) || 0 })
            .eq('id', data.category_id);
          if (error) throw new Error(error.message);
          break;
        }
        case 'transfer': {
          const fromField = data.from_cash_type === 'cash' ? 'cash_balance' : 'gcash_balance';
          const toField = data.to_cash_type === 'cash' ? 'cash_balance' : 'gcash_balance';
          const { error: e1 } = await supabase
            .from('categories')
            .update({ [fromField]: Number(data.from_previous_balance) || 0 })
            .eq('id', data.from_category_id);
          if (e1) throw new Error(e1.message);
          const { error: e2 } = await supabase
            .from('categories')
            .update({ [toField]: Number(data.to_previous_balance) || 0 })
            .eq('id', data.to_category_id);
          if (e2) throw new Error(e2.message);
          break;
        }
        case 'auto_add': {
          for (const [name, alloc] of Object.entries(data.allocations || {})) {
            const cat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
            if (!cat) continue;
            const { error } = await supabase
              .from('categories')
              .update({
                gcash_balance: Math.max(0, (Number(cat.gcash_balance) || 0) - (Number(alloc?.gcash) || 0)),
                cash_balance: Math.max(0, (Number(cat.cash_balance) || 0) - (Number(alloc?.cash) || 0)),
              })
              .eq('id', cat.id);
            if (error) throw new Error(error.message);
          }
          break;
        }
        case 'remove_category': {
          const { error } = await supabase.from('categories').insert({
            name: data.category_name,
            gcash_balance: Number(data.gcash_balance) || 0,
            cash_balance: Number(data.cash_balance) || 0,
          });
          if (error) throw new Error(error.message);
          break;
        }
        default:
          return; // 'other' entries are not undoable
      }
      const { error: delError } = await supabase.from('action_logs').delete().eq('id', log.id);
      if (delError) throw new Error(delError.message);
      afterWrite();
      show('success', 'Action undone.');
    } catch (error) {
      onError(error, 'Error undoing the action.');
    } finally {
      setBusy('');
    }
  };

  // ── Chatbot ────────────────────────────────────────────────────────────
  const onAction = (action) =>
    runHomeAction(action, { budgetPlan, queryClient });

  const categoryOptions = () =>
    categories.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name} — GCash {peso(c.gcash_balance)} / Cash {peso(c.cash_balance)}
      </option>
    ));

  const quickActions = [
    { key: 'auto-add', icon: ArrowDownToLine, label: 'Auto-Add from Budget Plan', cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200', onClick: autoAdd },
    { key: 'auto-sub', icon: ArrowUpFromLine, label: 'Auto-Subtract from Budget Plan', cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200', onClick: autoSubtract },
    { key: 'convert-gcash', icon: Zap, label: 'Convert All → GCash', cls: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200', onClick: () => convertAll('gcash') },
    { key: 'convert-cash', icon: Zap, label: 'Convert All → Cash', cls: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200', onClick: () => convertAll('cash') },
    { key: 'rm-zero', icon: Trash2, label: 'Remove Zero Balances', cls: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200', onClick: removeZeroBalances },
    { key: 'clear', icon: Eraser, label: 'Clear All Balances', cls: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200', onClick: clearAllBalances },
    { key: 'pdf', icon: FileDown, label: busy === 'pdf' ? 'Exporting...' : 'Export to PDF', cls: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200', onClick: exportPDF },
    { key: 'png', icon: ImageDown, label: busy === 'png' ? 'Exporting...' : 'Export to PNG', cls: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200', onClick: exportPNG },
  ];

  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Home</h1>
          <p className="mt-1 text-slate-600">Track every peso across categories and both wallets.</p>
        </div>

        {categoriesQuery.isLoading ? (
          <div className="grid place-items-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" role="status" />
          </div>
        ) : (
          <>
            <SummaryCards stats={stats} />

            <div className="grid lg:grid-cols-2 gap-6 items-start">
              {/* Left column: forms + quick actions */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Plus size={16} className="text-green-600" /> Add Funds</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Category</Label>
                      <Input
                        value={addForm.category}
                        onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                        placeholder="e.g. Groceries (new or existing)"
                      />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={addForm.amount}
                        onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div>
                      <Label>Wallet</Label>
                      <CashTypeRadio value={addForm.cashType} onChange={(v) => setAddForm((f) => ({ ...f, cashType: v }))} />
                    </div>
                    <Button onClick={() => addFunds.mutate()} disabled={addFunds.isPending} className="w-full">
                      Add Funds
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Minus size={16} className="text-red-600" /> Subtract Funds</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={subtractForm.categoryId}
                        onChange={(e) => setSubtractForm((f) => ({ ...f, categoryId: e.target.value }))}
                      >
                        <option value="">Choose a category...</option>
                        {categoryOptions()}
                      </Select>
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={subtractForm.amount}
                        onChange={(e) => setSubtractForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="e.g. 200"
                      />
                    </div>
                    <div>
                      <Label>Wallet</Label>
                      <CashTypeRadio value={subtractForm.cashType} onChange={(v) => setSubtractForm((f) => ({ ...f, cashType: v }))} />
                    </div>
                    <p className="text-xs text-slate-500">Balance never goes below ₱0.00.</p>
                    <Button onClick={() => subtractFunds.mutate()} disabled={subtractFunds.isPending} className="w-full">
                      Subtract Funds
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ArrowLeftRight size={16} className="text-blue-600" /> Transfer Funds</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>From category</Label>
                        <Select value={transferForm.fromCategory} onChange={(e) => setTransferForm((f) => ({ ...f, fromCategory: e.target.value }))}>
                          <option value="">From...</option>
                          {categoryOptions()}
                        </Select>
                      </div>
                      <div>
                        <Label>To category</Label>
                        <Select value={transferForm.toCategory} onChange={(e) => setTransferForm((f) => ({ ...f, toCategory: e.target.value }))}>
                          <option value="">To...</option>
                          {categoryOptions()}
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="e.g. 300"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>From wallet</Label>
                        <CashTypeRadio value={transferForm.fromCashType} onChange={(v) => setTransferForm((f) => ({ ...f, fromCashType: v }))} />
                      </div>
                      <div>
                        <Label>To wallet</Label>
                        <CashTypeRadio value={transferForm.toCashType} onChange={(v) => setTransferForm((f) => ({ ...f, toCashType: v }))} />
                      </div>
                    </div>
                    <Button onClick={() => transferFunds.mutate()} disabled={transferFunds.isPending} className="w-full">
                      Transfer Funds
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap size={16} className="text-amber-600" /> Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    {quickActions.map(({ key, icon: Icon, label, cls, onClick }) => (
                      <button
                        key={key}
                        onClick={onClick}
                        disabled={!!busy}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium text-left transition-colors disabled:opacity-50 ${cls}`}
                      >
                        <Icon size={14} className="shrink-0" /> {label}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Right column: categories + recent actions */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Categories &amp; Balances</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sortedCategories.length === 0 ? (
                      <p className="text-sm text-slate-500">No categories yet — add funds to create one.</p>
                    ) : (
                      sortedCategories.map((cat) => (
                        <CategoryCard
                          key={cat.id}
                          name={cat.name}
                          gcash_balance={cat.gcash_balance}
                          cash_balance={cat.cash_balance}
                          onRemove={() => removeCategory(cat)}
                        />
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-sm text-slate-500">No actions yet.</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800 truncate">{log.message}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(log.created_at).toLocaleString()} · {log.action_type}
                            </p>
                          </div>
                          {log.action_type !== 'other' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUndoAction(log)}
                              disabled={busy === `undo-${log.id}`}
                              title="Undo"
                            >
                              <Undo2 size={14} /> Undo
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      <AlertMessage
        type={alert.type}
        message={alert.message}
        onClose={() => setAlert({ type: 'info', message: '' })}
      />

      <ChatBot
        {...HOME_BOT}
        buildContext={() => ({
          categories: categories.map((c) => ({
            name: c.name,
            gcash: Number(c.gcash_balance) || 0,
            cash: Number(c.cash_balance) || 0,
          })),
          totals: { gcash: totalGCash, cash: totalCash, total: totalBalance },
          budget_allocations: budgetPlan?.allocations || {},
          recent_actions: logs.slice(0, 5).map((l) => l.message),
        })}
        onAction={onAction}
      />
    </AppLayout>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}
