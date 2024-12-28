import { describe, expect, it, beforeEach } from 'vitest'
import { ai } from './index'
import { z } from 'zod'
import type { AsyncIterablePromise, DynamicAIFunction } from './types'
import { openai } from '@ai-sdk/openai'

describe('ai', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai(process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o', { structuredOutputs: true })

  describe('template tag', () => {
    it('should support basic template literals', async () => {
      const name = 'World'
      const result = await ai`Hello ${name}`({ model })
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should support configuration object', async () => {
      const name = 'World'
      const result = await ai`Hello ${name}`({ model })
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should support JSON output with schema', async () => {
      const schema = z.object({
        greeting: z.string(),
        timestamp: z.number(),
      })

      const result = await ai`Generate a greeting with the current timestamp`({
        model,
        outputFormat: 'json',
        schema
      })
      const parsed = schema.parse(typeof result === 'string' ? JSON.parse(result) : result)
      expect(parsed).toBeDefined()
      expect(typeof parsed.greeting).toBe('string')
      expect(typeof parsed.timestamp).toBe('number')
    })

    it('should support streaming responses', async () => {
      const streamingModel = openai('gpt-4o', { 
        structuredOutputs: true
      })
      const response = ai`List some items`({ 
        model: streamingModel,
        outputFormat: 'json',
        schema: z.array(z.string()),
        streaming: {
          onProgress: () => {},
          enableTokenCounting: true
        }
      }) as AsyncIterablePromise<string>
      
      expect(response[Symbol.asyncIterator]).toBeDefined()
      const chunks: string[] = []
      for await (const chunk of response) {
        chunks.push(chunk)
      }
      expect(chunks.length).toBeGreaterThan(0)
      expect(JSON.parse(chunks.join(''))).toBeInstanceOf(Array)
    })
  })

  describe('dynamic functions', () => {
    it('should support dynamic function creation', async () => {
      const writeBlogPost = ai.writeBlogPost as DynamicAIFunction
      const result = await writeBlogPost({
        title: 'Testing Dynamic Functions',
        description: 'A test blog post about AI',
        wordCount: '500-1000 words',
        tone: 'Technical | Professional | Engaging'
      }, { model })
      
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(200) // Reasonable minimum for a blog post
    })

    it('should support dynamic function with JSON output', async () => {
      const analyzeText = ai.analyzeText as DynamicAIFunction
      const result = await analyzeText({
        text: 'This is a sample text for analysis.',
        aspects: 'Tone | Sentiment | Key Points',
        format: 'JSON with analysis results'
      }, { 
        model,
        outputFormat: 'json'
      })
      
      const parsed = JSON.parse(result)
      expect(parsed).toBeDefined()
      expect(typeof parsed).toBe('object')
    })
  })
})
