import type { GenerateTextResult } from 'ai'

export function createJsonResponse(result: GenerateTextResult<any, any>): Response {
  return new Response(result.text, {
    headers: { 'Content-Type': 'application/json' }
  })
}

export function createStreamResponse(result: GenerateTextResult<any, any>): Response {
  return new Response(result.text, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}

export function createTextResponse(result: GenerateTextResult<any, any>): Response {
  return new Response(result.text, {
    headers: { 'Content-Type': 'text/plain' },
  })
} 