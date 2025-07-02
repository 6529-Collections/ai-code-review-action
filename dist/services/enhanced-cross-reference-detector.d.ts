import { NodeContext } from './node-context-builder';
import { ConsolidatedTheme } from '../types/similarity-types';
/**
 * Enhanced cross-reference detector using complete node contexts
 * Implements PRD: "Smart duplication - AI decides when showing code in multiple contexts adds value"
 */
export declare class EnhancedCrossReferenceDetector {
    private referenceCache;
    constructor();
    /**
     * Detect cross-references between themes using their contexts
     */
    detectCrossReferences(contexts: Map<string, NodeContext>, themes: ConsolidatedTheme[]): CrossReferenceReport;
    /**
     * Detect file-level cross-references
     */
    private detectFileReferences;
    /**
     * Detect method-level cross-references
     */
    private detectMethodReferences;
    /**
     * Detect shared components
     */
    private detectSharedComponents;
    /**
     * Detect dependency chains
     */
    private detectDependencyChains;
    /**
     * Detect smart duplications (when showing code in multiple contexts adds value)
     */
    private detectSmartDuplications;
    /**
     * Build dependency chain recursively
     */
    private buildDependencyChain;
    /**
     * Infer component type from import path
     */
    private inferComponentType;
    /**
     * Normalize business purpose for grouping
     */
    private normalizePurpose;
    /**
     * Analyze cross-reference value
     */
    analyzeCrossReferenceValue(reference: CrossReference): CrossReferenceValue;
}
/**
 * Cross-reference report
 */
export interface CrossReferenceReport {
    references: CrossReference[];
    duplications: SmartDuplication[];
    sharedComponents: SharedComponent[];
    dependencies: DependencyChain[];
}
/**
 * Cross-reference between themes
 */
export interface CrossReference {
    type: 'file' | 'method' | 'component';
    path: string;
    method?: string;
    themes: Array<{
        id: string;
        name: string;
        purpose: string;
    }>;
    reason: string;
}
/**
 * Smart duplication (valuable to show in multiple contexts)
 */
export interface SmartDuplication {
    type: 'valuable' | 'test-implementation' | 'refactor';
    purpose: string;
    themes: Array<{
        id: string;
        name: string;
        approach: string;
        complexity: string;
    }>;
    reason: string;
    recommendation: string;
}
/**
 * Shared component
 */
export interface SharedComponent {
    component: string;
    usedByThemes: string[];
    usageCount: number;
    type: ComponentType;
}
/**
 * Dependency chain
 */
export interface DependencyChain {
    startTheme: string;
    chain: Array<{
        id: string;
        name: string;
    }>;
    type: 'simple' | 'complex';
}
/**
 * Component types
 */
export type ComponentType = 'utility' | 'service' | 'component' | 'hook' | 'type' | 'config' | 'module';
/**
 * Cross-reference value assessment
 */
export interface CrossReferenceValue {
    isValuable: boolean;
    confidence: number;
    reasons: string[];
    recommendation: 'keep-separate' | 'show-relationship' | 'consolidate-or-sequence';
}
