// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-montserrat)", "sans-serif"],
        title: ["var(--font-montserrat-alternates)", "sans-serif"],
        hand: ["var(--font-mynerve)", "cursive"],
      },
      colors: {
        brandRed: "#E63946",
      },
    },
  },
  plugins: [],
};
