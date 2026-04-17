import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Iowan Old Style", "Charter", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        parchment: "#f7f3ea",
        ink: "#1a1815",
        rule: "#d9d2c2",
      },
    },
  },
  plugins: [],
};

export default config;
