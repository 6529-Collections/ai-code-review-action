import { ChangedFile } from './git-service';
import { Theme, ThemeService } from './theme-service';
import { ConsolidatedTheme } from './theme-similarity';
export interface ValidationRun {
    runId: string;
    timestamp: Date;
    themes: ConsolidatedTheme[];
    originalThemes: Theme[];
    processingTime: number;
    consolidationRatio: number;
}
export interface ConsistencyMetrics {
    totalRuns: number;
    stableThemes: ThemeStability[];
    averageThemeCount: number;
    consistencyScore: number;
    volatileThemes: string[];
}
export interface ThemeStability {
    themeName: string;
    appearsInRuns: number;
    consistencyRatio: number;
    averageConfidence: number;
    fileStability: number;
}
export interface CrossValidationResult {
    fileToThemeMapping: Map<string, string[]>;
    unmappedFiles: string[];
    themeToFileMapping: Map<string, string[]>;
    orphanedThemes: string[];
    coverageScore: number;
}
export interface GranularityValidation {
    tooFineGrained: string[];
    tooCoarseGrained: string[];
    appropriateGranularity: string[];
    granularityScore: number;
    recommendedMerges: Array<{
        themes: string[];
        reason: string;
    }>;
    recommendedSplits: Array<{
        theme: string;
        reason: string;
    }>;
}
export interface BusinessLogicValidation {
    prIntent: string;
    alignmentScore: number;
    missingBusinessLogic: string[];
    technicalNoiseThemes: string[];
    businessRelevantThemes: string[];
    domainCoverage: string[];
}
export interface ValidationReport {
    summary: {
        overallScore: number;
        confidence: 'high' | 'medium' | 'low';
        recommendation: string;
    };
    consistency: ConsistencyMetrics;
    crossValidation: CrossValidationResult;
    granularity: GranularityValidation;
    businessLogic: BusinessLogicValidation;
    recommendations: string[];
    timestamp: Date;
}
export declare class ThemeValidator {
    private readonly anthropicApiKey;
    private readonly themeService;
    constructor(anthropicApiKey: string, themeService: ThemeService);
    validateThemes(changedFiles: ChangedFile[], runCount?: number): Promise<ValidationReport>;
    private performMultipleRuns;
    private analyzeConsistency;
    private calculateFileStability;
    private performCrossValidation;
    private analyzeFilesForThemes;
    private askAIForFileThemes;
    private validateGranularity;
    private validateBusinessLogic;
    private askClaude;
    private generateValidationReport;
}
