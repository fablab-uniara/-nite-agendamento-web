/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nite: {
          blue: '#1E3A5F',
          orange: '#E8711A',
          green: '#00C896',
        },
      },
    },
  },
  plugins: [],
}

