"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TonConnectButton, useTonAddress } from "@tonconnect/ui-react";
import {
  List, Section, Cell, Placeholder, Title, Caption, Banner,
} from "@telegram-apps/telegram-ui";
import { useGames, useMe, useUpdateMe } from "@/hooks/api";

export default function OnboardingPage() {
  const me = useMe();
  const games = useGames();
  const updateMe = useUpdateMe();
  const tonAddress = useTonAddress();
  const router = useRouter();

  // Persist wallet address as soon as it's available.
  useEffect(() => {
    if (me.data && tonAddress && tonAddress !== me.data.wallet_address) {
      updateMe.mutate({ wallet_address: tonAddress });
    }
  }, [tonAddress, me.data?.wallet_address]);

  // Once wallet AND game are set, leave onboarding.
  useEffect(() => {
    if (me.data?.wallet_address && me.data?.current_game_id) {
      router.replace("/");
    }
  }, [me.data?.wallet_address, me.data?.current_game_id]);

  return (
    <List>
      <Placeholder
        header={<Title level="2">Welcome to EZChamp</Title>}
        description="eSports wagers settled on TON. Two quick steps and you're in."
      />

      <Section header="1. Connect your TON wallet">
        {me.data?.wallet_address ? (
          <Banner header="Wallet connected" subheader={`${me.data.wallet_address.slice(0, 6)}…${me.data.wallet_address.slice(-6)}`} />
        ) : (
          <Cell>
            <TonConnectButton />
          </Cell>
        )}
      </Section>

      {me.data?.wallet_address && (
        <Section header="2. Pick a game">
          {games.data?.map((g) => (
            <Cell
              key={g.id}
              onClick={() => updateMe.mutate({ current_game_id: g.id })}
              after={me.data?.current_game_id === g.id ? <Caption>✓</Caption> : null}
            >
              {g.name}
            </Cell>
          ))}
        </Section>
      )}
    </List>
  );
}
