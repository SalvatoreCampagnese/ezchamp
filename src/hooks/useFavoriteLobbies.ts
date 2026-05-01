"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ezchamp:fav-lobbies";

export type LobbyKey = string; // `${gameId}|${rulesId}|${pps}|${fee}`

export function lobbyKey(gameId: string, rulesId: string, pps: number, fee: number): LobbyKey {
  return `${gameId}|${rulesId}|${pps}|${fee}`;
}

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function write(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(s)));
  } catch { /* noop */ }
}

/**
 * Persistent set of "favorite" lobby keys (game + ruleset + format + entry).
 * Pinned lobbies float to the top of the lobby browser.
 */
export function useFavoriteLobbies() {
  const [favs, setFavs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFavs(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavs(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((key: LobbyKey) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      write(next);
      return next;
    });
  }, []);

  const isFav = useCallback((key: LobbyKey) => favs.has(key), [favs]);

  return { favs, toggle, isFav };
}
