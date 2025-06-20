import { ConsolidatedTheme } from '../types/similarity-types';
export declare class BusinessDomainService {
    groupByBusinessDomain(themes: ConsolidatedTheme[]): Promise<Map<string, ConsolidatedTheme[]>>;
    extractBusinessDomain(name: string, description: string): Promise<string>;
    private buildDomainExtractionPrompt;
    private parseDomainExtractionResponse;
    private isValidDomainName;
    private extractBusinessDomainFallback;
}
