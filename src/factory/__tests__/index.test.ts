import { describe, it, expect, vi } from 'vitest'
import { generateObject, generateText, streamText, LanguageModelV1 } from 'ai'
import { createAIFunction, createTemplateFunction } from '../index'
import { z } from 'zod'

// Mock types for AI SDK
type MockLanguageModelUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

type MockGenerateResult<T> = {
  object: T
  usage: MockLanguageModelUsage
}

type MockTextResult = {
  text: string
  usage: MockLanguageModelUsage
}

type MockStreamResult = {
  textStream: AsyncIterableStream<string>
  usage: Promise<MockLanguageModelUsage>
}

interface AsyncIterableStream<T> extends AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>
}

const mockUsage: MockLanguageModelUsage = {
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
}

// Mock the ai package functions
vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
  LanguageModelV1: class {},
}))

describe('createAIFunction', () => {
  it('should return schema when called without args', async () => {
    const fn = createAIFunction({
      productType: 'App | API | Marketplace',
      description: 'website meta description',
    })

    const result = await fn()
    expect(result).toHaveProperty('schema')
    expect(result.schema).toBeInstanceOf(z.ZodObject)
  })

  it('should generate content when called with args', async () => {
    const mockResult = { type: 'App', description: 'A cool app' }
    const mockResponse: MockGenerateResult<typeof mockResult> = {
      object: mockResult,
      usage: mockUsage,
    }
    vi.mocked(generateObject).mockResolvedValue(mockResponse as any)

    const fn = createAIFunction({
      type: 'App | API | Marketplace',
      description: 'website meta description',
    })

    const result = await fn({ type: 'App', description: 'test' })
    expect(result).toEqual(mockResult)
  })
})

describe('createTemplateFunction', () => {
  it('should support basic template literal usage', async () => {
    const mockResponse: MockTextResult = {
      text: 'Hello World',
      usage: mockUsage,
    }
    vi.mocked(generateText).mockResolvedValue(mockResponse as any)

    const fn = createTemplateFunction()
    const result = await fn`Hello ${123}`

    expect(result).toBe('Hello World')
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Hello 123',
    }))
  })

  it('should support options', async () => {
    const mockResponse: MockTextResult = {
      text: 'Custom Model Result',
      usage: mockUsage,
    }
    vi.mocked(generateText).mockResolvedValue(mockResponse as any)

    const fn = createTemplateFunction()
    const result = await fn({ prompt: 'Test', model: {} as LanguageModelV1 })

    expect(result).toBe('Custom Model Result')
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Test',
    }))
  })

  it('should support streaming with async iterator', async () => {
    const chunks = ['Hello', ' ', 'World']
    const mockStream: AsyncIterableStream<string> = {
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      }
    }

    const mockResponse: MockStreamResult = {
      textStream: mockStream,
      usage: Promise.resolve(mockUsage),
    }
    vi.mocked(streamText).mockReturnValue(mockResponse as any)

    const fn = createTemplateFunction()
    const collected: string[] = []

    for await (const chunk of fn) {
      collected.push(chunk)
    }

    expect(collected).toEqual(chunks)
  })
})
