/**
 * Robust JSON extraction utility for handling mixed text/JSON responses from Claude AI
 */
export interface JsonExtractionResult {
    success: boolean;
    data: unknown;
    error?: string;
    originalResponse?: string;
}
export declare class JsonExtractor {
    /**
     * Extract JSON from Claude AI response that may contain explanatory text
     */
    static extractJson(response: string): JsonExtractionResult;
    /**
     * Find all potential JSON candidates in text
     */
    private static findAllJsonCandidates;
    /**
     * Validate that extracted JSON matches expected schema
     */
    static validateJsonSchema(data: unknown, expectedType: 'object' | 'array', requiredFields?: string[]): {
        valid: boolean;
        error?: string;
    };
    /**
     * Extract JSON with schema validation
     */
    static extractAndValidateJson(response: string, expectedType: 'object' | 'array', requiredFields?: string[]): JsonExtractionResult;
}
