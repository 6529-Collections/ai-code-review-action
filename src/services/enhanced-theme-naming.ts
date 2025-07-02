import { DiffAnalysis } from './git-diff-analyzer';
import { logger } from '../utils/logger';
import { UnifiedPromptService } from './ai/unified-prompt-service';
import { PromptType } from './ai/prompt-types';

/**
 * Enhanced theme naming service that generates accurate names from actual changes
 */
export class EnhancedThemeNamingService {
  private unifiedPromptService?: UnifiedPromptService;

  constructor(anthropicApiKey?: string) {
    if (anthropicApiKey) {
      this.unifiedPromptService =
        UnifiedPromptService.getInstance(anthropicApiKey);
    }
  }

  /**
   * Generate theme name based on actual code changes
   * Priority: actual changes > file names > business impact
   */
  async generateThemeName(
    diffAnalysis: DiffAnalysis,
    businessContext?: string
  ): Promise<{
    name: string;
    description: string;
    confidence: number;
  }> {
    const context = logger.startOperation('Enhanced Theme Naming');

    try {
      // Step 1: Try to generate name from actual changes
      const dataBasedName = this.generateDataBasedName(diffAnalysis);

      // Step 2: If we have AI, enhance with business context
      if (this.unifiedPromptService && businessContext) {
        const aiEnhanced = await this.enhanceWithAI(
          dataBasedName,
          diffAnalysis,
          businessContext
        );

        logger.endOperation(context, true, {
          method: 'AI enhanced',
          confidence: aiEnhanced.confidence,
        });

        return aiEnhanced;
      }

      // Step 3: Fallback to pure data-based naming
      const result = {
        name: dataBasedName.name,
        description: dataBasedName.description,
        confidence: 0.7,
      };

      logger.endOperation(context, true, {
        method: 'Data-based',
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.endOperation(context, false);

      // Ultimate fallback
      return {
        name: this.generateFallbackName(diffAnalysis),
        description: this.generateFallbackDescription(diffAnalysis),
        confidence: 0.3,
      };
    }
  }

  /**
   * Generate name directly from diff analysis data
   */
  private generateDataBasedName(analysis: DiffAnalysis): {
    name: string;
    description: string;
  } {
    // Case 1: Single method change
    if (analysis.totalMethods.length === 1 && analysis.totalFiles === 1) {
      const method = analysis.totalMethods[0];
      const file = Array.from(analysis.files.keys())[0];
      const action = this.determineAction(analysis);

      return {
        name: `${action} ${method} method`,
        description: `${action} ${method} in ${this.getFileName(file)}`,
      };
    }

    // Case 2: Single class change
    if (analysis.totalClasses.length === 1 && analysis.totalFiles === 1) {
      const className = analysis.totalClasses[0];
      const action = this.determineAction(analysis);

      return {
        name: `${action} ${className} class`,
        description: `${action} ${className} implementation`,
      };
    }

    // Case 3: Single file with specific changes
    if (analysis.totalFiles === 1) {
      const file = Array.from(analysis.files.keys())[0];
      const fileName = this.getFileName(file);
      const action = this.determineAction(analysis);

      if (analysis.totalMethods.length > 0) {
        return {
          name: `${action} ${fileName} methods`,
          description: `${action} ${analysis.totalMethods.join(', ')} in ${fileName}`,
        };
      }

      return {
        name: `${action} ${fileName}`,
        description: `${action} ${analysis.totalLinesAdded} additions, ${analysis.totalLinesRemoved} deletions in ${fileName}`,
      };
    }

    // Case 4: Multiple files - find common pattern
    const filePattern = this.findFilePattern(Array.from(analysis.files.keys()));
    const action = this.determineAction(analysis);

    if (filePattern) {
      return {
        name: `${action} ${filePattern} files`,
        description: `${action} ${analysis.totalFiles} ${filePattern} files`,
      };
    }

    // Case 5: Generic multi-file change
    return {
      name: `${action} ${analysis.totalFiles} files`,
      description: `${action} code across ${analysis.totalFiles} files (+${analysis.totalLinesAdded}/-${analysis.totalLinesRemoved})`,
    };
  }

  /**
   * Determine the primary action from changes
   */
  private determineAction(analysis: DiffAnalysis): string {
    const added = analysis.totalLinesAdded;
    const removed = analysis.totalLinesRemoved;

    if (added > 0 && removed === 0) return 'Add';
    if (removed > 0 && added === 0) return 'Remove';
    if (removed > added * 2) return 'Remove';
    if (added > removed * 2) return 'Add';

    // Look at change types
    const changeTypes = Array.from(analysis.changeTypes.keys());
    if (changeTypes.includes('deleted')) return 'Remove';
    if (changeTypes.includes('added')) return 'Add';

    return 'Update';
  }

  /**
   * Get clean file name from path
   */
  private getFileName(filePath: string): string {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.[^.]+$/, ''); // Remove extension
  }

  /**
   * Find common pattern in file paths
   */
  private findFilePattern(files: string[]): string | null {
    if (files.length === 0) return null;

    // Check for common directory
    const directories = files.map((f) => {
      const parts = f.split('/');
      return parts.slice(0, -1).join('/');
    });

    const uniqueDirs = [...new Set(directories)];
    if (uniqueDirs.length === 1) {
      const dir = uniqueDirs[0].split('/').pop() || '';
      return dir;
    }

    // Check for common file type
    const extensions = files.map((f) => f.split('.').pop() || '');
    const uniqueExts = [...new Set(extensions)];
    if (uniqueExts.length === 1) {
      const ext = uniqueExts[0];
      if (ext === 'test' || ext === 'spec') return 'test';
      if (ext === 'ts' || ext === 'js') return 'code';
      if (ext === 'json' || ext === 'yaml') return 'config';
      return ext;
    }

    return null;
  }

  /**
   * Enhance data-based name with AI for business context
   */
  private async enhanceWithAI(
    dataBasedName: { name: string; description: string },
    analysis: DiffAnalysis,
    businessContext: string
  ): Promise<{ name: string; description: string; confidence: number }> {
    if (!this.unifiedPromptService) {
      return { ...dataBasedName, confidence: 0.7 };
    }

    try {
      const prompt = {
        currentName: dataBasedName.name,
        currentDescription: dataBasedName.description,
        actualChanges: this.summarizeChanges(analysis),
        businessContext,
        affectedFiles: Array.from(analysis.files.keys()),
      };

      const response = await this.unifiedPromptService.execute(
        PromptType.THEME_NAMING,
        prompt
      );

      if (response.success && response.data) {
        const data = response.data as {
          themeName?: string;
          reasoning?: string;
        };
        return {
          name: data.themeName || dataBasedName.name,
          description: data.reasoning || dataBasedName.description,
          confidence: response.confidence || 0.8,
        };
      }
    } catch (error) {
      logger.logError('AI theme naming failed', error as Error);
    }

    return { ...dataBasedName, confidence: 0.7 };
  }

  /**
   * Summarize changes for AI context
   */
  private summarizeChanges(analysis: DiffAnalysis): string {
    const parts: string[] = [];

    if (analysis.totalMethods.length > 0) {
      parts.push(`Methods: ${analysis.totalMethods.join(', ')}`);
    }

    if (analysis.totalClasses.length > 0) {
      parts.push(`Classes: ${analysis.totalClasses.join(', ')}`);
    }

    parts.push(
      `Lines: +${analysis.totalLinesAdded}/-${analysis.totalLinesRemoved}`
    );
    parts.push(`Files: ${analysis.totalFiles}`);

    return parts.join(', ');
  }

  /**
   * Generate fallback name when all else fails
   */
  private generateFallbackName(analysis: DiffAnalysis): string {
    if (analysis.totalFiles === 1) {
      const file = Array.from(analysis.files.keys())[0];
      return `Update ${this.getFileName(file)}`;
    }
    return `Update ${analysis.totalFiles} files`;
  }

  /**
   * Generate fallback description
   */
  private generateFallbackDescription(analysis: DiffAnalysis): string {
    return `Modified ${analysis.totalFiles} files with +${analysis.totalLinesAdded}/-${analysis.totalLinesRemoved} lines`;
  }
}
