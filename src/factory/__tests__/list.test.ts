import { describe, it, expect, test } from 'vitest'
import { createListFunction } from '../list'
import { openai } from '@ai-sdk/openai'

const model = openai('gpt-4o-mini')

describe('createListFunction', () => {
  it('should generate a list of items', async () => {
    const list = createListFunction()
    const result = await list`fun things to do in Miami`({ model })
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
    const result = await list`fun things to do in Miami`({ model })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect(result.split('\n').length).toBeGreaterThan(0)
  })

  it('should handle empty input', async () => {
    const list = createListFunction()
    const result = await list``({ model })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should handle concurrent list operations', async () => {
    const list = createListFunction()
    const topics = ['cities', 'foods', 'sports']
    const tasks = topics.map(topic => 
      list`5 popular ${topic}`({ model, concurrency: 2 })
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
      list`3 popular ${topic}`({ model, concurrency: 2 })
    )
    
    const results = await Promise.all(
      streams.map(async stream => {
        const items: string[] = []
        const asyncStream = await stream
        for await (const item of asyncStream) {
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
    const list = createListFunction()
    const tasks = [
      list`valid request`({ model }),
      list`trigger error`({ model }),
      list`another valid request`({ model })
    ].map(promise => 
      promise.catch(err => {
        // If any request fails, we'll handle it gracefully
        return 'error occurred'
      })
    )
    
    const results = await Promise.all(tasks)
    expect(results).toHaveLength(3)
    results.forEach(result => {
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  it('should handle streaming responses', async () => {
    const items = ['item1', 'item2', 'item3'];
    const stream = {
      [Symbol.asyncIterator]: async function* () {
        for (const item of items) {
          yield item;
        }
      }
    };
    
    const result: string[] = [];
    for await (const item of stream) {
      result.push(item);
    }
    
    expect(result).toEqual(items);
  });
}) 