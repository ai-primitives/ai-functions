import { createAIFunction, createTemplateFunction } from './factory'
import { createListFunction } from './factory/list'
import { AI, ListFunction, BaseTemplateFunction, AIFunctionOptions } from './types'
import { z } from 'zod'

// Create the main template function with async iteration support
const templateFn = createTemplateFunction()

// Create the list function with async iteration support
const listFn = createListFunction()

// Create the categorizeProduct function with proper schema
const categorizeProduct = createAIFunction(
  z.object({
    productType: z.enum(['App', 'API', 'Marketplace', 'Platform', 'Packaged Service', 'Professional Service', 'Website']),
    customer: z.string().describe('ideal customer profile in 3-5 words'),
    solution: z.string().describe('describe the offer in 4-10 words'),
    description: z.string().describe('website meta description'),
  }),
)

// Create the main AI object with template literal and async iteration support
function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

function createWrappedTemplateFunction(baseFn: BaseTemplateFunction): BaseTemplateFunction {
  const wrappedFn = function (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): Promise<string> {
    if (!isTemplateStringsArray(stringsOrOptions)) {
      return baseFn(values.shift() as TemplateStringsArray, ...values, stringsOrOptions)
    }
    return baseFn(stringsOrOptions, ...values)
  }

  // Make wrappedFn async iterable by delegating to baseFn
  Object.defineProperty(wrappedFn, Symbol.asyncIterator, {
    value: function () {
      return baseFn[Symbol.asyncIterator]()
    },
    writable: true,
    configurable: true,
  })

  return wrappedFn as BaseTemplateFunction
}

const aiFn = createWrappedTemplateFunction(templateFn)
export const ai = Object.assign(aiFn, { categorizeProduct }) as unknown as AI

// Create the list function with template literal and async iteration support
export const list = createWrappedTemplateFunction(listFn) as ListFunction

// Export types for consumers
export * from './types'
