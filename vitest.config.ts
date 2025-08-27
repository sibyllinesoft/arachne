import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'scripts/**',
        'ui/**',
        'deprecated/**',
        'output/**',
        'analysis/**',
        'benchmarks/**',
        'contracts/**',
        'spec/**',
        'infra/**',
        '*.js'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ir': path.resolve(__dirname, './src/ir'),
      '@passes': path.resolve(__dirname, './src/passes'),
      '@lifters': path.resolve(__dirname, './src/lifters'),
      '@sandbox': path.resolve(__dirname, './src/sandbox'),
      '@glue': path.resolve(__dirname, './src/glue'),
      '@cli': path.resolve(__dirname, './src/cli')
    }
  }
});