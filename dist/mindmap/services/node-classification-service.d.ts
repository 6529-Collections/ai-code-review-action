import { ConsolidatedTheme } from '../types/similarity-types';
import { Theme } from '@/shared/types/theme-types';
export interface ClassificationResult {
    nodeType: 'atomic-technical' | 'business-feature' | 'integration-hybrid';
    confidence: number;
    reasoning: string;
}
export interface ClassificationMetrics {
    totalClassified: number;
    classificationCounts: Record<string, number>;
    averageConfidence: number;
    processingTime: number;
}
export declare class NodeClassificationService {
    private claudeClient;
    private promptTemplates;
    constructor(anthropicApiKey?: string);
    /**
     * Classify a single theme node
     */
    classifyTheme(theme: Theme): Promise<ClassificationResult>;
    /**
     * Classify multiple themes in batch
     */
    classifyThemes(themes: Theme[]): Promise<Map<string, ClassificationResult>>;
    /**
     * Apply classification results to consolidated themes
     */
    applyClassificationToThemes(themes: ConsolidatedTheme[], classifications: Map<string, ClassificationResult>): Promise<ConsolidatedTheme[]>;
    /**
     * Validate node type
     */
    private isValidNodeType;
    /**
     * Fallback classification for when AI fails
     */
    private fallbackClassification;
    /**
     * Fallback classification for consolidated themes
     */
    private fallbackClassificationForConsolidated;
    /**
     * Create batches for processing
     */
    private createBatches;
    /**
     * Calculate classification metrics
     */
    private calculateMetrics;
    /**
     * Log classification metrics
     */
    private logMetrics;
}
