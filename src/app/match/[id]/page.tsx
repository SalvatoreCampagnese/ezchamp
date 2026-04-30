"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import {
  useMatch, useMe, useOpenDispute, useReportResult, useTeam,
} from "@/hooks/api";
import { useSendStake, ESCROW } from "@/lib/ton";
import { api } from "@/lib/api-client";

export default function MatchPage() {
  return (
    <ConnectGate>
      <AppShell title="Match" showBack>
        <Match />
      </AppShell>
    </ConnectGate>
  );
}

function statusPill(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    open:            { cls: "is-open",    label: "Open" },
    accepted:        { cls: "is-live",    label: "Live" },
    awaiting_result: { cls: "is-pending", label: "Awaiting result" },
    completed:       { cls: "is-done",    label: "Completed" },
    disputed:        { cls: "is-error",   label: "Disputed" },
    cancelled:       { cls: "is-done",    label: "Cancelled" },
  };
  const v = map[status] ?? { cls: "is-done", label: status };
  return <span className={`pill ${v.cls}`}>{v.label}</span>;
}

function Match() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const match = useMatch(id);
  const team = useTeam(me.data?.current_game_id ?? null);
  const reportResult = useReportResult(id);
  const openDispute = useOpenDispute(id);
  const sendStake = useSendStake();

  const [confirmingResult, setConfirmingResult] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (match.isLoading) return <p className="text-white/55 text-sm">Loading…</p>;
  if (!match.data) return <p className="text-white/65">Match not found.</p>;

  const m = match.data;
  const myTeamId = team.data?.team?.id ?? null;
  const inMatch = !!myTeamId && (myTeamId === m.poster_team_id || myTeamId === m.accepter_team_id);
  const otherTeam = myTeamId === m.poster_team_id ? m.accepter_team : m.poster_team;

  const onAccept = async () => {
    setErr(null);
    setAccepting(true);
    try {
      await api(`/api/matches/${id}/accept`, { method: "POST" });
      await sendStake(m.id, Number(m.stake_ton));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header card with both teams */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="label-display">Match {m.id.slice(0, 8)}</span>
          {statusPill(m.status)}
        </div>
        <div className="flex items-center gap-3 justify-between">
          <TeamBadge name={m.poster_team?.name ?? "?"} side="left" />
          <span className="font-display text-2xl text-white/40">VS</span>
          <TeamBadge name={m.accepter_team?.name ?? "Open slot"} side="right" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Format" value={`${m.players_per_side}v${m.players_per_side}`} />
          <Stat label="Series" value={`BO${m.best_of}`} />
          <Stat label="Stake" value={`${m.stake_ton} TON`} accent />
        </div>
        {m.rule?.name && (
          <div className="mt-3 text-center text-[0.75rem] text-white/55">
            <span className="text-white/35 uppercase tracking-[0.18em] text-[0.65rem]">Rules · </span>
            {m.rule.name}
          </div>
        )}
        {m.result_deadline_at && (
          <div className="mt-3 text-center text-[0.7rem] text-white/45">
            Other team must confirm by{" "}
            <span className="text-white/85">
              {new Date(m.result_deadline_at).toLocaleString()}
            </span>
          </div>
        )}
      </section>

      {/* Accept */}
      {m.status === "open" && !inMatch && (
        <section className="flex flex-col gap-3">
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
          <button onClick={onAccept} disabled={accepting || !ESCROW} className="btn-neon">
            {accepting ? "Sending…" : `Accept & Pay ${m.stake_ton} TON`}
          </button>
          {ESCROW && (
            <p className="text-[0.65rem] text-white/45 text-center">
              Funds escrowed at{" "}
              <code className="text-white/65">
                {ESCROW.slice(0, 6)}…{ESCROW.slice(-4)}
              </code>
              . Match locks once payment confirms.
            </p>
          )}
        </section>
      )}

      {/* In progress */}
      {inMatch && ["accepted", "awaiting_result"].includes(m.status) && (
        <section className="flex flex-col gap-3">
          <button onClick={() => setConfirmingResult(myTeamId!)} className="btn-neon">
            🏁 We won
          </button>
          <button onClick={() => setConfirmingResult(otherTeam?.id ?? "")} className="btn-outline">
            😞 They won ({otherTeam?.name})
          </button>
          <button onClick={() => setDisputeOpen(true)} className="btn-outline is-danger">
            🚩 Open dispute
          </button>
        </section>
      )}

      {m.status === "completed" && (
        <section className="card p-5 text-center">
          <div className="text-3xl mb-1">🏆</div>
          <div className="headline-glitch text-2xl">
            {m.winner_team_id === m.poster_team_id ? m.poster_team?.name : m.accepter_team?.name}
          </div>
          <div className="text-[0.7rem] uppercase tracking-[0.18em] text-white/45 mt-1">Match complete</div>
        </section>
      )}
      {m.status === "disputed" && (
        <section className="card p-5 text-center" style={{ borderColor: "rgba(255,80,120,0.4)" }}>
          <div className="text-3xl mb-1">⚠</div>
          <div className="font-display text-white">Disputed</div>
          <div className="text-[0.7rem] text-white/55 mt-1">
            Staff is reviewing — you&apos;ll be notified by the bot.
          </div>
        </section>
      )}

      {err && <p className="text-red-400 text-sm">⚠ {err}</p>}

      {/* Confirm result modal */}
      {confirmingResult && (
        <Overlay onClose={() => setConfirmingResult(null)}>
          <h3 className="headline-glitch text-2xl">Confirm result</h3>
          <p className="text-white/65 text-sm mt-2">
            Once both teams agree (or 20 min pass) the payout is queued.
          </p>
          <div className="flex flex-col gap-2 mt-5">
            <button
              onClick={async () => {
                await reportResult.mutateAsync(confirmingResult);
                setConfirmingResult(null);
              }}
              className="btn-neon"
            >
              Submit
            </button>
            <button onClick={() => setConfirmingResult(null)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </Overlay>
      )}

      {/* Dispute modal */}
      {disputeOpen && (
        <Overlay onClose={() => setDisputeOpen(false)}>
          <h3 className="headline-glitch text-2xl">Open dispute</h3>
          <p className="text-white/65 text-sm mt-2">What happened?</p>
          <textarea
            value={disputeText}
            onChange={(e) => setDisputeText(e.target.value)}
            placeholder="Brief description"
            rows={4}
            className="input-neon mt-3"
          />
          <div className="flex flex-col gap-2 mt-4">
            <button
              disabled={disputeText.trim().length < 5}
              onClick={async () => {
                await openDispute.mutateAsync(disputeText.trim());
                setDisputeOpen(false);
                router.refresh();
              }}
              className="btn-neon"
            >
              Submit dispute
            </button>
            <button onClick={() => setDisputeOpen(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function TeamBadge({ name, side }: { name: string; side: "left" | "right" }) {
  return (
    <div className={`flex flex-col items-${side === "left" ? "start" : "end"} flex-1 min-w-0`}>
      <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/45">
        {side === "left" ? "Poster" : "Challenger"}
      </div>
      <div className="font-display text-white text-lg truncate w-full" style={{ textAlign: side }}>
        {name}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2">
      <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className={`font-display mt-0.5 text-base ${accent ? "text-neon-cyan" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md sheet p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 w-12 h-1.5 rounded-full bg-white/15" />
        {children}
      </div>
    </div>
  );
}
