/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        surface: '#1A2333',
        primary: '#EAB308',
        secondary: '#3B82F6',
        accent: '#EF4444',
      }
    },
  },
  plugins: [],
}
