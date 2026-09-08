/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        skydream: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#87CEEB",
        },
      },
      fontFamily: {
        cute: ['"Fredoka"', '"Comic Neue"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(56, 189, 248, 0.25)",
        cloud: "0 8px 24px rgba(135, 206, 235, 0.35)",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        softPulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(1.25)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        heartPop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.35)" },
          "100%": { transform: "scale(1)" },
        },
        penguinBob: {
          "0%, 100%": { transform: "translateY(0) rotate(-2deg)" },
          "50%": { transform: "translateY(-10px) rotate(2deg)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        softPulse: "softPulse 1.2s ease-in-out infinite",
        fadeIn: "fadeIn 0.35s ease-out",
        heartPop: "heartPop 0.45s ease-out",
        "penguin-bob": "penguinBob 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
