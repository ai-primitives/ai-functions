import { z } from 'zod'
import { LanguageModelV1 } from 'ai'
import type PQueue from 'p-queue'

export type Queue = Omit<PQueue, 'add'> & {
  add<T>(fn: () => Promise<T> | T): Promise<T>
}

export interface ConcurrencyOptions {
  concurrency?: number
  autoStart?: boolean
  intervalCap?: number
  interval?: number
  carryoverConcurrencyCount?: boolean
}

export interface AIFunctionOptions {
  model?: LanguageModelV1
  prompt?: string
  outputFormat?: 'json'
  schema?: z.ZodType | Record<string, unknown>
  structuredOutputs?: boolean
  system?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string | string[]
  seed?: number
  concurrency?: ConcurrencyOptions
}

export type AIFunction<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  (): Promise<{ schema: T }>
  (args: z.infer<T>): Promise<z.infer<T>>
  (args: z.infer<T>, options: AIFunctionOptions): Promise<z.infer<T>>
  schema?: T
  queue?: Queue
}

export type AsyncIterablePromise<T> = Promise<T> & AsyncIterable<string>

export interface BaseTemplateFunction {
  <T extends unknown[]>(strings: TemplateStringsArray, ...values: T): AsyncIterablePromise<string>
  (options?: AIFunctionOptions): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
  [Symbol.asyncIterator](): AsyncIterator<string>
  queue?: Queue
}

export type AITemplateFunction = BaseTemplateFunction & {
  (strings: TemplateStringsArray, ...values: unknown[]): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
}

export interface AI extends AITemplateFunction {
  categorizeProduct: AIFunction<
    z.ZodObject<{
      productType: z.ZodEnum<['App', 'API', 'Marketplace', 'Platform', 'Packaged Service', 'Professional Service', 'Website']>
      customer: z.ZodString
      solution: z.ZodString
      description: z.ZodString
    }>
  >
}

export type ListFunction = BaseTemplateFunction
