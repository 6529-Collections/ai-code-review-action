import { PromptType } from './prompt-types';
/**
 * Centralized response validation for AI prompts
 */
export declare class ResponseValidator {
    /**
     * Validate AI response against expected schema
     */
    static validate<T>(rawResponse: string, promptType: PromptType): {
        success: boolean;
        data?: T;
        error?: string;
    };
    /**
     * Attempt partial validation for fallback scenarios
     */
    static validatePartial<T>(rawResponse: string, promptType: PromptType, requiredFields: string[]): {
        success: boolean;
        data?: Partial<T>;
        error?: string;
    };
    /**
     * Create a fallback response based on prompt type
     */
    static createFallbackResponse<T>(promptType: PromptType, context?: any): T;
}
