"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ezchamp:fav-games";

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
  } catch {
    /* quota / private mode — silently ignore */
  }
}

/**
 * Persistent set of "favorite" game IDs. Stored in localStorage so it survives
 * reloads without a server round-trip. Multi-device sync is intentionally out
 * of scope — the home grid lists all games anyway, favorites just float to the
 * top.
 */
export function useFavoriteGames() {
  const [favs, setFavs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFavs(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setFavs(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      write(next);
      return next;
    });
  }, []);

  const isFav = useCallback((id: string) => favs.has(id), [favs]);

  return { favs, toggle, isFav };
}
