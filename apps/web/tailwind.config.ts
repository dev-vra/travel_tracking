import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terra: {
          50: '#f5f7f4',
          600: '#3f6b4f',
          700: '#2f5a3f',
          900: '#16271c',
        },
      },
    },
  },
  plugins: [],
};

export default config;
