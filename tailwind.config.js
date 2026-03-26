/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./APP/**/*.{html,js}",
    "./index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        '24px': '24px',
      }
    },
  },
  plugins: [],
}
