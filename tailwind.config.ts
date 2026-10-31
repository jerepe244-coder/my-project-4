import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        zyrvae: {
          950: "#08090c",
          900: "#0e1015",
          850: "#14171f",
          800: "#1c202a",
          750: "#282e3c",
          700: "#333b4d",
          600: "#49546d",
          500: "#6a7690",
          400: "#9ba5b9",
          300: "#c7cedb",
          200: "#e3e7ee",
          100: "#f3f5f8",
        },
        electric: {
          DEFAULT: "#2563eb",
          hover: "#3b82f6",
          active: "#1d4ed8",
          glow: "rgba(37, 99, 235, 0.15)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.35)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
        glow: "0 0 15px -3px rgba(37, 99, 235, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
