"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { SpinnerBlock } from "@/components/Spinner";
import { DisputeChat } from "@/components/DisputeChat";
import {
  useAdminDispute, useAdminDisputeChat, useMe,
  useSendAdminDisputeMessage,
} from "@/hooks/api";

export default function AdminDisputeDetailPage() {
  return (
    <ConnectGate>
      <AppShell title="Staff · Dispute" showBack>
        <AdminDisputeDetail />
      </AppShell>
    </ConnectGate>
  );
}

function AdminDisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const detail = useAdminDispute(id);
  const send = useSendAdminDisputeMessage(id);
  const [tab, setTab] = useState<"poster" | "accepter">("poster");

  // Each side's chat is its own query — keeping them mounted in parallel
  // means the unread side keeps polling while staff is on the other tab.
  const posterChat = useAdminDisputeChat(id, "poster");
  const accepterChat = useAdminDisputeChat(id, "accepter");

  if (me.isLoading) return <SpinnerBlock label="Loading" />;
  if (!me.data?.is_admin) {
    return (
      <section className="card p-6 text-center">
        <div className="text-3xl mb-1">🔒</div>
        <h2 className="headline-glitch text-2xl">Staff only</h2>
      </section>
    );
  }

  if (detail.isLoading) return <SpinnerBlock label="Loading dispute" />;
  if (!detail.data?.dispute) return <p className="text-white/65">Dispute not found.</p>;

  const d = detail.data.dispute;
  const m = d.match;
  const evidence = detail.data.evidence;
  const posterName = m?.poster_team?.name ?? "Poster";
  const accepterName = m?.accepter_team?.name ?? "Accepter";

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="label-display">Dispute {d.id.slice(0, 8)}</span>
          <span className="pill is-error">{d.status}</span>
        </div>
        <div className="flex items-center gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/45">Poster</div>
            <div className="font-display text-white text-lg truncate">{posterName}</div>
          </div>
          <span className="font-display text-2xl text-white/40">VS</span>
          <div className="flex-1 min-w-0 text-right">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/45">Accepter</div>
            <div className="font-display text-white text-lg truncate">{accepterName}</div>
          </div>
        </div>
        <div className="mt-3 text-[0.7rem] text-white/55">
          <div>Reason: <span className="text-white/85">{d.reason}</span></div>
          {d.description && (
            <div className="mt-1">Description: <span className="text-white/85">{d.description}</span></div>
          )}
          {d.opener_team && (
            <div className="mt-1">Opened by: <span className="text-white/85">{d.opener_team.name}</span></div>
          )}
          {m && (
            <div className="mt-1">
              Match: {m.players_per_side}v{m.players_per_side} · BO{m.best_of} · {m.stake_ton} TON
            </div>
          )}
        </div>
      </section>

      {evidence.length > 0 && (
        <section className="card p-4">
          <div className="label-display mb-2">Evidence</div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {evidence.map((e) => (
              <li key={e.id}>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neon-cyan break-all"
                >
                  {e.url}
                </a>
                {e.description && (
                  <span className="text-white/55"> — {e.description}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("poster")}
            className={`flex-1 py-2 text-sm font-display tracking-[0.12em] uppercase rounded-lg border ${
              tab === "poster"
                ? "border-neon-cyan/60 bg-neon-cyan/10 text-white"
                : "border-white/10 bg-white/[0.02] text-white/60"
            }`}
          >
            {posterName}
          </button>
          <button
            onClick={() => setTab("accepter")}
            className={`flex-1 py-2 text-sm font-display tracking-[0.12em] uppercase rounded-lg border ${
              tab === "accepter"
                ? "border-neon-cyan/60 bg-neon-cyan/10 text-white"
                : "border-white/10 bg-white/[0.02] text-white/60"
            }`}
          >
            {accepterName}
          </button>
        </div>

        {tab === "poster" ? (
          <DisputeChat
            messages={posterChat.data ?? []}
            isLoading={posterChat.isLoading}
            viewerRole="staff"
            emptyHint={`No messages from ${posterName} yet.`}
            onSend={(body) => send.mutateAsync({ side: "poster", body })}
          />
        ) : (
          <DisputeChat
            messages={accepterChat.data ?? []}
            isLoading={accepterChat.isLoading}
            viewerRole="staff"
            emptyHint={`No messages from ${accepterName} yet.`}
            onSend={(body) => send.mutateAsync({ side: "accepter", body })}
          />
        )}
      </section>
    </div>
  );
}
