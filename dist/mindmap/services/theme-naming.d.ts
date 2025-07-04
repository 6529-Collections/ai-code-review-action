import { Theme } from '@/shared/types/theme-types';
import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';
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
