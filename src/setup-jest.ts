import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

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
    dispatchEvent: jest.fn()
  }))
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver
});

// Mock ResizeObserver
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver
});

// Mock Ionic/Capacitor globals
Object.defineProperty(window, 'Capacitor', {
  writable: true,
  value: {
    getPlatform: () => 'web',
    isNativePlatform: () => false,
    convertFileSrc: (path: string) => path
  }
});

// Mock CSS object and CSS.supports for Ionic components
Object.defineProperty(globalThis, 'CSS', {
  writable: true,
  value: {
    supports: jest.fn().mockImplementation(() => false)
  }
});

// Global test utilities and configurations
// eslint-disable-next-line no-undef
(global as any).structuredClone = (global as any).structuredClone || ((val: any) => JSON.parse(JSON.stringify(val)));

// Spectator is configured per-test with createComponentFactory, createServiceFactory, etc.

// Configure console to show warnings in tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const [message] = args;
  if (typeof message === 'string') {
    const shouldSuppress =
      message.includes('Angular is running in development mode') ||
      message.includes('Multiple tabs open, persistence can only be enabled in one tab') ||
      message.includes('[Ionicons Warning]');

    if (shouldSuppress) {
      return;
    }
  }

  originalWarn.apply(console, args);
};

// Suppress Ionic asset path errors that spam console.log during tests
const originalLog = console.log;
console.log = (...args: any[]) => {
  const shouldSuppress = args.some(arg => {
    try {
      return typeof arg !== 'undefined' && String(arg).includes('TypeError: Invalid base URL');
    } catch {
      return false;
    }
  });

  if (shouldSuppress) {
    return;
  }

  originalLog.apply(console, args);
};
