import { z } from 'zod'
import { LanguageModelV1 } from 'ai'
import type PQueue from 'p-queue'

export type Queue = Omit<PQueue, 'add'> & {
  add<T>(fn: () => Promise<T> | T): Promise<T>
}

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface RateLimitOptions {
  requestsPerMinute: number;
  burstLimit?: number;
  timeoutMs?: number;
}

export interface RequestHandlingOptions {
  retry?: RetryOptions;
  rateLimit?: RateLimitOptions;
  timeout?: number;
}

export interface StreamProgress {
  type: 'token' | 'chunk' | 'complete';
  tokensGenerated?: number;
  totalTokens?: number;
  chunk?: string;
  estimatedTimeRemaining?: number;
}

export type ProgressCallback = (progress: StreamProgress) => void;

export interface StreamingOptions {
  onProgress?: ProgressCallback;
  enableTokenCounting?: boolean;
  estimateTimeRemaining?: boolean;
}

export type LanguageModelV1 = string // TODO: get this from the @ai-sdk/openai provider first parameter

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
  concurrency?: number
  requestHandling?: RequestHandlingOptions;
  streaming?: StreamingOptions;
}

export type AIFunction<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  (): Promise<{ schema: T }>
  (args: z.infer<T>): Promise<z.infer<T>>
  (args: z.infer<T>, options: AIFunctionOptions): Promise<z.infer<T>>
  schema?: T
  queue?: Queue
}

export type AsyncIterablePromise<T> = Promise<T> & AsyncIterable<string> & {
  (options: AIFunctionOptions): Promise<T>
}

export type TemplateResult = Promise<string> & AsyncIterable<string> & {
  (options: AIFunctionOptions): Promise<string>
}

export interface BaseTemplateFunction {
  <T extends unknown[]>(strings: TemplateStringsArray, ...values: T): TemplateResult
  (options?: AIFunctionOptions): AsyncIterablePromise<string>
  withOptions: (options?: AIFunctionOptions) => AsyncIterablePromise<string>
  [Symbol.asyncIterator](): AsyncIterator<string>
  queue?: Queue
}

export type AITemplateFunction = BaseTemplateFunction & {
  (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult
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

export class AIRequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'AIRequestError';
  }
}
