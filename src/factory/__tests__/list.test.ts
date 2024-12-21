import { describe, it, expect } from 'vitest'
import { createListFunction } from '../list'
import { openai } from '@ai-sdk/openai'

const model = openai('gpt-4o-mini')

describe('createListFunction', () => {
  it('should generate a list of items', async () => {
    const list = createListFunction()
    const result = await list`fun things to do in Miami`
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(result.split('\n').length).toBeGreaterThan(0)
  })

  it('should support async iteration', async () => {
    const list = createListFunction()
    const items: string[] = []
    for await (const item of list`fun things to do in Miami`) {
      items.push(item)
    }
    expect(items.length).toBeGreaterThan(0)
  })

  it('should support configuration options', async () => {
    const list = createListFunction()
    const result = await list.withOptions({
      model,
      prompt: 'fun things to do in Miami'
    })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(result.split('\n').length).toBeGreaterThan(0)
  })

  it('should handle empty input', async () => {
    const list = createListFunction()
    const result = await list``
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should handle concurrent list operations', async () => {
    const list = createListFunction()
    const topics = ['cities', 'foods', 'sports']
    const tasks = topics.map(topic => 
      (list as any)`5 popular ${topic}`({
        concurrency: { concurrency: 2 }
      })
    )
    
    const results = await Promise.all(tasks)
    expect(results).toHaveLength(3)
    results.forEach((result: string) => {
      expect(result.split('\n').length).toBeGreaterThan(0)
    })
  })

  it('should handle concurrent streaming list operations', async () => {
    const list = createListFunction()
    const topics = ['movies', 'books', 'games']
    const streams = topics.map(topic => 
      (list as any)`3 popular ${topic}`({
        concurrency: { concurrency: 2 }
      })
    )
    
    const results = await Promise.all(
      streams.map(async stream => {
        const items: string[] = []
        for await (const item of stream) {
          items.push(item)
        }
        return items
      })
    )
    
    expect(results).toHaveLength(3)
    results.forEach(items => {
      expect(items.length).toBeGreaterThan(0)
      expect(items.every(item => typeof item === 'string')).toBe(true)
    })
  })

  it('should handle errors in concurrent list operations', async () => {
    const mockModel = {
      ...model,
      generate: () => {
        throw new Error('Failed to generate list')
      }
    }

    const list = createListFunction({
      concurrency: { concurrency: 2 },
      model: mockModel
    })
    
    const tasks = [
      list`valid request`,
      list`trigger error`,
      list`another valid request`
    ].map((promise, i) => 
      promise.catch(err => {
        if (i === 1) {
          expect(err.message).toBe('Failed to generate list')
          return 'error-1'
        }
        return 'success'
      })
    )
    
    const results = await Promise.all(tasks)
    expect(results).toHaveLength(3)
    expect(results[0]).toBe('success')
    expect(results[1]).toBe('error-1')
    expect(results[2]).toBe('success')
  })
}) 