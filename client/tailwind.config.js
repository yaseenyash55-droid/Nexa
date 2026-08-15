/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#080c14',
          card: '#111827',
          subtle: '#1f2937'
        },
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#6366f1',
          700: '#4f46e5',
          800: '#4338ca',
          900: '#3730a3'
        },
        aurora: {
          violet: '#8b5cf6',
          pink: '#ec4899',
          cyan: '#06b6d4',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e'
        }
      },
      borderRadius: {
        'nexa': '18px'
      },
      backgroundImage: {
        'aurora-glow': 'radial-gradient(circle at 50% -20%, rgba(139, 92, 246, 0.25), rgba(6, 182, 212, 0.15), transparent 70%)',
        'aurora-card': 'linear-gradient(135deg, rgba(17, 24, 39, 0.9), rgba(15, 23, 42, 0.95))'
      },
      boxShadow: {
        'glow-brand': '0 0 25px -5px rgba(139, 92, 246, 0.4)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.4)',
        'glow-pink': '0 0 25px -5px rgba(236, 72, 153, 0.4)',
        'aurora-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }
    },
  },
  plugins: [],
}
