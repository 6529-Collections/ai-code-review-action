import { ConsolidatedTheme } from '../types/similarity-types';

/**
 * Utility for formatting theme hierarchies for output
 */
export class ThemeFormatter {
  private static readonly MAX_FILES_SHOWN = 3;
  private static readonly MAX_DESCRIPTION_LENGTH = 200;

  /**
   * Format themes for GitHub Actions output with deep hierarchy support
   */
  static formatThemesForOutput(themes: ConsolidatedTheme[]): string {
    const themeCount = this.countTotalThemes(themes);
    let output = `Found ${themeCount} themes:\\n`;

    themes.forEach((theme, index) => {
      output += this.formatThemeRecursively(theme, index + 1, 0);
    });

    return output;
  }

  /**
   * Format a single theme recursively with proper indentation
   */
  private static formatThemeRecursively(
    theme: ConsolidatedTheme,
    number: number,
    depth: number,
    parentNumber?: string
  ): string {
    const indent = '   '.repeat(depth);
    const confidence = (theme.confidence * 100).toFixed(0);
    // Create theme number (e.g., "1", "1.1", "1.1.1")
    const themeNumber = parentNumber
      ? `${parentNumber}.${number}`
      : `${number}`;

    // Truncate description if too long
    const description = this.truncateText(
      theme.description.replace(/[\r\n]/g, ' ').trim()
    );

    let output = `\\n${indent}${themeNumber}. **${theme.name}** (${confidence}%)`;

    // Files on the same line or next line depending on length
    const files = theme.affectedFiles.join(', '); // Show ALL files
    const fileList =
      theme.affectedFiles.length > this.MAX_FILES_SHOWN
        ? `${files} (+${theme.affectedFiles.length - this.MAX_FILES_SHOWN} more)`
        : files;
    output += `\\n${indent}   ${fileList}`;

    // Main description
    output += `\\n${indent}   ${description}`;

    // Show detailed description only if significantly different and adds value
    if (
      theme.detailedDescription &&
      theme.detailedDescription.length > 20 &&
      !theme.description
        .toLowerCase()
        .includes(theme.detailedDescription.toLowerCase())
    ) {
      output += ` ${theme.detailedDescription}`;
    }

    // No merge indicators, no emoji, just content

    // Show child themes recursively without announcement
    if (theme.childThemes && theme.childThemes.length > 0) {
      output += '\\n'; // Add blank line before sub-themes

      theme.childThemes.forEach((childTheme, childIndex) => {
        output += this.formatThemeRecursively(
          childTheme,
          childIndex + 1,
          depth + 1,
          themeNumber
        );
      });
    }

    return output;
  }

  /**
   * Create a concise summary of the theme analysis
   */
  static createThemeSummary(themes: ConsolidatedTheme[]): string {
    const totalThemes = this.countTotalThemes(themes);
    const maxDepth = this.calculateMaxDepth(themes);
    const avgConfidence = this.calculateAverageConfidence(themes);

    const rootThemes = themes.length;
    const expandedThemes = this.countExpandedThemes(themes);
    const mergedThemes = this.countMergedThemes(themes);

    let summary = `Analyzed code changes and identified ${totalThemes} themes across ${maxDepth + 1} hierarchy levels. `;
    summary += `Root themes: ${rootThemes}, Average confidence: ${(avgConfidence * 100).toFixed(0)}%. `;

    if (expandedThemes > 0) {
      summary += `${expandedThemes} themes expanded for detailed analysis. `;
    }

    if (mergedThemes > 0) {
      summary += `${mergedThemes} themes consolidated from similar patterns.`;
    }

    return summary;
  }

  /**
   * Format themes for JSON output (useful for integrations)
   */
  static formatThemesAsJson(themes: ConsolidatedTheme[]): string {
    const formatted = themes.map((theme) => this.themeToJsonObject(theme));
    return JSON.stringify(formatted, null, 2);
  }

  /**
   * Create a flat list of all themes with hierarchy indicators
   */
  static createFlatThemeList(themes: ConsolidatedTheme[]): string {
    const flatThemes: Array<{ theme: ConsolidatedTheme; path: string }> = [];

    const collectThemes = (
      themeList: ConsolidatedTheme[],
      parentPath: string = ''
    ): void => {
      themeList.forEach((theme, index) => {
        const currentPath = parentPath
          ? `${parentPath}.${index + 1}`
          : `${index + 1}`;
        flatThemes.push({ theme, path: currentPath });

        if (theme.childThemes.length > 0) {
          collectThemes(theme.childThemes, currentPath);
        }
      });
    };

    collectThemes(themes);

    let output = `Theme hierarchy (${flatThemes.length} total themes):\\n`;
    flatThemes.forEach(({ theme, path }) => {
      const confidence = (theme.confidence * 100).toFixed(0);
      const level = path.split('.').length;
      const indent = '  '.repeat(level - 1);

      output += `\\n${indent}${path}. ${theme.name} (${confidence}%, ${theme.affectedFiles.length} files)`;
    });

    return output;
  }

  // Private helper methods

  private static countTotalThemes(themes: ConsolidatedTheme[]): number {
    let count = 0;

    const countRecursively = (themeList: ConsolidatedTheme[]): void => {
      count += themeList.length;
      themeList.forEach((theme) => {
        if (theme.childThemes.length > 0) {
          countRecursively(theme.childThemes);
        }
      });
    };

    countRecursively(themes);
    return count;
  }

  private static calculateMaxDepth(themes: ConsolidatedTheme[]): number {
    let maxDepth = 0;

    const findMaxDepth = (
      themeList: ConsolidatedTheme[],
      currentDepth: number
    ): void => {
      maxDepth = Math.max(maxDepth, currentDepth);
      themeList.forEach((theme) => {
        if (theme.childThemes.length > 0) {
          findMaxDepth(theme.childThemes, currentDepth + 1);
        }
      });
    };

    findMaxDepth(themes, 0);
    return maxDepth;
  }

  private static calculateAverageConfidence(
    themes: ConsolidatedTheme[]
  ): number {
    const allThemes: ConsolidatedTheme[] = [];

    const collectAllThemes = (themeList: ConsolidatedTheme[]): void => {
      themeList.forEach((theme) => {
        allThemes.push(theme);
        if (theme.childThemes.length > 0) {
          collectAllThemes(theme.childThemes);
        }
      });
    };

    collectAllThemes(themes);

    if (allThemes.length === 0) return 0;

    const totalConfidence = allThemes.reduce(
      (sum, theme) => sum + theme.confidence,
      0
    );
    return totalConfidence / allThemes.length;
  }

  private static countExpandedThemes(themes: ConsolidatedTheme[]): number {
    let count = 0;

    const countRecursively = (themeList: ConsolidatedTheme[]): void => {
      themeList.forEach((theme) => {
        if (theme.isExpanded || theme.consolidationMethod === 'expansion') {
          count++;
        }
        if (theme.childThemes.length > 0) {
          countRecursively(theme.childThemes);
        }
      });
    };

    countRecursively(themes);
    return count;
  }

  private static countMergedThemes(themes: ConsolidatedTheme[]): number {
    let count = 0;

    const countRecursively = (themeList: ConsolidatedTheme[]): void => {
      themeList.forEach((theme) => {
        if (
          theme.consolidationMethod === 'merge' &&
          theme.sourceThemes.length > 1
        ) {
          count++;
        }
        if (theme.childThemes.length > 0) {
          countRecursively(theme.childThemes);
        }
      });
    };

    countRecursively(themes);
    return count;
  }

  private static truncateText(text: string): string {
    // NO truncation - return full text always
    return text;
  }

  private static themeToJsonObject(theme: ConsolidatedTheme): {
    id: string;
    name: string;
    description: string;
    level: number;
    confidence: number;
    businessImpact: string;
    affectedFiles: string[];
    consolidationMethod: string;
    isExpanded?: boolean;
    businessLogicPatterns?: string[];
    userFlowPatterns?: string[];
    childThemes: unknown[];
  } {
    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      level: theme.level,
      confidence: theme.confidence,
      businessImpact: theme.businessImpact,
      affectedFiles: theme.affectedFiles,
      consolidationMethod: theme.consolidationMethod,
      isExpanded: theme.isExpanded,
      businessLogicPatterns: theme.businessLogicPatterns,
      userFlowPatterns: theme.userFlowPatterns,
      childThemes: theme.childThemes.map((child) =>
        this.themeToJsonObject(child)
      ),
    };
  }
}
