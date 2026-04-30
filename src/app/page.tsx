"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Section, Cell, List, Button, Placeholder, Banner, Avatar, Title, Caption, Divider,
} from "@telegram-apps/telegram-ui";
import { ConnectGate } from "@/components/ConnectGate";
import { useGames, useMe, useOpenMatches, useUpdateMe } from "@/hooks/api";

export default function HomePage() {
  return (
    <ConnectGate>
      <Home />
    </ConnectGate>
  );
}

function Home() {
  const me = useMe();
  const games = useGames();
  const updateMe = useUpdateMe();
  const router = useRouter();
  const [tab, setTab] = useState<"open" | "team">("open");

  if (!me.data) return null;

  // No wallet → push to onboarding.
  useEffect(() => {
    if (me.data && !me.data.wallet_address) router.replace("/onboarding");
  }, [me.data?.wallet_address]);

  // No game picked → show inline picker.
  if (!me.data.current_game_id) {
    return (
      <List>
        <Placeholder
          header="Pick a game"
          description="EZChamp matches are organized per game. Choose yours to continue."
        />
        <Section>
          {games.data?.map((g) => (
            <Cell key={g.id} onClick={() => updateMe.mutate({ current_game_id: g.id })}>
              {g.name}
            </Cell>
          ))}
        </Section>
      </List>
    );
  }

  const currentGame = games.data?.find((g) => g.id === me.data!.current_game_id);

  return (
    <List>
      <Section header={<Title level="3">EZChamp</Title>}>
        <Cell
          before={<Avatar size={40} acronym={currentGame?.name?.[0] ?? "?"} />}
          subtitle={`Wallet ${me.data.wallet_address?.slice(0, 6)}…${me.data.wallet_address?.slice(-4)}`}
          onClick={() => updateMe.mutate({ current_game_id: null })}
          after={<Caption>change</Caption>}
        >
          {currentGame?.name ?? "Select a game"}
        </Cell>
      </Section>

      <Section>
        <Cell onClick={() => router.push("/post")}>➕ Post a match</Cell>
        <Cell onClick={() => router.push("/team")}>👥 My team</Cell>
      </Section>

      <Divider />

      <OpenMatchesSection gameId={me.data.current_game_id} />
    </List>
  );
}

function OpenMatchesSection({ gameId }: { gameId: string }) {
  const matches = useOpenMatches(gameId);
  const router = useRouter();

  if (matches.isLoading) return <Section header="Open matches"><Cell>Loading…</Cell></Section>;
  if (!matches.data || matches.data.length === 0) {
    return (
      <Section header="Open matches">
        <Banner header="Nothing here yet" subheader="Be the first to post a match." />
      </Section>
    );
  }
  return (
    <Section header="Open matches">
      {matches.data.map((m) => (
        <Cell
          key={m.id}
          subtitle={`${m.players_per_side}v${m.players_per_side} · BO${m.best_of} · ${m.rule?.name ?? ""}`}
          after={<strong>{m.stake_ton} TON</strong>}
          onClick={() => router.push(`/match/${m.id}`)}
        >
          {m.poster_team?.name ?? "Unknown team"}
        </Cell>
      ))}
    </Section>
  );
}
