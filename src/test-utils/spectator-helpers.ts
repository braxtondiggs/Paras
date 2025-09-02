import { Type } from '@angular/core';
import { createComponentFactory, createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { MockAuthService, MockFeedService } from './firebase-mocks';
import { 
  MockAlertController, 
  MockLoadingController, 
  MockModalController, 
  MockToastController, 
  MockPlatform 
} from './ionic-mocks';

// Common providers for tests
export const commonProviders = [
  { provide: 'AuthService', useClass: MockAuthService },
  { provide: 'FeedService', useClass: MockFeedService },
  { provide: 'AlertController', useClass: MockAlertController },
  { provide: 'LoadingController', useClass: MockLoadingController },
  { provide: 'ModalController', useClass: MockModalController },
  { provide: 'ToastController', useClass: MockToastController },
  { provide: 'Platform', useClass: MockPlatform },
];

/**
 * Helper function to create a component factory with common Ionic/Firebase mocks
 */
export function createIonicComponentFactory<T>(
  component: Type<T>,
  config: any = {}
) {
  return createComponentFactory({
    component,
    imports: [
      // Add common Ionic imports
      ...(config.imports || [])
    ],
    providers: [
      // Common mocks
      ...commonProviders,
      ...(config.providers || [])
    ],
    mocks: [
      // Services to auto-mock
      ...(config.mocks || [])
    ],
    detectChanges: config.detectChanges !== false,
    shallow: config.shallow || false,
    ...config
  });
}

/**
 * Helper function to create a service factory with common mocks
 */
export function createIonicServiceFactory<T>(
  service: Type<T>,
  config: any = {}
) {
  return createServiceFactory({
    service,
    providers: [
      ...commonProviders,
      ...(config.providers || [])
    ],
    mocks: [
      ...(config.mocks || [])
    ],
    ...config
  });
}

/**
 * Helper function to setup common test environment
 */
export function setupSpectatorTest() {
  // Common setup that can be called before each test
  // This can include clearing mocks, resetting state, etc.
}

/**
 * Helper to create a mock with common spy methods
 */
export function createMockWithSpy<T = any>(methods: string[] = []): T {
  const mock = {} as T;
  methods.forEach(method => {
    (mock as any)[method] = jest.fn();
  });
  return mock;
}

// Common test utilities
export const testUtils = {
  // Wait for async operations
  async waitForAsync(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
  },

  // Mock console methods
  mockConsole: () => ({
    log: jest.spyOn(console, 'log').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation(),
  }),

  // Restore console methods
  restoreConsole(mocks: { log: jest.SpyInstance; warn: jest.SpyInstance; error: jest.SpyInstance }) {
    Object.values(mocks).forEach((mock) => mock.mockRestore());
  },
};

// Note: Spectator provides its own comprehensive Jest matchers
// No need to extend Jest with custom matchers when using Spectator