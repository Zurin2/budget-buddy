# Budget Buddy — working notes

Budget tracker rebuilt from the original Base44 app as Next.js 16 (App Router) +
Supabase (auth, Postgres + RLS) + server-side Gemini chatbot. Deployed on Vercel.

## Commands

- Dev: `npm run dev` (needs `.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI_API_KEY)
- Verify: `npm run lint` then `npm run build` — both must pass before declaring work done
- Schema: run `supabase/schema.sql` once per fresh Supabase project

## Layout

- `src/app/` — routes: `/` (public Welcome), `/home`, `/budget-planning`, `/notes`, `/guide`, auth pages, `/api/chat`
- `src/components/` — AppLayout/Sidebar shell, ui.jsx primitives, AlertMessage, chat/ChatBot + chat/botConfigs
- `src/lib/` — data.js (Supabase reads/inserts), botActions.js (chat action executors + fuzzy category matching), chatLLM.js (server-only Gemini prompt/schema/sanitizer), useUser.js

## Invariants (do not break)

- Chat actions run strictly sequentially; each action re-reads fresh rows from Supabase before mutating.
- UI subtract clamps at 0; chat subtract refuses overdraft — keep both as designed.
- Logs store the *previous* balance so undo restores instead of recomputing; undo deletes the log only after success.
- Ownership is enforced by RLS (user_id default auth.uid()); never add an admin bypass.
- The Gemini key exists only in /api/chat. Never import chatLLM.js from client code.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
