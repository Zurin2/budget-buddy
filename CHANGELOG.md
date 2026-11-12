# Changelog

All notable changes to Budget Buddy, newest first. Dates are deployment dates.

## 2026-11-12 — Deploy day + mobile polish

Deployed the completed rebuild to production and shipped a round of mobile
responsiveness fixes driven by real-phone testing.

### Deploy & infrastructure

- **Public repo:** https://github.com/Zurin2/budget-buddy (branch `master`,
  commit `d838810` = full initial app, 45 files).
- **Live URL:** https://budget-buddy-ph.vercel.app
- Vercel project linked via `vercel link` (`jose-miguel-esperat-s-projects/budget-buddy`).
- All 3 env vars pushed to production with `node scripts/push-env.cjs production`
  (values live in `.env.local`, never printed or committed).
- Vercel's default **SSO Deployment Protection** disabled with
  `vercel project protection disable budget-buddy --sso` so the site is publicly
  reachable.
- `budget-buddy.vercel.app` was taken (an unrelated old CRA app), so
  `budget-buddy-ph.vercel.app` was claimed and attached as a **project domain**
  via `POST /v9/projects/{projectId}/domains` — it auto-follows every production
  deploy. Do **not** `vercel alias set` per deploy; a manual alias pins to one
  deployment and strands the next release.
- GitHub↔Vercel git integration is NOT connected (CLI got a 403). Until it is
  connected in the dashboard, deploys are CLI-only: `vercel --prod`.

### Chatbot brain fixes (all live in `/api/chat` + libs)

- **Uppercase Gemini schema** — `toGeminiSchema` in `chatLLM.js` converts schema
  types to uppercase; lowercase types make Gemini silently drop
  `action_params.amount` and emit junk params.
- **`walletOf` word-boundary fix** (`botActions.js`) — matches `/\bcash\b/i`
  instead of `includes('cash')`, which previously classified "gcash" as Cash on
  Hand and sent every chat add to the wrong wallet.
- **Transfer phrasing + executor auto-correction** — "transfer 500 X to gcash"
  means X's Cash → GCash; if the model still returns same-category/same-wallet,
  the executor pulls the source from the category's other wallet when it can
  cover the amount.
- **503/429 model fallback chain** (`route.js`) — `GEMINI_MODEL` →
  `gemini-3.6-flash` → `gemini-3.1-flash-lite`, because the lite tier flaps
  under load. `scripts/probe-chat.mjs` reproduces raw model output for debugging.

### Mobile responsiveness (commits `07add82`, `883ec00`, `cbc2126`, `9eb44af`)

- **Burger drawer** (`AppLayout.js` + `Sidebar.js`): below 768px the sidebar is
  replaced by a fixed top bar (burger + logo + title) that opens a slide-in
  drawer with the fully expanded sidebar over a dimmed backdrop; closes on
  backdrop tap or navigation. Desktop ≥768px keeps the collapsible rail.
  Drawer/fade keyframes live in `globals.css`.
- **Horizontal overflow guards**: `min-w-0` on every two-column grid child
  (Home + Budget Planning), quick actions become `grid-cols-1` until the
  `min-[420px]` breakpoint, `min-w-0` + `break-words` on SummaryCards, and a
  page-level guard `html, body { max-width: 100%; overflow-x: clip; }`
  (`clip`, not `hidden`, so sticky positioning still works). Rule of thumb for
  future layouts: grid/flex children default to `min-width:auto` — always put
  `min-w-0` on children and never hard-code `grid-cols-2` for small screens.
- **Full category names**: `CategoryCard` name uses `break-words` instead of
  `truncate`; quick-action button labels wrap too (commit `cbc2126`).
- **Avatar circle removed** (commit `9eb44af`): the letter circle on category
  cards is gone; the name + GCash/Cash balances now use the full card width.

### Still pending (user, dashboard-only)

- Add `https://budget-buddy-ph.vercel.app/**` to Supabase → Authentication →
  URL Configuration (password-reset redirect on production).
- Connect the GitHub repo in Vercel → Project → Settings → Git for
  push-to-deploy.
