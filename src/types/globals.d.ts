/// <reference types="node" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

declare global {
  interface AbortController {
    abort(reason?: unknown): void;
    readonly signal: AbortSignal;
  }
  
  interface AbortSignal {
    readonly aborted: boolean;
    readonly reason: unknown;
    throwIfAborted(): void;
  }

  interface Window {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
    AbortController: typeof AbortController;
  }

  var setTimeout: (callback: (...args: unknown[]) => void, ms?: number) => NodeJS.Timeout;
  var clearTimeout: (timeoutId: NodeJS.Timeout) => void;
  var AbortController: {
    prototype: AbortController;
    new(): AbortController;
  };

  namespace NodeJS {
    interface Timeout {
      ref(): NodeJS.Timeout;
      unref(): NodeJS.Timeout;
    }
  }

  // Timer functions
  function setTimeout(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): NodeJS.Timeout;
  function clearTimeout(timeoutId: NodeJS.Timeout): void;
  
  // Stream types
  interface ReadableStream<R = unknown> {
    getReader(): ReadableStreamDefaultReader<R>;
    tee(): [ReadableStream<R>, ReadableStream<R>];
    pipeThrough<T>(transform: ReadableWritablePair<T, R>): ReadableStream<T>;
    pipeTo(destination: WritableStream<R>): Promise<void>;
    cancel(reason?: unknown): Promise<void>;
  }

  interface ReadableStreamDefaultReader<R = unknown> {
    read(): Promise<ReadableStreamReadResult<R>>;
    releaseLock(): void;
    cancel(reason?: unknown): Promise<void>;
    closed: Promise<void>;
  }

  interface ReadableStreamReadResult<T> {
    done: boolean;
    value: T | undefined;
  }

  interface ReadableWritablePair<T, R> {
    readable: ReadableStream<R>;
    writable: WritableStream<T>;
  }

  interface WritableStream<W = unknown> {
    getWriter(): WritableStreamDefaultWriter<W>;
    abort(reason?: unknown): Promise<void>;
    close(): Promise<void>;
  }

  interface WritableStreamDefaultWriter<W = unknown> {
    write(chunk: W): Promise<void>;
    close(): Promise<void>;
    abort(reason?: unknown): Promise<void>;
    releaseLock(): void;
    closed: Promise<void>;
    ready: Promise<void>;
  }
}

export {};
