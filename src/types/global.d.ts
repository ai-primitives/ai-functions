declare global {
  var AbortController: typeof globalThis.AbortController
  var setTimeout: typeof globalThis.setTimeout
  var clearTimeout: typeof globalThis.clearTimeout
  var console: typeof globalThis.console
  var process: typeof globalThis.process
}

export {}
