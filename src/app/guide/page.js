'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import ChatBot from '@/components/chat/ChatBot';
import { GUIDE_BOT } from '@/components/chat/botConfigs';
import { useAuthUser, useLogout } from '@/lib/useUser';

const TIPS = [
  { cls: 'bg-blue-50 text-blue-800', title: 'Start with a plan', text: 'Set your total budget on the Budget Planning page before logging money — the Auto-Add action pushes the plan straight into the tracker.' },
  { cls: 'bg-green-50 text-green-800', title: 'Use descriptive category names', text: '"Groceries", "Transport", "Load & Data" — names you will recognize later, and that the AI assistant can match.' },
  { cls: 'bg-amber-50 text-amber-800', title: 'Use Auto-Save', text: 'After allocating your budget, one click on Auto-Add moves every allocation into your wallet balances.' },
  { cls: 'bg-purple-50 text-purple-800', title: 'Review regularly', text: 'Check Recent Actions at the bottom of Home. Made a mistake? One click on Undo restores the previous balance.' },
  { cls: 'bg-red-50 text-red-800', title: 'The app will not stop you', text: 'You can subtract more than you have — subtracting is clamped at zero rather than blocked. The AI assistant is stricter: it refuses overdrafts.' },
];

function GuideContent() {
  const user = useAuthUser();
  const logout = useLogout();
  const router = useRouter();

  const onAction = async (action) => {
    if (action.type !== 'navigate') return null;
    const map = {
      Home: { href: '/home', label: 'Home' },
      BudgetPlanning: { href: '/budget-planning', label: 'Budget Planning' },
      Notes: { href: '/notes', label: 'Notes' },
    };
    const target = map[action.params?.page];
    if (!target) return "I can only jump to Home, Budget Planning or Notes.";
    router.push(target.href);
    return `Opening ${target.label}.`;
  };

  return (
    <AppLayout user={user} onLogout={logout}>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Guide</h1>
          <p className="mt-1 text-slate-600">Everything you need to run your budget in one page.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>👋 Welcome</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 leading-relaxed">
            Budget Buddy tracks your money <strong>per category</strong> (Groceries, Rent, Transport, …)
            in <strong>two separate wallets</strong>: GCash (digital) and Cash on Hand (physical). They
            are never mixed implicitly — every peso lives in one category and one wallet.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💳 Understanding Cash Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="font-semibold text-blue-700">GCash</p>
              <p className="text-blue-800/80">Digital money — online transfers, QR payments, and wallet top-ups.</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 p-4">
              <p className="font-semibold text-green-700">Cash on Hand</p>
              <p className="text-green-800/80">Physical money in your pocket — jeepney fares, market runs, sari-sari purchases.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🏠 Home Page</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p><strong>1. Add Funds</strong> — put money into a category. Type a new name and the category is created for you.</p>
            <p><strong>2. Subtract Funds</strong> — take money out. Subtraction clamps at ₱0.00; it never goes negative.</p>
            <p><strong>3. Transfer Funds</strong> — move money between two categories, or between GCash and Cash inside one category.</p>
            <p><strong>4. Quick Actions</strong> — auto-add / auto-subtract your whole budget plan, convert all balances to one wallet, remove zero-balance categories, clear everything, or export a PDF/PNG report.</p>
            <p>Every movement lands in <strong>Recent Actions</strong> with a one-click <strong>Undo</strong>.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🎯 Budget Planning</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p><strong>Set Total Budget</strong> — the total you plan to spend per wallet. Setting it replaces the previous total.</p>
            <p><strong>Allocate</strong> — divide the total across categories. Allocations can never exceed the wallet total.</p>
            <p><strong>Track Progress</strong> — the progress bar turns green at exactly 100% and red when over-budget.</p>
            <p><strong>Export & Reset</strong> — download a PDF/PNG report, clear all allocations, or reset the whole plan.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💡 Tips &amp; Best Practices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {TIPS.map((tip) => (
              <div key={tip.title} className={`rounded-lg p-4 text-sm ${tip.cls}`}>
                <p className="font-semibold">{tip.title}</p>
                <p className="mt-0.5 opacity-90">{tip.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🚀 Quick Start Guide</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p><strong>1.</strong> Go to <strong>Budget Planning</strong> and set your total budget (e.g. ₱10,000 GCash).</p>
            <p><strong>2.</strong> Allocate it across categories (e.g. ₱4,000 Groceries, ₱2,000 Transport).</p>
            <p><strong>3.</strong> On <strong>Home</strong>, click <strong>Auto-Add from Budget Plan</strong> to push the allocations into your balances.</p>
            <p><strong>4.</strong> As you spend, use <strong>Subtract Funds</strong> — or just ask Buddy: <em>&quot;minus 200 from groceries&quot;</em>.</p>
            <p><strong>5.</strong> Export a PDF report anytime, and jot down plans in <strong>Notes</strong>.</p>
          </CardContent>
        </Card>
      </div>

      <ChatBot
        {...GUIDE_BOT}
        buildContext={() => ({ current_page: 'Guide' })}
        onAction={onAction}
      />
    </AppLayout>
  );
}

export default function GuidePage() {
  return (
    <ProtectedRoute>
      <GuideContent />
    </ProtectedRoute>
  );
}
