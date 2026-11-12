'use client';

// Responsive grid of { label, value } stat cards.
export default function SummaryCards({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl bg-white border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
          <p className="mt-1.5 text-xl font-bold text-slate-900 break-words">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
