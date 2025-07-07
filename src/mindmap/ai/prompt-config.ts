import { z } from 'zod';
import { PromptType, Example, FallbackStrategy } from './prompt-types';

/**
 * Prompt configuration with validation schemas
 */
export interface PromptConfig {
  type: PromptType;
  template: string;
  maxTokens: number;
  temperature: number;
  responseSchema: z.ZodSchema;
  examples?: Example[];
  fallbackStrategy?: FallbackStrategy;
  cacheTTL?: number; // in milliseconds
  maxRetries?: number;
}

// Response schemas for each prompt type
export const ResponseSchemas = {
  [PromptType.CODE_ANALYSIS]: z.object({
    functionsChanged: z.array(z.string()),
    classesChanged: z.array(z.string()),
    importsChanged: z.array(z.string()),
    fileType: z.string(),
    isTestFile: z.boolean(),
    isConfigFile: z.boolean(),
    architecturalPatterns: z.array(z.string()),
    businessDomain: z.string(),
    codeComplexity: z.enum(['low', 'medium', 'high']),
    semanticDescription: z.string(),
  }),

  [PromptType.THEME_EXTRACTION]: z.object({
    themeName: z.string(),
    description: z.string(),
    businessImpact: z.string(),
    confidence: z.number(),
    codePattern: z.string(),
    detailedDescription: z.string().nullable().optional(),
    technicalSummary: z.string().optional(),
    keyChanges: z.array(z.string()).optional(),
    userScenario: z.string().nullable().optional(),
    suggestedParent: z.string().nullable().optional(),
  }),

  [PromptType.SIMILARITY_CHECK]: z.object({
    shouldMerge: z.boolean(),
    confidence: z.number(),
    reasoning: z.string(),
    nameScore: z.number(),
    descriptionScore: z.number(),
    patternScore: z.number(),
    businessScore: z.number(),
    semanticScore: z.number(),
  }),

  [PromptType.THEME_EXPANSION]: z.object({
    shouldExpand: z.boolean(),
    confidence: z.number(),
    subThemes: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        businessValue: z.string(),
        affectedComponents: z.array(z.string()),
        relatedFiles: z.array(z.string()),
      })
    ),
    reasoning: z.string(),
  }),

  [PromptType.DOMAIN_EXTRACTION]: z.object({
    domains: z.array(
      z.object({
        domain: z.string(),
        themes: z.array(z.string()),
        confidence: z.number(),
        userValue: z.string(),
      })
    ),
  }),

  [PromptType.THEME_NAMING]: z.object({
    themeName: z.string(),
    alternativeNames: z.array(z.string()).optional(),
    reasoning: z.string(),
  }),

  [PromptType.BATCH_SIMILARITY]: z.object({
    results: z.array(
      z.object({
        pairId: z.string(),
        shouldMerge: z.boolean(),
        confidence: z.number(),
        scores: z.object({
          name: z.number(),
          description: z.number(),
          pattern: z.number(),
          business: z.number(),
          semantic: z.number(),
        }),
      })
    ),
  }),

  [PromptType.CROSS_LEVEL_SIMILARITY]: z.object({
    relationship: z.enum(['parent_child', 'duplicate', 'none']),
    confidence: z.number(),
    action: z.enum([
      'keep_both',
      'merge_into_parent',
      'merge_into_child',
      'make_sibling',
    ]),
    reasoning: z.string(),
  }),
};

// Cache TTL configurations by prompt type (in milliseconds)
export const CacheTTLConfig = {
  [PromptType.CODE_ANALYSIS]: 24 * 60 * 60 * 1000, // 24 hours
  [PromptType.THEME_EXTRACTION]: 60 * 60 * 1000, // 1 hour
  [PromptType.SIMILARITY_CHECK]: 60 * 60 * 1000, // 1 hour
  [PromptType.THEME_EXPANSION]: 30 * 60 * 1000, // 30 minutes
  [PromptType.DOMAIN_EXTRACTION]: 30 * 60 * 1000, // 30 minutes
  [PromptType.THEME_NAMING]: 0, // No cache
  [PromptType.BATCH_SIMILARITY]: 60 * 60 * 1000, // 1 hour
  [PromptType.CROSS_LEVEL_SIMILARITY]: 60 * 60 * 1000, // 1 hour
};

// Temperature settings by prompt type
export const TemperatureConfig = {
  [PromptType.CODE_ANALYSIS]: 0.2, // Low creativity for factual analysis
  [PromptType.THEME_EXTRACTION]: 0.3, // Some creativity for theme identification
  [PromptType.SIMILARITY_CHECK]: 0.1, // Very low for consistent decisions
  [PromptType.THEME_EXPANSION]: 0.4, // Moderate creativity for finding sub-themes
  [PromptType.DOMAIN_EXTRACTION]: 0.2, // Low for consistent categorization
  [PromptType.THEME_NAMING]: 0.5, // Higher creativity for good names
  [PromptType.BATCH_SIMILARITY]: 0.1, // Very low for consistency
  [PromptType.CROSS_LEVEL_SIMILARITY]: 0.1, // Very low for consistent decisions
};
