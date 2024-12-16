import { z } from 'zod'

/**
 * Creates a Zod schema from a template object where:
 * - String values become descriptions
 * - Pipe-separated values become enums
 * - Word count constraints (e.g. "3-5 words") are enforced
 */
export function createSchemaFromTemplate<T extends Record<string, string>>(
  template: T,
): z.ZodObject<{
  [K in keyof T]: z.ZodString | z.ZodEnum<[string, ...string[]]> | z.ZodEffects<z.ZodString>
}> {
  type SchemaShape = {
    [K in keyof T]: z.ZodString | z.ZodEnum<[string, ...string[]]> | z.ZodEffects<z.ZodString>
  }
  const shape = Object.entries(template).reduce<Partial<SchemaShape>>((acc, [key, value]) => {
    // Check if value contains pipe-separated options
    if (value.includes('|')) {
      const options = value
        .split('|')
        .map((opt) => opt.trim())
        .filter(Boolean) // Remove empty strings
      if (options.length >= 1) {
        acc[key as keyof T] = z.enum([options[0], ...options.slice(1)] as [string, ...string[]]).describe(value)
      } else {
        acc[key as keyof T] = z.string().describe(value)
      }
    } else {
      // Check for word count constraints
      const wordCountMatch = value.match(/(\d+)-(\d+)\s+words/)
      if (wordCountMatch) {
        const [, minStr, maxStr] = wordCountMatch
        const min = parseInt(minStr, 10)
        const max = parseInt(maxStr, 10)
        acc[key as keyof T] = z
          .string()
          .min(1)
          .refine(
            (val) => {
              const words = val.trim().split(/\s+/).length
              return words >= min && words <= max
            },
            {
              message: `Must be between ${min} and ${max} words`,
              params: { min, max },
            },
          )
          .describe(value)
      } else {
        // Regular string field with description
        acc[key as keyof T] = z.string().describe(value)
      }
    }
    return acc
  }, {})

  return z.object(shape as SchemaShape)
}
