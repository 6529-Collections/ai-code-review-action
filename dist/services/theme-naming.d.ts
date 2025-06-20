import { Theme } from './theme-service';
import { ConsolidatedTheme } from '../types/similarity-types';
export declare class ThemeNamingService {
    generateMergedThemeNameAndDescription(themes: Theme[]): Promise<{
        name: string;
        description: string;
    }>;
    createParentTheme(domain: string, children: ConsolidatedTheme[]): ConsolidatedTheme;
    private buildMergedThemeNamingPrompt;
    private parseMergedThemeNamingResponse;
    private isValidThemeName;
    private createFallbackMergedThemeName;
}
