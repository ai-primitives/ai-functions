import type { GenerateJsonResult, StreamingResult, GenerateResult } from 'ai'

export function createJsonResponse(result: GenerateJsonResult): Response {
  return result.toJsonResponse()
}

export function createStreamResponse(result: StreamingResult): Response {
  return new Response(result.experimental_stream as unknown as ReadableStream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}

export function createTextResponse(result: GenerateResult): Response {
  return new Response(result.text, {
    headers: { 'Content-Type': 'text/plain' },
  })
} 