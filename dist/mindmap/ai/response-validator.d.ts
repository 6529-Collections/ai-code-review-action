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
}
