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
}) 