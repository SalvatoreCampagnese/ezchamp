"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import {
  useCancelQueueEntry,
  useConfirmQueuePayment,
  useGames,
  useJoinQueue,
  useMyQueueEntry,
  useRules,
  useTeam,
  useUpdateMe,
} from "@/hooks/api";
import { useFavoriteLobbies, lobbyKey } from "@/hooks/useFavoriteLobbies";
import { useSendEntryFee, ESCROW, NETWORK } from "@/lib/ton";
import { gameVisual } from "@/lib/games-meta";

const ENTRY_COSTS = [2, 5, 10, 25, 50] as const;
const FORMATS = [1, 2, 3, 4, 5] as const;
const FEE_BPS = 1000; // 10% — must match the matcher RPC
const DEFAULT_BO = 3;

function calcPrize(entry: number) {
  // pot = 2 × entry, fee = 10%, prize = 1.8 × entry
  return entry * 2 * (1 - FEE_BPS / 10000);
}

export default function GameDetailPage() {
  return (
    <ConnectGate>
      <AppShellWrap />
    </ConnectGate>
  );
}

function AppShellWrap() {
  const { id } = useParams<{ id: string }>();
  const games = useGames();
  const game = games.data?.find((g) => g.id === id);
  return (
    <AppShell title={game?.name ?? "Game"} showBack>
      <GameDetail />
    </AppShell>
  );
}

function GameDetail() {
  const { id: gameId } = useParams<{ id: string }>();
  const router = useRouter();
  const games = useGames();
  const rules = useRules(gameId);
  const team = useTeam(gameId);
  const queueEntry = useMyQueueEntry();
  const updateMe = useUpdateMe();

  const game = games.data?.find((g) => g.id === gameId);
  const v = gameVisual(game?.slug);

  // Sync the user's "active game" with whichever game page they're on, so My
  // Team / sidebar stay in context.
  useEffect(() => {
    if (gameId) updateMe.mutate({ current_game_id: gameId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (games.isLoading || rules.isLoading || team.isLoading || queueEntry.isLoading) {
    return <p className="text-white/55 text-sm">Loading…</p>;
  }
  if (!game) return <p className="text-white/65">Game not found.</p>;

  // ───── If the user is in queue for THIS game, show the waiting state. ─────
  if (queueEntry.data && queueEntry.data.game_id === gameId) {
    return <QueueWaiting />;
  }

  // ───── Otherwise show the lobby browser. ─────
  const teamSize = team.data?.members.length ?? 0;
  const teamId = team.data?.team?.id ?? null;

  return (
    <LobbyBrowser
      gameSlug={game.slug}
      gameAccent={v.accent}
      gameGradient={v.gradient}
      gameGlyph={v.glyph}
      rules={rules.data ?? []}
      teamSize={teamSize}
      teamPresent={!!teamId}
      onNeedTeam={() => router.push("/team")}
    />
  );
}

/* ───────── Lobby browser ───────── */

function LobbyBrowser({
  gameSlug, gameAccent, gameGradient, gameGlyph,
  rules, teamSize, teamPresent, onNeedTeam,
}: {
  gameSlug: string | undefined;
  gameAccent: string;
  gameGradient: string;
  gameGlyph: string;
  rules: { id: string; name: string; description: string | null }[];
  teamSize: number;
  teamPresent: boolean;
  onNeedTeam: () => void;
}) {
  const [filterFormats, setFilterFormats] = useState<Set<number>>(new Set(FORMATS));
  const [filterRules, setFilterRules] = useState<Set<string>>(() => new Set(rules.map((r) => r.id)));
  const [filterCosts, setFilterCosts] = useState<Set<number>>(new Set(ENTRY_COSTS));
  const [favOnly, setFavOnly] = useState(false);
  const { isFav, toggle } = useFavoriteLobbies();
  const { id: gameId } = useParams<{ id: string }>();

  // Keep ruleset filter in sync when rules load.
  useEffect(() => {
    setFilterRules((prev) => {
      if (prev.size === 0 && rules.length > 0) return new Set(rules.map((r) => r.id));
      return prev;
    });
  }, [rules]);

  type Lobby = { rules_id: string; rules_name: string; pps: number; entry: number; key: string; fav: boolean };
  const lobbies: Lobby[] = useMemo(() => {
    const out: Lobby[] = [];
    for (const r of rules) {
      for (const pps of FORMATS) {
        for (const entry of ENTRY_COSTS) {
          const key = lobbyKey(gameId, r.id, pps, entry);
          out.push({ rules_id: r.id, rules_name: r.name, pps, entry, key, fav: isFav(key) });
        }
      }
    }
    return out;
  }, [rules, gameId, isFav]);

  const filtered = lobbies
    .filter((l) => filterFormats.has(l.pps) && filterRules.has(l.rules_id) && filterCosts.has(l.entry))
    .filter((l) => (favOnly ? l.fav : true))
    .sort((a, b) => {
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      if (a.pps !== b.pps) return a.pps - b.pps;
      if (a.entry !== b.entry) return a.entry - b.entry;
      return a.rules_name.localeCompare(b.rules_name);
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Game banner */}
      <section
        className="card p-4 relative overflow-hidden flex items-center gap-3"
        style={{ borderColor: gameAccent + "55" }}
      >
        <div aria-hidden className="absolute inset-0 opacity-25" style={{ background: gameGradient }} />
        <div className="relative flex items-center gap-3 w-full">
          <div className="text-3xl">{gameGlyph}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.7rem] tracking-[0.18em] uppercase text-white/55">{gameSlug}</div>
            <div className="text-white truncate font-display tracking-[0.06em] uppercase">
              Lobby browser
            </div>
          </div>
          <span className="pill is-open">{NETWORK}</span>
        </div>
      </section>

      {/* Team status */}
      {!teamPresent && (
        <div className="card p-4" style={{ borderColor: "rgba(255,80,120,0.4)" }}>
          <div className="font-display text-sm text-white">No team in this game</div>
          <p className="text-[0.75rem] text-white/55 mt-1">
            You need a team before you can queue. Create one or join via invite code.
          </p>
          <button onClick={onNeedTeam} className="btn-outline mt-3">
            Set up team
          </button>
        </div>
      )}

      {/* Filters */}
      <section className="flex flex-col gap-3">
        <FilterRow label="Format">
          {FORMATS.map((f) => (
            <Chip
              key={f}
              active={filterFormats.has(f)}
              onClick={() => toggleSetItem(filterFormats, f, setFilterFormats)}
              label={`${f}v${f}`}
            />
          ))}
        </FilterRow>

        <FilterRow label="Ruleset">
          {rules.map((r) => (
            <Chip
              key={r.id}
              active={filterRules.has(r.id)}
              onClick={() => toggleSetItem(filterRules, r.id, setFilterRules)}
              label={r.name}
            />
          ))}
        </FilterRow>

        <FilterRow label="Entry">
          {ENTRY_COSTS.map((c) => (
            <Chip
              key={c}
              active={filterCosts.has(c)}
              onClick={() => toggleSetItem(filterCosts, c, setFilterCosts)}
              label={`${c} TON`}
            />
          ))}
        </FilterRow>

        <button
          onClick={() => setFavOnly((v) => !v)}
          className={`self-start text-[0.7rem] tracking-[0.18em] uppercase font-display px-3 py-1.5 rounded-md border transition ${
            favOnly
              ? "border-yellow-300/80 text-yellow-300 bg-yellow-300/10"
              : "border-white/15 text-white/55 hover:text-white"
          }`}
        >
          ★ {favOnly ? "Showing favorites only" : "Show favorites only"}
        </button>
      </section>

      {/* Lobby list */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="label-display">Lobbies</span>
          <span className="text-[0.7rem] tracking-[0.18em] uppercase text-white/40">
            {filtered.length} match{filtered.length !== 1 ? "es" : ""}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="card p-5 text-center text-white/55 text-sm">
            No lobbies match your filters.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((l) => (
              <LobbyCard
                key={l.key}
                rulesId={l.rules_id}
                rulesName={l.rules_name}
                pps={l.pps}
                entry={l.entry}
                fav={l.fav}
                teamSize={teamSize}
                teamPresent={teamPresent}
                onToggleFav={() => toggle(l.key)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function toggleSetItem<T>(set: Set<T>, item: T, setFn: (s: Set<T>) => void) {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  setFn(next);
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label-display mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-[0.72rem] tracking-[0.16em] uppercase font-display px-2.5 py-1.5 rounded-md border transition ${
        active
          ? "border-neon-cyan/70 text-neon-cyan bg-neon-cyan/10"
          : "border-white/12 text-white/55 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

/* ───────── Lobby card with inline join ───────── */

function LobbyCard({
  rulesId, rulesName, pps, entry, fav, teamSize, teamPresent, onToggleFav,
}: {
  rulesId: string;
  rulesName: string;
  pps: number;
  entry: number;
  fav: boolean;
  teamSize: number;
  teamPresent: boolean;
  onToggleFav: () => void;
}) {
  const { id: gameId } = useParams<{ id: string }>();
  const join = useJoinQueue();
  const confirm = useConfirmQueuePayment();
  const sendFee = useSendEntryFee();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const prize = calcPrize(entry);
  const tooSmall = teamPresent && teamSize < pps;
  const noTeam = !teamPresent;
  const noEscrow = !ESCROW;
  const disabled = busy || tooSmall || noTeam || noEscrow;

  const handleJoin = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { entry: q } = await join.mutateAsync({
        game_id: gameId,
        rules_id: rulesId,
        players_per_side: pps,
        best_of: DEFAULT_BO,
        entry_fee_ton: entry,
      });
      const result = await sendFee(q.id, entry);
      const txHash = result?.boc?.slice(0, 64) ?? `dev:${q.id}`;
      await confirm.mutateAsync({ entry_id: q.id, tx_hash: txHash });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-display tracking-[0.12em] uppercase text-white text-base">
              {pps}v{pps}
            </span>
            <span className="text-[0.65rem] tracking-[0.18em] uppercase text-white/45">
              · BO{DEFAULT_BO}
            </span>
          </div>
          <div className="text-[0.78rem] text-white/65 truncate">{rulesName}</div>
        </div>
        <button
          onClick={onToggleFav}
          className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition ${
            fav
              ? "border-yellow-300/70 text-yellow-300 bg-yellow-300/10 shadow-[0_0_12px_rgba(255,216,74,0.4)]"
              : "border-white/12 text-white/40 hover:text-yellow-300"
          }`}
          aria-label={fav ? "Unfavorite" : "Favorite"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
          <div className="text-[0.6rem] tracking-[0.18em] uppercase text-white/45">Entry</div>
          <div className="font-display text-white text-base mt-0.5">{entry} TON</div>
        </div>
        <div className="rounded-md border border-neon-cyan/30 bg-neon-cyan/5 p-2.5">
          <div className="text-[0.6rem] tracking-[0.18em] uppercase text-white/45">Win</div>
          <div className="font-display text-neon-cyan text-base mt-0.5">{prize.toFixed(2)} TON</div>
        </div>
      </div>

      {tooSmall && (
        <p className="text-[0.7rem] text-yellow-300">
          ⚠ Need {pps} player{pps > 1 ? "s" : ""} on team — you have {teamSize}.
        </p>
      )}
      {err && <p className="text-red-400 text-[0.75rem]">⚠ {err}</p>}

      <button onClick={handleJoin} disabled={disabled} className="btn-neon">
        {busy
          ? "Confirm in wallet…"
          : noTeam
          ? "Need a team first"
          : tooSmall
          ? `Roster too small`
          : noEscrow
          ? "Escrow not configured"
          : `Pay ${entry} TON & Queue Up`}
      </button>
    </div>
  );
}

/* ───────── In-queue waiting state ───────── */

function QueueWaiting() {
  const router = useRouter();
  const myEntry = useMyQueueEntry();
  const cancel = useCancelQueueEntry();
  const [err, setErr] = useState<string | null>(null);

  // Once matched → straight to the match page.
  useEffect(() => {
    if (myEntry.data?.status === "matched" && myEntry.data.match_id) {
      router.replace(`/match/${myEntry.data.match_id}`);
    }
  }, [myEntry.data?.status, myEntry.data?.match_id, router]);

  if (!myEntry.data) return null;
  const e = myEntry.data;
  const v = gameVisual(e.game?.slug);
  const canCancel = e.status === "pending_payment" || e.status === "queued";
  const prize = calcPrize(Number(e.entry_fee_ton));

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
            {e.rule?.name ?? "—"} · entry {Number(e.entry_fee_ton)} TON · win {prize.toFixed(2)} TON
          </p>
        </div>
      </section>

      <section className="card p-6 text-center">
        <span
          className="inline-block w-3 h-3 rounded-full animate-pulse"
          style={{
            background: e.status === "pending_payment" ? "#ffd84a" : "#00e5ff",
            boxShadow: `0 0 16px ${e.status === "pending_payment" ? "#ffd84a" : "#00e5ff"}`,
          }}
        />
        <h3 className="headline-glitch text-xl mt-2">
          {e.status === "pending_payment" ? "Waiting for payment" : "Searching opponent…"}
        </h3>
        <p className="text-white/65 text-sm mt-2">
          {e.status === "pending_payment"
            ? "Open your wallet and confirm the entry fee."
            : "Random pairing. The owner gets a Telegram message when you're matched."}
        </p>
      </section>

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
          Cancel search & refund
        </button>
      )}
      {err && <p className="text-red-400 text-sm">⚠ {err}</p>}
    </div>
  );
}
