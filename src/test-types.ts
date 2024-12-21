import type { Response, BodyInit, ResponseInit } from 'undici'

export interface AIResponse extends Response {
  toJsonResponse(): Response<Record<string, unknown>>
}

export type AsyncIterableStream = AsyncIterable<string>

export function createTextStream(text: string): AsyncIterableStream {
  return {
    async *[Symbol.asyncIterator]() {
      yield text
    },
  }
}

export function createFullStream(text: string): AsyncIterableStream {
  return {
    async *[Symbol.asyncIterator]() {
      for (const char of text) {
        yield char
      }
    },
  }
}

export class CompatibleResponse extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init)
  }

  toJsonResponse(): Response<Record<string, unknown>> {
    return new Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    }) as Response<Record<string, unknown>>
  }
}
