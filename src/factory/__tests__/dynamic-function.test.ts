import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { createAIFunction, getProvider } from '../index'
import type { StreamProgress } from '../../types'

beforeEach(() => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  process.env.AI_GATEWAY = process.env.AI_GATEWAY || 'https://api.openai.com/v1'
})

describe('Dynamic AI Functions', () => {
  it('should support dynamic blog post generation', async () => {
    const blogPostSchema = z.object({
      title: z.string(),
      content: z.string(),
      tags: z.array(z.string())
    })

    const writeBlogPost = createAIFunction(blogPostSchema)
    const result = await writeBlogPost({
      title: 'Testing AI Systems',
      content: 'Write a blog post about AI testing',
      tags: ['testing', 'ai']
    }, {
      model: getProvider()('gpt-4o'),
      system: 'You are a helpful blog post writer.'
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('content')
    expect(result).toHaveProperty('tags')
    expect(Array.isArray(result.tags)).toBe(true)
    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(100)
  })

  it('should support streaming responses', async () => {
    const schema = z.object({
      response: z.string()
    })

    const streamingFunction = createAIFunction(schema)
    const progress: StreamProgress[] = []

    const response = streamingFunction({
      response: 'Generate a test response'
    }, {
      streaming: { 
        onProgress: (p: StreamProgress) => {
          progress.push(p)
        }
      },
      outputFormat: 'json',
      model: getProvider()('gpt-4o'),
      requestHandling: {
        streamingTimeout: 30000,
        concurrency: 1
      }
    })

    // Verify it returns an AsyncIterablePromise
    expect(response).toBeDefined()
    expect(typeof response.then).toBe('function')
    expect(typeof response[Symbol.asyncIterator]).toBe('function')

    // Test streaming functionality
    const chunks: string[] = []
    for await (const chunk of response) {
      chunks.push(chunk)
    }

    // Verify streaming output
    expect(chunks.length).toBeGreaterThan(0)
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[progress.length - 1].type).toBe('complete')
    
    // Verify final result matches schema
    const finalResult = await response
    const parsedResult = typeof finalResult === 'string' ? JSON.parse(finalResult) : finalResult
    expect(parsedResult).toEqual(expect.objectContaining({
      response: expect.any(String)
    }))
    expect(parsedResult.response.length).toBeGreaterThan(0)
  })

  it('should preserve template literal patterns', async () => {
    const schema = z.object({
      text: z.string()
    })

    const templateFunction = createAIFunction(schema)
    const result = await templateFunction({
      text: 'Generate some test text'
    }, {
      model: getProvider()('gpt-4o')
    })

    expect(result).toBeDefined()
    const parsedResult = typeof result === 'string' ? JSON.parse(result) : result;
    expect(parsedResult).toEqual(expect.objectContaining({
      text: expect.any(String)
    }))
  })
})
