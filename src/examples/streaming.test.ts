import { describe, expect, it, beforeEach } from 'vitest'
import { openai } from '@ai-sdk/openai'
import { streamObject, streamText, generateObject, NoObjectGeneratedError } from 'ai'
import { z } from 'zod'

describe('AI SDK Examples', () => {
  beforeEach(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
  })

  const model = openai('gpt-4o-mini')

  describe('Streaming Text', () => {
    it('should stream text using streamText', async () => {
      const chunks: string[] = []
      const { textStream } = streamText({
        model,
        prompt: 'Write a short story about a robot learning to paint',
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta' && chunk.textDelta) {
            chunks.push(chunk.textDelta)
          }
        }
      })

      let fullText = ''
      for await (const text of textStream) {
        fullText += text
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(fullText).toBeDefined()
      expect(fullText.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Streaming Objects', () => {
    it('should stream array elements using streamObject', async () => {
      const { elementStream } = streamObject({
        model,
        output: 'array',
        schema: z.object({
          name: z.string(),
          type: z.string().describe('Type of fruit'),
          color: z.string(),
          taste: z.string().describe('Description of taste')
        }),
        prompt: 'Generate descriptions of 3 different fruits'
      })

      const fruits: any[] = []
      for await (const fruit of elementStream) {
        fruits.push(fruit)
      }

      expect(fruits.length).toBe(3)
      fruits.forEach(fruit => {
        expect(fruit).toHaveProperty('name')
        expect(fruit).toHaveProperty('type')
        expect(fruit).toHaveProperty('color')
        expect(fruit).toHaveProperty('taste')
      })
    }, 30000)

    it('should stream partial objects using streamObject', async () => {
      const { partialObjectStream } = streamObject({
        model,
        schema: z.object({
          recipe: z.object({
            name: z.string(),
            ingredients: z.array(z.object({
              name: z.string(),
              amount: z.string()
            })),
            steps: z.array(z.string())
          })
        }),
        prompt: 'Generate a recipe for chocolate chip cookies'
      })

      const updates: any[] = []
      for await (const partial of partialObjectStream) {
        updates.push(partial)
      }

      expect(updates.length).toBeGreaterThan(0)
      const finalUpdate = updates[updates.length - 1]
      expect(finalUpdate.recipe).toBeDefined()
      expect(finalUpdate.recipe.name).toBeDefined()
      expect(Array.isArray(finalUpdate.recipe.ingredients)).toBe(true)
      expect(Array.isArray(finalUpdate.recipe.steps)).toBe(true)
    }, 30000)

    it('should handle streaming errors gracefully', async () => {
      let error: Error | undefined
      try {
        const { elementStream } = streamObject({
          model: undefined as any, // Force an error
          output: 'array',
          schema: z.string(),
          prompt: 'Generate a list of items'
        })

        for await (const item of elementStream) {
          console.log(item)
        }
      } catch (e) {
        error = e as Error
      }

      expect(error).toBeDefined()
      expect(error?.message).toBeDefined()
    }, 30000)
  })

  describe('Generating Objects', () => {
    it('should generate an object with schema validation', async () => {
      const { object } = await generateObject({
        model,
        schema: z.object({
          character: z.object({
            name: z.string(),
            class: z.string().describe('Character class, e.g. warrior, mage, or thief'),
            level: z.number().min(1).max(100),
            abilities: z.array(z.string())
          })
        }),
        prompt: 'Create a character for a fantasy RPG'
      })

      expect(object.character).toBeDefined()
      expect(object.character.name).toBeDefined()
      expect(object.character.class).toBeDefined()
      expect(typeof object.character.level).toBe('number')
      expect(Array.isArray(object.character.abilities)).toBe(true)
    }, 30000)

    it('should generate an enum value', async () => {
      const { object } = await generateObject({
        model,
        output: 'enum',
        enum: ['action', 'comedy', 'drama', 'horror', 'sci-fi'],
        prompt: 'Classify this movie plot: "A group of astronauts travel through a wormhole in search of a new habitable planet for humanity."'
      })

      expect(['action', 'comedy', 'drama', 'horror', 'sci-fi']).toContain(object)
      expect(object).toBe('sci-fi')
    }, 30000)

    it('should handle object generation errors', async () => {
      try {
        await generateObject({
          model,
          schema: z.object({
            invalidField: z.number().min(100).max(0) // Impossible constraint
          }),
          prompt: 'This should fail'
        })
        fail('Should have thrown an error')
      } catch (error) {
        expect(NoObjectGeneratedError.isInstance(error)).toBe(true)
        if (NoObjectGeneratedError.isInstance(error)) {
          expect(error.text).toBeDefined()
          expect(error.response).toBeDefined()
          expect(error.usage).toBeDefined()
          expect(error.cause).toBeDefined()
        }
      }
    }, 30000)
  })

  describe('Advanced Features', () => {
    it('should support streaming with tool calls', async () => {
      const toolCalls: any[] = []
      const toolResults: any[] = []

      const { fullStream } = streamText({
        model,
        tools: {
          cityAttractions: {
            parameters: z.object({ city: z.string() }),
            execute: async ({ city }) => ({
              attractions: ['attraction1', 'attraction2', 'attraction3']
            })
          }
        },
        prompt: 'What are some San Francisco tourist attractions?'
      })

      for await (const part of fullStream) {
        switch (part.type) {
          case 'tool-call':
            toolCalls.push(part)
            break
          case 'tool-result':
            toolResults.push(part)
            break
        }
      }

      expect(toolCalls.length).toBeGreaterThan(0)
      expect(toolResults.length).toBeGreaterThan(0)
      expect(toolCalls[0].toolName).toBe('cityAttractions')
    }, 30000)

    it('should support predicted outputs', async () => {
      const existingCode = `
interface User {
  Username: string;
  Password: string;
}
`
      const { textStream } = streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'Replace the Username property with an Email property.'
          },
          {
            role: 'user',
            content: existingCode
          }
        ],
        experimental_providerMetadata: {
          openai: {
            prediction: {
              type: 'content',
              content: existingCode
            }
          }
        },
        seed: 12345
      })

      let text = ''
      for await (const chunk of textStream) {
        text += chunk
      }

      // Extract just the interface code
      const interfaceMatch = text.match(/interface User {[^}]*}/s)
      const interfaceCode = interfaceMatch ? interfaceMatch[0] : ''

      expect(interfaceCode).toContain('interface User')
      expect(interfaceCode).toContain('Email: string')
      expect(interfaceCode).not.toContain('Username')
    }, 30000)
  })
}) 