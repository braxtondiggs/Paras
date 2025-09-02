/// <reference types="jest" />

// Jest global types for this project
declare global {
  namespace jest {
    interface Matchers<R> {
      // Add any custom Jest matchers here if needed
    }
  }
}

export {};
