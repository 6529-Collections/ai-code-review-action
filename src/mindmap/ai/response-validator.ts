import { z } from 'zod';
import { JsonExtractor } from '../../utils/json-extractor';
import { PromptType } from './prompt-types';
import { ResponseSchemas } from './prompt-config';

/**
 * Centralized response validation for AI prompts
 */
export class ResponseValidator {
  /**
   * Validate AI response against expected schema
   */
  static validate<T>(
    rawResponse: string,
    promptType: PromptType
  ): { success: boolean; data?: T; error?: string } {
    // Early exit optimization: Quick check for obvious negative responses
    const quickCheck = ResponseValidator.quickNegativeCheck<T>(
      rawResponse,
      promptType
    );
    if (quickCheck) {
      return quickCheck;
    }

    // First extract JSON from the response
    const extractionResult = JsonExtractor.extractAndValidateJson(
      rawResponse,
      'object'
    );

    if (!extractionResult.success) {
      return {
        success: false,
        error: `Failed to extract JSON: ${extractionResult.error}`,
      };
    }

    // Get the schema for this prompt type
    const schema = ResponseSchemas[promptType];
    if (!schema) {
      return {
        success: false,
        error: `No schema defined for prompt type: ${promptType}`,
      };
    }

    // Validate against schema
    try {
      const validatedData = schema.parse(extractionResult.data);
      return {
        success: true,
        data: validatedData as T,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        return {
          success: false,
          error: `Schema validation failed: ${issues}`,
        };
      }
      return {
        success: false,
        error: `Validation error: ${error}`,
      };
    }
  }

  /**
   * Attempt partial validation for fallback scenarios
   */
  static validatePartial<T>(
    rawResponse: string,
    promptType: PromptType,
    requiredFields: string[]
  ): { success: boolean; data?: Partial<T>; error?: string } {
    const extractionResult = JsonExtractor.extractAndValidateJson(
      rawResponse,
      'object',
      requiredFields
    );

    if (!extractionResult.success) {
      return {
        success: false,
        error: `Failed to extract required fields: ${extractionResult.error}`,
      };
    }

    // For partial validation, we'll be more lenient
    try {
      const schema = ResponseSchemas[promptType];
      if (schema && schema instanceof z.ZodObject) {
        // Make all fields optional for partial validation
        const partialSchema = schema.partial();
        const validatedData = partialSchema.parse(extractionResult.data);

        // Check if required fields are present
        const missingFields = requiredFields.filter(
          (field) => !(field in validatedData)
        );

        if (missingFields.length > 0) {
          return {
            success: false,
            error: `Missing required fields: ${missingFields.join(', ')}`,
          };
        }

        return {
          success: true,
          data: validatedData as Partial<T>,
        };
      }
    } catch (error) {
      // Fall through to return the extracted data as-is
    }

    // If schema validation fails, return the raw extracted data
    // This allows for graceful degradation
    return {
      success: true,
      data: extractionResult.data as Partial<T>,
    };
  }

  /**
   * Create a fallback response based on prompt type
   */
  static createFallbackResponse<T>(promptType: PromptType, context?: any): T {
    switch (promptType) {
      case PromptType.CODE_ANALYSIS:
        return {
          functionsChanged: [],
          classesChanged: [],
          importsChanged: [],
          fileType: context?.fileType || 'unknown',
          isTestFile: false,
          isConfigFile: false,
          architecturalPatterns: [],
          businessDomain: 'unknown',
          codeComplexity: 'medium',
          semanticDescription: 'Analysis failed',
        } as T;

      case PromptType.THEME_EXTRACTION:
        return {
          themeName: context?.filename
            ? `Changes in ${context.filename}`
            : 'Unknown Theme',
          description: 'Analysis unavailable',
          businessImpact: 'Unknown impact',
          confidence: 0.3,
          codePattern: 'Unknown',
          detailedDescription: null,
          suggestedParent: null,
        } as T;

      case PromptType.SIMILARITY_CHECK:
        return {
          shouldMerge: false,
          confidence: 0.5,
          reasoning: 'Analysis failed - defaulting to no merge',
          nameScore: 0,
          descriptionScore: 0,
          patternScore: 0,
          businessScore: 0,
          semanticScore: 0,
        } as T;

      case PromptType.THEME_EXPANSION:
        return {
          shouldExpand: false,
          confidence: 0.5,
          subThemes: [],
          reasoning: 'Analysis failed - no expansion',
        } as T;

      case PromptType.DOMAIN_EXTRACTION:
        return {
          domains: [],
        } as T;

      case PromptType.THEME_NAMING:
        return {
          themeName: context?.defaultName || 'Unnamed Theme',
          alternativeNames: [],
          reasoning: 'Naming analysis failed',
        } as T;

      case PromptType.BATCH_SIMILARITY:
        return {
          results: [],
        } as T;

      case PromptType.CROSS_LEVEL_SIMILARITY:
        return {
          relationship: 'none',
          confidence: 0.5,
          action: 'keep_both',
          reasoning: 'Analysis failed - keeping both themes',
        } as T;

      default:
        throw new Error(
          `No fallback response defined for prompt type: ${promptType}`
        );
    }
  }

  /**
   * Quick check for obvious negative responses to avoid full parsing
   */
  static quickNegativeCheck<T>(
    rawResponse: string,
    promptType: PromptType
  ): { success: boolean; data: T; error?: string } | null {
    // Only apply quick checks for similarity/merge-related prompts
    if (
      ![
        PromptType.SIMILARITY_CHECK,
        PromptType.BATCH_SIMILARITY,
        PromptType.CROSS_LEVEL_SIMILARITY,
      ].includes(promptType)
    ) {
      return null; // No quick check for other types
    }

    // Quick regex checks for obvious patterns
    const shouldMergeFalse = /"shouldMerge":\s*false/i.test(rawResponse);
    const lowConfidence = /"confidence":\s*0\.([0-2])\d*/i.test(rawResponse);
    const relationshipNone = /"relationship":\s*"none"/i.test(rawResponse);

    // If it's clearly a negative response with low confidence
    if ((shouldMergeFalse && lowConfidence) || relationshipNone) {
      try {
        // Try to extract just the essential fields quickly
        const confidenceMatch = rawResponse.match(/"confidence":\s*(0\.\d+)/);
        const confidence = confidenceMatch
          ? parseFloat(confidenceMatch[1])
          : 0.1;

        if (confidence < 0.3) {
          // Return fast negative response
          switch (promptType) {
            case PromptType.SIMILARITY_CHECK:
              return {
                success: true,
                data: {
                  shouldMerge: false,
                  confidence,
                  reasoning: 'Quick analysis - clear non-match',
                  nameScore: 0,
                  descriptionScore: 0,
                  patternScore: 0,
                  businessScore: 0,
                  semanticScore: 0,
                } as T,
              };

            case PromptType.CROSS_LEVEL_SIMILARITY:
              return {
                success: true,
                data: {
                  relationship: 'none',
                  confidence,
                  action: 'keep_both',
                  reasoning: 'Quick analysis - no relationship',
                } as T,
              };
          }
        }
      } catch {
        // If quick parsing fails, fall through to full validation
      }
    }

    return null; // No quick check applied, proceed with full validation
  }
}
