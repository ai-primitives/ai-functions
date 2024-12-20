import { z } from 'zod'
import { LanguageModelV1 } from 'ai'

export interface AIFunctionOptions {
  model?: LanguageModelV1
  prompt?: string
}

export type AIFunction<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  (): Promise<{ schema: T }>
  (args: z.infer<T>): Promise<z.infer<T>>
  (args: z.infer<T>, options: AIFunctionOptions): Promise<z.infer<T>>
  schema?: T
}

export type AsyncIterablePromise<T> = Promise<T> & AsyncIterable<string>

export interface BaseTemplateFunction {
  <T extends unknown[]>(strings: TemplateStringsArray, ...values: T): AsyncIterablePromise<string>
  (options?: AIFunctionOptions): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
  [Symbol.asyncIterator](): AsyncIterator<string>
}

export type AITemplateFunction = BaseTemplateFunction & {
  (strings: TemplateStringsArray, ...values: unknown[]): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
}

export interface AI extends AITemplateFunction {
  categorizeProduct: AIFunction<z.ZodObject<{
    productType: z.ZodEnum<['App', 'API', 'Marketplace', 'Platform', 'Packaged Service', 'Professional Service', 'Website']>
    customer: z.ZodString
    solution: z.ZodString
    description: z.ZodString
  }>>
}

export type ListFunction = BaseTemplateFunction
