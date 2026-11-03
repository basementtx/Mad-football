// Minimal browser globals so the game modules can run in Node.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = globalThis;
