import { z } from 'zod';
import { JsonExtractor } from '@/shared/utils/json-extractor';
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
    // AI-first approach: No quick checks or algorithmic shortcuts

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



}
