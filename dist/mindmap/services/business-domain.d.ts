import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';
export declare class BusinessDomainService {
    private aiDomainAnalyzer;
    constructor(anthropicApiKey: string);
    groupByBusinessDomain(themes: ConsolidatedTheme[]): Promise<Map<string, ConsolidatedTheme[]>>;
    /**
     * Extract business domain using AI semantic understanding
     * PRD: "AI decides" domain classification based on actual business impact
     */
    private extractBusinessDomainWithAI;
    /**
     * Fallback domain extraction for when AI fails
     * PRD: "Graceful degradation - never fail completely"
     */
    private extractBusinessDomainFallback;
    extractBusinessDomainWithContext(name: string, description: string, enhancedContext?: {
        codeChanges?: CodeChange[];
        contextSummary?: string;
    }): Promise<string>;
    extractBusinessDomain(name: string, description: string): Promise<string>;
    private executeDomainExtraction;
    private tryDomainExtraction;
    private buildDomainExtractionPrompt;
    private buildSimpleDomainPrompt;
    private buildEnhancedDomainExtractionPrompt;
    private parseDomainExtractionResponse;
    private extractDomainFromResponse;
    private isValidDomainName;
    /**
     * Calculate optimal batch size for domain classification
     * PRD: "Dynamic batch sizing" - adapt to content complexity
     */
    private calculateOptimalDomainBatchSize;
    /**
     * Split themes into optimally-sized batches for domain processing
     */
    private createDomainBatches;
    /**
     * Process a batch of themes for domain classification with a single AI call
     * This is the key optimization - multiple themes analyzed in one API call
     */
    private processDomainBatch;
    /**
     * Fallback to individual domain processing if batch fails
     */
    private processDomainBatchIndividually;
}
