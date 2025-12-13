/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Lora", "serif"],
      },
      colors: {
        christmas: {
          red: "#B91C1C",
          green: "#15803D",
          gold: "#A16207",
          accent: "#FCD34D",
          cream: "#FFFCF5",
          dark: "#1F2937"
        }
      }
    }
  },
  darkMode: "class"
};
