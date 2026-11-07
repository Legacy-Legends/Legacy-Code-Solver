/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        parchment: {
          50: '#FCFBF9',
          100: '#FAF8F5',
          200: '#F5F2EB',
          300: '#EFECE4',
          400: '#E4DFD5',
          500: '#D5CFC3',
          border: '#E2DCD2',
        },
        ink: {
          900: '#18181B',
          800: '#27272A',
          700: '#3F3F46',
          600: '#52525B',
          500: '#71717A',
          400: '#A1A1AA',
        },
        plum: {
          900: '#2E082E',
          800: '#3B0764',
          700: '#4A154B',
          600: '#581C87',
          500: '#6B21A8',
          hover: '#380B39',
          light: '#F3E8FF',
        },
        lilac: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          border: '#DDD6FE',
        },
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        card: '0 4px 20px -2px rgba(46, 8, 46, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        drawer: '-16px 0 48px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
