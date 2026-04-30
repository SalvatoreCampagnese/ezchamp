"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { CopyButton } from "@/components/CopyButton";
import { useCreateTeam, useGames, useJoinTeam, useMe, useTeam } from "@/hooks/api";
import { gameVisual } from "@/lib/games-meta";

export default function TeamPage() {
  return (
    <ConnectGate>
      <AppShell title="My Team" showBack>
        <Team />
      </AppShell>
    </ConnectGate>
  );
}

function Team() {
  const me = useMe();
  const games = useGames();
  const gameId = me.data?.current_game_id ?? null;
  const team = useTeam(gameId);
  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const router = useRouter();

  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!gameId) {
    return (
      <EmptyState
        glyph="🎮"
        title="Pick a game first"
        body="Teams are per-game. Head to the lobby and tap a game to play."
        ctaLabel="Go to lobby"
        onCta={() => router.push("/")}
      />
    );
  }
  if (team.isLoading) return <p className="text-white/55 text-sm">Loading team…</p>;

  const game = games.data?.find((g) => g.id === gameId);
  const v = gameVisual(game?.slug);

  if (team.data?.team) {
    const t = team.data.team;
    return (
      <div className="flex flex-col gap-5">
        {/* Team banner */}
        <section
          className="card p-5 relative overflow-hidden"
          style={{ borderColor: v.accent + "55" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-25"
            style={{ background: v.gradient }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{v.glyph}</span>
              <span className="label-display" style={{ color: v.accent }}>{game?.name ?? ""}</span>
            </div>
            <h1 className="headline-glitch text-3xl leading-none mt-1">{t.name}</h1>
            <p className="text-white/55 text-xs mt-2">
              {team.data.members.length} member{team.data.members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </section>

        {/* Invite code */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-display">Invite code</span>
            <CopyButton value={t.invite_code} label="Copy" />
          </div>
          <div className="rounded-lg bg-black/40 border border-white/10 px-4 py-3 font-mono text-2xl tracking-[0.32em] text-neon-cyan text-center">
            {t.invite_code}
          </div>
          <p className="text-[0.7rem] text-white/45 mt-2 text-center">
            Share with teammates so they can join.
          </p>
        </section>

        {/* Members */}
        <section>
          <span className="label-display block mb-2">Roster</span>
          <div className="flex flex-col gap-2">
            {team.data.members.map((m) => (
              <div
                key={m.user_id}
                className="card px-4 py-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-display text-white/85">
                  {(m.user.telegram_username ?? "?")[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white truncate">
                    {m.user.telegram_username ? `@${m.user.telegram_username}` : `id:${m.user.telegram_id}`}
                  </div>
                  <div className="text-[0.7rem] tracking-[0.18em] uppercase text-white/45">
                    {m.role === "owner" ? "Owner" : "Member"}
                  </div>
                </div>
                {m.role === "owner" && <span className="pill is-live">Captain</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-5">
        <section className="card p-6 text-center">
          <div className="text-4xl mb-2">{v.glyph}</div>
          <h2 className="headline-glitch text-2xl leading-none">No squad yet</h2>
          <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">
            To post or accept matches in <span className="text-white">{game?.name}</span>, you need a team.
          </p>
        </section>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => setMode("create")} className="btn-neon">
            🆕 Create new team
          </button>
          <button onClick={() => setMode("join")} className="btn-outline">
            🔗 Join via invite code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5">
        {mode === "create" ? (
          <>
            <span className="label-display">Team name</span>
            <input
              autoFocus
              value={name}
              maxLength={32}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Neon Wolves"
              className="input-neon mt-2"
            />
            <p className="text-[0.7rem] text-white/40 mt-2">3–32 characters.</p>
            <button
              disabled={busy || name.length < 3 || name.length > 32}
              onClick={async () => {
                setErr(null);
                setBusy(true);
                try {
                  await createTeam.mutateAsync({ name, game_id: gameId });
                  setMode("choose");
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="btn-neon mt-4"
            >
              {busy ? "Creating…" : "Forge team"}
            </button>
          </>
        ) : (
          <>
            <span className="label-display">Invite code</span>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="ABCD1234"
              className="input-neon mt-2 font-mono tracking-[0.2em] text-center text-xl"
            />
            <p className="text-[0.7rem] text-white/40 mt-2">8 characters. Ask the team owner.</p>
            <button
              disabled={busy || code.length !== 8}
              onClick={async () => {
                setErr(null);
                setBusy(true);
                try {
                  await joinTeam.mutateAsync({ code });
                  setMode("choose");
                } catch (e) {
                  setErr((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              className="btn-neon mt-4"
            >
              {busy ? "Joining…" : "Join squad"}
            </button>
          </>
        )}
        {err && <p className="text-red-400 text-sm mt-3">⚠ {err}</p>}
      </section>
      <button onClick={() => setMode("choose")} className="btn-ghost mx-auto">
        Cancel
      </button>
    </div>
  );
}

function EmptyState({
  glyph, title, body, ctaLabel, onCta,
}: {
  glyph: string; title: string; body: string; ctaLabel: string; onCta: () => void;
}) {
  return (
    <section className="card p-6 text-center">
      <div className="text-4xl mb-2">{glyph}</div>
      <h2 className="headline-glitch text-2xl leading-none">{title}</h2>
      <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">{body}</p>
      <button onClick={onCta} className="btn-neon mt-4">{ctaLabel}</button>
    </section>
  );
}
