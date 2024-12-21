import { describe, expect, it, beforeEach } from 'vitest'
import { openai } from '@ai-sdk/openai'
import { streamObject, streamText, generateObject } from 'ai'
import { z } from 'zod'

describe('AI SDK Examples', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
  })

  const model = openai('gpt-4o-mini')

  describe('Streaming Text', () => {
    it('should stream text using streamText', async () => {
      const chunks: string[] = []
      const { textStream } = streamText({
        model,
        prompt: 'Write a short story about a robot learning to paint',
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta') {
            chunks.push(chunk.text)
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
    })
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
    })

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
    })
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
    })

    it('should generate an enum value', async () => {
      const { object } = await generateObject({
        model,
        output: 'enum',
        enum: ['action', 'comedy', 'drama', 'horror', 'sci-fi'],
        prompt: 'Classify this movie plot: "A group of astronauts travel through a wormhole in search of a new habitable planet for humanity."'
      })

      expect(['action', 'comedy', 'drama', 'horror', 'sci-fi']).toContain(object)
      expect(object).toBe('sci-fi')
    })
  })
}) 