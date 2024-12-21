export class AIRequestError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
    public retryable = true
  ) {
    super(message)
    this.name = 'AIRequestError'
  }
} 