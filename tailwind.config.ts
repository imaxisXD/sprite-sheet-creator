import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fal brand colors
        fal: {
          "purple-deep": "#5718c0",
          "purple-light": "#ab77ff",
          pink: "#e366af",
          red: "#ec0648",
          cyan: "#38acc6",
          "blue-light": "#3fb5fe",
          blue: "#115ef3",
        },
        // Background colors (renamed to 'surface' to avoid conflict with bg- utility)
        surface: {
          primary: "#0a0a0b",
          secondary: "#111113",
          tertiary: "#18181b",
          elevated: "#1f1f23",
        },
        // Border colors (renamed to 'stroke' to avoid conflict with border- utility)
        stroke: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.15)",
        },
        // Text colors (renamed to 'content' to avoid conflict with text- utility)
        content: {
          primary: "#ffffff",
          secondary: "rgba(255, 255, 255, 0.6)",
          tertiary: "rgba(255, 255, 255, 0.4)",
        },
        // Functional colors
        success: "#22c55e",
        warning: "#eab308",
        error: "#ef4444",
      },
      maxWidth: {
        container: "1200px",
      },
      animation: {
        "fal-spin": "fal-spin 4s ease-in-out infinite",
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        "fal-spin": {
          "0%": { transform: "rotate(0deg)", fill: "#5718c0" },
          "20%": { transform: "rotate(360deg)", fill: "#ab77ff" },
          "25%": { transform: "rotate(360deg)", fill: "#e366af" },
          "45%": { transform: "rotate(720deg)", fill: "#ec0648" },
          "50%": { transform: "rotate(720deg)", fill: "#ab77ff" },
          "70%": { transform: "rotate(1080deg)", fill: "#38acc6" },
          "75%": { transform: "rotate(1080deg)", fill: "#3fb5fe" },
          "95%": { transform: "rotate(1440deg)", fill: "#115ef3" },
          "100%": { transform: "rotate(1440deg)", fill: "#5718c0" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
