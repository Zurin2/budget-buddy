'use client';

// Minimal shadcn-style primitives used by the pages. Everything is styled with
// literal Tailwind classes so no design-token plumbing is needed.

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-xl bg-white border border-slate-200 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={`p-5 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={`text-base font-semibold text-slate-900 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={`p-5 pt-0 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Button({ variant = 'default', size = 'default', className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40';
  const sizes = { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', icon: 'h-9 w-9' };
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant] || variants.default} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full h-10 rounded-lg bg-white border border-slate-300 px-3 text-sm transition-colors focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 placeholder:text-slate-400 ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm transition-colors focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 placeholder:text-slate-400 ${className}`}
      {...props}
    />
  );
}

export function Label({ className = '', children, ...props }) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5 ${className}`} {...props}>
      {children}
    </label>
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full h-10 rounded-lg bg-white border border-slate-300 px-3 text-sm transition-colors focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/30 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// GCash / Cash on Hand choice — radio group styled as two pill buttons.
export function CashTypeRadio({ value, onChange, name = 'cashType' }) {
  const options = [
    { value: 'gcash', label: 'GCash' },
    { value: 'cash', label: 'Cash on Hand' },
  ];
  return (
    <div className="flex gap-2" role="radiogroup" aria-label="Wallet">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
            value === opt.value
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          data-cash-type={opt.value}
          data-name={name}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
