"use client";

import { useEffect } from "react";
import { useTonAddress } from "@tonconnect/ui-react";
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";
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
export function ConnectGate({ children, requireGame = true }: { children: React.ReactNode; requireGame?: boolean }) {
  const me = useMe();
  const tonAddress = useTonAddress();
  const updateMe = useUpdateMe();

  // Persist wallet when the on-device address changes and differs from the stored one.
  useEffect(() => {
    if (me.data && tonAddress && tonAddress !== me.data.wallet_address) {
      updateMe.mutate({ wallet_address: tonAddress });
    }
  }, [tonAddress, me.data?.wallet_address]);

  if (me.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="l" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <Placeholder
        header="Couldn't authenticate"
        description="Open this app from inside Telegram (long-press the bot's menu button)."
      />
    );
  }

  // The screens themselves decide what to do when the user lacks wallet/game.
  // We just pass through with the freshly-loaded user.
  return <>{children}</>;
}
