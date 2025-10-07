import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"],
      },
      colors: {
        brand: {
          DEFAULT: "#6D5EF0",
          50: "#f3f2ff",
          100: "#e7e6ff",
          200: "#cbc6ff",
          300: "#b1a8ff",
          400: "#8b7dff",
          500: "#6D5EF0",
          600: "#5d4edd",
          700: "#4b3dc0",
          800: "#3b309a",
          900: "#2f2676",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
