import { z } from 'zod'
import { streamElements } from '../streaming/utils'
import type { AIFunctionOptions, ListResult } from '../types'

export function createListFunction(defaultOptions: AIFunctionOptions = {}) {
  const fn = function(strings: TemplateStringsArray, ...values: any[]): ListResult {
    const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
    const lastValue = values[values.length - 1]
    const options = typeof lastValue === 'object' && !Array.isArray(lastValue) && lastValue !== null
      ? { ...defaultOptions, ...lastValue as AIFunctionOptions }
      : defaultOptions

    const promise = (async () => {
      const items: string[] = []
      for await (const item of streamElements({ ...options, prompt })) {
        items.push(item)
      }
      return items.join('\n')
    })()

    return Object.assign(promise, {
      [Symbol.asyncIterator]: async function*() {
        yield* streamElements({ ...options, prompt })
      }
    })
  }

  const result = Object.assign(fn, {
    withOptions: (options: AIFunctionOptions) => {
      const mergedOptions = { ...defaultOptions, ...options }
      return (strings: TemplateStringsArray, ...values: any[]): ListResult => {
        const prompt = strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')
        const promise = (async () => {
          const items: string[] = []
          for await (const item of streamElements({ ...mergedOptions, prompt })) {
            items.push(item)
          }
          return items.join('\n')
        })()

        return Object.assign(promise, {
          [Symbol.asyncIterator]: async function*() {
            yield* streamElements({ ...mergedOptions, prompt })
          }
        })
      }
    }
  })

  return result
} 