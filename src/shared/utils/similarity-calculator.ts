import { Theme } from '@/shared/types/theme-types';
import { QuickSimilarityResult } from '../../types/similarity-types';

export class SimilarityCalculator {
  quickSimilarityCheck(theme1: Theme, theme2: Theme): QuickSimilarityResult {
    // Quick name similarity check
    const nameScore = this.calculateNameSimilarity(theme1.name, theme2.name);

    // Exact or near-exact name match - very likely to merge
    if (nameScore >= 0.95) {
      return {
        shouldSkipAI: true,
        similarity: {
          nameScore,
          descriptionScore: 0.9, // Assume high description similarity
          fileOverlap: this.calculateFileOverlap(
            theme1.affectedFiles,
            theme2.affectedFiles
          ),
          patternScore: 0.8,
          businessScore: 0.9,
          combinedScore: 0.92,
        },
        reason: 'Near-identical names detected, skipping AI',
      };
    }

    // No file overlap and completely different file types - very unlikely to merge
    const fileOverlap = this.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );
    if (fileOverlap === 0 && this.hasDifferentFileTypes(theme1, theme2)) {
      return {
        shouldSkipAI: true,
        similarity: {
          nameScore,
          descriptionScore: 0.2,
          fileOverlap: 0,
          patternScore: 0.1,
          businessScore: 0.2,
          combinedScore: 0.15,
        },
        reason: 'No file overlap and different file types, skipping AI',
      };
    }

    // Very different names and no file overlap - unlikely to merge
    if (nameScore < 0.1 && fileOverlap === 0) {
      return {
        shouldSkipAI: true,
        similarity: {
          nameScore,
          descriptionScore: 0.2,
          fileOverlap: 0,
          patternScore: 0.2,
          businessScore: 0.2,
          combinedScore: 0.18,
        },
        reason: 'Very different names and no file overlap, skipping AI',
      };
    }

    // Need AI analysis for uncertain cases
    return {
      shouldSkipAI: false,
      reason: 'Uncertain case, using AI analysis',
    };
  }

  calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const words1 = desc1.toLowerCase().split(/\s+/);
    const words2 = desc2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  calculateFileOverlap(files1: string[], files2: string[]): number {
    const set1 = new Set(files1);
    const set2 = new Set(files2);

    const intersection = new Set([...set1].filter((file) => set2.has(file)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private hasDifferentFileTypes(theme1: Theme, theme2: Theme): boolean {
    const getFileTypes = (files: string[]): Set<string> =>
      new Set(files.map((f) => f.split('.').pop()?.toLowerCase() || 'unknown'));

    const types1 = getFileTypes(theme1.affectedFiles);
    const types2 = getFileTypes(theme2.affectedFiles);

    // Check if they have any common file types
    const commonTypes = new Set([...types1].filter((type) => types2.has(type)));
    return commonTypes.size === 0;
  }

  calculatePatternSimilarity(theme1: Theme, theme2: Theme): number {
    // Extract patterns from context
    const patterns1 = this.extractPatterns(theme1.context);
    const patterns2 = this.extractPatterns(theme2.context);

    const intersection = patterns1.filter((p) => patterns2.includes(p));
    const union = new Set([...patterns1, ...patterns2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  calculateBusinessSimilarity(theme1: Theme, theme2: Theme): number {
    const business1 = this.extractBusinessKeywords(theme1.description);
    const business2 = this.extractBusinessKeywords(theme2.description);

    const intersection = business1.filter((k) => business2.includes(k));
    const union = new Set([...business1, ...business2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  private extractPatterns(context: string): string[] {
    const patterns: string[] = [];
    const text = context.toLowerCase();

    if (text.includes('add') || text.includes('implement'))
      patterns.push('addition');
    if (text.includes('remove') || text.includes('delete'))
      patterns.push('removal');
    if (text.includes('update') || text.includes('modify'))
      patterns.push('modification');
    if (text.includes('refactor')) patterns.push('refactoring');
    if (text.includes('interface') || text.includes('type'))
      patterns.push('type_definition');
    if (text.includes('service') || text.includes('class'))
      patterns.push('service_implementation');
    if (text.includes('test')) patterns.push('testing');
    if (text.includes('configuration') || text.includes('config'))
      patterns.push('configuration');

    return patterns;
  }

  private extractBusinessKeywords(description: string): string[] {
    const keywords: string[] = [];
    const text = description.toLowerCase();

    if (text.includes('greeting')) keywords.push('greeting');
    if (text.includes('authentication') || text.includes('auth'))
      keywords.push('authentication');
    if (text.includes('user') || text.includes('customer'))
      keywords.push('user_experience');
    if (text.includes('api') || text.includes('service'))
      keywords.push('api_service');
    if (text.includes('data') || text.includes('storage'))
      keywords.push('data_management');
    if (text.includes('security')) keywords.push('security');
    if (text.includes('performance')) keywords.push('performance');
    if (text.includes('integration')) keywords.push('integration');
    if (text.includes('workflow') || text.includes('process'))
      keywords.push('workflow');

    return keywords;
  }
}
