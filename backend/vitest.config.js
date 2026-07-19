import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'demo/**',
        'db/seed.js',
        'db/cloudSql.js',
        'middleware/googleCloudLogger.js',
        'server.js',
        '*.config.js'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      }
    },
    // Isolate each test file so the DB singleton is fresh per file
    isolate: true,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
