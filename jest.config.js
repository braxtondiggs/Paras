export default {
  // Use the latest jest-preset-angular preset
  preset: 'jest-preset-angular',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  
  // TypeScript configuration
  transform: {
    '^.+\\.(ts|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.html$'
      }
    ]
  },
  
  // Module paths and name mapping
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@features/(.*)$': '<rootDir>/src/app/features/$1',
    '^@data/(.*)$': '<rootDir>/src/app/data/$1',
    '^@environments/(.*)$': '<rootDir>/src/environments/$1',
    'ionicons/components/ion-icon.js': '@ionic/core/components/ion-icon.js'
  },
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|js)',
    '<rootDir>/src/**/*.(test|spec).(ts|js)'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/www/',
    '<rootDir>/e2e/'
  ],
  
  // Transform certain node_modules to handle ESM
  transformIgnorePatterns: [
    'node_modules/(?!(@ionic|@stencil|ionicons|@angular|@capacitor|@ngneat)/)'
  ],
  
  // Module paths to ignore
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/www/'
  ],
  
  // Coverage configuration
  collectCoverage: false, // Enable manually when needed
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.test.ts',
    '!src/app/**/*.mock.ts',
    '!src/app/**/index.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/*.interface.ts',
    '!src/app/**/*.type.ts',
    '!src/app/**/*.d.ts',
    '!src/main.ts',
    '!src/polyfills.ts'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'html',
    'text-summary',
    'text',
    'lcov',
    'clover'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70, 
      lines: 70,
      statements: 70
    }
  },
  
  // Performance and reliability
  maxWorkers: '50%',
  verbose: false,
  silent: false,
  bail: false,
  
  // Timeouts
  testTimeout: 10000,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Cache
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Globals (deprecated in Jest 30, but still supported)
  // Use transform configuration above instead
  globals: {},
  
  // Modern features
  extensionsToTreatAsEsm: ['.ts'],
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'jest-junit.xml',
        suiteName: 'Paras Tests'
      }
    ]
  ]
};