/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        command: {
          bg: '#050811',
          panel: '#0b1120',
          border: '#1e293b',
          healthy: '#10b981',
          sick: '#b47b38',
          blast: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
