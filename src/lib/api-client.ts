"use client";

/**
 * Client-side fetch helper. Auto-injects the Telegram initData into every API
 * call so the server can verify the signed payload.
 */
export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const initData =
    typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";

  const headers = new Headers(init.headers);
  headers.set("x-telegram-init-data", initData);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (json as { error?: string })?.error ?? `${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { id: number; username?: string } };
      };
    };
  }
}
