"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { SpinnerBlock } from "@/components/Spinner";
import {
  useGames,
  useMe,
  useMyMatches,
  useMyQueueEntry,
  useUpdateMe,
} from "@/hooks/api";
import { useFavoriteGames } from "@/hooks/useFavoriteGames";
import { gameVisual } from "@/lib/games-meta";

export default function HomePage() {
  return (
    <ConnectGate>
      <AppShell>
        <Home />
      </AppShell>
    </ConnectGate>
  );
}

function Home() {
  const me = useMe();
  const games = useGames();
  const updateMe = useUpdateMe();
  const router = useRouter();
  const { isFav, toggle } = useFavoriteGames();
  const queueEntry = useMyQueueEntry();
  const myMatches = useMyMatches();

  // Navigate to the per-game lobby browser AND set the active game so
  // sidebar / "My Team" stay in context.
  const openGame = (id: string) => {
    updateMe.mutate({ current_game_id: id });
    router.push(`/game/${id}`);
  };

  useEffect(() => {
    if (me.data && !me.data.wallet_address) router.replace("/onboarding");
  }, [me.data?.wallet_address, me.data, router]);

  if (!me.data) return null;

  const activeGameId = me.data.current_game_id;
  const sortedGames = (games.data ?? []).slice().sort((a, b) => {
    const af = isFav(a.id) ? 0 : 1;
    const bf = isFav(b.id) ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.name.localeCompare(b.name);
  });

  const liveMatches = (myMatches.data ?? []).filter((m) =>
    ["accepted", "awaiting_result"].includes(m.status),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* QUEUE BANNER */}
      {queueEntry.data && <QueueBanner entry={queueEntry.data} />}

      {/* HERO STRIP */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <span className="label-display">Choose your battle</span>
          <span className="text-[0.7rem] tracking-[0.18em] uppercase text-white/40">
            ★ favorite · tap to play
          </span>
        </div>
        {games.isLoading ? (
          <SpinnerBlock label="Loading games" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sortedGames.map((g) => {
              const v = gameVisual(g.slug);
              const active = activeGameId === g.id;
              const fav = isFav(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => openGame(g.id)}
                  className={`gx-tile ${active ? "is-active" : ""}`}
                  aria-label={`Play ${g.name}`}
                >
                  {active && <span className="gx-tile-active-flag">Active</span>}
                  <span
                    role="button"
                    aria-label={fav ? "Unfavorite" : "Favorite"}
                    className={`gx-fav ${fav ? "is-fav" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(g.id);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </span>
                  <div className="gx-tile-img" style={{ background: v.gradient }}>
                    <span style={{ position: "relative", zIndex: 1 }}>{v.glyph}</span>
                  </div>
                  <div className="gx-tile-meta">
                    <span className="gx-tile-name">{g.name}</span>
                    <span
                      className="text-[0.65rem] tracking-[0.16em] uppercase font-display"
                      style={{ color: v.accent }}
                    >
                      {active ? "Playing" : "Play"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* QUICK ACTIONS */}
      {activeGameId && !queueEntry.data && (
        <section className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push(`/game/${activeGameId}`)} className="card p-4 text-left">
            <div className="text-2xl">⚡</div>
            <div className="font-display tracking-[0.16em] uppercase text-sm text-white mt-1">Find Match</div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">Browse lobbies</div>
          </button>
          <button onClick={() => router.push("/team")} className="card p-4 text-left">
            <div className="text-2xl">🛡️</div>
            <div className="font-display tracking-[0.16em] uppercase text-sm text-white mt-1">My Team</div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">Roster · invite code</div>
          </button>
        </section>
      )}

      {/* LIVE MATCHES */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="label-display">Live matches</span>
            <span className="text-[0.7rem] tracking-[0.18em] uppercase text-white/40">
              {liveMatches.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {liveMatches.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/match/${m.id}`)}
                className="card p-4 text-left flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display tracking-[0.06em] uppercase text-white truncate">
                    {m.poster_team?.name ?? "?"} <span className="text-white/40">vs</span>{" "}
                    {m.accepter_team?.name ?? "?"}
                  </div>
                  <div className="text-[0.7rem] text-white/55 mt-0.5">
                    {m.players_per_side}v{m.players_per_side} · BO{m.best_of} · {m.rule?.name ?? "—"}
                  </div>
                </div>
                <span className="pill is-live">Live</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!activeGameId && (
        <section className="card p-5 text-center">
          <p className="text-white/65">Tap any game above to enter its lobby.</p>
        </section>
      )}
    </div>
  );
}

function QueueBanner({ entry }: { entry: NonNullable<ReturnType<typeof useMyQueueEntry>["data"]> }) {
  const router = useRouter();
  const v = gameVisual(entry.game?.slug);
  const status = entry.status;
  const label =
    status === "pending_payment"
      ? "Awaiting payment"
      : status === "queued"
      ? "Searching opponent"
      : "Matched!";
  const color =
    status === "pending_payment" ? "#ffd84a" : status === "queued" ? "#00e5ff" : "#b6ff3c";

  return (
    <button
      onClick={() => router.push(entry.match_id ? `/match/${entry.match_id}` : `/game/${entry.game_id}`)}
      className="card p-4 text-left flex items-center gap-3 relative overflow-hidden"
      style={{ borderColor: color + "55" }}
    >
      <div aria-hidden className="absolute inset-0 opacity-20" style={{ background: v.gradient }} />
      <span
        className="relative inline-block w-3 h-3 rounded-full animate-pulse shrink-0"
        style={{ background: color, boxShadow: `0 0 16px ${color}` }}
      />
      <div className="relative flex-1 min-w-0">
        <div className="font-display tracking-[0.16em] uppercase text-white text-sm">{label}</div>
        <div className="text-[0.7rem] text-white/55 mt-0.5 truncate">
          {entry.game?.name ?? ""} · {entry.players_per_side}v{entry.players_per_side} · BO{entry.best_of} · {entry.rule?.name ?? ""}
        </div>
      </div>
      <span className="relative font-display text-neon-cyan text-sm shrink-0">
        {Number(entry.entry_fee_ton)} TON
      </span>
    </button>
  );
}
