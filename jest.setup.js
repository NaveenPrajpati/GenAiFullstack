// The real AsyncStorage is a native module; its maintained mock is an in-memory
// store, which is exactly the fidelity these tests want — they assert on what
// was persisted, not on how it crossed the bridge.
// The mock ships as CommonJS, so it needs the `default` interop the app's
// `import AsyncStorage from ...` call sites expect.
jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  return { __esModule: true, ...mock, default: mock };
});
