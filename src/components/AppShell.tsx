"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useUpdateMe } from "@/hooks/api";

type NavItem = { href: string; label: string; icon: ReactNode };

const NAV: NavItem[] = [
  { href: "/", label: "Lobby", icon: <IconHome /> },
  { href: "/team", label: "My Team", icon: <IconShield /> },
  { href: "/matches", label: "My Matches", icon: <IconSwords /> },
  { href: "/tickets", label: "Tickets", icon: <IconTicket /> },
];

/**
 * Page chrome shared across the app: top header (menu / title / wallet) and
 * the slide-in sidebar drawer. Pages render inside `children` and inherit the
 * eSports dark canvas background.
 *
 * `title` is the optional page label shown in the header. `showBack` shows a
 * back arrow on the left instead of the menu button.
 */
export function AppShell({
  children,
  title,
  showBack = false,
}: {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tonAddress = useTonAddress();
  const me = useMe();
  const updateMe = useUpdateMe();
  const [tonConnectUI] = useTonConnectUI();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Refetch the session whenever:
  //   1. TonConnect's wallet status changes (connect / disconnect / restore)
  //   2. The Mini App becomes visible again (user returned from the wallet app)
  // Without these, useMe stays cached for staleTime (15s) and the header keeps
  // showing the old wallet state until the user closes/reopens the app.
  useEffect(() => {
    if (!tonConnectUI) return;
    const unsub = tonConnectUI.onStatusChange((w) => {
      qc.invalidateQueries({ queryKey: ["me"] });
      // If the wallet just connected and the server doesn't know yet, persist
      // it now so the header pill swaps in immediately without waiting for
      // ConnectGate's effect on the next render.
      const addr = w?.account?.address;
      if (addr && me.data && me.data.wallet_address !== addr) {
        updateMe.mutate({ wallet_address: addr });
      }
    });
    return unsub;
  }, [tonConnectUI, qc, me.data, updateMe]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        qc.invalidateQueries({ queryKey: ["me"] });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [qc]);

  async function handleDisconnect() {
    if (disconnecting) return;
    setDisconnecting(true);
    try {
      // Clear TonConnect's local cache (tonAddress goes null on next render).
      try { await tonConnectUI.disconnect(); } catch { /* noop */ }
      // Clear the persisted wallet on the server so the header doesn't keep
      // showing the old address via the me.data fallback.
      try { await updateMe.mutateAsync({ wallet_address: null }); } catch { /* noop */ }
    } finally {
      setDisconnecting(false);
      setOpen(false);
      router.replace("/onboarding");
    }
  }

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const wallet = tonAddress || me.data?.wallet_address || null;
  const shortAddr = wallet
    ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
    : null;

  return (
    <div className="esports-canvas">
      {/* HEADER */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-ink-900/65 border-b border-white/[0.06]">
        <div className="max-w-md mx-auto px-3 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {showBack ? (
              <button
                onClick={() => router.back()}
                className="header-btn"
                aria-label="Back"
              >
                <IconBack />
              </button>
            ) : (
              <button
                onClick={() => setOpen(true)}
                className="header-btn"
                aria-label="Open menu"
              >
                <IconMenu />
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="font-display tracking-[0.16em] uppercase text-[0.95rem] text-white pl-1 truncate"
            >
              {title ? (
                <span className="text-white/85">{title}</span>
              ) : (
                <span className="headline-glitch">EZCHAMP</span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {wallet ? (
              <button
                onClick={() => setOpen(true)}
                className="wallet-pill"
                aria-label="Wallet menu"
              >
                <span className="dot" />
                <span className="font-mono text-[0.75rem] text-white/90">{shortAddr}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  // Onboarding owns the wallet flow; just send them there.
                  router.push("/onboarding");
                }}
                className="wallet-pill is-disconnected"
              >
                <span className="dot is-off" />
                <span className="font-display text-[0.7rem] tracking-[0.18em] uppercase">Connect</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <aside
            className="sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="headline-glitch text-2xl tracking-[0.06em]">EZCHAMP</span>
                <button onClick={() => setOpen(false)} className="header-btn" aria-label="Close menu">
                  <IconClose />
                </button>
              </div>
              {wallet && (
                <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
                  <span className="dot" />
                  <span className="font-mono text-white/80">{shortAddr}</span>
                </div>
              )}
            </div>

            <nav className="px-3 py-3 flex flex-col gap-1">
              {NAV.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={`sidebar-link ${active ? "is-active" : ""}`}
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto px-3 py-3 border-t border-white/[0.06] flex flex-col gap-1">
              <button
                onClick={() => {
                  router.push("/onboarding");
                }}
                className="sidebar-link"
              >
                <span className="sidebar-link-icon"><IconSwap /></span>
                <span className="flex-1 text-left">Switch wallet / game</span>
              </button>
              {wallet && (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="sidebar-link is-danger"
                >
                  <span className="sidebar-link-icon"><IconLogout /></span>
                  <span className="flex-1 text-left">
                    {disconnecting ? "Disconnecting…" : "Disconnect wallet"}
                  </span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* CONTENT */}
      <main className="relative z-10 max-w-md mx-auto px-4 pt-4 pb-24">
        {children}
      </main>
    </div>
  );
}

/* ─── inline icons (no external dep) ─── */

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconSwords() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="19" y2="13" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <line x1="19" y1="21" x2="21" y2="19" />
    </svg>
  );
}
function IconTicket() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
      <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
    </svg>
  );
}
function IconSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
