"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useGames, useMe, useUpdateMe } from "@/hooks/api";

const MANIFEST_URL =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  "https://raw.githubusercontent.com/SalvatoreCampagnese/ezchamp-manifest/refs/heads/main/tonconnect-manifest.json";

type LogEntry = { t: string; level: "info" | "warn" | "error"; msg: string };

export default function OnboardingPage() {
  const me = useMe();
  const games = useGames();
  const updateMe = useUpdateMe();
  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ───────── debug log ─────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debugOpen, setDebugOpen] = useState(true);
  const log = useCallback((level: LogEntry["level"], msg: string) => {
    const t = new Date().toISOString().slice(11, 23);
    // eslint-disable-next-line no-console
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`[ezc] ${msg}`);
    setLogs((prev) => [...prev.slice(-49), { t, level, msg }]);
  }, []);

  // Capture window errors / unhandled rejections so we don't miss anything.
  useEffect(() => {
    const onErr = (e: ErrorEvent) => log("error", `window.error: ${e.message}`);
    const onRej = (e: PromiseRejectionEvent) =>
      log("error", `unhandledrejection: ${String(e.reason?.message ?? e.reason)}`);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, [log]);

  // Initial environment dump + manifest fetch probe.
  const probedRef = useRef(false);
  useEffect(() => {
    if (probedRef.current) return;
    probedRef.current = true;

    log("info", `manifest = ${MANIFEST_URL}`);
    log("info", `origin   = ${window.location.origin}`);
    log("info", `UA       = ${navigator.userAgent.slice(0, 80)}`);
    const tg = (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
    log("info", `Telegram.WebApp = ${tg ? "present" : "MISSING"}`);

    fetch(MANIFEST_URL, { cache: "no-store" })
      .then(async (r) => {
        log(r.ok ? "info" : "error", `manifest fetch → HTTP ${r.status}`);
        if (r.ok) {
          try {
            const j = await r.json();
            log("info", `manifest.url=${j.url} name=${j.name}`);
          } catch (e) {
            log("error", `manifest JSON parse failed: ${String(e)}`);
          }
        }
      })
      .catch((e) => log("error", `manifest fetch threw: ${String(e?.message ?? e)}`));
  }, [log]);

  // Subscribe to TonConnect status changes.
  useEffect(() => {
    if (!tonConnectUI) {
      log("warn", "tonConnectUI is null at mount");
      return;
    }
    log("info", `tonConnectUI ready · connected=${tonConnectUI.connected}`);
    const unsub = tonConnectUI.onStatusChange(
      (w) => log("info", `status → ${w ? `connected ${w.account?.address?.slice(0, 8)}…` : "disconnected"}`),
      (err) => log("error", `tonConnect error: ${String(err?.message ?? err)}`),
    );
    return () => {
      unsub();
    };
  }, [tonConnectUI, log]);

  // Persist wallet address as soon as it's available.
  useEffect(() => {
    if (me.data && tonAddress && tonAddress !== me.data.wallet_address) {
      log("info", `persisting wallet ${tonAddress.slice(0, 8)}…`);
      updateMe.mutate({ wallet_address: tonAddress });
    }
  }, [tonAddress, me.data?.wallet_address, log, me.data, updateMe]);

  // Once wallet AND game are set, leave onboarding.
  useEffect(() => {
    if (me.data?.wallet_address && me.data?.current_game_id) {
      router.replace("/");
    }
  }, [me.data?.wallet_address, me.data?.current_game_id, router]);

  const walletConnected = !!(tonAddress || me.data?.wallet_address);
  const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;

  function probeModalDom(label: string) {
    const root = document.querySelector("tc-root") as HTMLElement | null;
    if (!root) {
      log("warn", `${label}: <tc-root> NOT in DOM`);
      return;
    }
    const hasShadow = !!root.shadowRoot;
    const cs = window.getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    log(
      "info",
      `${label}: tc-root display=${cs.display} vis=${cs.visibility} z=${cs.zIndex} ` +
        `pos=${cs.position} size=${Math.round(rect.width)}x${Math.round(rect.height)} ` +
        `shadow=${hasShadow ? "yes" : "NO"}`,
    );
    if (hasShadow) {
      const overlay = root.shadowRoot!.querySelector('[class*="modal"], [class*="Modal"]') as HTMLElement | null;
      if (overlay) {
        const ocs = window.getComputedStyle(overlay);
        const orect = overlay.getBoundingClientRect();
        log(
          "info",
          `${label}: modal el display=${ocs.display} vis=${ocs.visibility} ` +
            `opacity=${ocs.opacity} size=${Math.round(orect.width)}x${Math.round(orect.height)} ` +
            `top=${Math.round(orect.top)}`,
        );
      } else {
        log("warn", `${label}: no modal element in shadowRoot (children=${root.shadowRoot!.children.length})`);
      }
    }
    log("info", `${label}: viewport=${window.innerWidth}x${window.innerHeight} scroll=${window.scrollY}`);
  }

  async function handleConnect() {
    log("info", "connect button clicked");
    if (!tonConnectUI) {
      log("error", "tonConnectUI is null — provider not mounted");
      setConnectError("TON Connect not initialized.");
      return;
    }
    setConnectError(null);
    setConnecting(true);
    try {
      probeModalDom("pre-open");
      log("info", "calling tonConnectUI.openModal()…");
      await tonConnectUI.openModal();
      log("info", "openModal() resolved");
      // The modal mounts asynchronously — re-probe after a tick.
      setTimeout(() => probeModalDom("post-open +0ms"), 0);
      setTimeout(() => probeModalDom("post-open +500ms"), 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", `openModal() threw: ${msg}`);
      setConnectError(msg || "Couldn't open wallet.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      log("info", "disconnect()");
      await tonConnectUI.disconnect();
    } catch (e) {
      log("error", `disconnect threw: ${String(e)}`);
    }
  }

  function copyLogs() {
    const text = logs.map((l) => `${l.t} [${l.level}] ${l.msg}`).join("\n");
    navigator.clipboard?.writeText(text).then(
      () => log("info", "logs copied to clipboard"),
      () => log("warn", "clipboard write failed"),
    );
  }

  return (
    <main className="esports-canvas">
      <div className="relative z-10 flex flex-col gap-8 px-5 pt-10 pb-44 max-w-md mx-auto">
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
                <p className="mt-3 text-sm text-red-400">{connectError}</p>
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

      {/* DEBUG PANEL */}
      <div className="fixed bottom-0 inset-x-0 z-50 max-w-md mx-auto px-3 pb-3">
        <div
          className="rounded-t-xl rounded-b-xl border border-white/10 bg-black/80 backdrop-blur"
          style={{ boxShadow: "0 -10px 30px rgba(0,0,0,0.5)" }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <button
              onClick={() => setDebugOpen((o) => !o)}
              className="text-[0.7rem] tracking-[0.18em] uppercase text-white/70"
            >
              {debugOpen ? "▼" : "▲"} Debug ({logs.length})
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={copyLogs}
                className="text-[0.7rem] tracking-[0.18em] uppercase text-neon-cyan"
              >
                Copy
              </button>
              <button
                onClick={() => setLogs([])}
                className="text-[0.7rem] tracking-[0.18em] uppercase text-white/50"
              >
                Clear
              </button>
            </div>
          </div>
          {debugOpen && (
            <pre
              className="px-3 py-2 text-[10px] leading-snug overflow-auto"
              style={{ maxHeight: "32vh", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {logs.length === 0
                ? "(no logs yet)"
                : logs
                    .map(
                      (l) =>
                        `${l.t} ${
                          l.level === "error" ? "✖" : l.level === "warn" ? "▲" : "·"
                        } ${l.msg}`,
                    )
                    .join("\n")}
            </pre>
          )}
        </div>
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
