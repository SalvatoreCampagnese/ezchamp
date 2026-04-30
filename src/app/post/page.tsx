"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  List, Section, Cell, Button, Input, SegmentedControl, Placeholder, Banner, Caption,
} from "@telegram-apps/telegram-ui";
import { useCreateMatch, useMe, useRules, useTeam } from "@/hooks/api";
import { useSendStake, MIN_STAKE, FEE_BPS, ESCROW } from "@/lib/ton";

const PLAYER_OPTIONS = [1, 2, 3, 5];
const BEST_OF_OPTIONS = [1, 3, 5, 7];

export default function PostMatchPage() {
  const me = useMe();
  const gameId = me.data?.current_game_id ?? null;
  const team = useTeam(gameId);
  const rules = useRules(gameId);
  const createMatch = useCreateMatch();
  const sendStake = useSendStake();
  const router = useRouter();

  const [ruleId, setRuleId] = useState<string | null>(null);
  const [players, setPlayers] = useState<number>(2);
  const [bestOf, setBestOf] = useState<number>(3);
  const [stake, setStake] = useState<string>(MIN_STAKE.toString());
  const [step, setStep] = useState<"form" | "paying" | "waiting">("form");
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!gameId) return <Placeholder header="Pick a game first" />;
  if (team.isLoading || rules.isLoading) return <Placeholder header="Loading…" />;

  if (!team.data?.team) {
    return (
      <Placeholder
        header="You need a team"
        description="Posting a match requires a team in this game. Create or join one first."
        action={<Button onClick={() => router.push("/team")}>Go to my team</Button>}
      />
    );
  }

  const fee = (FEE_BPS / 100).toFixed(1);
  const stakeNum = Number(stake);
  const valid =
    !!ruleId &&
    Number.isFinite(stakeNum) &&
    stakeNum >= MIN_STAKE;

  const onSubmit = async () => {
    if (!valid || !ruleId) return;
    setErr(null);
    try {
      const { match } = await createMatch.mutateAsync({
        game_id: gameId,
        rules_id: ruleId,
        players_per_side: players,
        best_of: bestOf,
        stake_ton: stakeNum,
      });
      setCreatedMatchId(match.id);
      setStep("paying");
      await sendStake(match.id, stakeNum);
      setStep("waiting");
    } catch (e) {
      setErr((e as Error).message);
      setStep("form");
    }
  };

  if (step === "waiting" && createdMatchId) {
    return (
      <Placeholder
        header="Payment sent ✅"
        description="Once the chain confirms (usually <1 min), your match goes live in the lobby."
        action={
          <>
            <Button onClick={() => router.replace(`/match/${createdMatchId}`)}>View match</Button>
            <Button mode="plain" onClick={() => router.replace("/")}>Back home</Button>
          </>
        }
      />
    );
  }

  return (
    <List>
      <Section header="Rule set">
        {rules.data?.map((r) => (
          <Cell
            key={r.id}
            subtitle={r.description ?? undefined}
            after={ruleId === r.id ? <Caption>✓</Caption> : null}
            onClick={() => setRuleId(r.id)}
          >
            {r.name}
          </Cell>
        ))}
      </Section>

      <Section header="Players per side">
        <Cell>
          <SegmentedControl>
            {PLAYER_OPTIONS.map((n) => (
              <SegmentedControl.Item key={n} selected={players === n} onClick={() => setPlayers(n)}>
                {`${n}v${n}`}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </Cell>
      </Section>

      <Section header="Best of">
        <Cell>
          <SegmentedControl>
            {BEST_OF_OPTIONS.map((n) => (
              <SegmentedControl.Item key={n} selected={bestOf === n} onClick={() => setBestOf(n)}>
                {`BO${n}`}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </Cell>
      </Section>

      <Section
        header="Stake (TON)"
        footer={`Each team locks ${stake || "—"} TON. Winner takes ~${
          (2 * (1 - FEE_BPS / 10_000)).toFixed(2)
        }× back (${fee}% fee).`}
      >
        <Cell>
          <Input
            type="number"
            inputMode="decimal"
            min={MIN_STAKE}
            step={0.1}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
        </Cell>
      </Section>

      {err && <Banner header="⚠ Error" subheader={err} />}

      <Section>
        <Cell>
          <Button stretched disabled={!valid || step !== "form"} onClick={onSubmit}>
            {step === "paying" ? "Confirm in your wallet…" : `Post & Pay ${stake} TON`}
          </Button>
        </Cell>
        <Cell>
          <Caption>
            Funds go to escrow <code>{ESCROW.slice(0, 6)}…{ESCROW.slice(-4)}</code>.
          </Caption>
        </Cell>
      </Section>
    </List>
  );
}
