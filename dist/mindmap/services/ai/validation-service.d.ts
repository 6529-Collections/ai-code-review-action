import { ConsolidatedTheme } from '../../types/similarity-types';
import { ThemeAnalysis, ValidationResult } from '../../types/multi-stage-types';
import { ClaudeClient } from '../../../shared/utils/claude-client';
/**
 * Service for validating expansion decisions through self-reflection
 */
export declare class ValidationService {
    private claudeClient;
    constructor(claudeClient: ClaudeClient);
    /**
     * Validate expansion decision through multi-criteria analysis
     */
    validateExpansionDecision(theme: ConsolidatedTheme, analysis: ThemeAnalysis, currentDepth: number, initialInclination?: {
        shouldExpand: boolean;
        confidence: number;
    }): Promise<ValidationResult>;
    /**
     * Build validation prompt with self-reflection
     */
    private buildValidationPrompt;
    /**
     * Validate validation response structure
     */
    private validateValidationResponse;
    /**
     * Generate default validation when AI validation fails
     */
    private getDefaultValidation;
}
