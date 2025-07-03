import { z } from 'zod';
import { PromptType, Example, FallbackStrategy } from './prompt-types';
/**
 * Prompt configuration with validation schemas
 */
export interface PromptConfig {
    type: PromptType;
    template: string;
    maxTokens: number;
    temperature: number;
    responseSchema: z.ZodSchema;
    examples?: Example[];
    fallbackStrategy?: FallbackStrategy;
    cacheTTL?: number;
    maxRetries?: number;
}
export declare const ResponseSchemas: {
    code_analysis: z.ZodObject<{
        functionsChanged: z.ZodArray<z.ZodString, "many">;
        classesChanged: z.ZodArray<z.ZodString, "many">;
        importsChanged: z.ZodArray<z.ZodString, "many">;
        fileType: z.ZodString;
        isTestFile: z.ZodBoolean;
        isConfigFile: z.ZodBoolean;
        architecturalPatterns: z.ZodArray<z.ZodString, "many">;
        businessDomain: z.ZodString;
        codeComplexity: z.ZodEnum<["low", "medium", "high"]>;
        semanticDescription: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        isTestFile: boolean;
        businessDomain: string;
        semanticDescription: string;
        functionsChanged: string[];
        classesChanged: string[];
        importsChanged: string[];
        fileType: string;
        isConfigFile: boolean;
        architecturalPatterns: string[];
        codeComplexity: "low" | "medium" | "high";
    }, {
        isTestFile: boolean;
        businessDomain: string;
        semanticDescription: string;
        functionsChanged: string[];
        classesChanged: string[];
        importsChanged: string[];
        fileType: string;
        isConfigFile: boolean;
        architecturalPatterns: string[];
        codeComplexity: "low" | "medium" | "high";
    }>;
    theme_extraction: z.ZodObject<{
        themeName: z.ZodString;
        description: z.ZodString;
        businessImpact: z.ZodString;
        confidence: z.ZodNumber;
        codePattern: z.ZodString;
        detailedDescription: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        technicalSummary: z.ZodOptional<z.ZodString>;
        keyChanges: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        userScenario: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        suggestedParent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        themeName: string;
        description: string;
        businessImpact: string;
        confidence: number;
        codePattern: string;
        detailedDescription?: string | null | undefined;
        technicalSummary?: string | undefined;
        keyChanges?: string[] | undefined;
        userScenario?: string | null | undefined;
        suggestedParent?: string | null | undefined;
    }, {
        themeName: string;
        description: string;
        businessImpact: string;
        confidence: number;
        codePattern: string;
        detailedDescription?: string | null | undefined;
        technicalSummary?: string | undefined;
        keyChanges?: string[] | undefined;
        userScenario?: string | null | undefined;
        suggestedParent?: string | null | undefined;
    }>;
    similarity_check: z.ZodObject<{
        shouldMerge: z.ZodBoolean;
        confidence: z.ZodNumber;
        reasoning: z.ZodString;
        nameScore: z.ZodNumber;
        descriptionScore: z.ZodNumber;
        patternScore: z.ZodNumber;
        businessScore: z.ZodNumber;
        semanticScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        reasoning: string;
        shouldMerge: boolean;
        nameScore: number;
        descriptionScore: number;
        patternScore: number;
        businessScore: number;
        semanticScore: number;
    }, {
        confidence: number;
        reasoning: string;
        shouldMerge: boolean;
        nameScore: number;
        descriptionScore: number;
        patternScore: number;
        businessScore: number;
        semanticScore: number;
    }>;
    theme_expansion: z.ZodObject<{
        shouldExpand: z.ZodBoolean;
        confidence: z.ZodNumber;
        subThemes: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            businessValue: z.ZodString;
            affectedComponents: z.ZodArray<z.ZodString, "many">;
            relatedFiles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            description: string;
            name: string;
            businessValue: string;
            affectedComponents: string[];
            relatedFiles: string[];
        }, {
            description: string;
            name: string;
            businessValue: string;
            affectedComponents: string[];
            relatedFiles: string[];
        }>, "many">;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        subThemes: {
            description: string;
            name: string;
            businessValue: string;
            affectedComponents: string[];
            relatedFiles: string[];
        }[];
        shouldExpand: boolean;
        reasoning: string;
    }, {
        confidence: number;
        subThemes: {
            description: string;
            name: string;
            businessValue: string;
            affectedComponents: string[];
            relatedFiles: string[];
        }[];
        shouldExpand: boolean;
        reasoning: string;
    }>;
    domain_extraction: z.ZodObject<{
        domains: z.ZodArray<z.ZodObject<{
            domain: z.ZodString;
            themes: z.ZodArray<z.ZodString, "many">;
            confidence: z.ZodNumber;
            userValue: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            themes: string[];
            confidence: number;
            domain: string;
            userValue: string;
        }, {
            themes: string[];
            confidence: number;
            domain: string;
            userValue: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        domains: {
            themes: string[];
            confidence: number;
            domain: string;
            userValue: string;
        }[];
    }, {
        domains: {
            themes: string[];
            confidence: number;
            domain: string;
            userValue: string;
        }[];
    }>;
    theme_naming: z.ZodObject<{
        themeName: z.ZodString;
        alternativeNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        themeName: string;
        reasoning: string;
        alternativeNames?: string[] | undefined;
    }, {
        themeName: string;
        reasoning: string;
        alternativeNames?: string[] | undefined;
    }>;
    batch_similarity: z.ZodObject<{
        results: z.ZodArray<z.ZodObject<{
            pairId: z.ZodString;
            shouldMerge: z.ZodBoolean;
            confidence: z.ZodNumber;
            scores: z.ZodObject<{
                name: z.ZodNumber;
                description: z.ZodNumber;
                pattern: z.ZodNumber;
                business: z.ZodNumber;
                semantic: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                description: number;
                name: number;
                pattern: number;
                business: number;
                semantic: number;
            }, {
                description: number;
                name: number;
                pattern: number;
                business: number;
                semantic: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            pairId: string;
            shouldMerge: boolean;
            scores: {
                description: number;
                name: number;
                pattern: number;
                business: number;
                semantic: number;
            };
        }, {
            confidence: number;
            pairId: string;
            shouldMerge: boolean;
            scores: {
                description: number;
                name: number;
                pattern: number;
                business: number;
                semantic: number;
            };
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        results: {
            confidence: number;
            pairId: string;
            shouldMerge: boolean;
            scores: {
                description: number;
                name: number;
                pattern: number;
                business: number;
                semantic: number;
            };
        }[];
    }, {
        results: {
            confidence: number;
            pairId: string;
            shouldMerge: boolean;
            scores: {
                description: number;
                name: number;
                pattern: number;
                business: number;
                semantic: number;
            };
        }[];
    }>;
    cross_level_similarity: z.ZodObject<{
        relationship: z.ZodEnum<["parent_child", "duplicate", "none"]>;
        confidence: z.ZodNumber;
        action: z.ZodEnum<["keep_both", "merge_into_parent", "merge_into_child", "make_sibling"]>;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        confidence: number;
        reasoning: string;
        action: "keep_both" | "merge_into_parent" | "merge_into_child" | "make_sibling";
        relationship: "none" | "duplicate" | "parent_child";
    }, {
        confidence: number;
        reasoning: string;
        action: "keep_both" | "merge_into_parent" | "merge_into_child" | "make_sibling";
        relationship: "none" | "duplicate" | "parent_child";
    }>;
};
export declare const CacheTTLConfig: {
    code_analysis: number;
    theme_extraction: number;
    similarity_check: number;
    theme_expansion: number;
    domain_extraction: number;
    theme_naming: number;
    batch_similarity: number;
    cross_level_similarity: number;
};
export declare const TemperatureConfig: {
    code_analysis: number;
    theme_extraction: number;
    similarity_check: number;
    theme_expansion: number;
    domain_extraction: number;
    theme_naming: number;
    batch_similarity: number;
    cross_level_similarity: number;
};
