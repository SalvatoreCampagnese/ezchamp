"use client";

import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { useMyMatches } from "@/hooks/api";

/**
 * "Tickets" = matches that need the user's attention: open disputes and
 * matches awaiting a result confirmation. The webapp doesn't have a dedicated
 * disputes endpoint yet — for now we surface the relevant subset of `useMyMatches`.
 */
export default function TicketsPage() {
  return (
    <ConnectGate>
      <AppShell title="Tickets" showBack>
        <Tickets />
      </AppShell>
    </ConnectGate>
  );
}

function Tickets() {
  const router = useRouter();
  const matches = useMyMatches();

  const tickets = (matches.data ?? []).filter((m) =>
    ["disputed", "awaiting_result"].includes(m.status),
  );

  if (matches.isLoading) return <p className="text-white/55 text-sm">Loading…</p>;
  if (tickets.length === 0) {
    return (
      <section className="card p-6 text-center">
        <div className="text-3xl mb-1">🎫</div>
        <h2 className="headline-glitch text-2xl">No tickets</h2>
        <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">
          When a match is disputed or waiting on a result confirmation, it shows up here.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tickets.map((m) => (
        <button
          key={m.id}
          onClick={() => router.push(`/match/${m.id}`)}
          className="card p-4 text-left flex items-center justify-between gap-3"
          style={{
            borderColor:
              m.status === "disputed" ? "rgba(255,80,120,0.4)" : "rgba(255,216,74,0.35)",
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-display tracking-[0.06em] uppercase text-white truncate">
              {m.poster_team?.name ?? "?"} vs {m.accepter_team?.name ?? "?"}
            </div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">
              {m.players_per_side}v{m.players_per_side} · BO{m.best_of}
            </div>
          </div>
          <span
            className={`pill ${m.status === "disputed" ? "is-error" : "is-pending"}`}
          >
            {m.status === "disputed" ? "Dispute" : "Awaiting"}
          </span>
        </button>
      ))}
    </div>
  );
}
