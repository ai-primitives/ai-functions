import { createAIFunction, createTemplateFunction } from './factory'
import { createListFunction } from './factory/list'
import { AI, ListFunction, BaseTemplateFunction, AITemplateFunction, AIFunctionOptions, TemplateResult } from './types'
import { z } from 'zod'
import { createSchemaFromTemplate } from './utils/schema'

// Create the main template function with async iteration support
const templateFn = createTemplateFunction()

// Create the list function with async iteration support
const listFn = createListFunction()

// Create the main AI object with template literal and async iteration support
function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

function createWrappedTemplateFunction(baseFn: BaseTemplateFunction): BaseTemplateFunction {
  const wrappedFn = function (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult {
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

  // Add withOptions method
  Object.defineProperty(wrappedFn, 'withOptions', {
    value: (opts?: AIFunctionOptions) => baseFn.withOptions(opts),
    writable: true,
    configurable: true,
  })

  // Add queue property
  Object.defineProperty(wrappedFn, 'queue', {
    get: () => baseFn.queue,
    configurable: true,
  })

  return wrappedFn as BaseTemplateFunction
}

function createDynamicAI(baseAI: AITemplateFunction): AI {
  return new Proxy(baseAI as AI, {
    get(target, prop, receiver) {
      // If prop is part of baseAI or a symbol, return it directly
      if (prop in target || typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }
      
      // Otherwise, create a dynamic function
      return function(templateObj: Record<string, string>, options: AIFunctionOptions = {}) {
        // Build schema from template object
        const dynamicSchema = createSchemaFromTemplate(templateObj);
        
        // Create and call AI function with schema
        const newFn = createAIFunction(dynamicSchema);
        return newFn(templateObj, options);
      };
    },
  });
}

const aiFn = createWrappedTemplateFunction(templateFn) as unknown as AITemplateFunction
export const ai = createDynamicAI(aiFn)

// Create the list function with template literal and async iteration support
export const list = createWrappedTemplateFunction(listFn) as ListFunction

// Export types for consumers
export * from './types'
