'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, Target, CreditCard, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import ChatBot from '@/components/chat/ChatBot';
import { GUIDE_BOT } from '@/components/chat/botConfigs';

// Public landing page — marketing + navigation, no auth, no data.

const FEATURES = [
  {
    icon: Wallet,
    title: 'Track Your Money',
    text: 'Log every peso you add or spend, organized by categories like Groceries, Rent, and Transport.',
  },
  {
    icon: Target,
    title: 'Plan Your Budget',
    text: 'Set a total budget for each wallet and allocate it across your categories.',
  },
  {
    icon: CreditCard,
    title: 'Dual Cash Types',
    text: 'Keep your GCash and Cash on Hand balances separate — the way real money works.',
  },
  {
    icon: Home,
    title: 'Auto-Save & Private',
    text: 'Your data is saved to your own private account and syncs across your devices.',
  },
];

const CTA_LINKS = [
  { href: '/guide', label: 'View Guide', cls: 'bg-white text-blue-700 hover:bg-blue-50' },
  { href: '/home', label: 'Go to Home', cls: 'bg-blue-500 text-white hover:bg-blue-400' },
  { href: '/notes', label: 'Notes', cls: 'bg-blue-500 text-white hover:bg-blue-400' },
  { href: '/budget-planning', label: 'Budget Planning', cls: 'bg-blue-500 text-white hover:bg-blue-400' },
];

export default function Welcome() {
  const router = useRouter();

  // Guide bot on the landing page: answers questions and navigates only.
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Budget Buddy logo" className="mx-auto h-20 w-20 animate-bounce" />
          <h1 className="text-4xl font-bold text-slate-900">Welcome to Budget Tracker</h1>
          <p className="max-w-xl mx-auto text-slate-600">
            Track your money in <span className="font-semibold text-blue-700">GCash</span> and{' '}
            <span className="font-semibold text-green-600">Cash on Hand</span>, category by category —
            with an AI assistant that can do the bookkeeping for you.
          </p>
          <Link
            href="/guide"
            className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Read the Guide - Get Started
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardContent className="flex gap-4 pt-5">
                <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 grid place-items-center shrink-0">
                  <Icon size={20} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA card */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center space-y-5">
          <p className="text-xl font-bold text-white">Ready to take control of your money?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {CTA_LINKS.map(({ href, label, cls }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${cls}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500">
          💡 Tip: start with the Guide, then set a budget on the Budget Planning page.
        </p>
      </div>

      <ChatBot
        {...GUIDE_BOT}
        buildContext={() => ({ current_page: 'Welcome' })}
        onAction={onAction}
      />
    </div>
  );
}
