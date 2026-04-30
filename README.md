# EZChamp Mini App

The user-facing Telegram Mini App that opens inside Telegram via a `web_app` button on the bot. Talks to Supabase (read/write) through Next.js API routes that verify Telegram `initData` on every call.

## Stack

a- **Next.js 14** (App Router) + TypeScript

- **@telegram-apps/telegram-ui** — native-looking Telegram components
- **@telegram-apps/sdk-react** — `MainButton`, `BackButton`, theme params, haptics
- **@tonconnect/ui-react** — wallet connect modal + `sendTransaction` for stakes
- **TanStack Query** — data fetching, polling
- **Tailwind** — layout / spacing only (component visuals come from telegram-ui)

## Local development

```bash
cd webapp
npm install
cp .env.example .env.local
# fill in:
#   BOT_TOKEN (same as the bot)
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (same as the bot)
#   NEXT_PUBLIC_TONCONNECT_MANIFEST_URL (must be HTTPS, world-reachable)
#   NEXT_PUBLIC_TON_ESCROW_ADDRESS (same as TON_ESCROW_ADDRESS in the bot)
npm run dev
```

You can't fully exercise the app from a desktop browser — Telegram only injects `initData` when the page is opened via a `web_app` button or t.me/<bot>/<app> link inside Telegram. For local testing, use a tunnel (`ngrok http 3000`) and set `WEBAPP_URL` in the bot's `.env` to the public ngrok URL.

## Deploying to Vercel

1. Push the repo to GitHub.
2. In Vercel: **Add New → Project → Import**, point at the repo, set **Root Directory** to `webapp`.
3. Add the same env vars from `.env.example`. Mark `BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` as **Server-only** (default for non-`NEXT_PUBLIC_` vars).
4. Deploy. Note the production URL — that's your `WEBAPP_URL` for the bot.
5. In BotFather: `/mybots → EZChamp → Bot Settings → Menu Button → Configure Menu Button → <Vercel URL>`. (Optional — the bot also sends a `web_app` inline button on `/start`.)
6. Update `tonconnect-manifest.json` (in the repo root, next to the bot's source) so its `url` matches the Vercel domain, and re-host it. Set `NEXT_PUBLIC_TONCONNECT_MANIFEST_URL` accordingly.

## Architecture

```
webapp/src/
├── app/
│   ├── layout.tsx              — root layout, loads telegram-web-app.js
│   ├── page.tsx                — home (game header, post/team/list)
│   ├── onboarding/page.tsx     — wallet connect + game pick
│   ├── post/page.tsx           — post-match wizard with TonConnect payment
│   ├── team/page.tsx           — create / join / view team
│   ├── match/[id]/page.tsx     — match detail, accept, report, dispute
│   └── api/
│       ├── me/                 — GET/PATCH current user
│       ├── games/              — list + per-game rules
│       ├── teams/              — get/create + join via code
│       ├── matches/            — open list, post draft, detail, accept ack, result, dispute
│       ├── my-matches/         — matches involving the caller
│       └── disputes/[id]/evidence — list/add evidence URLs
├── components/
│   ├── Providers.tsx           — TonConnectUI + QueryClient + AppRoot
│   └── ConnectGate.tsx         — auth + wallet sync wrapper
├── hooks/api.ts                — every TanStack Query/Mutation in one file
└── lib/
    ├── auth.ts                 — server-side initData HMAC verification
    ├── supabase.ts             — service-role client
    ├── api-auth.ts             — withAuth() wrapper for route handlers
    ├── api-client.ts           — client fetch helper that injects initData
    ├── nanoid.ts               — invite-code generator (Web Crypto)
    └── ton.ts                  — useSendStake() hook for TON transactions
```

## Auth model

- Every API call must include `X-Telegram-Init-Data: <window.Telegram.WebApp.initData>`.
- The server recomputes `HMAC_SHA256(HMAC_SHA256("WebAppData", BOT_TOKEN), data_check_string)` and compares it to the `hash` field. Forgeries get a 401.
- We also reject `initData` whose `auth_date` is older than 24h.
- The matched `telegram_id` is the only auth fact — we upsert/lookup the user and execute the request as them.

## Payment flow (Mini App path)

1. User confirms a match-post or accept action.
2. `useSendStake()` calls `tonConnectUI.sendTransaction()` with `amount`, escrow address, and a `EZC:<matchId>` text comment.
3. Wallet returns a BOC (the signed message). The webapp shows a "waiting for chain" state.
4. The bot's payment sweeper (running in the bot process) sees the incoming TON on tonapi, matches the comment, and either marks `poster_paid_tx_hash` (post path) or calls the `accept_match` RPC (accept path).
5. Match status flips to `accepted`/live; the webapp's polling query picks it up within a few seconds.

The Mini App never blocks waiting for the chain — it returns to the lobby and shows the match in real time as state advances.

## What's stubbed

- File uploads for dispute evidence (we accept URLs; Supabase Storage upload is a follow-up).
- Admin panel screen (admins use the bot's `/disputes` and `/resolve` commands for now).
- Persisted TON Connect sessions across reloads — handled by `@tonconnect/ui-react` for the user side, but the bot's deeplink path uses an in-memory store (see WHAT_TO_DO.md §2.3).
