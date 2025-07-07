import * as path from 'path';
import { ClaudeClient } from './claude-client';
import { JsonExtractor } from './json-extractor';
import { CodeAnalysisCache } from '../cache/code-analysis-cache';
import { logger } from '../logger/logger';

// Re-export interfaces for compatibility
export interface CodeChange {
  file: string;
  diffHunk: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';

  // AI-enhanced extractions
  functionsChanged: string[];
  classesChanged: string[];
  importsChanged: string[];
  fileType: string;
  isTestFile: boolean;
  isConfigFile: boolean;

  // New AI-only fields
  architecturalPatterns?: string[];
  businessDomain?: string;
  codeComplexity?: 'low' | 'medium' | 'high';
  semanticDescription?: string;
}

export interface SmartContext {
  // Algorithmic facts
  fileMetrics: {
    totalFiles: number;
    fileTypes: string[];
    hasTests: boolean;
    hasConfig: boolean;
    codeComplexity: 'low' | 'medium' | 'high';
  };

  // AI-enhanced patterns
  changePatterns: {
    newFunctions: string[];
    modifiedFunctions: string[];
    newImports: string[];
    removedImports: string[];
    newClasses: string[];
    modifiedClasses: string[];
    architecturalPatterns: string[];
    businessDomains: string[];
  };

  // Raw data for AI
  contextSummary: string;
  significantChanges: string[];
}

interface AIAnalysisResult {
  functionsChanged: string[];
  classesChanged: string[];
  importsChanged: string[];
  fileType: string;
  isTestFile: boolean;
  isConfigFile: boolean;
  architecturalPatterns: string[];
  businessDomain: string;
  codeComplexity: 'low' | 'medium' | 'high';
  semanticDescription: string;
}

/**
 * AI-powered code analyzer that replaces regex-based analysis
 * Uses Claude to understand code structure across all programming languages
 */
export class AICodeAnalyzer {
  private cache: CodeAnalysisCache;
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.cache = new CodeAnalysisCache(86400000); // 24 hour TTL
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Analyze multiple code changes with AI and build smart context
   * Replaces the static analyzeCodeChanges method
   */
  async analyzeCodeChanges(changes: CodeChange[]): Promise<SmartContext> {
    logger.debug('CODE-ANALYSIS', `Analyzing ${changes.length} code changes`);

    const fileMetrics = this.analyzeFileMetrics(changes);
    const changePatterns = this.extractChangePatterns(changes);
    const contextSummary = this.buildContextSummary(
      fileMetrics,
      changePatterns
    );
    const significantChanges = this.extractSignificantChanges(changes);

    return {
      fileMetrics,
      changePatterns,
      contextSummary,
      significantChanges,
    };
  }

  /**
   * Process a single changed file with AI analysis
   * Replaces the static processChangedFile method
   */
  async processChangedFile(
    filename: string,
    diffPatch: string,
    changeType: 'added' | 'modified' | 'deleted' | 'renamed'
  ): Promise<CodeChange> {
    logger.trace('CODE-ANALYSIS', `Processing ${filename} (${changeType})`);

    return await this.cache.getOrAnalyze(filename, diffPatch, async () => {
      try {
        const aiAnalysis = await this.analyzeWithAI(
          filename,
          diffPatch,
          changeType
        );

        return {
          file: filename,
          diffHunk: diffPatch,
          changeType,
          functionsChanged: aiAnalysis.functionsChanged,
          classesChanged: aiAnalysis.classesChanged,
          importsChanged: aiAnalysis.importsChanged,
          fileType: aiAnalysis.fileType,
          isTestFile: aiAnalysis.isTestFile,
          isConfigFile: aiAnalysis.isConfigFile,
          architecturalPatterns: aiAnalysis.architecturalPatterns,
          businessDomain: aiAnalysis.businessDomain,
          codeComplexity: aiAnalysis.codeComplexity,
          semanticDescription: aiAnalysis.semanticDescription,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[AI-CODE-ANALYZER] AI analysis failed for ${filename}, using minimal analysis: ${errorMessage}`
        );
        return this.createMinimalAnalysis(
          filename,
          diffPatch,
          changeType
        );
      }
    });
  }

  /**
   * Process multiple files in parallel batches
   * ClaudeClient handles rate limiting and concurrency
   */
  async processChangedFilesConcurrently(
    files: Array<{
      filename: string;
      diffPatch: string;
      changeType: 'added' | 'modified' | 'deleted' | 'renamed';
    }>
  ): Promise<CodeChange[]> {
    logger.debug('CODE-ANALYSIS', `Processing ${files.length} files`);

    // Process all files concurrently - let ClaudeClient handle rate limiting
    // This creates a continuous stream: 10→9→10→9→8→10 instead of batched 10→0→10→0
    logger.debug('CODE-ANALYSIS', `Processing all ${files.length} files concurrently`);
    
    const filePromises = files.map(async (file) => {
      try {
        const result = await this.processChangedFile(
          file.filename,
          file.diffPatch,
          file.changeType
        );
        return { success: true, result, file };
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          'CODE-ANALYSIS',
          `Failed: ${file.filename} - ${errorObj.message}`
        );
        return { success: false, error: errorObj, file };
      }
    });
    
    // Wait for all files to complete - ClaudeClient manages the 10 concurrent limit
    const allResults = await Promise.all(filePromises);
    
    // Separate successful and failed results
    const successful: CodeChange[] = [];
    const failed: Array<{ filename: string; error: Error }> = [];
    
    for (const result of allResults) {
      if (result.success) {
        successful.push(result.result as CodeChange);
      } else {
        failed.push({ filename: result.file.filename, error: result.error as Error });
      }
    }

    if (failed.length > 0) {
      logger.warn('CODE-ANALYSIS', `${failed.length} files failed analysis`);
    }

    logger.info(
      'CODE-ANALYSIS',
      `Analyzed ${successful.length}/${files.length} files`
    );
    return successful;
  }

  /**
   * Perform AI analysis on a single file
   */
  private async analyzeWithAI(
    filename: string,
    diffContent: string,
    changeType: string
  ): Promise<AIAnalysisResult> {
    const prompt = this.buildCodeAnalysisPrompt(
      filename,
      diffContent,
      changeType
    );

    const response = await this.claudeClient.callClaude(prompt, 'code-analysis', filename);

    const extractionResult = JsonExtractor.extractAndValidateJson(
      response,
      'object',
      ['functionsChanged', 'classesChanged', 'importsChanged', 'fileType']
    );

    if (!extractionResult.success) {
      throw new Error(`Failed to parse AI response: ${extractionResult.error}`);
    }

    const data = extractionResult.data as Record<string, unknown>;

    return {
      functionsChanged: Array.isArray(data.functionsChanged)
        ? (data.functionsChanged as string[])
        : [],
      classesChanged: Array.isArray(data.classesChanged)
        ? (data.classesChanged as string[])
        : [],
      importsChanged: Array.isArray(data.importsChanged)
        ? (data.importsChanged as string[])
        : [],
      fileType: (data.fileType as string) || this.getFileType(filename),
      isTestFile: (data.isTestFile as boolean) ?? this.isTestFile(filename),
      isConfigFile:
        (data.isConfigFile as boolean) ?? this.isConfigFile(filename),
      architecturalPatterns: Array.isArray(data.architecturalPatterns)
        ? (data.architecturalPatterns as string[])
        : [],
      businessDomain: (data.businessDomain as string) || 'unknown',
      codeComplexity:
        (data.codeComplexity as 'low' | 'medium' | 'high') || 'medium',
      semanticDescription:
        (data.semanticDescription as string) || 'Code changes detected',
    };
  }

  /**
   * Build AI prompt for code analysis
   */
  private buildCodeAnalysisPrompt(
    filename: string,
    diffContent: string,
    changeType: string
  ): string {
    const language = this.detectLanguage(filename);

    return `Analyze this code change and extract structural information:

File: ${filename}
Change Type: ${changeType}
Language: ${language}

Code Diff:
${diffContent}

Extract the following information as JSON. Be accurate and specific - if you can't determine something, use empty arrays or null values:

{
  "functionsChanged": ["function1", "method2"], // All function/method names that were added/modified/removed
  "classesChanged": ["Class1", "Interface2"], // Classes, interfaces, types, enums that were added/modified/removed  
  "importsChanged": ["module1", "package2"], // Import/dependency changes (module names only)
  "fileType": "${path.extname(filename)}", // File extension
  "isTestFile": false, // Is this a test file?
  "isConfigFile": false, // Is this a configuration file?
  "architecturalPatterns": ["MVC", "Repository"], // Design patterns you can identify
  "businessDomain": "authentication", // Business domain/feature area (one word)
  "codeComplexity": "medium", // low/medium/high based on complexity of changes
  "semanticDescription": "Added user authentication with JWT tokens" // Brief description of what changed
}

Rules:
- Extract exact names from the code, don't invent them
- For imports, only include the module/package name (e.g., "express", not the full path)
- Be conservative - empty arrays are better than wrong information
- Focus on structural changes, not just formatting
- Complexity: low (simple changes), medium (moderate logic), high (complex algorithms/architectures)

Respond with ONLY the JSON object, no explanations.`;
  }

  /**
   * Create minimal analysis when AI fails
   */
  private createMinimalAnalysis(
    filename: string,
    diffPatch: string,
    changeType: 'added' | 'modified' | 'deleted' | 'renamed'
  ): CodeChange {
    return {
      file: filename,
      diffHunk: diffPatch,
      changeType,
      functionsChanged: [],
      classesChanged: [],
      importsChanged: [],
      fileType: this.getFileType(filename),
      isTestFile: this.isTestFile(filename),
      isConfigFile: this.isConfigFile(filename),
      architecturalPatterns: [],
      businessDomain: 'unknown',
      codeComplexity: 'medium',
      semanticDescription: `Changes in ${filename} (AI analysis failed)`,
    };
  }

  // Helper methods from original CodeAnalyzer
  private detectLanguage(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.sh': 'Shell',
      '.sql': 'SQL',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.md': 'Markdown',
    };

    return languageMap[ext] || 'Unknown';
  }

  private getFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return ext || 'unknown';
  }

  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /^tests?\//,
      /^spec\//,
      /__tests__\//,
      /\.test$/,
      /\.spec$/,
    ];

    return testPatterns.some((pattern) => pattern.test(filename));
  }

  private isConfigFile(filename: string): boolean {
    const configPatterns = [
      /\.config\./,
      /^package\.json$/,
      /^tsconfig/,
      /^jest\.config/,
      /^webpack\.config/,
      /^\.env/,
      /^\.eslintrc/,
      /^\.prettierrc/,
      /^docker/i,
      /^makefile$/i,
      /\.ya?ml$/,
      /\.toml$/,
      /\.ini$/,
    ];

    return configPatterns.some((pattern) => pattern.test(filename));
  }

  // Analysis methods adapted from original CodeAnalyzer
  private analyzeFileMetrics(changes: CodeChange[]): {
    totalFiles: number;
    fileTypes: string[];
    hasTests: boolean;
    hasConfig: boolean;
    codeComplexity: 'low' | 'medium' | 'high';
  } {
    const fileTypes = [
      ...new Set(changes.map((c) => c.fileType).filter((type) => type)),
    ];
    const fileCount = changes.length;

    // Enhanced complexity scoring using AI results
    const complexityScores = changes.map((c) => c.codeComplexity);
    const highComplexity = complexityScores.filter((c) => c === 'high').length;
    const mediumComplexity = complexityScores.filter(
      (c) => c === 'medium'
    ).length;

    let codeComplexity: 'low' | 'medium' | 'high' = 'low';
    if (highComplexity > 0 || fileCount > 10) {
      codeComplexity = 'high';
    } else if (mediumComplexity > 1 || fileCount > 3) {
      codeComplexity = 'medium';
    }

    return {
      totalFiles: fileCount,
      fileTypes: fileTypes.filter((type) => type !== 'unknown'),
      hasTests: changes.some((c) => c.isTestFile),
      hasConfig: changes.some((c) => c.isConfigFile),
      codeComplexity,
    };
  }

  private extractChangePatterns(changes: CodeChange[]): {
    newFunctions: string[];
    modifiedFunctions: string[];
    newImports: string[];
    removedImports: string[];
    newClasses: string[];
    modifiedClasses: string[];
    architecturalPatterns: string[];
    businessDomains: string[];
  } {
    // Categorize by change type
    const newFunctions = changes
      .filter((c) => c.changeType === 'added')
      .flatMap((c) => c.functionsChanged);

    const modifiedFunctions = changes
      .filter((c) => c.changeType === 'modified')
      .flatMap((c) => c.functionsChanged);

    const newClasses = changes
      .filter((c) => c.changeType === 'added')
      .flatMap((c) => c.classesChanged);

    const modifiedClasses = changes
      .filter((c) => c.changeType === 'modified')
      .flatMap((c) => c.classesChanged);

    // Enhanced AI-based pattern extraction
    const architecturalPatterns = [
      ...new Set(changes.flatMap((c) => c.architecturalPatterns || [])),
    ];

    const businessDomains = [
      ...new Set(
        changes
          .map((c) => c.businessDomain)
          .filter((d): d is string => d !== undefined && d !== 'unknown')
      ),
    ];

    // Import analysis (simplified - could be enhanced with AI)
    const newImports = changes
      .filter((c) => c.changeType === 'added')
      .flatMap((c) => c.importsChanged);

    const removedImports = changes
      .filter((c) => c.changeType === 'deleted')
      .flatMap((c) => c.importsChanged);

    return {
      newFunctions: [...new Set(newFunctions)],
      modifiedFunctions: [...new Set(modifiedFunctions)],
      newImports: [...new Set(newImports)],
      removedImports: [...new Set(removedImports)],
      newClasses: [...new Set(newClasses)],
      modifiedClasses: [...new Set(modifiedClasses)],
      architecturalPatterns,
      businessDomains,
    };
  }

  private buildContextSummary(
    metrics: {
      totalFiles: number;
      fileTypes: string[];
      codeComplexity: string;
    },
    patterns: {
      newFunctions: string[];
      modifiedFunctions: string[];
      newImports: string[];
      architecturalPatterns: string[];
      businessDomains: string[];
    }
  ): string {
    const summary = [];

    // File overview
    summary.push(`${metrics.totalFiles} files changed`);
    if (metrics.fileTypes.length > 0) {
      summary.push(`Types: ${metrics.fileTypes.join(', ')}`);
    }

    // Function changes
    if (patterns.newFunctions.length > 0) {
      summary.push(
        `New functions: ${patterns.newFunctions.slice(0, 3).join(', ')}${patterns.newFunctions.length > 3 ? '...' : ''}`
      );
    }
    if (patterns.modifiedFunctions.length > 0) {
      summary.push(
        `Modified functions: ${patterns.modifiedFunctions.slice(0, 3).join(', ')}${patterns.modifiedFunctions.length > 3 ? '...' : ''}`
      );
    }

    // AI-enhanced insights
    if (patterns.architecturalPatterns.length > 0) {
      summary.push(`Patterns: ${patterns.architecturalPatterns.join(', ')}`);
    }

    if (patterns.businessDomains.length > 0) {
      summary.push(`Domains: ${patterns.businessDomains.join(', ')}`);
    }

    // Import changes
    if (patterns.newImports.length > 0) {
      summary.push(
        `New imports: ${patterns.newImports.slice(0, 2).join(', ')}${patterns.newImports.length > 2 ? '...' : ''}`
      );
    }

    // Complexity
    summary.push(`Complexity: ${metrics.codeComplexity}`);

    return summary.join(' | ');
  }

  private extractSignificantChanges(changes: CodeChange[]): string[] {
    const significant = [];


    // New files
    const newFiles = changes.filter((c) => c.changeType === 'added');
    for (const file of newFiles) {
      significant.push(`New file: ${file.file}`);
    }

    // Deleted files
    const deletedFiles = changes.filter((c) => c.changeType === 'deleted');
    for (const file of deletedFiles) {
      significant.push(`Deleted file: ${file.file}`);
    }

    // AI-detected significant patterns
    const complexChanges = changes.filter((c) => c.codeComplexity === 'high');
    for (const change of complexChanges) {
      if (change.semanticDescription) {
        significant.push(`Complex change: ${change.semanticDescription}`);
      }
    }

    return significant;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return this.cache.getStats();
  }
}
