"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useGames, useMe, useUpdateMe } from "@/hooks/api";

export default function OnboardingPage() {
  const me = useMe();
  const games = useGames();
  const updateMe = useUpdateMe();
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

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

  const walletConnected = !!(tonAddress || me.data?.wallet_address);
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;

  async function handleConnect() {
    setConnectError(null);
    setConnecting(true);
    try {
      await tonConnectUI.openModal();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Couldn't open wallet.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await tonConnectUI.disconnect();
    } catch {
      /* swallow */
    }
  }

  return (
    <main className="esports-canvas">
      <div className="relative z-10 flex flex-col gap-8 px-5 pt-10 pb-16 max-w-md mx-auto">
        {/* HERO */}
        <header className="flex flex-col items-center text-center gap-4">
          <span className="chip">
            <span className="dot" />
            <span>Live on TON · Testnet</span>
          </span>

          <h1 className="headline-glitch text-[2.6rem] leading-none sm:text-5xl">
            EZCHAMP
          </h1>
          <p className="tagline text-sm text-white/70">
            Stake · Clash · Cash Out
          </p>

          <p className="text-white/75 max-w-xs text-base">
            Real-money 1v1 and team eSports duels. Wagered in TON. Settled on-chain.
            <span className="text-neon-cyan"> No middlemen.</span>
          </p>
        </header>

        {/* STEP 1 — wallet */}
        <section className={`card p-5 ${walletConnected ? "is-active" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <StepBadge n={1} done={walletConnected} />
              <h2 className="font-display text-lg tracking-[0.18em] uppercase text-white">
                Link wallet
              </h2>
            </div>
            {walletConnected && (
              <span className="chip" style={{ borderColor: "rgba(0,229,255,0.5)" }}>
                <span className="dot" />
                <span>Connected</span>
              </span>
            )}
          </div>

          {walletConnected ? (
            <div className="flex items-center justify-between gap-3">
              <code className="text-neon-cyan text-sm break-all">
                {shortAddr((tonAddress || me.data?.wallet_address) as string)}
              </code>
              <button
                onClick={handleDisconnect}
                className="text-xs uppercase tracking-[0.18em] text-white/55 hover:text-white transition"
              >
                Switch
              </button>
            </div>
          ) : (
            <>
              <p className="text-white/65 text-sm mb-4">
                Connect a TON wallet (Tonkeeper, MyTonWallet, …) to deposit and receive winnings.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn-neon"
              >
                {connecting ? "Opening wallet…" : "⚡ Connect TON Wallet"}
              </button>
              {connectError && (
                <p className="mt-3 text-sm text-red-400">
                  {connectError}
                </p>
              )}
            </>
          )}
        </section>

        {/* STEP 2 — game */}
        <section className={`card p-5 ${walletConnected ? "" : "opacity-50 pointer-events-none"}`}>
          <div className="flex items-center gap-3 mb-3">
            <StepBadge n={2} done={!!me.data?.current_game_id} />
            <h2 className="font-display text-lg tracking-[0.18em] uppercase text-white">
              Pick your game
            </h2>
          </div>

          {games.isLoading ? (
            <p className="text-white/55 text-sm">Loading games…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {games.data?.map((g) => {
                const isActive = me.data?.current_game_id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => updateMe.mutate({ current_game_id: g.id })}
                    className={`game-tile ${isActive ? "is-active" : ""}`}
                  >
                    <span className="block text-white/95">{g.name}</span>
                    <span className="block mt-1 text-[0.7rem] tracking-[0.18em] uppercase text-white/45">
                      {isActive ? "selected" : "tap to pick"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <footer className="pt-2 text-center text-[0.7rem] tracking-[0.18em] uppercase text-white/35">
          Powered by TON · Built for Telegram
        </footer>
      </div>
    </main>
  );
}

function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold font-display ${
        done
          ? "bg-neon-cyan text-black shadow-glow-cyan"
          : "bg-white/10 text-white/80 border border-white/15"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}
