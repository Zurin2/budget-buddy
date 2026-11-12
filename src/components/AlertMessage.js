'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const TONES = {
  success: { cls: 'bg-green-50 border-green-300 text-green-800', Icon: CheckCircle2 },
  error: { cls: 'bg-red-50 border-red-300 text-red-800', Icon: XCircle },
  warning: { cls: 'bg-amber-50 border-amber-300 text-amber-800', Icon: AlertTriangle },
  info: { cls: 'bg-blue-50 border-blue-300 text-blue-800', Icon: Info },
};

// Auto-dismissing toast. Render fixed top-right; the parent clears `message`
// via onClose (called automatically after ~4s or on click).
export default function AlertMessage({ type = 'info', message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  const { cls, Icon } = TONES[type] || TONES.info;

  return (
    <div className="fixed top-4 right-4 z-50" role="status">
      <button
        onClick={onClose}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm text-left ${cls}`}
      >
        <Icon size={16} className="shrink-0" />
        <span>{message}</span>
      </button>
    </div>
  );
}
