"use client";

import { useEffect } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { Spinner } from "@/components/Spinner";
import { useMe, useUpdateMe } from "@/hooks/api";

/**
 * Top-level gate. Renders children once the user has:
 *   1. been authenticated via initData (we have a /api/me row)
 *   2. linked a TON wallet (wallet_address persisted)
 *   3. picked a current_game_id
 *
 * If the wallet is connected on-device but not yet stored, this component
 * persists it. Game selection is deferred to the onboarding screen.
 */
export function ConnectGate({ children }: { children: React.ReactNode; requireGame?: boolean }) {
  const me = useMe();
  const tonAddress = useTonAddress();
  const updateMe = useUpdateMe();

  // Persist wallet when the on-device address changes and differs from the stored one.
  useEffect(() => {
    if (me.data && tonAddress && tonAddress !== me.data.wallet_address) {
      updateMe.mutate({ wallet_address: tonAddress });
    }
  }, [tonAddress, me.data?.wallet_address, me.data, updateMe]);

  if (me.isLoading) {
    return (
      <div className="esports-canvas flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Authenticating" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="esports-canvas min-h-screen flex items-center justify-center px-6">
        <div className="card p-6 text-center max-w-sm">
          <div className="text-3xl mb-2">⚠</div>
          <h2 className="headline-glitch text-2xl">Couldn&apos;t authenticate</h2>
          <p className="text-white/65 text-sm mt-2">
            Open this app from inside Telegram (long-press the bot&apos;s menu button).
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
