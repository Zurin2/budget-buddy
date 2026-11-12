'use client';

import Link from 'next/link';

// Slim auth scaffold shared by login / register / forgot-password / reset-password.
export default function AuthCard({ kicker, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-4">
      <div className="max-w-md w-full py-16">
        <header className="text-center mb-8">
          <p className="flex items-center justify-center gap-2 text-3xl font-bold tracking-tight text-blue-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-8 w-8" /> Budget Buddy
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {kicker}
          </p>
        </header>

        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <h1 className="text-2xl font-semibold leading-snug">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{subtitle}</p> : null}
          <div className="mt-5">{children}</div>
        </section>

        {footer ? <footer className="mt-6 text-center text-sm text-slate-500">{footer}</footer> : null}
        <p className="mt-10 text-center text-[11px] text-slate-500">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-slate-900"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function Field({ label, type, value, onChange, placeholder, autoFocus }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required
        className="w-full h-11 rounded-xl bg-white border border-slate-300 px-3.5 text-sm transition-colors focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 placeholder:text-slate-400"
      />
    </label>
  );
}

export function SubmitButton({ busy, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-medium grid place-items-center transition-opacity hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
    >
      {busy ? (
        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
}

export function AuthError({ message, tone = 'error' }) {
  if (!message) return null;
  return (
    <p
      className={`text-xs leading-relaxed px-3 py-2 rounded-lg ${tone === 'error' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}
      role="alert"
    >
      {message}
    </p>
  );
}
