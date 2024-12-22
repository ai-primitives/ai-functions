import { createListFunction } from './list'
import type { AIFunctionOptions } from '../types'

describe('List Function', () => {
  const model = 'gpt-3.5-turbo'
  const list = createListFunction()

  it('should generate a list of items', async () => {
    const result = await list`fun things to do in Miami`({ model })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)

    const items = result.split('\n')
    expect(items.length).toBeGreaterThan(0)
    items.forEach((item: string) => expect(typeof item).toBe('string'))
  })

  it('should support async iteration', async () => {
    const generator = list`fun things to do in Miami`({ model })[Symbol.asyncIterator]()
    const items: string[] = []

    for await (const item of generator) {
      items.push(item)
    }

    expect(items.length).toBeGreaterThan(0)
    items.forEach((item: string) => expect(typeof item).toBe('string'))
  })

  it('should support interpolated values', async () => {
    const category = 'attractions'
    const city = 'Paris'
    const result = await list`top ${category} to visit in ${city}`({ model })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support custom options', async () => {
    const result = await list`fun things to do in Miami`({
      model,
      temperature: 0.7,
      maxTokens: 100,
      topP: 0.9,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      stop: ['\n\n'],
      seed: 123
    })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support concurrent requests', async () => {
    const cities = ['Paris', 'London', 'Tokyo']
    const promises = cities.map(city => 
      list`top attractions in ${city}`({ model, concurrency: 2 })[Symbol.asyncIterator]()
    )

    const results = await Promise.all(promises)
    results.forEach((result: AsyncGenerator<string>) => {
      expect(result).toBeDefined()
    })
  })

  it('should support streaming with progress', async () => {
    const progressItems: string[] = []
    const result = await list`fun things to do in Miami`({
      model,
      streaming: {
        onProgress: (chunk: string) => progressItems.push(chunk)
      }
    })

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(progressItems.length).toBeGreaterThan(0)
  })

  it('should handle errors', async () => {
    await expect(async () => {
      const result = await list`fun things to do in Miami`({
        model: 'invalid-model'
      })
      return result
    }).rejects.toThrow()
  })
}) 