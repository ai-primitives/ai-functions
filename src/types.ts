import { z } from 'zod'
import { LanguageModelV1 } from 'ai'

export interface AIFunctionOptions {
  model?: LanguageModelV1
  prompt?: string
}

export type AIFunction<T extends Record<string, unknown> = Record<string, unknown>> = {
  (): Promise<{ schema: z.ZodSchema }>
  (args: T): Promise<T>
  (args: T, options: AIFunctionOptions): Promise<T>
  schema?: z.ZodSchema
}

export type AsyncIterablePromise<T> = Promise<T> & AsyncIterable<string>

export interface BaseTemplateFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): AsyncIterablePromise<string>
  (options?: AIFunctionOptions): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
  [Symbol.asyncIterator](): AsyncIterator<string>
}

export type AITemplateFunction = BaseTemplateFunction & {
  (strings: TemplateStringsArray, ...values: unknown[]): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
}

export interface AI extends AITemplateFunction {
  categorizeProduct: AIFunction<{
    productType?: string
    customer?: string
    solution?: string
    description?: string
    domain?: string
  }>
}

export type ListFunction = BaseTemplateFunction
