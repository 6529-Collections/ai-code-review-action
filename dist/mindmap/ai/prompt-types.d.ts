/**
 * Centralized prompt type definitions and response schemas
 */
export declare enum PromptType {
    CODE_ANALYSIS = "code_analysis",
    THEME_EXTRACTION = "theme_extraction",
    SIMILARITY_CHECK = "similarity_check",
    THEME_EXPANSION = "theme_expansion",
    DOMAIN_EXTRACTION = "domain_extraction",
    THEME_NAMING = "theme_naming",
    BATCH_SIMILARITY = "batch_similarity",
    CROSS_LEVEL_SIMILARITY = "cross_level_similarity"
}
export interface Example {
    input: string;
    output: string;
    explanation?: string;
}
export declare enum FallbackStrategy {
    RETRY_SIMPLIFIED = "retry_simplified",
    USE_DEFAULT = "use_default",
    THROW_ERROR = "throw_error",
    PARTIAL_RESPONSE = "partial_response"
}
export interface PromptResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    confidence?: number;
    tokensUsed?: number;
    cached?: boolean;
}
export interface PromptMetrics {
    promptType: PromptType;
    executionTime: number;
    tokenCount: number;
    successRate: number;
    averageConfidence: number;
    cacheHitRate: number;
}
