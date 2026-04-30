"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { AppRoot } from "@telegram-apps/telegram-ui";

const manifestUrl =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  "https://raw.githubusercontent.com/SalvatoreCampagnese/ezchamp-manifest/refs/heads/main/tonconnect-manifest.json";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  // Initialize Telegram WebApp: expand to full viewport so modals (like the
  // TON Connect wallet picker) aren't clipped, and signal `ready` so Telegram
  // dismisses its loading overlay.
  useEffect(() => {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          ready?: () => void;
          expand?: () => void;
          disableVerticalSwipes?: () => void;
          setHeaderColor?: (c: string) => void;
          setBackgroundColor?: (c: string) => void;
        };
      };
    }).Telegram?.WebApp;
    if (!tg) return;
    try { tg.ready?.(); } catch {}
    try { tg.expand?.(); } catch {}
    try { tg.disableVerticalSwipes?.(); } catch {}
    try { tg.setHeaderColor?.("#05050a"); } catch {}
    try { tg.setBackgroundColor?.("#05050a"); } catch {}
  }, []);

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      uiPreferences={{ theme: "DARK" as never }}
      actionsConfiguration={{
        twaReturnUrl: (typeof window !== "undefined"
          ? (window.location.href as `${string}://${string}`)
          : ("https://ezchamp.vercel.app" as `${string}://${string}`)),
      }}
    >
      <QueryClientProvider client={client}>
        <AppRoot appearance="dark">{children}</AppRoot>
      </QueryClientProvider>
    </TonConnectUIProvider>
  );
}
