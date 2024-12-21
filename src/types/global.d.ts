declare global {
  // Add DOM types that Node.js doesn't have by default
  type ReadableStream = globalThis.ReadableStream
  type AbortController = globalThis.AbortController

  // Add Node.js timer types
  const setTimeout: typeof globalThis.setTimeout
  const clearTimeout: typeof globalThis.clearTimeout
}

export {}
