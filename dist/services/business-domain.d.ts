import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '../utils/ai-code-analyzer';
export declare class BusinessDomainService {
    groupByBusinessDomain(themes: ConsolidatedTheme[]): Promise<Map<string, ConsolidatedTheme[]>>;
    extractBusinessDomainWithContext(name: string, description: string, enhancedContext?: {
        codeChanges?: CodeChange[];
        contextSummary?: string;
    }): Promise<string>;
    extractBusinessDomain(name: string, description: string): Promise<string>;
    private executeDomainExtraction;
    private buildDomainExtractionPrompt;
    private buildEnhancedDomainExtractionPrompt;
    private parseDomainExtractionResponse;
    private isValidDomainName;
    private extractBusinessDomainFallback;
}
