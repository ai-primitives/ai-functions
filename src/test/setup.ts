import { config } from 'dotenv'
import { resolve } from 'path'
import { openai } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') })

// Configure OpenAI provider with custom endpoint if AI_GATEWAY is set
if (process.env.AI_GATEWAY && process.env.OPENAI_API_KEY) {
  const customProvider = createOpenAICompatible({
    baseURL: process.env.AI_GATEWAY,
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    name: 'openai-compatible'
  })
  // Replace the default provider with our custom configured one
  Object.assign(openai, customProvider)
}                            