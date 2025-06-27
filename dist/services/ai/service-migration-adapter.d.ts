import { PromptType } from './prompt-types';
/**
 * Adapter to help migrate existing services to use UnifiedPromptService
 * Provides compatibility layer for gradual migration
 */
export declare class ServiceMigrationAdapter {
    private unifiedService;
    private claudeClient?;
    constructor(anthropicApiKey: string);
    /**
     * Migrate theme analysis calls
     */
    analyzeTheme(chunk: {
        filename: string;
        content: string;
    }, context: string): Promise<any>;
    /**
     * Migrate code analysis calls
     */
    analyzeCode(filename: string, diffContent: string, changeType: string, language: string): Promise<any>;
    /**
     * Migrate similarity check calls
     */
    checkSimilarity(theme1: {
        name: string;
        description: string;
        files: string[];
        context?: string;
    }, theme2: {
        name: string;
        description: string;
        files: string[];
        context?: string;
    }): Promise<any>;
    /**
     * Migrate batch similarity calls
     */
    batchSimilarity(pairs: Array<{
        id: string;
        theme1: any;
        theme2: any;
    }>): Promise<any>;
    /**
     * Migrate theme expansion calls
     */
    expandTheme(theme: {
        name: string;
        description: string;
        affectedFiles: string[];
        codeContext?: string;
    }): Promise<any>;
    /**
     * Migrate domain extraction calls
     */
    extractDomains(themes: Array<{
        name: string;
        description: string;
    }>, availableDomains: string[]): Promise<any>;
    /**
     * Migrate theme naming calls
     */
    generateThemeName(theme: {
        currentName: string;
        description: string;
        keyChanges?: string[];
        affectedFiles?: string[];
    }): Promise<any>;
    /**
     * Migrate cross-level similarity calls
     */
    checkCrossLevelSimilarity(parentTheme: {
        name: string;
        description: string;
    }, childTheme: {
        name: string;
        description: string;
    }): Promise<any>;
    /**
     * Get cache report for monitoring
     */
    getCacheReport(): {
        metrics: any;
        efficiency: string;
        memory: {
            used: number;
            max: number;
            percentage: number;
        };
    };
    /**
     * Clear cache
     */
    clearCache(promptType?: PromptType): void;
    /**
     * Warm cache with common queries
     */
    warmCache(promptType: PromptType, commonInputs: Array<Record<string, any>>): Promise<void>;
    /**
     * Legacy method for services that need raw Claude access
     * @deprecated Use unified methods instead
     */
    callClaudeDirect(prompt: string): Promise<string>;
    /**
     * Legacy JSON extraction for migration
     * @deprecated Use unified response validation
     */
    extractJson(response: string, requiredFields?: string[]): any;
}
