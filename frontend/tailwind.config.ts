import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        canvas: "#101014",
        panel: "#18181e",
        raised: "#222230",
        subtle: "#2a2a3a",
        muted: "#71717a",
        soft: "#a1a1aa",
        mint: { DEFAULT: "#34d399", dim: "rgba(52,211,153,0.12)" },
        coral: { DEFAULT: "#fb7185", dim: "rgba(251,113,133,0.12)" },
        sky: { DEFAULT: "#38bdf8", dim: "rgba(56,189,248,0.10)" },
        amber: { DEFAULT: "#fbbf24", dim: "rgba(251,191,36,0.12)" },
      },
      animation: {
        "enter": "enter 0.35s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        enter: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
