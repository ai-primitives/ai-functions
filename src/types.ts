import { LanguageModelV1 } from '@ai-sdk/provider'
import { z } from 'zod'
import PQueue from 'p-queue'

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

export type OutputFormat = 'object' | 'array' | 'enum' | 'no-schema';

export interface AIFunctionOptions {
  model?: LanguageModelV1;
  prompt?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  seed?: number;
  requestHandling?: RequestHandlingOptions;
  outputFormat?: OutputFormat;
  schema?: z.ZodType;
  enum?: string[];
  schemaName?: string;
  schemaDescription?: string;
  streaming?: {
    onProgress?: (progress: { type: 'chunk'; chunk: string }) => void;
    enableTokenCounting?: boolean;
  };
}

export type AI = AITemplateFunction;

export type ListFunction = BaseTemplateFunction;

export class AIRequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'AIRequestError';
  }

  static isInstance(error: unknown): error is AIRequestError {
    return error instanceof AIRequestError;
  }
}

export interface AIFunction<T extends z.ZodType> {
  (args?: z.infer<T>, options?: AIFunctionOptions): Promise<z.infer<T>>;
  schema: T;
}

export interface BaseTemplateFunction {
  (strings: TemplateStringsArray | AIFunctionOptions, ...values: unknown[]): TemplateResult;
  [Symbol.asyncIterator](): AsyncIterator<string>;
  queue?: Queue;
  withOptions(options?: AIFunctionOptions): BaseTemplateFunction;
}

export interface AITemplateFunction extends BaseTemplateFunction {
  categorizeProduct(schema: Record<string, string>): AIFunction<z.ZodObject<any>>;
}

export type AsyncIterablePromise<T> = Promise<T> & AsyncIterable<T>;

export type Queue = PQueue;

export type TemplateResult = AsyncIterablePromise<string> & {
  call(options?: AIFunctionOptions): Promise<string>;
};
