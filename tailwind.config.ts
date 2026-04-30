import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: "var(--tg-theme-bg-color, #0a0a0f)",
          text: "var(--tg-theme-text-color, #ffffff)",
          hint: "var(--tg-theme-hint-color, #8a8a9c)",
          link: "var(--tg-theme-link-color, #00e5ff)",
          button: "var(--tg-theme-button-color, #ff2d92)",
          buttonText: "var(--tg-theme-button-text-color, #ffffff)",
          secondaryBg: "var(--tg-theme-secondary-bg-color, #14141c)",
        },
        neon: {
          cyan: "#00e5ff",
          magenta: "#ff2d92",
          violet: "#7a3cff",
          lime: "#b6ff3c",
        },
        ink: {
          900: "#05050a",
          800: "#0a0a12",
          700: "#10101c",
          600: "#181826",
        },
      },
      fontFamily: {
        display: ["'Rajdhani'", "'Orbitron'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-cyan": "0 0 24px rgba(0,229,255,0.55), 0 0 60px rgba(0,229,255,0.25)",
        "glow-magenta": "0 0 24px rgba(255,45,146,0.6), 0 0 60px rgba(255,45,146,0.25)",
        "glow-violet": "0 0 30px rgba(122,60,255,0.55), 0 0 80px rgba(122,60,255,0.3)",
      },
      keyframes: {
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 16px rgba(255,45,146,0.55), 0 0 40px rgba(122,60,255,0.35)" },
          "50%": { boxShadow: "0 0 28px rgba(255,45,146,0.85), 0 0 80px rgba(122,60,255,0.55)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%,19.999%,22%,62.999%,64%,64.999%,70%,100%": { opacity: "1" },
          "20%,21.999%,63%,63.999%,65%,69.999%": { opacity: "0.55" },
        },
        gridShift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 40px" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        scan: "scan 6s linear infinite",
        flicker: "flicker 4s linear infinite",
        gridShift: "gridShift 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
