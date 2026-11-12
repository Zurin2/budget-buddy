'use client';

// One category with both wallet balances, plus an optional remove (×) button.
export default function CategoryCard({ name, gcash_balance = 0, cash_balance = 0, subtitle, onRemove, children }) {
  const total = Number(gcash_balance) + Number(cash_balance);
  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 grid place-items-center shrink-0 font-bold text-sm">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 break-words">{name}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          <span className="text-blue-600 font-medium">GCash: ₱{Number(gcash_balance).toFixed(2)}</span>
          <span className="text-green-600 font-medium">Cash: ₱{Number(cash_balance).toFixed(2)}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-500">Total</p>
        <p className="font-bold text-slate-900">₱{total.toFixed(2)}</p>
      </div>
      {children}
      {onRemove ? (
        <button
          onClick={onRemove}
          title={`Remove ${name}`}
          aria-label={`Remove ${name}`}
          className="w-8 h-8 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors grid place-items-center text-lg font-bold shrink-0"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
