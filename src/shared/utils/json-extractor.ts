/**
 * Robust JSON extraction utility for handling mixed text/JSON responses from Claude AI
 */

export interface JsonExtractionResult {
  success: boolean;
  data: unknown;
  error?: string;
  originalResponse?: string;
}

export class JsonExtractor {
  /**
   * Extract JSON from Claude AI response that may contain explanatory text
   */
  static extractJson(response: string): JsonExtractionResult {
    if (!response || typeof response !== 'string') {
      return {
        success: false,
        data: null,
        error: 'Invalid response: empty or non-string input',
        originalResponse: response,
      };
    }

    const trimmedResponse = response.trim();

    // Strategy 1: Try parsing as pure JSON first
    try {
      const parsed = JSON.parse(trimmedResponse);
      return {
        success: true,
        data: parsed,
        originalResponse: response,
      };
    } catch {
      // Continue to other strategies
    }

    // Strategy 2: Extract JSON from markdown code blocks
    const jsonMarkdownMatch = trimmedResponse.match(
      /```json\s*([\s\S]*?)\s*```/
    );
    if (jsonMarkdownMatch) {
      try {
        const parsed = JSON.parse(jsonMarkdownMatch[1].trim());
        return {
          success: true,
          data: parsed,
          originalResponse: response,
        };
      } catch (error) {
        return {
          success: false,
          data: null,
          error: `JSON parsing failed in markdown block: ${error}`,
          originalResponse: response,
        };
      }
    }

    // Strategy 3: Extract JSON from regular code blocks
    const codeBlockMatch = trimmedResponse.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        return {
          success: true,
          data: parsed,
          originalResponse: response,
        };
      } catch {
        // Continue to next strategy
      }
    }

    // Strategy 4: Find JSON object/array in mixed text
    const jsonPatterns = [
      // Match JSON objects
      /\{[\s\S]*\}/,
      // Match JSON arrays
      /\[[\s\S]*\]/,
    ];

    for (const pattern of jsonPatterns) {
      const matches = trimmedResponse.match(pattern);
      if (matches) {
        for (const match of matches) {
          try {
            const parsed = JSON.parse(match);
            return {
              success: true,
              data: parsed,
              originalResponse: response,
            };
          } catch {
            // Try next match
            continue;
          }
        }
      }
    }

    // Strategy 5: Extract multiple potential JSON blocks and try each
    const allJsonCandidates = this.findAllJsonCandidates(trimmedResponse);
    for (const candidate of allJsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);
        return {
          success: true,
          data: parsed,
          originalResponse: response,
        };
      } catch {
        // Try next candidate
        continue;
      }
    }

    // All strategies failed
    return {
      success: false,
      data: null,
      error: 'No valid JSON found in response',
      originalResponse: response,
    };
  }

  /**
   * Find all potential JSON candidates in text
   */
  private static findAllJsonCandidates(text: string): string[] {
    const candidates: string[] = [];

    // Look for balanced braces/brackets
    let braceCount = 0;
    let bracketCount = 0;
    let start = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (braceCount === 0 && bracketCount === 0) {
          start = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && bracketCount === 0 && start !== -1) {
          candidates.push(text.substring(start, i + 1));
          start = -1;
        }
      } else if (char === '[') {
        if (bracketCount === 0 && braceCount === 0) {
          start = i;
        }
        bracketCount++;
      } else if (char === ']') {
        bracketCount--;
        if (bracketCount === 0 && braceCount === 0 && start !== -1) {
          candidates.push(text.substring(start, i + 1));
          start = -1;
        }
      }
    }

    return candidates;
  }

  /**
   * Validate that extracted JSON matches expected schema
   */
  static validateJsonSchema(
    data: unknown,
    expectedType: 'object' | 'array',
    requiredFields?: string[]
  ): { valid: boolean; error?: string } {
    if (!data) {
      return { valid: false, error: 'Data is null or undefined' };
    }

    if (expectedType === 'array' && !Array.isArray(data)) {
      return { valid: false, error: 'Expected array but got ' + typeof data };
    }

    if (
      expectedType === 'object' &&
      (typeof data !== 'object' || Array.isArray(data))
    ) {
      return { valid: false, error: 'Expected object but got ' + typeof data };
    }

    if (requiredFields && expectedType === 'object') {
      const obj = data as Record<string, unknown>;
      for (const field of requiredFields) {
        if (!(field in obj)) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Extract JSON with schema validation
   */
  static extractAndValidateJson(
    response: string,
    expectedType: 'object' | 'array',
    requiredFields?: string[]
  ): JsonExtractionResult {
    const extractionResult = this.extractJson(response);

    if (!extractionResult.success) {
      return extractionResult;
    }

    const validationResult = this.validateJsonSchema(
      extractionResult.data,
      expectedType,
      requiredFields
    );

    if (!validationResult.valid) {
      return {
        success: false,
        data: extractionResult.data,
        error: `Schema validation failed: ${validationResult.error}`,
        originalResponse: response,
      };
    }

    return extractionResult;
  }
}
