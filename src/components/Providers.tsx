"use client";

import { useState, type ReactNode } from "react";
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

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      uiPreferences={{ theme: "DARK" as never }}
    >
      <QueryClientProvider client={client}>
        <AppRoot appearance="dark">{children}</AppRoot>
      </QueryClientProvider>
    </TonConnectUIProvider>
  );
}
