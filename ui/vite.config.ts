import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          editor: ['monaco-editor', '@monaco-editor/react'],
          visualization: ['d3'],
          ui: ['@radix-ui/react-tabs', '@radix-ui/react-scroll-area'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'd3', 'monaco-editor'],
  },
});