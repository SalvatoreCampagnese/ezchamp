"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { useGames, useMe, useOpenMatches, useUpdateMe } from "@/hooks/api";
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

  return (
    <div className="flex flex-col gap-6">
      {/* HERO STRIP */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <span className="label-display">Choose your battle</span>
          <span className="text-[0.7rem] tracking-[0.18em] uppercase text-white/40">
            ★ favorite · tap to play
          </span>
        </div>
        {games.isLoading ? (
          <p className="text-white/55 text-sm">Loading games…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sortedGames.map((g) => {
              const v = gameVisual(g.slug);
              const active = activeGameId === g.id;
              const fav = isFav(g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => updateMe.mutate({ current_game_id: g.id })}
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
      {activeGameId && (
        <section className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push("/post")} className="card p-4 text-left">
            <div className="text-2xl">⚡</div>
            <div className="font-display tracking-[0.16em] uppercase text-sm text-white mt-1">Post Match</div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">Stake TON, post a duel</div>
          </button>
          <button onClick={() => router.push("/team")} className="card p-4 text-left">
            <div className="text-2xl">🛡️</div>
            <div className="font-display tracking-[0.16em] uppercase text-sm text-white mt-1">My Team</div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">Roster · invite code</div>
          </button>
        </section>
      )}

      {/* OPEN MATCHES — only when a game is picked */}
      {activeGameId && <OpenMatchesSection gameId={activeGameId} />}

      {!activeGameId && (
        <section className="card p-5 text-center">
          <p className="text-white/65">
            Tap any game above to enter its lobby.
          </p>
        </section>
      )}
    </div>
  );
}

function OpenMatchesSection({ gameId }: { gameId: string }) {
  const matches = useOpenMatches(gameId);
  const router = useRouter();

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <span className="label-display">Open matches</span>
        {matches.data && matches.data.length > 0 && (
          <span className="text-[0.7rem] tracking-[0.18em] uppercase text-white/40">
            {matches.data.length} live
          </span>
        )}
      </div>

      {matches.isLoading ? (
        <p className="text-white/55 text-sm">Loading…</p>
      ) : !matches.data || matches.data.length === 0 ? (
        <div className="card p-5 text-center">
          <p className="text-white/70 text-sm">Nothing here yet.</p>
          <p className="text-white/45 text-xs mt-1">Be the first to post a match.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.data.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/match/${m.id}`)}
              className="card p-4 text-left flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-display tracking-[0.06em] uppercase text-white truncate">
                  {m.poster_team?.name ?? "Unknown team"}
                </div>
                <div className="text-[0.7rem] text-white/55 mt-0.5">
                  {m.players_per_side}v{m.players_per_side} · BO{m.best_of} · {m.rule?.name ?? "—"}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                <span className="font-display text-neon-cyan text-base">{m.stake_ton} TON</span>
                <span className="pill is-open">Open</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
