# EZChamp — Release Checklist

End-to-end runbook to take the project from local code to "real users wagering TON". Two deployables: the **bot** (long-running Node process) and the **Mini App** (Next.js on Vercel). They share a Supabase project and a TON escrow address.

Work top-down — each step depends on the previous ones.

---

## 0. Pre-flight (do this first)

- [ ] **Rotate leaked credentials.** `.env` was committed to local git history at some point. Before pushing anywhere:
  - BotFather → `/mybots → EZChamp → API Token → Revoke current token` → save the new one.
  - Supabase → Project Settings → API → **Reset service-role key** → save the new one.
  - Update both `.env` files (root for the bot, `webapp/.env.local` for the webapp) with the new values.
- [ ] **Confirm `.gitignore` covers secrets in both packages.** Both `/.gitignore` and `webapp/.gitignore` must exclude `.env`, `.env.local`, `node_modules`, `.next`, `dist`. Run `git ls-files | grep -E '\.env$|node_modules|\.next'` — should return nothing.
- [ ] **Push the cleaned repo.** If your previous push contained the 109MB `next-swc` binary or `.env`, follow the rewrite steps in your git history (orphan-branch trick) before force-pushing.

---

## 1. Supabase

- [ ] Create a Supabase project at https://supabase.com.
- [ ] Copy the credentials into both `.env` files:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never expose to the browser)
  - `SUPABASE_PROJECT_ID` (bot only)
- [ ] Apply the schema:
  ```bash
  # Option A — Supabase CLI
  supabase link --project-ref $SUPABASE_PROJECT_ID
  supabase db push

  # Option B — paste supabase/migrations/0001_initial.sql into the SQL editor
  ```
- [ ] Apply the seed (games + rules):
  ```bash
  psql "$SUPABASE_DB_URL" < supabase/seed.sql
  ```
- [ ] (Optional) regenerate strict types after schema edits: `npm run db:types` from the bot root.

---

## 2. Telegram bot account

- [ ] [@BotFather](https://t.me/BotFather) → `/newbot` → name **EZChamp** → save the token into both `.env` files (`BOT_TOKEN`).
- [ ] BotFather → `/mybots → EZChamp → Bot Settings → Set Description / Set About / Set Botpic`.
- [ ] BotFather → `/mybots → EZChamp → Edit Commands` and paste:
  ```
  start - Connect wallet & pick a game
  menu - Main menu
  help - Help
  ```
  *(Admin commands `/disputes`, `/dispute`, `/resolve` intentionally omitted from the public list.)*

---

## 3. TON Connect manifest

The manifest tells wallets what app is asking to connect. It must be reachable over HTTPS at the URL stored in `TONCONNECT_MANIFEST_URL`.

- [ ] Edit `tonconnect-manifest.json` (repo root): set `url` and `iconUrl` to your real Vercel domain.
- [ ] Host it. Easiest: drop a copy at `webapp/public/tonconnect-manifest.json` so Vercel serves it from `https://<your-vercel>.vercel.app/tonconnect-manifest.json`. Then point both env vars (`TONCONNECT_MANIFEST_URL` for the bot, `NEXT_PUBLIC_TONCONNECT_MANIFEST_URL` for the webapp) at that URL.

---

## 4. TON escrow + tonapi

- [ ] Create a dedicated TON wallet (Tonkeeper / MyTonWallet) — this is the platform escrow that receives stakes. Save its address as `TON_ESCROW_ADDRESS` (bot) and `NEXT_PUBLIC_TON_ESCROW_ADDRESS` (webapp).
- [ ] Decide network: keep `TON_NETWORK=testnet` and `NEXT_PUBLIC_TON_NETWORK=testnet` for the first end-to-end run.
- [ ] Get a tonapi.io API key (free tier) and put it in `TONAPI_KEY`. Without it you'll hit rate limits as soon as you have a few users.

---

## 5. Deploy the Mini App to Vercel

- [ ] Push the repo to GitHub (clean history — see §0).
- [ ] In Vercel: **Add New → Project → Import**, point at the repo, set **Root Directory** to `webapp`.
- [ ] Add env vars from `webapp/.env.example`:
  - Server-only (default): `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TELEGRAM_IDS`
  - Public (must be prefixed `NEXT_PUBLIC_`): `NEXT_PUBLIC_TONCONNECT_MANIFEST_URL`, `NEXT_PUBLIC_TON_ESCROW_ADDRESS`, `NEXT_PUBLIC_TON_NETWORK`, `NEXT_PUBLIC_MIN_STAKE_TON`, `NEXT_PUBLIC_PLATFORM_FEE_BPS`, `NEXT_PUBLIC_RESULT_TIMEOUT_MINUTES`
- [ ] Deploy. Verify build succeeds and the site loads at `https://<project>.vercel.app`.
- [ ] Note the production URL — this is your `WEBAPP_URL` for the bot.

---

## 6. Wire the bot to the Mini App

- [ ] In the bot's `.env`, set `WEBAPP_URL=https://<project>.vercel.app`.
- [ ] BotFather → `/mybots → EZChamp → Bot Settings → Menu Button → Configure menu button → URL` → paste the same Vercel URL. (Optional but recommended — gives users a permanent shortcut next to the message input.)
- [ ] BotFather → `/newapp` → attach to EZChamp → set the Mini App URL to the Vercel URL → set name/short name/description/photo. This enables `t.me/<bot>/<app>` direct links and the "Open App" button in chat headers.
- [ ] Add yourself (and any staff) to `ADMIN_TELEGRAM_IDS` in both `.env` files (your Telegram user ID — find it via [@userinfobot](https://t.me/userinfobot)).

---

## 7. Deploy the bot

The bot is a long-running Node process — Vercel functions don't fit. Pick one:

| Option | Effort | Cost | Notes |
| --- | --- | --- | --- |
| **Railway** | ★ | ~$5/mo | Simplest. Connect repo, set start command `npm start`, paste env vars. |
| **Fly.io** | ★★ | free tier | Add a `fly.toml`, `fly launch`, `fly deploy`. |
| **Hetzner / Vultr VPS + PM2** | ★★ | €4/mo | `pm2 start dist/index.js --name ezchamp && pm2 save && pm2 startup`. |
| **Docker + your favorite host** | ★★★ | varies | Add a Dockerfile (Node 20-alpine, copy, build, `CMD ["node","dist/index.js"]`). |

For all options: **build first** (`npm run build`), then run **`node dist/index.js`**. Set every env var from `.env.example`. Keep `BOT_MODE=polling` for now — webhook mode requires you to also bind an HTTP server (see §10.4).

---

## 8. Smoke test (end-to-end on testnet)

Open the bot in Telegram on your phone and walk the flow:

- [ ] `/start` → tap **🚀 Open EZChamp** → Mini App loads with "Welcome".
- [ ] Tap **Connect TON Wallet** → Tonkeeper/Wallet opens → confirm. Wallet address persists (refresh the app — it should still be linked).
- [ ] Pick a game → home screen shows "no team yet" state.
- [ ] **My team → Create team** → enter name → confirm → invite code is shown.
- [ ] On a second Telegram account: open the bot, `/start`, connect a different wallet, pick same game, **My team → Join via code**, paste the code → success.
- [ ] First account: **Post a match** → fill the wizard → tap pay → wallet prompt → confirm with testnet TON.
- [ ] Watch the bot logs: within ~30s the payment sweeper logs the confirmation. The match appears in the lobby.
- [ ] Second account: open lobby → tap the match → **Accept & Pay** → confirm → again wait ~30s for sweep → status flips to `accepted`.
- [ ] Both accounts: open the match → **We won** / **They won** → if both report the same winner, status → `completed`, payout queued in `transactions` table.
- [ ] Repeat with mismatched results → status → `disputed`. As admin, in the bot: `/disputes` → `/resolve <id> poster` → resolution applied.

If any step hangs more than a couple of minutes, check `transactions` and `matches` in Supabase, plus the bot's stdout.

---

## 9. Production hardening (before mainnet)

These are **not** stubbed — they exist but need attention before real money is involved.

- [ ] **Rate limiting on the webapp.** Add `@upstash/ratelimit` (or similar) to API routes — at minimum on `/api/matches` POST and `/api/teams/join` POST. Per-Telegram-ID limits, e.g. 10 req/min.
- [ ] **Rate limiting on the bot.** Add `@grammyjs/ratelimiter` middleware in `src/bot.ts`.
- [ ] **Structured logging.** Replace `console.log/error` with `pino` and ship to Logflare / Axiom / Better Stack so you can debug live issues.
- [ ] **Error reporting.** Sentry on both the bot and the webapp.
- [ ] **Health checks.** Add `/api/health` to the webapp; a bot endpoint or external uptime ping for the bot process.
- [ ] **Backups.** Supabase makes daily snapshots on paid plans; verify yours are running.

---

## 10. Stubs to implement before launch

These are working stubs the system runs without — but production requires them.

### 10.1 Outbound TON payouts (highest priority)
The bot **records** payouts in the `transactions` table (`type='payout', status='pending'`) but never actually sends TON. To complete the loop:

- [ ] Build a **separate signer process** (not in the bot, not in the webapp) that:
  1. Polls `transactions where type='payout' and status='pending'`.
  2. Sends `amount_ton` from your hot wallet to the winner's `users.wallet_address`.
  3. Marks the row `status='confirmed'` with the resulting `tx_hash`.
- [ ] Use `@ton/ton` `WalletContractV4` for signing. Keys live **outside** the bot/webapp (env var on the signer host or a secrets manager).
- [ ] Daily reconciliation: sum `stake_in - payout - refund` per user; alert on mismatches.

**Why a third process?** The bot has the Supabase service-role key and is exposed to user input. The webapp is on Vercel with HTTP traffic. The signer holds wallet keys — it should accept no inbound traffic.

### 10.2 Supabase Storage for evidence
Today, dispute evidence is just URLs the user pastes. To accept files inside Telegram / inside the Mini App:

- [ ] Supabase: create a private bucket `dispute-evidence`.
- [ ] **Bot**: in `flows/openDispute.ts`, also accept `message:photo`, `message:video`, `message:document` — for each, `await ctx.getFile()` → download via `https://api.telegram.org/file/bot<TOKEN>/<file_path>` → upload to the bucket → store the object path as the evidence URL.
- [ ] **Webapp**: in `match/[id]/page.tsx` dispute modal, add a file input that uploads to the bucket via `db.storage.from('dispute-evidence').upload(...)` and posts the resulting URL to `/api/disputes/[id]/evidence`.
- [ ] Generate signed URLs (5-min expiry) when admins inspect a dispute.

### 10.3 Persistent TON Connect storage (bot deeplink path only)
`src/ton/connect.ts` uses an in-memory `MemoryStore`. After a bot restart, in-flight wallet connections from the bot's `/start` deeplink path are lost. The Mini App path doesn't have this problem — `@tonconnect/ui-react` handles persistence client-side.

- [ ] Add a Supabase table `tonconnect_storage(user_id uuid, key text, value text, primary key(user_id, key))`.
- [ ] Implement an `IStorage` adapter that reads/writes from it.
- [ ] Replace `new MemoryStore()` with the persistent store.

### 10.4 Webhook HTTP server (only if leaving polling)
`index.ts` calls `bot.api.setWebhook(...)` in webhook mode but doesn't bind a server.

- [ ] Pick a host that supports inbound HTTP (Fly, Railway, your VPS).
- [ ] Wrap `bot.handleUpdate(update)` in an HTTP handler that:
  1. Verifies `X-Telegram-Bot-Api-Secret-Token` matches `WEBHOOK_SECRET`.
  2. Returns 200 immediately.
- [ ] Polling is fine for low volume — only switch to webhooks when polling latency becomes a UX problem.

---

## 11. Mainnet cutover

When you're done testing on testnet:

- [ ] Move all stakes off testnet (refund any leftover testnet matches).
- [ ] Flip env vars on both bot and webapp: `TON_NETWORK=mainnet`, `NEXT_PUBLIC_TON_NETWORK=mainnet`.
- [ ] Update `TON_ESCROW_ADDRESS` / `NEXT_PUBLIC_TON_ESCROW_ADDRESS` to your **mainnet** escrow.
- [ ] Re-host `tonconnect-manifest.json` if the URL changed.
- [ ] Sanity-check `MIN_STAKE_TON` and `PLATFORM_FEE_BPS` for production values.
- [ ] **Run §8 smoke test again on mainnet with tiny amounts (e.g. 0.1 TON)** before opening to real users.

---

## 12. Operational runbook

- **Bot crashes / restarts**: open matches and active matches survive (state lives in Supabase). The payment sweeper picks up pending payments on next tick.
- **Dispute backlog**: `/disputes` shows open ones in chronological order. Resolve with `/resolve <prefix> poster|accepter|none [notes]`. `none` cancels the match — refunds go through the (still-to-build) outbound signer.
- **Force-cancel a match**: there's no admin command yet. SQL: `update matches set status='cancelled' where id='...';` then queue refunds manually in `transactions`.
- **Concurrent accept race**: if two users both pay to accept the same match, the second one's stake gets stuck (RPC raises `match_not_open`). Mitigation idea: model a `pending_acceptances(match_id, user_id, expires_at)` table. Low priority for testnet.
- **Refunds for cancelled drafts**: when the sweeper cancels a draft after 30 min, if the user did pay late, their TON sits in escrow. Add a refund routine that scans tonapi for incoming `EZC:<id>` payments to cancelled matches and queues a refund.
