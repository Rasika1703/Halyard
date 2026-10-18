export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#070c16', 900: '#0b1220', 800: '#111827', 700: '#536071', 300: '#8d9bb3' },
        paper: { 50: '#ffffff', 100: '#f7f8fa', 200: '#eef0f4', 300: '#e1e5ec' },
        teal: { 50: '#e8edf2', 500: '#22c7b8', 600: '#0b1220', 700: '#111827' },
        amber: { 500: '#d99a3e', 600: '#a86f1e', 50: '#fbf1e0' },
        alert: { 600: '#dc4c64', 50: '#fbe9ec' },
      },
      fontFamily: { display: ['Geist', 'system-ui', 'sans-serif'], sans: ['Geist', 'system-ui', 'sans-serif'], mono: ['"Geist Mono"', 'ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
