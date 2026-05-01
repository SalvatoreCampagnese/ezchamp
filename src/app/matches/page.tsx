"use client";

import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { SpinnerBlock } from "@/components/Spinner";
import { useMyMatches } from "@/hooks/api";

export default function MyMatchesPage() {
  return (
    <ConnectGate>
      <AppShell title="My Matches" showBack>
        <List />
      </AppShell>
    </ConnectGate>
  );
}

function statusPill(status: string) {
  const map: Record<string, string> = {
    open: "is-open",
    accepted: "is-live",
    awaiting_result: "is-pending",
    completed: "is-done",
    disputed: "is-error",
    cancelled: "is-done",
  };
  return <span className={`pill ${map[status] ?? "is-done"}`}>{status.replace("_", " ")}</span>;
}

function List() {
  const router = useRouter();
  const matches = useMyMatches();

  if (matches.isLoading) return <SpinnerBlock label="Loading matches" />;
  if (!matches.data || matches.data.length === 0) {
    return (
      <section className="card p-6 text-center">
        <div className="text-3xl mb-1">⚔️</div>
        <h2 className="headline-glitch text-2xl">No matches yet</h2>
        <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">
          Post a duel from the lobby or accept an open one to get going.
        </p>
        <button onClick={() => router.push("/")} className="btn-neon mt-4">Go to lobby</button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {matches.data.map((m) => (
        <button
          key={m.id}
          onClick={() => router.push(`/match/${m.id}`)}
          className="card p-4 text-left flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="font-display tracking-[0.06em] uppercase text-white truncate">
              {m.poster_team?.name ?? "?"} <span className="text-white/40">vs</span>{" "}
              {m.accepter_team?.name ?? "(open)"}
            </div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">
              {m.players_per_side}v{m.players_per_side} · BO{m.best_of} · {m.rule?.name ?? "—"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-display text-neon-cyan">{m.stake_ton} TON</span>
            {statusPill(m.status)}
          </div>
        </button>
      ))}
    </div>
  );
}
