"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectGate } from "@/components/ConnectGate";
import { AppShell } from "@/components/AppShell";
import { useCreateMatch, useGames, useMe, useRules, useTeam } from "@/hooks/api";
import { useSendStake, MIN_STAKE, FEE_BPS, ESCROW } from "@/lib/ton";
import { gameVisual } from "@/lib/games-meta";

const PLAYER_OPTIONS = [1, 2, 3, 5];
const BEST_OF_OPTIONS = [1, 3, 5, 7];

export default function PostMatchPage() {
  return (
    <ConnectGate>
      <AppShell title="Post Match" showBack>
        <PostMatch />
      </AppShell>
    </ConnectGate>
  );
}

function PostMatch() {
  const me = useMe();
  const games = useGames();
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

  if (!gameId) return <Empty msg="Pick a game from the lobby first." />;
  if (team.isLoading || rules.isLoading) return <p className="text-white/55 text-sm">Loading…</p>;

  if (!team.data?.team) {
    return (
      <section className="card p-6 text-center">
        <div className="text-4xl mb-2">🛡️</div>
        <h2 className="headline-glitch text-2xl leading-none">You need a team</h2>
        <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">
          Posting a match requires a team in this game. Create or join one first.
        </p>
        <button onClick={() => router.push("/team")} className="btn-neon mt-4">
          Go to my team
        </button>
      </section>
    );
  }

  const game = games.data?.find((g) => g.id === gameId);
  const v = gameVisual(game?.slug);
  const fee = (FEE_BPS / 100).toFixed(1);
  const stakeNum = Number(stake);
  const valid = !!ruleId && Number.isFinite(stakeNum) && stakeNum >= MIN_STAKE;
  const projected = (2 * stakeNum * (1 - FEE_BPS / 10_000)).toFixed(2);

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
      <section className="card p-6 text-center">
        <div className="text-4xl mb-2">⚡</div>
        <h2 className="headline-glitch text-2xl leading-none">Stake sent</h2>
        <p className="text-white/65 text-sm mt-2 max-w-xs mx-auto">
          Once the chain confirms (~1 min), your match goes live in the lobby.
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button onClick={() => router.replace(`/match/${createdMatchId}`)} className="btn-neon">
            View match
          </button>
          <button onClick={() => router.replace("/")} className="btn-ghost">Back to lobby</button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Game banner */}
      <section
        className="card p-4 relative overflow-hidden flex items-center gap-3"
        style={{ borderColor: v.accent + "55" }}
      >
        <div aria-hidden className="absolute inset-0 opacity-25" style={{ background: v.gradient }} />
        <div className="relative flex items-center gap-3 w-full">
          <div className="text-3xl">{v.glyph}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white truncate font-display tracking-[0.06em] uppercase">{game?.name ?? ""}</div>
            <div className="text-[0.7rem] text-white/55">posting as {team.data.team.name}</div>
          </div>
        </div>
      </section>

      {/* Rules */}
      <section>
        <span className="label-display block mb-2">Rule set</span>
        <div className="flex flex-col gap-2">
          {rules.data?.map((r) => (
            <button
              key={r.id}
              onClick={() => setRuleId(r.id)}
              className={`card p-3 text-left ${ruleId === r.id ? "is-active" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display tracking-[0.06em] uppercase text-white">{r.name}</div>
                  {r.description && (
                    <div className="text-[0.75rem] text-white/55 mt-0.5">{r.description}</div>
                  )}
                </div>
                {ruleId === r.id && <span className="pill is-open">Picked</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Players per side */}
      <section>
        <span className="label-display block mb-2">Players per side</span>
        <div className="seg w-full flex">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPlayers(n)}
              className={`seg-item flex-1 ${players === n ? "is-active" : ""}`}
            >
              {n}v{n}
            </button>
          ))}
        </div>
      </section>

      {/* Best of */}
      <section>
        <span className="label-display block mb-2">Best of</span>
        <div className="seg w-full flex">
          {BEST_OF_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setBestOf(n)}
              className={`seg-item flex-1 ${bestOf === n ? "is-active" : ""}`}
            >
              BO{n}
            </button>
          ))}
        </div>
      </section>

      {/* Stake */}
      <section>
        <span className="label-display block mb-2">Stake (TON)</span>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_STAKE}
          step={0.1}
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="input-neon font-mono text-center text-2xl"
        />
        <div className="card mt-3 p-4 flex items-center justify-between">
          <div>
            <div className="text-[0.7rem] text-white/45 uppercase tracking-[0.18em]">Winner takes</div>
            <div className="font-display text-neon-cyan text-xl mt-0.5">~{projected} TON</div>
          </div>
          <div className="text-right">
            <div className="text-[0.7rem] text-white/45 uppercase tracking-[0.18em]">Fee</div>
            <div className="font-display text-white/85 text-xl mt-0.5">{fee}%</div>
          </div>
        </div>
      </section>

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

      {err && <p className="text-red-400 text-sm">⚠ {err}</p>}

      <button
        onClick={onSubmit}
        disabled={!valid || step !== "form" || !ESCROW}
        className="btn-neon"
      >
        {step === "paying" ? "Confirm in your wallet…" : `Post & Pay ${stake} TON`}
      </button>

      {ESCROW && (
        <p className="text-[0.65rem] text-white/40 text-center">
          Funds escrowed at{" "}
          <code className="text-white/60">
            {ESCROW.slice(0, 6)}…{ESCROW.slice(-4)}
          </code>
        </p>
      )}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <section className="card p-6 text-center">
      <p className="text-white/70">{msg}</p>
    </section>
  );
}
