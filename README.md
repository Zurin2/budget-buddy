# Budget Buddy

A personal finance tracker for the Philippines, rebuilt from the original Base44 app
("Budget Buddy / Budget Tracker") as **Next.js 16 + Supabase + server-side Gemini** —
the same proven stack as riff note ai.

**Live:** https://budget-buddy-ph.vercel.app · **Repo:** https://github.com/Zurin2/budget-buddy

Money is tracked **per category** in **two separate wallets** (`GCash` and
`Cash on Hand`), never mixed. A budget plan sets totals per wallet and allocates
them across categories; allocations can be pushed into the tracker (or pulled out)
in one click. Every money movement is logged with one-click undo. A floating AI
assistant on every page reads the page's live data and performs the page's
operations from natural language.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Public landing page (Welcome) with a navigate-only Guide bot |
| `/home` | Balance tracker: add / subtract / transfer funds, quick actions, exports, recent actions with undo — Buddy bot |
| `/budget-planning` | Set totals per wallet, allocate across categories, progress bar, exports — Planner bot |
| `/notes` | Quick notes with pinning, inline editing, delete — Scribble bot |
| `/guide` | In-app documentation — Guide bot |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Supabase email auth |
| `/api/chat` | Server-only Gemini call for every chatbot (key never reaches the browser) |

## Setup

1. `npm install`
2. Create a fresh Supabase project, run `supabase/schema.sql` once in its SQL Editor
   (creates `categories`, `budget_plans`, `action_logs`, `notes` with owner-only RLS).
3. Copy `.env.example` → `.env.local` and fill in the three keys
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`).
   Use a **new** Gemini key for this app, shared with nothing else.
4. In Supabase → Authentication → URL Configuration, add your dev/deploy URL as a
   redirect target (needed for password-reset links).
5. `npm run dev` → http://localhost:3000

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, "Add New Project" → import the repo (framework auto-detected: Next.js).
3. Add the three env vars in Project → Settings → Environment Variables.
4. Deploy, then add the production domain to the Supabase URL Configuration.
5. Verify: sign up → confirm email → sign in → set a budget → allocate →
   Auto-Add on Home → subtract → undo → export PDF → ask Buddy
   "minus 200 from groceries and add 500 to savings".

## Mobile

Below 768px the sidebar becomes a fixed top bar with a burger button that opens
a slide-in drawer (full nav + logout) over a dimmed backdrop; desktop keeps the
collapsible rail. The page never scrolls horizontally: layout columns carry
`min-w-0`, and `globals.css` enforces `overflow-x: clip` on `html, body`.
Category names always render in full (`break-words`, no truncation).

## Verify locally

```bash
npm run lint
npm run build
```

## Changelog

See `CHANGELOG.md` for dated release notes (deploy, chatbot brain fixes,
mobile responsiveness rounds).

## Documentation

Full architecture, data model and chatbot wiring live in the Obsidian vault:
`40 - Projects → Budget Buddy → Budget Buddy — Budget Tracker (Next.js +
Supabase Rebuild Guide)`.
Keep that note updated whenever a page, entity, or chatbot action changes.
