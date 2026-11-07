import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#142D4E", 700: "#1B3B66", 600: "#27497A", 50: "#EAEEF4" },
        // Brand teal #168C83 is used for fills/icons/borders. Text and button
        // fills use the darker steps so white/ivory text meets WCAG AA.
        teal: { DEFAULT: "#168C83", 700: "#0F6B64", 600: "#127A72", 500: "#168C83" },
        ivory: { DEFAULT: "#F5F3ED", 200: "#ECE9DF" },
        mist: { DEFAULT: "#DCE9E7", 300: "#C4DAD6" },
        danger: { DEFAULT: "#A33A2F", 50: "#FBEDEB" },
        amber: { 50: "#FFF6E0", 700: "#8A5A00" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", "sans-serif"],
        display: ["Iowan Old Style", "Palatino Linotype", "Georgia", "Noto Serif", "serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(20,45,78,0.06), 0 1px 1px rgba(20,45,78,0.04)" },
      borderRadius: { xl2: "1.125rem" },
    },
  },
  plugins: [],
};
export default config;
