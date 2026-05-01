"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useGames, useMe, useUpdateMe } from "@/hooks/api";
import { SpinnerBlock } from "@/components/Spinner";

type WalletInfo = {
  appName: string;
  name: string;
  imageUrl?: string;
  aboutUrl?: string;
  universalLink?: string;
  deepLink?: string;
  bridgeUrl?: string;
  jsBridgeKey?: string;
};

function openInTelegram(url: string) {
  const tg = (window as unknown as {
    Telegram?: { WebApp?: { openLink?: (u: string, opts?: object) => void; openTelegramLink?: (u: string) => void } };
  }).Telegram?.WebApp;
  if (url.startsWith("https://t.me/") && tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return "openTelegramLink";
  }
  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
    return "openLink";
  }
  window.open(url, "_blank");
  return "window.open";
}

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
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [walletQuery, setWalletQuery] = useState("");

  // ───────── debug log ─────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
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

  // Load the wallet list so we can offer a fallback picker.
  useEffect(() => {
    if (!tonConnectUI) return;
    (async () => {
      try {
        const list = (await tonConnectUI.getWallets()) as WalletInfo[];
        setWallets(list);
        log("info", `wallet list loaded: ${list.map((w) => w.appName).join(", ")}`);
      } catch (e) {
        log("error", `getWallets failed: ${String(e)}`);
      }
    })();
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

  function handleConnect() {
    log("info", "opening custom wallet picker");
    setConnectError(null);
    setPickerOpen(true);
  }

  async function pickWallet(w: WalletInfo) {
    log("info", `picked ${w.appName}`);
    setPickerOpen(false);
    setConnecting(true);
    setConnectError(null);
    try {
      // openSingleWalletModal works in iOS Telegram WebView even when openModal
      // (the multi-wallet picker) silently fails to mount.
      await (
        tonConnectUI as unknown as { openSingleWalletModal: (n: string) => Promise<void> }
      ).openSingleWalletModal(w.appName);
      log("info", "openSingleWalletModal resolved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", `openSingleWalletModal failed: ${msg} — trying direct link`);
      // Last-resort: build the universal link manually and open it via Telegram.
      if (w.universalLink && w.bridgeUrl) {
        try {
          const url = (
            tonConnectUI as unknown as {
              connector: { connect: (s: { universalLink: string; bridgeUrl: string }) => string };
            }
          ).connector.connect({ universalLink: w.universalLink, bridgeUrl: w.bridgeUrl });
          openInTelegram(url);
          log("info", "opened via direct universal link");
        } catch (e2) {
          setConnectError(`${w.name} couldn't open: ${String(e2)}`);
        }
      } else {
        setConnectError(`${w.name} couldn't open: ${msg}`);
      }
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

  // Featured wallets first (in this exact order), then everyone else
  // alphabetically. Matches what mainstream Telegram Mini Apps display.
  const FEATURED_ORDER = [
    "telegram-wallet",
    "tonkeeper",
    "mytonwallet",
    "tonhub",
    "hot",
    "bitgetTonWallet",
  ];
  const filteredWallets = wallets
    .filter((w) =>
      walletQuery.trim() === ""
        ? true
        : w.name.toLowerCase().includes(walletQuery.toLowerCase()) ||
          w.appName.toLowerCase().includes(walletQuery.toLowerCase()),
    )
    .sort((a, b) => {
      const ai = FEATURED_ORDER.indexOf(a.appName);
      const bi = FEATURED_ORDER.indexOf(b.appName);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

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

              <p className="mt-3 text-center text-[0.65rem] tracking-[0.18em] uppercase text-white/35">
                Tonkeeper · MyTonWallet · Tonhub · Wallet · +30 more
              </p>
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
            <SpinnerBlock label="Loading games" />
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

      {/* WALLET PICKER OVERLAY */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
          onClick={() => setPickerOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* drag handle */}
            <div className="mx-auto mt-2 mb-3 w-12 h-1.5 rounded-full bg-white/15" />

            <div className="px-5 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg tracking-[0.18em] uppercase text-white">
                  Choose Wallet
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Tap to link · {wallets.length} supported
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-white/55 hover:text-white text-xl leading-none px-2"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-5 mt-3">
              <input
                value={walletQuery}
                onChange={(e) => setWalletQuery(e.target.value)}
                placeholder="Search wallets…"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/35 focus:outline-none focus:border-neon-cyan/60"
              />
            </div>

            <div
              className="mt-3 px-3 pb-5 grid grid-cols-3 gap-2 overflow-y-auto"
              style={{ maxHeight: "55vh" }}
            >
              {filteredWallets.length === 0 && (
                <p className="col-span-3 text-center text-sm text-white/45 py-6">
                  No wallets match.
                </p>
              )}
              {filteredWallets.map((w) => {
                const featured = FEATURED_ORDER.includes(w.appName);
                return (
                  <button
                    key={w.appName}
                    onClick={() => pickWallet(w)}
                    className={`wallet-tile ${featured ? "is-featured" : ""}`}
                  >
                    {w.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={w.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/60 font-bold">
                        {w.name[0]}
                      </div>
                    )}
                    <span className="block text-[0.72rem] mt-1.5 text-white/85 truncate w-full text-center">
                      {w.name}
                    </span>
                    {featured && <span className="featured-badge">Top</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
