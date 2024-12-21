import { describe, expect, it, beforeEach } from 'vitest'
import { createListFunction } from './list'
import { openai } from '@ai-sdk/openai'

describe('List Function', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini')

  describe('Template Literals', () => {
    it('should generate list using template literal', async () => {
      const list = createListFunction()
      const result = await list`fun things to do in Miami`({ model })
      expect(result).toBeDefined()
      const items = result.split('\n')
      expect(items.length).toBeGreaterThan(0)
      items.forEach(item => expect(typeof item).toBe('string'))
    })

    it('should support async iteration', async () => {
      const list = createListFunction()
      const items: string[] = []
      for await (const item of list`fun things to do in Miami`({ model })) {
        items.push(item)
      }
      expect(items.length).toBeGreaterThan(0)
      items.forEach(item => expect(typeof item).toBe('string'))
    })

    it('should support interpolation', async () => {
      const list = createListFunction()
      const city = 'Paris'
      const category = 'museums'
      const result = await list`top ${category} to visit in ${city}`({ model })
      expect(result).toContain('Louvre')
    })
  })

  describe('Configuration', () => {
    it('should support system prompts', async () => {
      const list = createListFunction()
      const result = await list`fun things to do in Miami`({
        model,
        system: 'You are an expert tour guide',
        temperature: 0.2
      })
      expect(result).toBeDefined()
      expect(result.split('\n').length).toBeGreaterThan(0)
    })

    it('should support concurrency for multiple lists', async () => {
      const list = createListFunction()
      const cities = ['Paris', 'London', 'Tokyo']
      const results = await Promise.all(
        cities.map(city => list`top attractions in ${city}`({ model, concurrency: 2 }))
      )
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.split('\n').length).toBeGreaterThan(0)
      })
    })
  })

  describe('Streaming', () => {
    it('should stream list items', async () => {
      const list = createListFunction()
      const items: string[] = []
      const progressItems: string[] = []

      for await (const item of list`fun things to do in Miami`({
        model,
        streaming: {
          onProgress: chunk => progressItems.push(chunk)
        }
      })) {
        items.push(item)
      }

      expect(items.length).toBeGreaterThan(0)
      expect(progressItems.length).toBeGreaterThan(0)
    })

    it('should handle streaming errors gracefully', async () => {
      const list = createListFunction()
      await expect(async () => {
        for await (const item of list`fun things to do in Miami`({
          model: undefined as any // Force an error
        })) {
          console.log(item)
        }
      }).rejects.toThrow()
    })
  })
}) 