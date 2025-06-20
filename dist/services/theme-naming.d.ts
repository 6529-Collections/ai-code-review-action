import { Theme } from './theme-service';
import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '../utils/code-analyzer';
export declare class ThemeNamingService {
    generateMergedThemeNameAndDescription(themes: Theme[]): Promise<{
        name: string;
        description: string;
    }>;
    private executeMergedThemeNaming;
    createParentTheme(domain: string, children: ConsolidatedTheme[]): ConsolidatedTheme;
    generateMergedThemeNameWithContext(themes: Theme[], enhancedContext?: {
        codeChanges?: CodeChange[];
        contextSummary?: string;
    }): Promise<{
        name: string;
        description: string;
    }>;
    private buildMergedThemeNamingPrompt;
    private buildEnhancedMergedThemeNamingPrompt;
    private parseMergedThemeNamingResponse;
    private isValidThemeName;
    private createFallbackMergedThemeName;
}
