import { describe, expect, it } from 'vitest'
import { createJsonResponse, createStreamResponse, createTextResponse } from './responses'
import type { GenerateTextResult } from 'ai'

describe('Response Creators', () => {
  it('should create JSON response', () => {
    const result = {
      text: '{"test": true}',
      experimental_output: null,
      toolCalls: [],
      toolResults: [],
      toJsonResponse: () => new Response('{"test": true}', { headers: { 'Content-Type': 'application/json' } })
    } as unknown as GenerateTextResult<any, any>

    const response = createJsonResponse(result)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('should create stream response', () => {
    const result = {
      text: '',
      experimental_output: null,
      toolCalls: [],
      toolResults: [],
      experimental_stream: new ReadableStream()
    } as unknown as GenerateTextResult<any, any>

    const response = createStreamResponse(result)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
  })

  it('should create text response', () => {
    const result = {
      text: 'Hello, World!',
      experimental_output: null,
      toolCalls: [],
      toolResults: []
    } as unknown as GenerateTextResult<any, any>

    const response = createTextResponse(result)
    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/plain')
  })
}) 