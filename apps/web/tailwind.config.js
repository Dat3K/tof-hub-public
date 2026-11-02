/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Site design tokens.
        canvas: "#0b0d13",
        panel: "#100d14",
        raised: "#151119",
        hairline: "rgba(255, 255, 255, 0.08)",
        gold: "#f5d97a",
        violet: "#a77add",
        blue: "#3b82f6",
        couture: "#ff5ea8",
        mmo: "#e879f9",
        positive: "#7fd2af",
        negative: "#df899b",

        // Text hierarchy tokens
        "text-strong": "#f4f0f6",
        "text-body": "#d7d0dd",
        "text-sub": "#9ca3af",
        "text-muted": "#918899",

        // Elemental color spectrum (both flat and grouped)
        "elem-phys": "#f59e0b",
        "elem-flame": "#ef4444",
        "elem-frost": "#06b6d4",
        "elem-volt": "#a855f7",
        "elem-altered": "#10b981",
        elem: {
          phys: "#f59e0b",
          flame: "#ef4444",
          frost: "#06b6d4",
          volt: "#a855f7",
          altered: "#10b981",
        },

        // Universal quality & rarity tiers (both flat and grouped)
        "quality-ssr": "#f5d97a",
        "quality-sr": "#c084fc",
        "quality-r": "#3b82f6",
        "quality-n": "#10b981",
        quality: {
          ssr: "#f5d97a",
          sr: "#c084fc",
          r: "#3b82f6",
          n: "#10b981",
        },
      },
      borderColor: {
        hairline: "rgba(255, 255, 255, 0.08)",
        "hairline-hover": "rgba(245, 217, 122, 0.28)",
        "hairline-highlight": "rgba(120, 160, 255, 0.3)",
      },
      borderRadius: {
        xs: ".25rem",
        sm: ".375rem",
        md: ".5rem",
        lg: ".625rem",
        full: "999px",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Barlow",
          "Manrope",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: ["var(--font-serif)", "Spectral", "Georgia", "serif"],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      maxWidth: {
        shell: "90rem",
        editorial: "76.25rem",
        reading: "51.25rem",
        directory: "60rem",
      },
    },
  },
  plugins: [],
};

