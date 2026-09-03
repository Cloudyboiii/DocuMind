import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          raised: "#1a1b23",
          overlay: "#242530",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
        },
        border: {
          DEFAULT: "#2a2b35",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "bounce-dot": "bounceDot 1.4s infinite ease-in-out both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        bounceDot: {
          "0%, 80%, 100%": { transform: "scale(0)" },
          "40%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
