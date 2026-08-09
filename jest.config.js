/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // `expo-modules-core` installs nested under `expo/node_modules` rather than
    // hoisted to the root, which the preset's own setup file cannot resolve.
    '^expo-modules-core$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core',
    '^expo-modules-core/(.*)$': '<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/app/**'],
};
