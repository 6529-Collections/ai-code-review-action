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
}
