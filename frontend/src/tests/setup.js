import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Suppress console output during tests to keep the terminal clean
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
