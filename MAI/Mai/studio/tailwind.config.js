/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-gold': '#FFD700',
        'neon-red': '#FF1744',
      },
      boxShadow: {
        'neon-gold': '0 0 20px rgba(255, 215, 0, 0.5)',
        'neon-red': '0 0 20px rgba(255, 23, 68, 0.5)',
      },
    },
  },
  plugins: [],
}

