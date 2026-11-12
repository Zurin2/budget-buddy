'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';

// Floating AI assistant. Replaces the Base44 InvokeLLM call with our own
// /api/chat route (server-side Gemini; the key never reaches the browser).
//
// Props:
//   name / tagline / systemPrompt / suggestions / actionTypes / confirmActions
//   buildContext() → snapshot of the page's live data
//   onAction(action) → executes ONE action, returns a short string (or null)

const normActions = (rawActions, actionTypes) => {
  const allowed = new Set(actionTypes);
  const list = Array.isArray(rawActions) ? rawActions : [];
  return list
    .map((item) => ({
      type: typeof item?.action_type === 'string' ? item.action_type : item?.type,
      params: item?.action_params && typeof item.action_params === 'object' ? item.action_params : item?.params || {},
    }))
    .filter((item) => item.type && allowed.has(item.type));
};

export default function ChatBot({
  name,
  tagline,
  systemPrompt,
  suggestions = [],
  actionTypes = [],
  confirmActions = [],
  buildContext,
  onAction,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  async function runActions(actions) {
    const lines = [];
    for (const action of actions) {
      try {
        const feedback = await onAction(action);
        if (feedback) lines.push(feedback);
      } catch (error) {
        lines.push(`Sorry, that step failed — ${error?.message || 'please try again.'}`);
      }
    }
    return lines;
  }

  function resolveConfirmation(index, approved) {
    setMessages((prev) => {
      const bubble = prev[index];
      if (!bubble || bubble.role !== 'confirm') return prev;
      const next = [...prev];
      if (!approved) {
        next[index] = { role: 'assistant', content: 'Cancelled — nothing was changed.' };
        return next;
      }
      next[index] = { role: 'assistant', content: 'Working on it...' };
      (async () => {
        let content;
        try {
          const lines = await runActions(bubble.actions);
          content = lines.length ? lines.join(' ') : 'Done.';
        } catch (error) {
          content = `Sorry, something went wrong — ${error?.message || 'please try again.'}`;
        }
        setMessages((current) => {
          const copy = [...current];
          copy[index] = { role: 'assistant', content };
          return copy;
        });
      })();
      return next;
    });
  }

  async function send(textOverride) {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || loading) return;
    setInput('');

    const prior = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    const history = [...prior, { role: 'user', content: text }];
    setMessages(history);
    setLoading(true);

    try {
      const transcript = history
        .slice(-8)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          context: buildContext(),
          transcript,
          actionTypes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'The assistant is unreachable right now.');
      }

      const reply = typeof data.reply === 'string' ? data.reply : '';
      const actions = normActions(data.actions, actionTypes);

      if (!actions.length) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || '…' }]);
      } else if (actions.some((a) => confirmActions.includes(a.type))) {
        setMessages((prev) => [...prev, { role: 'confirm', actions, content: reply }]);
      } else {
        const lines = await runActions(actions);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: lines.length ? lines.join(' ') : reply || 'Done.' },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I couldn't reach my brain — ${error?.message || 'please try again.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? `Close ${name}` : `Open ${name}`}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg grid place-items-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm h-[68vh] rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="w-9 h-9 rounded-full bg-white/20 grid place-items-center shrink-0">
              <Bot size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-blue-100 truncate">{tagline}</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 rounded-md hover:bg-white/15">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-3 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 px-1">
                  Hi! I&apos;m {name}. Try one of these:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs rounded-full border border-blue-200 bg-white text-blue-700 px-3 py-1.5 hover:bg-blue-50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === 'confirm') {
                return (
                  <div key={i} className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                    {m.content ? <p className="text-sm text-amber-900">{m.content}</p> : null}
                    <p className="text-xs text-amber-800">
                      This will: {m.actions.map((a) => a.type.replace(/_/g, ' ')).join(', ')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveConfirmation(i, true)}
                        className="rounded-lg bg-amber-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-amber-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => resolveConfirmation(i, false)}
                        className="rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-medium px-3 py-1.5 hover:bg-amber-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <p
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-800 border border-slate-200'
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <p className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-500">
                  Thinking...
                </p>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-slate-200 bg-white p-3 flex gap-2 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to do something..."
              className="flex-1 h-10 rounded-lg bg-white border border-slate-300 px-3 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="h-10 w-10 rounded-lg bg-blue-600 text-white grid place-items-center hover:bg-blue-700 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
