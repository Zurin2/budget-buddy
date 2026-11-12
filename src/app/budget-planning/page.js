'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileDown, ImageDown, Trash2, RotateCcw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import AlertMessage from '@/components/AlertMessage';
import SummaryCards from '@/components/SummaryCards';
import CategoryCard from '@/components/CategoryCard';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, CashTypeRadio } from '@/components/ui';
import ChatBot from '@/components/chat/ChatBot';
import { PLANNING_BOT } from '@/components/chat/botConfigs';
import { useAuthUser, useLogout } from '@/lib/useUser';
import { fetchOrCreateBudgetPlan } from '@/lib/data';
import { getSupabase } from '@/utils/supabase/client';
import { runPlanningAction } from '@/lib/botActions';

const peso = (v) => `₱${Number(v || 0).toFixed(2)}`;

function BudgetPlanningContent() {
  const user = useAuthUser();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const [budgetForm, setBudgetForm] = useState({ amount: '', cashType: 'gcash' });
  const [allocateForm, setAllocateForm] = useState({ category: '', amount: '', cashType: 'gcash' });
  const [alert, setAlert] = useState({ type: 'info', message: '' });
  const [busy, setBusy] = useState('');

  const planQuery = useQuery({
    queryKey: ['budgetPlan', user?.id],
    queryFn: fetchOrCreateBudgetPlan,
    enabled: !!user,
  });
  const plan = planQuery.data;

  // ── derived values ─────────────────────────────────────────────────────
  const totalGCashBudget = Number(plan?.total_gcash_budget) || 0;
  const totalCashBudget = Number(plan?.total_cash_budget) || 0;
  const totalBudget = totalGCashBudget + totalCashBudget;
  const allocations = plan?.allocations || {};
  const allocatedGCash = Object.values(allocations).reduce((sum, a) => sum + (Number(a?.gcash) || 0), 0);
  const allocatedCash = Object.values(allocations).reduce((sum, a) => sum + (Number(a?.cash) || 0), 0);
  const totalAllocated = allocatedGCash + allocatedCash;
  const remaining = totalBudget - totalAllocated;
  const percentage = totalBudget > 0 ? (totalAllocated / totalBudget) * 100 : 0;
  const sortedAllocations = Object.entries(allocations)
    .map(([name, a]) => ({ name, gcash_balance: Number(a?.gcash) || 0, cash_balance: Number(a?.cash) || 0 }))
    .sort((a, b) => b.gcash_balance + b.cash_balance - (a.gcash_balance + a.cash_balance));

  const stats = [
    { label: 'Total Budget', value: peso(totalBudget) },
    { label: 'GCash Budget', value: peso(totalGCashBudget) },
    { label: 'Cash Budget', value: peso(totalCashBudget) },
    { label: 'Allocated', value: peso(totalAllocated) },
    { label: 'Remaining', value: peso(remaining) },
  ];

  const show = (type, message) => setAlert({ type, message });
  const onError = (error, fallback) => show('error', error?.message ? `Error: ${error.message}` : fallback);

  const setPlan = useMutation({
    mutationFn: async (patch) => {
      const { error } = await getSupabase().from('budget_plans').update(patch).eq('id', plan.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgetPlan'] }),
    onError,
  });

  // ── Set Total Budget (replaces the previous total) ─────────────────────
  const setTotalBudget = () => {
    const amount = Number(budgetForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      show('warning', 'Please enter a valid amount.');
      return;
    }
    setPlan.mutate(
      budgetForm.cashType === 'cash'
        ? { total_cash_budget: amount }
        : { total_gcash_budget: amount }
    );
    show('success', `Total ${budgetForm.cashType === 'cash' ? 'Cash' : 'GCash'} budget set to ${peso(amount)}.`);
    setBudgetForm((f) => ({ ...f, amount: '' }));
  };

  // ── Allocate Budget ────────────────────────────────────────────────────
  const allocateBudget = () => {
    const name = allocateForm.category.trim();
    const amount = Number(allocateForm.amount);
    const cashType = allocateForm.cashType;
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      show('warning', 'Please enter a category name and an amount.');
      return;
    }
    const walletTotal = cashType === 'cash' ? totalCashBudget : totalGCashBudget;
    if (walletTotal <= 0) {
      show('warning', `Please set a ${cashType === 'cash' ? 'Cash' : 'GCash'} budget first!`);
      return;
    }
    const existing = allocations[name] || {};
    const currentForType = Number(existing[cashType]) || 0;
    const allocatedForWallet =
      cashType === 'cash'
        ? allocatedCash
        : allocatedGCash;
    if (allocatedForWallet - currentForType + amount > walletTotal + 0.001) {
      const left = Math.max(0, walletTotal - (allocatedForWallet - currentForType));
      show('warning', `That exceeds the ${cashType === 'cash' ? 'Cash' : 'GCash'} budget — ${peso(left)} remaining for this wallet.`);
      return;
    }
    const nextAllocations = {
      ...allocations,
      [name]: { gcash: Number(existing.gcash) || 0, cash: Number(existing.cash) || 0, [cashType]: currentForType + amount },
    };
    setPlan.mutate({ allocations: nextAllocations });
    show('success', `Allocated ${peso(amount)} to ${name} (${cashType === 'cash' ? 'Cash' : 'GCash'}).`);
    setAllocateForm((f) => ({ ...f, category: '', amount: '' }));
  };

  const removeAllocation = (name) => {
    if (!window.confirm(`Remove the allocation for ${name}?`)) return;
    const next = { ...allocations };
    delete next[name];
    setPlan.mutate({ allocations: next });
    show('success', `Removed the ${name} allocation.`);
  };

  const clearAllAllocations = () => {
    if (!window.confirm('Clear all allocations? (Totals are kept.)')) return;
    setPlan.mutate({ allocations: {} });
    show('success', 'Cleared all allocations.');
  };

  const resetPlan = () => {
    if (!window.confirm('Reset the budget plan? Totals go to ₱0.00 and allocations are cleared.')) return;
    setPlan.mutate({ total_gcash_budget: 0, total_cash_budget: 0, allocations: {} });
    show('success', 'Budget plan reset.');
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
      doc.text('Budget Planning Report', 14, 13);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString(), 14, 21);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      let y = 40;
      doc.text(`Total Budget: ${peso(totalBudget)}`, 14, y);
      doc.text(`GCash Budget: ${peso(totalGCashBudget)}`, 14, y + 7);
      doc.text(`Cash Budget: ${peso(totalCashBudget)}`, 14, y + 14);
      y += 24;
      doc.text(`Allocated: ${peso(totalAllocated)}  (${percentage.toFixed(1)}%)`, 14, y);
      doc.text(`Remaining: ${peso(remaining)}`, 14, y + 7);
      y += 20;

      doc.setDrawColor(37, 99, 235);
      doc.setFillColor(percentage > 100 ? 220 : 240, percentage > 100 ? 38 : 246, percentage > 100 ? 38 : 249);
      doc.rect(14, y, 180, 6, 'FD');
      doc.setFillColor(255, 255, 255);
      doc.rect(14 + Math.min(percentage, 100) * 1.8, y, 180 - Math.min(percentage, 100) * 1.8, 6, 'F');
      y += 14;

      doc.setFontSize(11);
      sortedAllocations.forEach(({ name, gcash_balance, cash_balance }) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(37, 99, 235);
        doc.rect(14, y - 4, 2, 12, 'F');
        doc.setTextColor(15, 23, 42);
        doc.text(`${name} — GCash ${peso(gcash_balance)} | Cash ${peso(cash_balance)}`, 20, y + 3);
        y += 14;
      });
      if (!sortedAllocations.length) doc.text('No allocations yet.', 20, y + 3);

      doc.save('budget-planning-report.pdf');
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
      link.download = 'budget-planning-screenshot.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      show('success', 'PNG exported.');
    } catch (error) {
      onError(error, 'Error exporting the PNG.');
    } finally {
      setBusy('');
    }
  };

  // ── Chatbot ────────────────────────────────────────────────────────────
  const onAction = (action) => runPlanningAction(action, { queryClient });

  const barColor = percentage > 100 ? 'bg-red-600' : percentage === 100 ? 'bg-green-600' : 'bg-blue-600';
  const barLabel =
    totalBudget <= 0
      ? 'Set a total budget to begin'
      : percentage > 100
        ? `Over budget by ${peso(Math.abs(remaining))}`
        : `${percentage.toFixed(1)}% allocated (${peso(totalAllocated)} / ${peso(totalBudget)})`;

  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Budget Planning</h1>
          <p className="mt-1 text-slate-600">Set a total per wallet, then allocate it across categories.</p>
        </div>

        {planQuery.isLoading ? (
          <div className="grid place-items-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" role="status" />
          </div>
        ) : (
          <>
            <SummaryCards stats={stats} />

            <div className="grid lg:grid-cols-2 gap-6 items-start">
              {/* Left column: forms */}
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Set Total Budget</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={budgetForm.amount}
                        onChange={(e) => setBudgetForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="e.g. 10000"
                      />
                    </div>
                    <div>
                      <Label>Wallet</Label>
                      <CashTypeRadio
                        value={budgetForm.cashType}
                        onChange={(v) => setBudgetForm((f) => ({ ...f, cashType: v }))}
                      />
                    </div>
                    <p className="text-xs text-slate-500">Setting this replaces the previous total for that wallet.</p>
                    <Button onClick={setTotalBudget} disabled={setPlan.isPending} className="w-full">
                      Set Budget
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Allocate Budget</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Category</Label>
                      <Input
                        value={allocateForm.category}
                        onChange={(e) => setAllocateForm((f) => ({ ...f, category: e.target.value }))}
                        placeholder="e.g. Groceries (free text)"
                      />
                    </div>
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={allocateForm.amount}
                        onChange={(e) => setAllocateForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="e.g. 3000"
                      />
                    </div>
                    <div>
                      <Label>Wallet</Label>
                      <CashTypeRadio
                        value={allocateForm.cashType}
                        onChange={(v) => setAllocateForm((f) => ({ ...f, cashType: v }))}
                      />
                    </div>
                    <Button onClick={allocateBudget} disabled={setPlan.isPending} className="w-full">
                      Allocate
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right column: progress + allocations */}
              <div className="min-w-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                    <p className={`text-sm font-medium ${percentage > 100 ? 'text-red-600' : 'text-slate-600'}`}>{barLabel}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={exportPDF} disabled={!!busy}>
                        <FileDown size={14} /> {busy === 'pdf' ? 'Exporting...' : 'Export PDF'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportPNG} disabled={!!busy}>
                        <ImageDown size={14} /> {busy === 'png' ? 'Exporting...' : 'Export PNG'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={clearAllAllocations}>
                        <Trash2 size={14} /> Clear All Allocations
                      </Button>
                      <Button size="sm" variant="destructive" onClick={resetPlan}>
                        <RotateCcw size={14} /> Reset Budget Plan
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Allocations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sortedAllocations.length === 0 ? (
                      <p className="text-sm text-slate-500">No allocations yet — set a total budget, then allocate.</p>
                    ) : (
                      sortedAllocations.map((alloc) => (
                        <CategoryCard
                          key={alloc.name}
                          name={alloc.name}
                          gcash_balance={alloc.gcash_balance}
                          cash_balance={alloc.cash_balance}
                          onRemove={() => removeAllocation(alloc.name)}
                        />
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
        {...PLANNING_BOT}
        buildContext={() => ({
          total_gcash_budget: totalGCashBudget,
          total_cash_budget: totalCashBudget,
          total_allocated: totalAllocated,
          remaining,
          allocations,
        })}
        onAction={onAction}
      />
    </AppLayout>
  );
}

export default function BudgetPlanningPage() {
  return (
    <ProtectedRoute>
      <BudgetPlanningContent />
    </ProtectedRoute>
  );
}
