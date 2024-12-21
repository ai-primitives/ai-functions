import { z } from 'zod'
import type PQueue from 'p-queue'
import type { LanguageModelV1 } from 'ai'

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
  maxRetries?: number;
  retryDelay?: number;
  streamingTimeout?: number;
  requestHandling?: {
    retry?: RetryOptions;
    rateLimit?: RateLimitOptions;
    timeout?: number;
  };
  concurrency?: number;
  retries?: number;
  backoff?: number;
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

export type AsyncIterablePromise<T> = Promise<T> & AsyncIterable<T> & {
  (options?: AIFunctionOptions): Promise<T>;
  then: Promise<T>['then'];
  catch: Promise<T>['catch'];
  finally: Promise<T>['finally'];
  [Symbol.asyncIterator]: () => AsyncIterator<T>;
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
  queue?: Queue;
  withOptions: (options?: AIFunctionOptions) => TemplateResult;
}

export type AITemplateFunction = BaseTemplateFunction & {
  (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult
}

export type AI = AITemplateFunction

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
