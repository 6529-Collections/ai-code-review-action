/**
 * Fallback analysis methods for when AI services fail
 * Provides keyword-based and heuristic analysis as backup
 */

import { ConsolidatedTheme } from '../types/similarity-types';

export interface FallbackConfig {
  enableKeywordMatching: boolean;
  enableHeuristicAnalysis: boolean;
  confidenceReduction: number; // Reduce confidence by this factor for fallback results
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enableKeywordMatching: true,
  enableHeuristicAnalysis: true,
  confidenceReduction: 0.3, // Reduce confidence by 30%
};

export class FallbackAnalysis {
  private config: FallbackConfig;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  }

  /**
   * Fallback business pattern identification using keywords
   */
  identifyBusinessPatternsFallback(
    themeName: string,
    themeDescription: string,
    businessImpact: string,
    affectedFiles: string[]
  ): string[] {
    if (!this.config.enableKeywordMatching) {
      return [];
    }

    const patterns: string[] = [];
    const text =
      `${themeName} ${themeDescription} ${businessImpact} ${affectedFiles.join(' ')}`.toLowerCase();

    // Authentication & Security patterns
    if (
      this.matchesKeywords(text, [
        'auth',
        'login',
        'password',
        'security',
        'token',
        'session',
      ])
    ) {
      patterns.push('User Authentication & Security');
    }

    // Data Processing patterns
    if (
      this.matchesKeywords(text, [
        'data',
        'process',
        'transform',
        'parse',
        'validate',
        'format',
      ])
    ) {
      patterns.push('Data Processing & Validation');
    }

    // API & Integration patterns
    if (
      this.matchesKeywords(text, [
        'api',
        'endpoint',
        'request',
        'response',
        'integration',
        'service',
      ])
    ) {
      patterns.push('API Integration & Services');
    }

    // User Interface patterns
    if (
      this.matchesKeywords(text, [
        'ui',
        'interface',
        'component',
        'view',
        'display',
        'render',
      ])
    ) {
      patterns.push('User Interface & Experience');
    }

    // Configuration patterns
    if (
      this.matchesKeywords(text, [
        'config',
        'setting',
        'option',
        'parameter',
        'environment',
        'setup',
      ])
    ) {
      patterns.push('Configuration & Setup');
    }

    // Error Handling patterns
    if (
      this.matchesKeywords(text, [
        'error',
        'exception',
        'failure',
        'fallback',
        'retry',
        'recovery',
      ])
    ) {
      patterns.push('Error Handling & Recovery');
    }

    // Performance patterns
    if (
      this.matchesKeywords(text, [
        'performance',
        'optimize',
        'cache',
        'efficient',
        'speed',
        'memory',
      ])
    ) {
      patterns.push('Performance Optimization');
    }

    // Testing patterns
    if (
      this.matchesKeywords(text, [
        'test',
        'spec',
        'mock',
        'verify',
        'validate',
        'coverage',
      ])
    ) {
      patterns.push('Testing & Quality Assurance');
    }

    // Documentation patterns
    if (
      this.matchesKeywords(text, [
        'doc',
        'documentation',
        'readme',
        'comment',
        'guide',
        'help',
      ])
    ) {
      patterns.push('Documentation & Help');
    }

    // Deployment patterns
    if (
      this.matchesKeywords(text, [
        'deploy',
        'build',
        'release',
        'publish',
        'ci',
        'cd',
        'pipeline',
      ])
    ) {
      patterns.push('Deployment & CI/CD');
    }

    // Return unique patterns, limited to 6
    return [...new Set(patterns)].slice(0, 6);
  }

  /**
   * Fallback sub-theme analysis using heuristics
   */
  analyzeSubThemesFallback(theme: ConsolidatedTheme): {
    shouldExpand: boolean;
    confidence: number;
    reasoning: string;
    businessLogicPatterns: string[];
    userFlowPatterns: string[];
    subThemes: Array<{
      name: string;
      description: string;
      businessImpact: string;
      relevantFiles: string[];
      confidence: number;
    }>;
  } {
    if (!this.config.enableHeuristicAnalysis) {
      return {
        shouldExpand: false,
        confidence: 0,
        reasoning: 'Heuristic analysis disabled',
        businessLogicPatterns: [],
        userFlowPatterns: [],
        subThemes: [],
      };
    }

    // Check complexity indicators
    const fileCount = theme.affectedFiles.length;
    const descriptionLength = theme.description.length;
    const businessImpactLength = theme.businessImpact.length;

    // Simple heuristic: expand if theme is complex enough
    const complexityScore =
      (fileCount > 3 ? 0.4 : 0) +
      (descriptionLength > 100 ? 0.3 : 0) +
      (businessImpactLength > 80 ? 0.2 : 0) +
      (theme.childThemes.length === 0 ? 0.1 : 0); // Bonus for themes without existing children

    const shouldExpand = complexityScore >= 0.5;

    if (!shouldExpand) {
      return {
        shouldExpand: false,
        confidence: complexityScore * (1 - this.config.confidenceReduction),
        reasoning: `Theme complexity score ${complexityScore.toFixed(2)} below expansion threshold`,
        businessLogicPatterns: [],
        userFlowPatterns: [],
        subThemes: [],
      };
    }

    // Generate business patterns
    const businessLogicPatterns = this.identifyBusinessPatternsFallback(
      theme.name,
      theme.description,
      theme.businessImpact,
      theme.affectedFiles
    );

    // Generate user flow patterns (simplified)
    const userFlowPatterns = this.extractUserFlowPatterns(theme);

    // Generate simple sub-themes based on file groupings
    const subThemes = this.generateSimpleSubThemes(
      theme,
      businessLogicPatterns
    );

    return {
      shouldExpand: subThemes.length > 0,
      confidence: Math.min(
        complexityScore * (1 - this.config.confidenceReduction),
        0.8
      ),
      reasoning: `Heuristic analysis based on complexity score ${complexityScore.toFixed(2)}`,
      businessLogicPatterns,
      userFlowPatterns,
      subThemes,
    };
  }

  /**
   * Fallback cross-level similarity analysis
   */
  analyzeCrossLevelSimilarityFallback(
    theme1: ConsolidatedTheme,
    theme2: ConsolidatedTheme,
    levelDifference: number
  ): {
    similarityScore: number;
    relationshipType: 'duplicate' | 'overlap' | 'related' | 'distinct';
    action: 'merge_up' | 'merge_down' | 'merge_sibling' | 'keep_separate';
    confidence: number;
    reasoning: string;
  } {
    // Calculate simple similarity metrics
    const nameSimilarity = this.calculateStringSimilarity(
      theme1.name,
      theme2.name
    );
    const descriptionSimilarity = this.calculateStringSimilarity(
      theme1.description,
      theme2.description
    );
    const fileOverlap = this.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );

    // Weight the similarities
    const similarityScore =
      nameSimilarity * 0.4 + descriptionSimilarity * 0.4 + fileOverlap * 0.2;

    // Determine relationship type
    let relationshipType: 'duplicate' | 'overlap' | 'related' | 'distinct';
    let action: 'merge_up' | 'merge_down' | 'merge_sibling' | 'keep_separate';

    if (similarityScore > 0.8) {
      relationshipType = 'duplicate';
      action = theme1.level < theme2.level ? 'merge_up' : 'merge_down';
    } else if (similarityScore > 0.6) {
      relationshipType = 'overlap';
      action = levelDifference <= 1 ? 'merge_sibling' : 'keep_separate';
    } else if (similarityScore > 0.3) {
      relationshipType = 'related';
      action = 'keep_separate';
    } else {
      relationshipType = 'distinct';
      action = 'keep_separate';
    }

    return {
      similarityScore,
      relationshipType,
      action,
      confidence: Math.max(
        0.3,
        similarityScore * (1 - this.config.confidenceReduction)
      ),
      reasoning: `Heuristic analysis: name similarity ${nameSimilarity.toFixed(2)}, description similarity ${descriptionSimilarity.toFixed(2)}, file overlap ${fileOverlap.toFixed(2)}`,
    };
  }

  // Private helper methods

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private extractUserFlowPatterns(theme: ConsolidatedTheme): string[] {
    const patterns: string[] = [];
    const text =
      `${theme.name} ${theme.description} ${theme.businessImpact}`.toLowerCase();

    // Common user flow patterns
    const flowKeywords = [
      {
        pattern: 'User Registration Flow',
        keywords: ['register', 'signup', 'create account'],
      },
      {
        pattern: 'Authentication Flow',
        keywords: ['login', 'signin', 'authenticate'],
      },
      {
        pattern: 'Data Entry Flow',
        keywords: ['input', 'form', 'submit', 'create'],
      },
      {
        pattern: 'Search & Filter Flow',
        keywords: ['search', 'filter', 'query', 'find'],
      },
      {
        pattern: 'Review & Approval Flow',
        keywords: ['review', 'approve', 'validate', 'check'],
      },
      {
        pattern: 'Payment Flow',
        keywords: ['payment', 'checkout', 'purchase', 'billing'],
      },
      {
        pattern: 'Notification Flow',
        keywords: ['notify', 'alert', 'message', 'email'],
      },
      {
        pattern: 'Configuration Flow',
        keywords: ['configure', 'setup', 'settings', 'options'],
      },
    ];

    for (const { pattern, keywords } of flowKeywords) {
      if (this.matchesKeywords(text, keywords)) {
        patterns.push(pattern);
      }
    }

    return patterns.slice(0, 4); // Limit to 4 patterns
  }

  private generateSimpleSubThemes(
    theme: ConsolidatedTheme,
    businessPatterns: string[]
  ): Array<{
    name: string;
    description: string;
    businessImpact: string;
    relevantFiles: string[];
    confidence: number;
  }> {
    const subThemes: Array<{
      name: string;
      description: string;
      businessImpact: string;
      relevantFiles: string[];
      confidence: number;
    }> = [];

    // Group files by directory or type
    const fileGroups = this.groupFilesByPattern(theme.affectedFiles);

    // Create sub-themes for each significant file group
    fileGroups.forEach((files, groupName) => {
      if (files.length >= 1 && subThemes.length < 3) {
        // Max 3 sub-themes
        const subThemeName = this.generateSubThemeName(
          groupName,
          businessPatterns
        );
        subThemes.push({
          name: subThemeName,
          description: `Handles ${groupName.toLowerCase()} related functionality within ${theme.name}`,
          businessImpact: `Supports ${theme.businessImpact} through ${groupName.toLowerCase()} management`,
          relevantFiles: files,
          confidence: Math.max(
            0.4,
            0.7 * (1 - this.config.confidenceReduction)
          ),
        });
      }
    });

    return subThemes;
  }

  private groupFilesByPattern(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    files.forEach((file) => {
      let groupName = 'General';

      // Group by directory
      const pathParts = file.split('/');
      if (pathParts.length > 1) {
        groupName = pathParts[pathParts.length - 2] || 'Root';
      }

      // Group by file type/purpose
      if (file.includes('test') || file.includes('spec')) {
        groupName = 'Testing';
      } else if (file.includes('config') || file.includes('setting')) {
        groupName = 'Configuration';
      } else if (file.includes('util') || file.includes('helper')) {
        groupName = 'Utilities';
      } else if (file.includes('component') || file.includes('ui')) {
        groupName = 'Components';
      } else if (file.includes('service') || file.includes('api')) {
        groupName = 'Services';
      }

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(file);
    });

    return groups;
  }

  private generateSubThemeName(
    groupName: string,
    businessPatterns: string[]
  ): string {
    // Try to match group with business patterns
    const relevantPattern = businessPatterns.find(
      (pattern) =>
        pattern.toLowerCase().includes(groupName.toLowerCase()) ||
        groupName.toLowerCase().includes(pattern.toLowerCase().split(' ')[0])
    );

    if (relevantPattern) {
      return `${groupName} ${relevantPattern}`;
    }

    // Generate generic name
    return `${groupName} Implementation`;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateFileOverlap(files1: string[], files2: string[]): number {
    const set1 = new Set(files1);
    const set2 = new Set(files2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}
