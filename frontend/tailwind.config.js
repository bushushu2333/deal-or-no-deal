/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        },
        banker: {
          700: '#1e3a8a',
          800: '#1e40af',
          900: '#172554',
        }
      }
    },
  },
  plugins: [],
}
