import { describe, expect, it } from 'vitest'
import { createJsonResponse, createStreamResponse, createTextResponse } from './responses'
import type { GenerateJsonResult, StreamingResult, GenerateResult } from 'ai'

describe('Response Creation', () => {
  it('should create JSON response', () => {
    const mockResult = {
      toJsonResponse: () => new Response(JSON.stringify({ test: 'data' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } as GenerateJsonResult

    const response = createJsonResponse(mockResult)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('should create stream response', () => {
    const mockResult = {
      experimental_stream: new ReadableStream()
    } as StreamingResult

    const response = createStreamResponse(mockResult)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('should create text response', () => {
    const mockResult = {
      text: 'test content'
    } as GenerateResult

    const response = createTextResponse(mockResult)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/plain')
  })
}) 