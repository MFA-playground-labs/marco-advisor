import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172232",
        sidebar: "#111c29",
        gold: "#e8b24f",
        paper: "#f5f7fa",
        line: "#d9dee7"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui"],
        display: ["var(--font-newsreader)", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 10px 30px rgba(23, 34, 50, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
