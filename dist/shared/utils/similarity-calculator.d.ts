import { Theme } from '@/shared/types/theme-types';
import { QuickSimilarityResult } from '../../types/similarity-types';
export declare class SimilarityCalculator {
    quickSimilarityCheck(theme1: Theme, theme2: Theme): QuickSimilarityResult;
    calculateNameSimilarity(name1: string, name2: string): number;
    calculateDescriptionSimilarity(desc1: string, desc2: string): number;
    calculateFileOverlap(files1: string[], files2: string[]): number;
    private hasDifferentFileTypes;
    calculatePatternSimilarity(theme1: Theme, theme2: Theme): number;
    calculateBusinessSimilarity(theme1: Theme, theme2: Theme): number;
    private extractPatterns;
    private extractBusinessKeywords;
}
