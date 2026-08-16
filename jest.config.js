/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, types: ['jest', 'node'] } }],
  },
  moduleNameMapper: {
    // map expo-* to mocks so tests don't need native modules
    '^expo-.*$': '<rootDir>/__mocks__/expo.js',
  },
  testMatch: ['**/src/**/*.spec.ts'],
};
