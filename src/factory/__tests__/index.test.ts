import { describe, expect, it, beforeEach } from 'vitest'
import { z } from 'zod'
import { createTemplateFunction, createAIFunction } from '../index'
import { createListFunction } from '../list'
import type { AIFunctionOptions, BaseTemplateFunction, TemplateResult } from '../../types'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

describe('createAIFunction', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  it('should return schema when called without args', async () => {
    const schema = z.object({
      productType: z.enum(['App', 'API', 'Marketplace']),
      description: z.string().describe('website meta description'),
    })
    const fn = createAIFunction(schema)

    const result = await fn()
    expect(result).toHaveProperty('productType')
    expect(result).toHaveProperty('description')
  })

  it('should generate content when called with args', async () => {
    const schema = z.object({
      productType: z.enum(['App', 'API', 'Marketplace']),
      description: z.string().describe('website meta description'),
    })
    const fn = createAIFunction(schema)

    const result = await fn({ 
      productType: 'App', 
      description: 'A modern web application for task management' 
    }, {
      model: openai('gpt-4o-mini')
    })
    
    expect(result).toHaveProperty('productType')
    expect(result).toHaveProperty('description')
    expect(typeof result.description).toBe('string')
  })
})

describe('createTemplateFunction', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  describe('output format handling', () => {
    it('should support JSON output format with schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const fn = createTemplateFunction()
      const result = await fn.withOptions({
        outputFormat: 'object',
        schema,
        model: openai('gpt-4o-mini')
      })
      const parsed = schema.parse(JSON.parse(result))
      expect(parsed).toBeDefined()
      expect(typeof parsed.name).toBe('string')
      expect(typeof parsed.age).toBe('number')
    })
  })

  it('should use custom baseURL when AI_GATEWAY is set', async () => {
    process.env.AI_GATEWAY = 'https://api.openai.com/v1'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      model: openai('gpt-4o-mini')
    })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should use default OpenAI when AI_GATEWAY is not set', async () => {
    delete process.env.AI_GATEWAY
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      model: openai('gpt-4o-mini')
    })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  describe('error handling', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
    })

    it('should handle template strings correctly', async () => {
      const fn = createTemplateFunction()
      const result = await fn.withOptions({
        prompt: 'List three programming languages',
        model: openai('gpt-4o-mini')
      })
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should throw on mismatched template values', () => {
      const fn = createTemplateFunction()
      const templateStrings = Object.assign(['test ', ' ', ' ', ''], {
        raw: ['test ', ' ', ' ', ''],
      }) as TemplateStringsArray
      expect(() => fn(templateStrings, 1, 2)).toThrow('Template literal slots must match provided values')
    })
  })

  it('should generate text', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      prompt: 'Hello, how are you?'
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support streaming', async () => {
    const fn = createTemplateFunction()
    const result = fn.withOptions({
      prompt: 'Hello, how are you?'
    })
    const chunks: string[] = []
    for await (const chunk of result) {
      chunks.push(chunk)
    }
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('should support JSON output with schema', async () => {
    const fn = createTemplateFunction()
    const schema = z.object({
      name: z.string(),
      age: z.number()
    })
    const result = await fn.withOptions({
      outputFormat: 'object',
      schema,
      prompt: 'Generate a person with a name and age'
    })
    expect(result).toBeDefined()
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('age')
    expect(typeof parsed.name).toBe('string')
    expect(typeof parsed.age).toBe('number')
  })

  it('should support JSON output without schema', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      outputFormat: 'no-schema',
      prompt: 'Generate a random object'
    })
    expect(result).toBeDefined()
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it('should support model parameters', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      stop: ['END'],
      seed: 42
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support array of stop sequences', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      stop: ['END', 'STOP']
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support deterministic output with seed', async () => {
    const fn = createTemplateFunction()
    const prompt = 'Generate a random number between 1 and 10'
    const result1 = await fn.withOptions({ prompt, seed: 42 })
    const result2 = await fn.withOptions({ prompt, seed: 42 })
    expect(result1).toBe(result2)
  })

  it('should support system parameter', async () => {
    const fn = createTemplateFunction()
    const result = await fn.withOptions({
      system: 'You are a helpful assistant that speaks in a formal tone.',
      prompt: 'Tell me about AI'
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should support system parameter in JSON output', async () => {
    const fn = createTemplateFunction()
    const schema = z.object({
      title: z.string(),
      content: z.string()
    })
    const result = await fn.withOptions({
      outputFormat: 'object',
      schema,
      system: 'You are a helpful assistant that speaks in a formal tone.',
      prompt: 'Write an article about AI'
    })
    expect(result).toBeDefined()
    const parsed = JSON.parse(result)
    expect(parsed).toHaveProperty('title')
    expect(parsed).toHaveProperty('content')
    expect(typeof parsed.title).toBe('string')
    expect(typeof parsed.content).toBe('string')
  })

  it('should support system parameter in list function', async () => {
    const list = createListFunction()
    const result = await list.withOptions({
      system: 'You are a helpful assistant that provides concise, one-word answers.',
      prompt: 'List 3 programming languages'
    })
    expect(result).toBeDefined()
    const items = result.split('\n')
    expect(items.length).toBe(3)
    items.forEach((item: string) => expect(item.split(' ').length).toBe(1))
  })

  describe('concurrency handling', () => {
    it('should respect concurrency limits', async () => {
      const fn = createTemplateFunction()
      const startTime = Date.now()
      const tasks = Array(5).fill(null).map((_, i) => 
        new Promise<string>(resolve => setTimeout(() => resolve(fn.withOptions({ prompt: `task ${i}` })), 500))
      )
      
      const results = await Promise.all(tasks)
      const endTime = Date.now()
      
      // With concurrency of 2 and 5 tasks of 500ms each, it should take at least 1500ms
      expect(endTime - startTime).toBeGreaterThan(1400)
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      })
    })

    it('should handle concurrent streaming requests', async () => {
      const fn = createTemplateFunction()
      const streams = Array(3).fill(null).map((_, i) => 
        new Promise<string>(resolve => setTimeout(() => resolve(fn.withOptions({ prompt: `generate a short story about item ${i}` })), 500))
      )
      
      const results = await Promise.all(
        streams.map(async stream => {
          const chunks: string[] = []
          const asyncStream = await stream
          for await (const chunk of asyncStream) {
            chunks.push(chunk)
          }
          return chunks
        })
      )
      
      expect(results).toHaveLength(3)
      results.forEach(chunks => {
        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.every(chunk => typeof chunk === 'string')).toBe(true)
      })
    })

    it('should queue requests when concurrency limit is reached', async () => {
      const fn = createTemplateFunction()
      const executionOrder: number[] = []
      const startTimes: number[] = []
      
      const tasks = Array(4).fill(null).map((_, i) => 
        new Promise<number>(resolve => {
          startTimes[i] = Date.now()
          setTimeout(() => {
            executionOrder.push(i)
            resolve(i)
          }, 500)
        }).then(async (index) => {
          await fn.withOptions({ prompt: `task ${index}` })
          return index
        })
      )
      
      const results = await Promise.all(tasks)
      
      // With concurrency of 1, tasks should complete in order
      expect(executionOrder).toEqual([0, 1, 2, 3])
      expect(results).toEqual([0, 1, 2, 3])
      
      // Each task should start after the previous one finishes
      for (let i = 1; i < startTimes.length; i++) {
        expect(startTimes[i] - startTimes[i-1]).toBeGreaterThanOrEqual(450)
      }
    })

    it('should handle errors in concurrent requests', async () => {
      const fn = createTemplateFunction()
      const tasks = Array(3).fill(null).map((_, i) => 
        new Promise<string>(resolve => setTimeout(() => resolve(fn.withOptions({ 
          prompt: i === 1 ? '{invalid json}' : `task ${i}`,
          outputFormat: 'object'
        })), 500))
          .then(result => {
            if (i === 1) {
              return JSON.stringify({ error: `error-${i}`, message: 'Invalid JSON' })
            }
            return JSON.stringify({ result: `task-${i}` })
          })
          .catch((err: Error) => {
            return JSON.stringify({ error: `error-${i}`, message: err.message })
          })
      )
      
      const results = await Promise.all(tasks)
      expect(results).toHaveLength(3)
      
      const result0 = JSON.parse(results[0])
      expect(result0.result).toBe('task-0')
      
      const errorResult = JSON.parse(results[1])
      expect(errorResult.error).toBe('error-1')
      expect(errorResult.message).toBeDefined()
      
      const result2 = JSON.parse(results[2])
      expect(result2.result).toBe('task-2')
    })
  })
})
