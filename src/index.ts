import { createAIFunction, createTemplateFunction } from './factory'
import { createListFunction } from './factory/list'
import { AI, ListFunction, BaseTemplateFunction, AIFunctionOptions, TemplateResult } from './types'
import { z } from 'zod'

// Create the main template function with async iteration support
const templateFn = createTemplateFunction()

// Create the list function with async iteration support
const listFn = createListFunction()

// Create the main AI object with template literal and async iteration support
function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

function createWrappedTemplateFunction(baseFn: BaseTemplateFunction): AI {
  function aiFunction(strings: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult {
    if (isTemplateStringsArray(strings)) {
      const prompt = String.raw({ raw: strings.raw }, ...values)
      const result = baseFn({ prompt })
      return Object.assign(result, {
        call: (options?: AIFunctionOptions) => baseFn({ ...options, prompt })
      })
    }
    return baseFn(strings as AIFunctionOptions)
  }

  // Add required properties to make it a BaseTemplateFunction
  Object.assign(aiFunction, {
    [Symbol.asyncIterator]: baseFn[Symbol.asyncIterator].bind(baseFn),
    queue: baseFn.queue,
    withOptions: baseFn.withOptions.bind(baseFn)
  })

  // Add prototype properties to make it callable as a function
  Object.setPrototypeOf(aiFunction, Function.prototype)

  return aiFunction as AI
}

// Create and export the AI template tag function
export const ai = createWrappedTemplateFunction(templateFn)

// Create and export the list function
export const list = createWrappedTemplateFunction(listFn) as ListFunction

// Export types
export type { AI, ListFunction, BaseTemplateFunction, AIFunctionOptions, TemplateResult }
