/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef3ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bafc',
          400: '#8295f8',
          500: '#6473f1',
          600: '#4f52e5',
          700: '#4240ca',
          800: '#3736a4',
          900: '#313382',
        },
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae1',
          200: '#a7f3c9',
          300: '#6ee7a8',
          400: '#35d38b',
          500: '#12b76a',
          600: '#05965c',
          700: '#04784c',
          800: '#065f3e',
          900: '#064e34',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
