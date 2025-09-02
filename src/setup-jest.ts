import 'jest-preset-angular/setup-jest';
import './polyfills';

// Import Spectator matchers
// Spectator Jest integration

// Mock Firebase functions globally if needed
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  })),
});

// Mock ResizeObserver
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  })),
});

// Mock Ionic/Capacitor globals
Object.defineProperty(window, 'Capacitor', {
  writable: true,
  value: {
    getPlatform: () => 'web',
    isNativePlatform: () => false,
    convertFileSrc: (path: string) => path,
  },
});

// Mock CSS.supports for Ionic components
Object.defineProperty(CSS, 'supports', {
  writable: true,
  value: jest.fn().mockImplementation(() => false),
});

// Global test utilities and configurations
global.structuredClone = global.structuredClone || ((val: any) => JSON.parse(JSON.stringify(val)));

// Spectator is configured per-test with createComponentFactory, createServiceFactory, etc.

// Configure console to show warnings in tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Suppress specific warnings that are expected in test environment
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Angular is running in development mode') ||
     args[0].includes('Multiple tabs open, persistence can only be enabled in one tab'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
