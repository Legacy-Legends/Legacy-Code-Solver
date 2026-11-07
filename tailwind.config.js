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
          bg: '#070b14',
          panel: '#0d1322',
          border: '#1e293b',
          healthy: '#10b981',
          sick: '#b47b38',
          blast: '#ef4444',
        },
        trace: {
          cyan: '#00f5d4',
          sky: '#38bdf8',
          indigo: '#818cf8',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'trace-flow': 'traceFlow 2s linear infinite',
      },
      keyframes: {
        traceFlow: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
};
