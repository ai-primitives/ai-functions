import { createAIFunction, createTemplateFunction, createAsyncIterablePromise, getProvider } from './factory'
import { createListFunction } from './factory/list'
import { 
  AI, 
  ListFunction, 
  BaseTemplateFunction, 
  AITemplateFunction, 
  AIFunctionOptions,
  AsyncIterablePromise
} from './types'
import { createSchemaFromTemplate } from './utils/schema'

// Type guard for template strings array
type TemplateResult = ReturnType<BaseTemplateFunction>

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
      
      // Create a dynamic function that inherits template function properties
      const dynamicFn = function(
        templateObj: Record<string, string>,
        options: AIFunctionOptions = {}
      ): Promise<string> | AsyncIterablePromise<string> {
        // Ensure options is defined and has necessary defaults
        options = {
          model: options?.model || getProvider()('gpt-4o'),
          outputFormat: 'json',  // Default to JSON output for dynamic functions
          ...options
        };
        // Build schema from template object
        const dynamicSchema = createSchemaFromTemplate(templateObj);
        
        // Create and call AI function with schema
        const newFn = createAIFunction(dynamicSchema);
        
        // Handle streaming
        if (options.streaming) {
          const asyncIterable = {
            async *[Symbol.asyncIterator]() {
              const result = await newFn(templateObj, options);
              const text = typeof result === 'string' ? result : JSON.stringify(result);
              yield text;
            }
          };
          
          const promise = (async () => {
            const result = await newFn(templateObj, options);
            return typeof result === 'string' ? result : JSON.stringify(result);
          })();

          return createAsyncIterablePromise(asyncIterable, promise);
        }
        
        // Handle regular response
        return (async () => {
          const result = await newFn(templateObj, options);
          return typeof result === 'string' ? result : JSON.stringify(result);
        })();
      };

      // Copy template function properties
      Object.assign(dynamicFn, {
        withOptions: target.withOptions,
        [Symbol.asyncIterator]: target[Symbol.asyncIterator],
        queue: target.queue
      });

      return dynamicFn;
    },
  });
}

const aiFn = createWrappedTemplateFunction(templateFn) as unknown as AITemplateFunction
export const ai = createDynamicAI(aiFn)

// Create the list function with template literal and async iteration support
export const list = createWrappedTemplateFunction(listFn) as ListFunction

// Export types for consumers
export * from './types'
export { getProvider } from './factory'
