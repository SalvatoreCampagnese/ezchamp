"use client";

import { useRouter } from "next/navigation";
import { useTonAddress } from "@tonconnect/ui-react";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { SpinnerBlock } from "@/components/Spinner";
import { useAdminPayouts, useMe } from "@/hooks/api";
import { addressEquals, ESCROW } from "@/lib/ton";

export default function AdminPayoutsPage() {
  return (
    <ConnectGate>
      <AppShell title="Staff · Payouts" showBack>
        <AdminPayouts />
      </AppShell>
    </ConnectGate>
  );
}

function AdminPayouts() {
  const router = useRouter();
  const me = useMe();
  const list = useAdminPayouts();
  const tonAddress = useTonAddress();
  const liveWalletIsEscrow = !!ESCROW && addressEquals(tonAddress, ESCROW);

  if (me.isLoading) return <SpinnerBlock label="Loading" />;
  if (!me.data?.is_admin) {
    return (
      <section className="card p-6 text-center">
        <div className="text-3xl mb-1">🔒</div>
        <h2 className="headline-glitch text-2xl">Staff only</h2>
      </section>
    );
  }

  if (list.isLoading) return <SpinnerBlock label="Loading payouts" />;
  const items = list.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      {!liveWalletIsEscrow && (
        <section className="card p-4" style={{ borderColor: "rgba(255,80,120,0.4)" }}>
          <div className="font-display text-[0.75rem] tracking-[0.18em] uppercase text-red-400">
            Escrow wallet not connected
          </div>
          <p className="text-[0.8rem] text-white/75 mt-1">
            To broadcast payouts you need TonConnect to be linked to the
            escrow wallet ({ESCROW ? `${ESCROW.slice(0, 6)}…${ESCROW.slice(-4)}` : "not configured"}).
            Disconnect via the sidebar and reconnect with the escrow wallet.
          </p>
        </section>
      )}

      {items.length === 0 ? (
        <section className="card p-6 text-center">
          <div className="text-3xl mb-1">✓</div>
          <h2 className="headline-glitch text-2xl">No pending payouts</h2>
          <p className="text-white/65 text-sm mt-2">
            Pending winnings will appear here once a match is completed.
          </p>
        </section>
      ) : (
        items.map((p) => (
          <button
            key={p.id}
            onClick={() => router.push(`/match/${p.match_id}`)}
            className="card p-4 text-left flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="font-display tracking-[0.06em] uppercase text-white truncate">
                {p.match?.poster_team?.name ?? "?"} vs {p.match?.accepter_team?.name ?? "?"}
              </div>
              <div className="text-[0.7rem] text-white/55 mt-0.5">
                {Number(p.amount_ton)} TON →{" "}
                {p.user?.wallet_address
                  ? `${p.user.wallet_address.slice(0, 6)}…${p.user.wallet_address.slice(-4)}`
                  : "no wallet linked"}
              </div>
            </div>
            <span className="pill is-pending">Pending</span>
          </button>
        ))
      )}
    </div>
  );
}
