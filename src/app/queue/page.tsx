"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import {
  useCancelQueueEntry,
  useConfirmQueuePayment,
  useGames,
  useJoinQueue,
  useMe,
  useMyQueueEntry,
  useRules,
  useTeam,
} from "@/hooks/api";
import { useSendEntryFee, ENTRY_FEE_TON, ESCROW, NETWORK } from "@/lib/ton";
import { gameVisual } from "@/lib/games-meta";

const PLAYER_OPTIONS = [1, 2, 3, 5];
const BEST_OF_OPTIONS = [1, 3, 5, 7];

export default function QueuePage() {
  return (
    <ConnectGate>
      <AppShell title="Find Match" showBack>
        <Queue />
      </AppShell>
    </ConnectGate>
  );
}

function Queue() {
  const me = useMe();
  const games = useGames();
  const gameId = me.data?.current_game_id ?? null;
  const team = useTeam(gameId);
  const rules = useRules(gameId);
  const router = useRouter();

  const myEntry = useMyQueueEntry();
  const join = useJoinQueue();
  const confirm = useConfirmQueuePayment();
  const cancel = useCancelQueueEntry();
  const sendFee = useSendEntryFee();

  const [ruleId, setRuleId] = useState<string | null>(null);
  const [players, setPlayers] = useState<number>(2);
  const [bestOf, setBestOf] = useState<number>(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Once matched, jump straight to the match page.
  useEffect(() => {
    if (myEntry.data?.status === "matched" && myEntry.data.match_id) {
      router.replace(`/match/${myEntry.data.match_id}`);
    }
  }, [myEntry.data?.status, myEntry.data?.match_id, router]);

  if (!gameId) {
    return (
      <Card>
        <p className="text-white/70 text-center">Pick a game from the lobby first.</p>
        <button onClick={() => router.push("/")} className="btn-neon mt-4">Lobby</button>
      </Card>
    );
  }
  if (team.isLoading || rules.isLoading || myEntry.isLoading) {
    return <p className="text-white/55 text-sm">Loading…</p>;
  }
  if (!team.data?.team) {
    return (
      <Card>
        <div className="text-4xl mb-2">🛡️</div>
        <h2 className="headline-glitch text-2xl leading-none">You need a team</h2>
        <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">
          Queueing requires a team in this game. Create or join one first.
        </p>
        <button onClick={() => router.push("/team")} className="btn-neon mt-4">
          Go to my team
        </button>
      </Card>
    );
  }

  // ───── ALREADY IN QUEUE ─────
  if (myEntry.data) {
    const e = myEntry.data;
    const v = gameVisual(e.game?.slug);
    const canCancel = e.status === "pending_payment" || e.status === "queued";

    return (
      <div className="flex flex-col gap-5">
        <section
          className="card p-5 relative overflow-hidden"
          style={{ borderColor: v.accent + "55" }}
        >
          <div aria-hidden className="absolute inset-0 opacity-20" style={{ background: v.gradient }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{v.glyph}</span>
              <span className="label-display" style={{ color: v.accent }}>
                {e.game?.name ?? ""}
              </span>
            </div>
            <h1 className="headline-glitch text-2xl leading-none mt-1">
              {e.players_per_side}v{e.players_per_side} · BO{e.best_of}
            </h1>
            <p className="text-white/55 text-xs mt-1">
              Rule: {e.rule?.name ?? "—"} · fee {Number(e.entry_fee_ton)} TON
            </p>
          </div>
        </section>

        {e.status === "pending_payment" && (
          <Card>
            <PulsingDot color="#ffd84a" />
            <h3 className="headline-glitch text-xl mt-2">Waiting for payment</h3>
            <p className="text-white/65 text-sm mt-2">
              Open your wallet and confirm the {Number(e.entry_fee_ton)} TON entry fee.
            </p>
          </Card>
        )}

        {e.status === "queued" && (
          <Card>
            <PulsingDot color="#00e5ff" />
            <h3 className="headline-glitch text-xl mt-2">Searching opponent…</h3>
            <p className="text-white/65 text-sm mt-2">
              Random pairing. We&apos;ll match you with another team in this lobby.
            </p>
            <p className="text-[0.7rem] text-white/40 mt-3">
              You&apos;ll be notified when matched. The fee is locked once paired.
            </p>
          </Card>
        )}

        {canCancel && (
          <button
            onClick={async () => {
              setErr(null);
              try {
                await cancel.mutateAsync(e.id);
              } catch (ex) {
                setErr((ex as Error).message);
              }
            }}
            className="btn-outline is-danger"
          >
            Cancel search
          </button>
        )}
        {err && <p className="text-red-400 text-sm">⚠ {err}</p>}
      </div>
    );
  }

  // ───── LOBBY PICKER ─────
  const game = games.data?.find((g) => g.id === gameId);
  const v = gameVisual(game?.slug);
  const fee = ENTRY_FEE_TON;

  const onJoin = async () => {
    if (!ruleId) return;
    setErr(null);
    setBusy(true);
    try {
      const { entry } = await join.mutateAsync({
        game_id: gameId,
        rules_id: ruleId,
        players_per_side: players,
        best_of: bestOf,
        entry_fee_ton: fee,
      });

      // Trigger TON payment.
      const result = await sendFee(entry.id, fee);

      // Optimistic confirm so the matcher fires without bot involvement on
      // testnet. Send the boc as the "tx hash" — bot will replace with the
      // real chain hash later when it sweeps.
      const txHash = result?.boc?.slice(0, 64) ?? `dev:${entry.id}`;
      await confirm.mutateAsync({ entry_id: entry.id, tx_hash: txHash });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Game banner */}
      <section
        className="card p-4 relative overflow-hidden flex items-center gap-3"
        style={{ borderColor: v.accent + "55" }}
      >
        <div aria-hidden className="absolute inset-0 opacity-25" style={{ background: v.gradient }} />
        <div className="relative flex items-center gap-3 w-full">
          <div className="text-3xl">{v.glyph}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white truncate font-display tracking-[0.06em] uppercase">
              {game?.name ?? ""}
            </div>
            <div className="text-[0.7rem] text-white/55">
              queueing as {team.data.team.name}
            </div>
          </div>
          <span className="pill is-open">{NETWORK}</span>
        </div>
      </section>

      {/* Rules */}
      <section>
        <span className="label-display block mb-2">Rule set</span>
        <div className="flex flex-col gap-2">
          {rules.data?.map((r) => (
            <button
              key={r.id}
              onClick={() => setRuleId(r.id)}
              className={`card p-3 text-left ${ruleId === r.id ? "is-active" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display tracking-[0.06em] uppercase text-white">{r.name}</div>
                  {r.description && (
                    <div className="text-[0.75rem] text-white/55 mt-0.5">{r.description}</div>
                  )}
                </div>
                {ruleId === r.id && <span className="pill is-open">Picked</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Players per side */}
      <section>
        <span className="label-display block mb-2">Lobby format</span>
        <div className="seg w-full flex">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPlayers(n)}
              className={`seg-item flex-1 ${players === n ? "is-active" : ""}`}
            >
              {n}v{n}
            </button>
          ))}
        </div>
      </section>

      {/* Best of */}
      <section>
        <span className="label-display block mb-2">Series</span>
        <div className="seg w-full flex">
          {BEST_OF_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setBestOf(n)}
              className={`seg-item flex-1 ${bestOf === n ? "is-active" : ""}`}
            >
              BO{n}
            </button>
          ))}
        </div>
      </section>

      {/* Fee summary */}
      <section className="card p-4 flex items-center justify-between">
        <div>
          <div className="text-[0.7rem] text-white/45 uppercase tracking-[0.18em]">Entry fee</div>
          <div className="font-display text-neon-cyan text-2xl mt-0.5">{fee} TON</div>
          <div className="text-[0.65rem] text-white/40 mt-0.5">Locked until you cancel or get matched.</div>
        </div>
        <div className="text-right">
          <div className="text-[0.7rem] text-white/45 uppercase tracking-[0.18em]">Network</div>
          <div className="font-display text-white/85 text-base mt-0.5 uppercase">{NETWORK}</div>
        </div>
      </section>

      {!ESCROW && (
        <div
          className="card p-3 text-center"
          style={{ borderColor: "rgba(255,80,120,0.4)" }}
        >
          <div className="font-display text-[0.7rem] tracking-[0.18em] uppercase text-red-400">
            Escrow not configured
          </div>
          <div className="text-[0.7rem] text-white/55 mt-1">
            Set <code>NEXT_PUBLIC_TON_ESCROW_ADDRESS</code> in Vercel and redeploy.
          </div>
        </div>
      )}

      {err && <p className="text-red-400 text-sm">⚠ {err}</p>}

      <button
        onClick={onJoin}
        disabled={!ruleId || busy || !ESCROW}
        className="btn-neon"
      >
        {busy ? "Confirm in your wallet…" : `Pay ${fee} TON & Queue Up`}
      </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="card p-6 text-center">{children}</section>;
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full animate-pulse"
      style={{ background: color, boxShadow: `0 0 16px ${color}` }}
    />
  );
}
