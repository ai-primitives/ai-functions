import { z } from 'zod'
import type PQueue from 'p-queue'
import type { LanguageModelV1 } from 'ai'

export type Queue = Omit<PQueue, 'add'> & {
  add<T, R = T>(fn: () => Promise<T> | AsyncGenerator<T, void, unknown>): Promise<R>
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
  maxRetries?: number;
  retryDelay?: number;
  streamingTimeout?: number;
  concurrency?: number;
  requestHandling?: {
    retry?: RetryOptions;
    rateLimit?: RateLimitOptions;
    timeout?: number;
    concurrency?: number;
  };
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

export type AsyncIterablePromise<T> = Promise<T> & {
  (options?: AIFunctionOptions): Promise<T>;
  then: Promise<T>['then'];
  catch: Promise<T>['catch'];
  finally: Promise<T>['finally'];
  [Symbol.asyncIterator]: () => AsyncIterator<string>;
}

export type TemplateResult = {
  (options?: AIFunctionOptions): Promise<string>;
  then: Promise<string>['then'];
  catch: Promise<string>['catch'];
  finally: Promise<string>['finally'];
  [Symbol.asyncIterator]: () => AsyncIterator<string>;
  call: (options?: AIFunctionOptions) => Promise<string>;
}

export interface BaseTemplateFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult;
  (options?: AIFunctionOptions): TemplateResult;
  [Symbol.asyncIterator]: () => AsyncIterator<string>;
  withOptions: (options?: AIFunctionOptions) => Promise<string>;
  queue?: Queue;
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
