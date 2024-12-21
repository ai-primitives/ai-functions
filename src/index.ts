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

function createWrappedTemplateFunction(baseFn: BaseTemplateFunction): BaseTemplateFunction {
  const wrappedFn = function (stringsOrOptions?: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult {
    if (!isTemplateStringsArray(stringsOrOptions)) {
      return baseFn(stringsOrOptions)
    }
    
    const prompt = String.raw({ raw: stringsOrOptions }, ...values)
    const fn = async (options?: AIFunctionOptions) => {
      const result = await baseFn({ ...options, prompt })
      if (result && typeof result === 'object' && 'call' in result && typeof (result as any).call === 'function') {
        return (result as any).call(options)
      }
      return result
    }
    
    const templatePromise = Promise.resolve(fn())
    const templateResult = Object.create(templatePromise, {
      [Symbol.asyncIterator]: {
        value: async function* () {
          const result = await fn({ streaming: { onProgress: () => {} } })
          if (typeof result === 'string') {
            yield result
          } else if (Symbol.asyncIterator in (result as any)) {
            yield* result as AsyncIterable<string>
          }
        },
        writable: true,
        configurable: true
      },
      call: {
        value: fn,
        writable: true,
        configurable: true
      },
      then: {
        value: templatePromise.then.bind(templatePromise),
        writable: true,
        configurable: true
      },
      catch: {
        value: templatePromise.catch.bind(templatePromise),
        writable: true,
        configurable: true
      },
      finally: {
        value: templatePromise.finally.bind(templatePromise),
        writable: true,
        configurable: true
      }
    }) as TemplateResult
    
    return templateResult
  }

  // Add required properties to make it a BaseTemplateFunction
  Object.defineProperties(wrappedFn, {
    [Symbol.asyncIterator]: {
      value: function () {
        return baseFn[Symbol.asyncIterator]()
      },
      writable: true,
      configurable: true,
    },
    queue: {
      get: () => baseFn.queue,
      configurable: true,
    },
    withOptions: {
      value: (options?: AIFunctionOptions) => baseFn(options),
      writable: true,
      configurable: true,
    }
  })

  return wrappedFn as BaseTemplateFunction
}

// Create the AI template tag function
const aiFn = createWrappedTemplateFunction(templateFn)

// Create the AI object with template literal and async iteration support
function createAITemplateTag(fn: BaseTemplateFunction): AI {
  function aiFunction(strings: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult {
    if (isTemplateStringsArray(strings)) {
      const prompt = String.raw({ raw: strings }, ...values)
      const result = fn({ prompt })
      const templateResult = Object.create(result, {
        call: {
          value: (options?: AIFunctionOptions) => fn({ ...options, prompt }),
          writable: true,
          configurable: true,
        }
      })
      return templateResult
    }
    return fn(strings as AIFunctionOptions)
  }

  // Add required properties to make it a BaseTemplateFunction
  Object.defineProperties(aiFunction, {
    [Symbol.asyncIterator]: {
      value: fn[Symbol.asyncIterator].bind(fn),
      writable: true,
      configurable: true,
    },
    queue: {
      get: () => fn.queue,
      configurable: true,
    },
    withOptions: {
      value: fn.withOptions.bind(fn),
      writable: true,
      configurable: true,
    }
  })

  // Create a proxy to handle both function calls and template tag usage
  const proxy = new Proxy(aiFunction, {
    apply(target, thisArg, args: [TemplateStringsArray | AIFunctionOptions, ...unknown[]]) {
      if (args.length === 0) {
        return target.apply(thisArg, [{}])
      }
      if (isTemplateStringsArray(args[0])) {
        const result = target.apply(thisArg, args)
        return new Proxy(result, {
          apply(resultTarget: TemplateResult, resultThisArg, resultArgs: [AIFunctionOptions?]) {
            return resultTarget.call.apply(resultThisArg, resultArgs)
          }
        })
      }
      return target.apply(thisArg, args)
    }
  })

  return proxy as unknown as AI
}

export const ai = createAITemplateTag(aiFn)

// Create the list function with template literal and async iteration support
export const list = createWrappedTemplateFunction(listFn) as ListFunction

// Export types for consumers
export * from './types'
