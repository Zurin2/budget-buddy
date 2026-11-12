# Budget Buddy

A personal finance tracker for the Philippines, rebuilt from the original Base44 app
("Budget Buddy / Budget Tracker") as **Next.js 16 + Supabase + server-side Gemini** —
the same proven stack as riff note ai. Deployed on Vercel.

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

## Verify locally

```bash
npm run lint
npm run build
```

## Documentation

Full architecture, data model and chatbot wiring live in the Obsidian vault:
`40 - Projects → Web & Full-Stack Architecture → Budget Buddy — Rebuild Guide`.
Keep that note updated whenever a page, entity, or chatbot action changes.
