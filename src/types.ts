import { z } from 'zod'
import type PQueue from 'p-queue'
import type { LanguageModelV1 } from 'ai'

export type Queue = Omit<PQueue, 'add'> & {
  add<T, R = T>(fn: () => Promise<T> | AsyncGenerator<T, void, unknown>): Promise<R>
}

export interface RetryOptions {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffFactor: number
}

export interface RateLimitOptions {
  requestsPerMinute: number
  burstLimit?: number
  timeoutMs?: number
}

export interface RequestHandlingOptions {
  retry?: RetryOptions
  rateLimit?: RateLimitOptions
  timeout?: number
  maxRetries?: number
  retryDelay?: number
  streamingTimeout?: number
  concurrency?: number
  requestHandling?: {
    retry?: RetryOptions
    rateLimit?: RateLimitOptions
    timeout?: number
    concurrency?: number
  }
}

export interface StreamProgress {
  type: 'token' | 'chunk' | 'complete'
  tokensGenerated?: number
  totalTokens?: number
  chunk?: string
  estimatedTimeRemaining?: number
}

export type ProgressCallback = (progress: StreamProgress) => void

export interface StreamingOptions {
  onProgress?: ProgressCallback
  enableTokenCounting?: boolean
  estimateTimeRemaining?: boolean
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
  requestHandling?: RequestHandlingOptions
  streaming?: StreamingOptions
}

export type AIFunction<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  (): Promise<{ schema: T }>
  (args: z.infer<T>): Promise<z.infer<T>>
  (args: z.infer<T>, options: AIFunctionOptions): Promise<z.infer<T>>
  schema?: T
  queue?: Queue
}

export type AsyncIterablePromise<T> = Promise<T> & {
  (options?: AIFunctionOptions): Promise<T>
  then: Promise<T>['then']
  catch: Promise<T>['catch']
  finally: Promise<T>['finally']
  [Symbol.asyncIterator]: () => AsyncIterator<string>
}

export type TemplateResult = {
  (options?: AIFunctionOptions): Promise<string>
  then: Promise<string>['then']
  catch: Promise<string>['catch']
  finally: Promise<string>['finally']
  [Symbol.asyncIterator]: () => AsyncIterator<string>
  call: (options?: AIFunctionOptions) => Promise<string>
}

export interface BaseTemplateFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): TemplateResult
  (options?: AIFunctionOptions): TemplateResult
  [Symbol.asyncIterator]: () => AsyncIterator<string>
  withOptions: (options?: AIFunctionOptions) => Promise<string>
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
  // Book-related functions
  writeBook: AIFunction<
    z.ZodObject<{
      title: z.ZodString
      author: z.ZodString
      genre: z.ZodString
      audience: z.ZodString
      content: z.ZodString
    }>
  >
  developProposal: AIFunction<
    z.ZodObject<{
      title: z.ZodString
      genre: z.ZodString
      audience: z.ZodString
      concept: z.ZodString
      marketAnalysis: z.ZodString
      competitiveAnalysis: z.ZodString
      uniqueSellingPoints: z.ZodArray<z.ZodString>
      outline: z.ZodString
    }>
  >
  draftTableOfContents: AIFunction<
    z.ZodObject<{
      title: z.ZodString
      genre: z.ZodString
      chapters: z.ZodArray<
        z.ZodObject<{
          title: z.ZodString
          summary: z.ZodString
        }>
      >
      frontMatter: z.ZodArray<z.ZodString>
      backMatter: z.ZodArray<z.ZodString>
    }>
  >
  outlineChapter: AIFunction<
    z.ZodObject<{
      chapterTitle: z.ZodString
      chapterNumber: z.ZodNumber
      keyPoints: z.ZodArray<z.ZodString>
      scenes: z.ZodOptional<
        z.ZodArray<
          z.ZodObject<{
            title: z.ZodString
            summary: z.ZodString
            characters: z.ZodOptional<z.ZodArray<z.ZodString>>
          }>
        >
      >
      sections: z.ZodOptional<
        z.ZodArray<
          z.ZodObject<{
            heading: z.ZodString
            content: z.ZodString
          }>
        >
      >
    }>
  >
  writeSection: AIFunction<
    z.ZodObject<{
      sectionTitle: z.ZodString
      chapterTitle: z.ZodString
      keyPoints: z.ZodArray<z.ZodString>
      tone: z.ZodString
      content: z.ZodString
    }>
  >
  reviewChapter: AIFunction<
    z.ZodObject<{
      chapterTitle: z.ZodString
      content: z.ZodString
      feedback: z.ZodString
      strengthPoints: z.ZodArray<z.ZodString>
      improvementPoints: z.ZodArray<z.ZodString>
      consistencyIssues: z.ZodOptional<z.ZodArray<z.ZodString>>
    }>
  >
  editChapter: AIFunction<
    z.ZodObject<{
      chapterTitle: z.ZodString
      originalContent: z.ZodString
      editedContent: z.ZodString
      changes: z.ZodArray<z.ZodString>
      rationale: z.ZodString
    }>
  >
  reviewBook: AIFunction<
    z.ZodObject<{
      title: z.ZodString
      content: z.ZodString
      overallFeedback: z.ZodString
      strengthPoints: z.ZodArray<z.ZodString>
      improvementPoints: z.ZodArray<z.ZodString>
      marketFit: z.ZodString
      recommendations: z.ZodArray<z.ZodString>
    }>
  >
  editBook: AIFunction<
    z.ZodObject<{
      title: z.ZodString
      originalContent: z.ZodString
      editedContent: z.ZodString
      majorChanges: z.ZodArray<z.ZodString>
      minorChanges: z.ZodArray<z.ZodString>
      rationale: z.ZodString
    }>
  >
  publishBook: AIFunction<
    z.ZodObject<{
      title: z.ZodString
      author: z.ZodString
      finalContent: z.ZodString
      publishingPlatforms: z.ZodArray<z.ZodString>
      marketingPlan: z.ZodString
      launchDate: z.ZodString
      pricingStrategy: z.ZodString
      distributionChannels: z.ZodArray<z.ZodString>
    }>
  >
}

export type ListFunction = BaseTemplateFunction

export class AIRequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = true,
  ) {
    super(message)
    this.name = 'AIRequestError'
  }
}
