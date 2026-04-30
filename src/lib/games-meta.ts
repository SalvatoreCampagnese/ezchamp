/**
 * Per-game visual treatment (gradient, glyph, accent color).
 * Keyed by `slug` to avoid coupling to DB UUIDs. Unknown slugs fall back to a
 * neutral neon look so the UI still renders.
 */
export type GameVisual = {
  glyph: string;
  gradient: string;
  accent: string;
};

const VISUALS: Record<string, GameVisual> = {
  cs2: {
    glyph: "🎯",
    gradient: "linear-gradient(135deg, #ff6a00 0%, #b91c1c 60%, #1a0808 100%)",
    accent: "#ff8a3c",
  },
  valorant: {
    glyph: "🔫",
    gradient: "linear-gradient(135deg, #ff2d55 0%, #4a0d18 70%, #0a0a12 100%)",
    accent: "#ff4d6d",
  },
  lol: {
    glyph: "⚔️",
    gradient: "linear-gradient(135deg, #00d4ff 0%, #0066ff 50%, #061a3a 100%)",
    accent: "#00d4ff",
  },
  dota2: {
    glyph: "🛡️",
    gradient: "linear-gradient(135deg, #b30000 0%, #4a0000 60%, #0a0a12 100%)",
    accent: "#ff3838",
  },
  rl: {
    glyph: "🚗",
    gradient: "linear-gradient(135deg, #00e5ff 0%, #ff7a00 60%, #1a0808 100%)",
    accent: "#00e5ff",
  },
  fc25: {
    glyph: "⚽",
    gradient: "linear-gradient(135deg, #00ff88 0%, #008c4a 50%, #002418 100%)",
    accent: "#00ff88",
  },
};

const FALLBACK: GameVisual = {
  glyph: "🎮",
  gradient: "linear-gradient(135deg, #7a3cff 0%, #ff2d92 60%, #0a0a12 100%)",
  accent: "#ff2d92",
};

export function gameVisual(slug: string | null | undefined): GameVisual {
  if (!slug) return FALLBACK;
  return VISUALS[slug] ?? FALLBACK;
}
