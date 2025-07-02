import { ConsolidatedTheme } from '../types/similarity-types';
import { logInfo } from '../utils';
import { GitDiffAnalyzer, DiffAnalysis, CodeChange } from './git-diff-analyzer';

/**
 * Enhanced code structure analyzer that uses actual git diff data
 */
export class EnhancedCodeStructureAnalyzer {
  private gitDiffAnalyzer: GitDiffAnalyzer;

  constructor() {
    this.gitDiffAnalyzer = new GitDiffAnalyzer();
  }

  /**
   * Analyze theme structure using actual diff data
   */
  async analyzeThemeStructure(
    theme: ConsolidatedTheme,
    diffContent?: string
  ): Promise<EnhancedCodeStructureAnalysis> {
    // If we have diff content, use it for accurate analysis
    const diffAnalysis = diffContent
      ? this.gitDiffAnalyzer.analyzeDiff(diffContent)
      : this.createFallbackAnalysis(theme);

    const analysis: EnhancedCodeStructureAnalysis = {
      // Accurate metrics from diff
      actualLinesAdded: diffAnalysis.totalLinesAdded,
      actualLinesRemoved: diffAnalysis.totalLinesRemoved,
      actualFilesChanged: diffAnalysis.totalFiles,
      actualMethods: diffAnalysis.totalMethods,
      actualClasses: diffAnalysis.totalClasses,

      // Detailed change information
      fileChanges: Array.from(diffAnalysis.files.entries()).map(
        ([file, changes]) => ({
          file,
          changes: changes.map((c) => ({
            type: c.type,
            linesAdded: c.linesAdded,
            linesRemoved: c.linesRemoved,
            methods: c.methods || [],
            classes: c.classes || [],
          })),
        })
      ),

      // Change types based on actual modifications
      changeTypes: this.identifyChangeTypesFromDiff(diffAnalysis),

      // Complexity based on actual changes
      complexity: this.calculateComplexityFromDiff(diffAnalysis),

      // Atomicity check
      isAtomic: this.gitDiffAnalyzer.isAtomicChange(diffAnalysis),

      // Expansion hints based on real data
      expansionHints: this.generateDataDrivenHints(diffAnalysis, theme),
    };

    logInfo(
      `Enhanced analysis for "${theme.name}": +${analysis.actualLinesAdded}/-${analysis.actualLinesRemoved} lines, ` +
        `${analysis.actualMethods.length} methods, ${analysis.actualClasses.length} classes, ` +
        `atomic: ${analysis.isAtomic}`
    );

    return analysis;
  }

  /**
   * Create fallback analysis when diff is not available
   */
  private createFallbackAnalysis(theme: ConsolidatedTheme): DiffAnalysis {
    const files = new Map<string, CodeChange[]>();

    // Create approximate analysis from theme data
    theme.affectedFiles.forEach((file, index) => {
      const codeSnippet = theme.codeSnippets[index] || '';
      const changes: CodeChange[] = [
        {
          file,
          type: 'modified',
          startLine: 0,
          endLine: 0,
          linesAdded: theme.codeMetrics?.linesAdded || 0,
          linesRemoved: theme.codeMetrics?.linesRemoved || 0,
          content: codeSnippet,
          diff: codeSnippet,
          methods: this.extractMethods(codeSnippet),
          classes: this.extractClasses(codeSnippet),
        },
      ];
      files.set(file, changes);
    });

    return {
      files,
      totalFiles: theme.affectedFiles.length,
      totalLinesAdded: theme.codeMetrics?.linesAdded || 0,
      totalLinesRemoved: theme.codeMetrics?.linesRemoved || 0,
      totalMethods: theme.mainFunctionsChanged || [],
      totalClasses: theme.mainClassesChanged || [],
      changeTypes: new Map(),
    };
  }

  /**
   * Extract method names from code snippet
   */
  private extractMethods(code: string): string[] {
    const methods: string[] = [];
    const patterns = [
      /(?:function|const|let|var)\s+(\w+)\s*[=\(]/g, // eslint-disable-line no-useless-escape
      /(\w+)\s*:\s*(?:async\s+)?function/g,
      /(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        if (match[1]) methods.push(match[1]);
      }
    });

    return [...new Set(methods)];
  }

  /**
   * Extract class names from code snippet
   */
  private extractClasses(code: string): string[] {
    const classes: string[] = [];
    const patterns = [/(?:export\s+)?(?:class|interface|type|enum)\s+(\w+)/g];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        if (match[1]) classes.push(match[1]);
      }
    });

    return [...new Set(classes)];
  }

  /**
   * Identify change types from actual diff data
   */
  private identifyChangeTypesFromDiff(analysis: DiffAnalysis): ChangeType[] {
    const types = new Set<ChangeType>();

    analysis.files.forEach((changes, file) => {
      // File-based detection
      if (file.includes('.test.') || file.includes('.spec.')) {
        types.add('test');
      } else if (file.includes('config') || file.endsWith('.json')) {
        types.add('config');
      } else if (file.includes('/components/') || file.includes('.css')) {
        types.add('ui');
      } else if (file.includes('/types/') || file.endsWith('.d.ts')) {
        types.add('types');
      } else if (file.includes('/utils/')) {
        types.add('utils');
      } else if (file.endsWith('.md')) {
        types.add('docs');
      } else {
        types.add('implementation');
      }

      // Content-based detection
      changes.forEach((change) => {
        if (change.imports && change.imports.length > 0) {
          types.add('imports');
        }
      });
    });

    return Array.from(types);
  }

  /**
   * Calculate complexity based on actual changes
   */
  private calculateComplexityFromDiff(
    analysis: DiffAnalysis
  ): 'low' | 'medium' | 'high' {
    const score =
      analysis.totalFiles * 2 +
      (analysis.totalLinesAdded + analysis.totalLinesRemoved) / 10 +
      analysis.totalMethods.length * 3 +
      analysis.totalClasses.length * 4;

    if (score < 10) return 'low';
    if (score < 30) return 'medium';
    return 'high';
  }

  /**
   * Generate hints based on actual diff data
   */
  private generateDataDrivenHints(
    analysis: DiffAnalysis,
    _theme: ConsolidatedTheme // eslint-disable-line @typescript-eslint/no-unused-vars
  ): string[] {
    const hints: string[] = [];

    // Lines changed hints (PRD: 5-15 lines for atomic)
    const totalLines = analysis.totalLinesAdded + analysis.totalLinesRemoved;
    if (totalLines > 15) {
      hints.push(
        `${totalLines} lines changed exceeds PRD atomic limit (15) - split into smaller units`
      );
    }

    // Method hints
    if (analysis.totalMethods.length > 1) {
      hints.push(
        `${analysis.totalMethods.length} methods changed: ${analysis.totalMethods.join(', ')} - test separately`
      );
    }

    // Class hints
    if (analysis.totalClasses.length > 1) {
      hints.push(
        `${analysis.totalClasses.length} classes affected: ${analysis.totalClasses.join(', ')} - distinct concerns`
      );
    }

    // File hints
    if (analysis.totalFiles > 1) {
      const fileList = Array.from(analysis.files.keys()).join(', ');
      hints.push(
        `${analysis.totalFiles} files changed: ${fileList} - consider file-based separation`
      );
    }

    // Mixed change types
    analysis.files.forEach((changes, file) => {
      const hasAdds = changes.some((c) => c.linesAdded > 0);
      const hasRemoves = changes.some((c) => c.linesRemoved > 0);
      if (hasAdds && hasRemoves) {
        hints.push(
          `${file} has both additions and deletions - refactor vs new feature?`
        );
      }
    });

    // No hints but complex = suggest expansion
    if (hints.length === 0 && totalLines > 10) {
      hints.push('Consider decomposition for better testability');
    }

    return hints;
  }
}

/**
 * Enhanced analysis result with accurate metrics
 */
export interface EnhancedCodeStructureAnalysis {
  // Accurate metrics from diff
  actualLinesAdded: number;
  actualLinesRemoved: number;
  actualFilesChanged: number;
  actualMethods: string[];
  actualClasses: string[];

  // Detailed change information
  fileChanges: Array<{
    file: string;
    changes: Array<{
      type: 'added' | 'modified' | 'deleted';
      linesAdded: number;
      linesRemoved: number;
      methods: string[];
      classes: string[];
    }>;
  }>;

  // Analysis results
  changeTypes: ChangeType[];
  complexity: 'low' | 'medium' | 'high';
  isAtomic: boolean;
  expansionHints: string[];
}

export type ChangeType =
  | 'config'
  | 'logic'
  | 'ui'
  | 'test'
  | 'types'
  | 'utils'
  | 'docs'
  | 'implementation'
  | 'imports';
