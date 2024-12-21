import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'

export function getProvider() {
  const gateway = process.env.AI_GATEWAY
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const provider = gateway
    ? createOpenAICompatible({
        baseURL: gateway,
        name: 'openai',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      } satisfies OpenAICompatibleProviderSettings)
    : openai

  return (model: string, options?: { structuredOutputs?: boolean }) => 
    provider(model, { structuredOutputs: options?.structuredOutputs ?? false })
} 