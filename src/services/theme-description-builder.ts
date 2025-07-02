import { DiffAnalysis, CodeChange } from './git-diff-analyzer';

/**
 * Builds accurate theme descriptions from actual code changes
 */
export class ThemeDescriptionBuilder {
  /**
   * Build complete theme description from diff analysis
   */
  buildDescription(
    analysis: DiffAnalysis,
    options?: {
      includeMetrics?: boolean;
      includeFileList?: boolean;
      maxLength?: number;
    }
  ): {
    description: string;
    detailedDescription: string;
    technicalSummary: string;
    keyChanges: string[];
  } {
    const opts = {
      includeMetrics: true,
      includeFileList: true,
      maxLength: 100,
      ...options,
    };

    return {
      description: this.buildMainDescription(analysis, opts),
      detailedDescription: this.buildDetailedDescription(analysis),
      technicalSummary: this.buildTechnicalSummary(analysis),
      keyChanges: this.extractKeyChanges(analysis),
    };
  }

  /**
   * Build main description (concise, factual)
   */
  private buildMainDescription(
    analysis: DiffAnalysis,
    options: { includeMetrics: boolean; maxLength: number }
  ): string {
    const parts: string[] = [];

    // Primary action
    const action = this.determineMainAction(analysis);
    parts.push(action);

    // What was changed
    if (analysis.totalMethods.length > 0) {
      const methods = analysis.totalMethods.slice(0, 3).join(', ');
      parts.push(
        `${analysis.totalMethods.length} method${analysis.totalMethods.length > 1 ? 's' : ''} (${methods})`
      );
    } else if (analysis.totalClasses.length > 0) {
      const classes = analysis.totalClasses.slice(0, 2).join(', ');
      parts.push(
        `${analysis.totalClasses.length} class${analysis.totalClasses.length > 1 ? 'es' : ''} (${classes})`
      );
    } else {
      parts.push(
        `${analysis.totalFiles} file${analysis.totalFiles > 1 ? 's' : ''}`
      );
    }

    // Metrics
    if (options.includeMetrics) {
      parts.push(
        `(+${analysis.totalLinesAdded}/-${analysis.totalLinesRemoved})`
      );
    }

    return this.truncateToLength(parts.join(' '), options.maxLength);
  }

  /**
   * Build detailed description with specific changes
   */
  private buildDetailedDescription(analysis: DiffAnalysis): string {
    const details: string[] = [];

    // File-specific changes
    let fileCount = 0;
    analysis.files.forEach((changes, file) => {
      if (fileCount++ >= 3) return; // Limit to first 3 files

      const fileName = this.extractFileName(file);
      const fileChanges = this.summarizeFileChanges(changes);

      if (fileChanges) {
        details.push(`${fileName}: ${fileChanges}`);
      }
    });

    return details.join('; ') || 'Code modifications across multiple files';
  }

  /**
   * Build technical summary
   */
  private buildTechnicalSummary(analysis: DiffAnalysis): string {
    const technical: string[] = [];

    // Methods and classes
    if (analysis.totalMethods.length > 0) {
      technical.push(`Methods: ${analysis.totalMethods.join(', ')}`);
    }

    if (analysis.totalClasses.length > 0) {
      technical.push(`Classes: ${analysis.totalClasses.join(', ')}`);
    }

    // Change types
    const changeTypes = Array.from(analysis.changeTypes.entries());
    if (changeTypes.length > 0) {
      const types = changeTypes
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      technical.push(`Changes: ${types}`);
    }

    return (
      technical.join('. ') ||
      `Technical modifications in ${analysis.totalFiles} files`
    );
  }

  /**
   * Extract key changes as bullet points
   */
  private extractKeyChanges(analysis: DiffAnalysis): string[] {
    const keyChanges: string[] = [];

    // Method changes
    analysis.totalMethods.forEach((method) => {
      const files = this.findFilesWithMethod(analysis, method);
      if (files.length > 0) {
        keyChanges.push(
          `${this.getMethodAction(analysis, method)} ${method} in ${files[0]}`
        );
      }
    });

    // Class changes
    analysis.totalClasses.forEach((className) => {
      const files = this.findFilesWithClass(analysis, className);
      if (files.length > 0) {
        keyChanges.push(
          `${this.getClassAction(analysis, className)} ${className} in ${files[0]}`
        );
      }
    });

    // File-level changes (if no methods/classes)
    if (keyChanges.length === 0) {
      analysis.files.forEach((changes, file) => {
        const summary = this.summarizeFileChanges(changes);
        if (summary) {
          keyChanges.push(`${this.extractFileName(file)}: ${summary}`);
        }
      });
    }

    return keyChanges.slice(0, 5); // Max 5 key changes
  }

  /**
   * Determine main action from diff
   */
  private determineMainAction(analysis: DiffAnalysis): string {
    const hasAdds = analysis.totalLinesAdded > 0;
    const hasRemoves = analysis.totalLinesRemoved > 0;

    if (hasAdds && !hasRemoves) return 'Added';
    if (!hasAdds && hasRemoves) return 'Removed';
    if (analysis.totalLinesAdded > analysis.totalLinesRemoved * 2)
      return 'Extended';
    if (analysis.totalLinesRemoved > analysis.totalLinesAdded * 2)
      return 'Reduced';

    return 'Modified';
  }

  /**
   * Summarize changes in a single file
   */
  private summarizeFileChanges(changes: CodeChange[]): string {
    const summary: string[] = [];

    // Aggregate metrics
    const totalAdded = changes.reduce((sum, c) => sum + c.linesAdded, 0);
    const totalRemoved = changes.reduce((sum, c) => sum + c.linesRemoved, 0);
    const allMethods = [...new Set(changes.flatMap((c) => c.methods || []))];
    const allClasses = [...new Set(changes.flatMap((c) => c.classes || []))];

    if (allMethods.length > 0) {
      summary.push(`${allMethods.join(', ')}`);
    } else if (allClasses.length > 0) {
      summary.push(`${allClasses.join(', ')}`);
    } else {
      summary.push(`+${totalAdded}/-${totalRemoved} lines`);
    }

    return summary.join(', ');
  }

  /**
   * Find files containing a specific method
   */
  private findFilesWithMethod(
    analysis: DiffAnalysis,
    method: string
  ): string[] {
    const files: string[] = [];

    analysis.files.forEach((changes, file) => {
      const hasMethod = changes.some((c) => c.methods?.includes(method));
      if (hasMethod) {
        files.push(this.extractFileName(file));
      }
    });

    return files;
  }

  /**
   * Find files containing a specific class
   */
  private findFilesWithClass(
    analysis: DiffAnalysis,
    className: string
  ): string[] {
    const files: string[] = [];

    analysis.files.forEach((changes, file) => {
      const hasClass = changes.some((c) => c.classes?.includes(className));
      if (hasClass) {
        files.push(this.extractFileName(file));
      }
    });

    return files;
  }

  /**
   * Determine action for a specific method
   */
  private getMethodAction(analysis: DiffAnalysis, method: string): string {
    let hasAdds = false;
    let hasRemoves = false;

    analysis.files.forEach((changes) => {
      changes.forEach((change) => {
        if (change.methods?.includes(method)) {
          if (change.linesAdded > 0) hasAdds = true;
          if (change.linesRemoved > 0) hasRemoves = true;
        }
      });
    });

    if (hasAdds && !hasRemoves) return 'Add';
    if (!hasAdds && hasRemoves) return 'Remove';
    return 'Update';
  }

  /**
   * Determine action for a specific class
   */
  private getClassAction(analysis: DiffAnalysis, className: string): string {
    let hasAdds = false;
    let hasRemoves = false;

    analysis.files.forEach((changes) => {
      changes.forEach((change) => {
        if (change.classes?.includes(className)) {
          if (change.linesAdded > 0) hasAdds = true;
          if (change.linesRemoved > 0) hasRemoves = true;
        }
      });
    });

    if (hasAdds && !hasRemoves) return 'Add';
    if (!hasAdds && hasRemoves) return 'Remove';
    return 'Update';
  }

  /**
   * Extract clean file name from path
   */
  private extractFileName(filePath: string): string {
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Truncate text to specified length
   */
  private truncateToLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Try to break at word boundary
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }
}
