/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Библиотеки — отдельными чанками: кэшируются браузером между выкатками приложения
        advancedChunks: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
            {
              name: 'data',
              test: /node_modules[\\/](@tanstack|i18next|react-i18next|date-fns)[\\/]/,
            },
            { name: 'ui', test: /node_modules[\\/](@radix-ui|@floating-ui|@dnd-kit)[\\/]/ },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
