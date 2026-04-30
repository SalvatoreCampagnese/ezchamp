import type { Metadata, Viewport } from "next";
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "EZChamp",
  description: "eSports wagers on TON",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Required for Telegram Mini Apps to expose window.Telegram.WebApp */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
