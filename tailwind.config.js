/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#5C7A3D',
          'primary-light': '#8BA76A',
          'primary-dark': '#3E5529',
          accent: '#3D5A3A',
          'accent-light': '#6B8F68',
          cream: '#F5F7F0',
          'warm-white': '#FAFCF7',
          sand: '#E8EDDF',
          stone: '#D4DBC8',
          charcoal: '#2A2D26',
          'warm-gray': '#5A5F52',
          'mid-gray': '#8A8F82',
          'light-gray': '#C2C8BA',
          wine: '#3D5A3A',
        },
        success: '#5B8C5A',
        warning: '#D4A843',
        danger: '#C44D4D',
        info: '#5B7FA8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
