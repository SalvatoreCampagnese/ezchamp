"use client";

import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { SpinnerBlock } from "@/components/Spinner";
import { useAdminDisputes, useMe } from "@/hooks/api";

export default function AdminDisputesPage() {
  return (
    <ConnectGate>
      <AppShell title="Staff · Disputes" showBack>
        <AdminDisputes />
      </AppShell>
    </ConnectGate>
  );
}

function AdminDisputes() {
  const router = useRouter();
  const me = useMe();
  const list = useAdminDisputes();

  if (me.isLoading) return <SpinnerBlock label="Loading" />;
  if (!me.data?.is_admin) {
    return (
      <section className="card p-6 text-center">
        <div className="text-3xl mb-1">🔒</div>
        <h2 className="headline-glitch text-2xl">Staff only</h2>
        <p className="text-white/65 text-sm mt-2">
          Your Telegram ID is not in the staff allowlist.
        </p>
      </section>
    );
  }

  if (list.isLoading) return <SpinnerBlock label="Loading disputes" />;
  const items = list.data ?? [];

  if (items.length === 0) {
    return (
      <section className="card p-6 text-center">
        <div className="text-3xl mb-1">✓</div>
        <h2 className="headline-glitch text-2xl">No open disputes</h2>
        <p className="text-white/65 text-sm mt-2">All quiet on the front.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((d) => (
        <button
          key={d.id}
          onClick={() => router.push(`/admin/disputes/${d.id}`)}
          className="card p-4 text-left flex items-center justify-between gap-3"
          style={{ borderColor: "rgba(255,80,120,0.4)" }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-display tracking-[0.06em] uppercase text-white truncate">
              {d.match?.poster_team?.name ?? "?"} vs{" "}
              {d.match?.accepter_team?.name ?? "?"}
            </div>
            <div className="text-[0.7rem] text-white/55 mt-0.5">
              {d.reason} · opened {new Date(d.created_at).toLocaleString()}
            </div>
          </div>
          <span className="pill is-error">{d.status}</span>
        </button>
      ))}
    </div>
  );
}
