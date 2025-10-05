/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chrono-sky': '#9FBAC3',
        'chrono-card': 'rgba(255,255,255,0.68)',
        'chrono-border': 'rgba(255,255,255,0.75)',
        'chrono-text': '#1F2A3A',
      },
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 24px 60px rgba(15, 23, 42, 0.18)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.35)',
      },
      dropShadow: {
        glow: '0 0 25px rgba(255,255,255,0.5)',
      },
      borderRadius: {
        fluid: '32px',
      },
    },
  },
  plugins: [],
}
