export interface CodeChange {
  file: string;
  diffHunk: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  linesAdded: number;
  linesRemoved: number;

  // Algorithmic extractions
  functionsChanged: string[];
  classesChanged: string[];
  importsChanged: string[];
  fileType: string;
  isTestFile: boolean;
  isConfigFile: boolean;
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

  // Algorithmic patterns
  changePatterns: {
    newFunctions: string[];
    modifiedFunctions: string[];
    newImports: string[];
    removedImports: string[];
    newClasses: string[];
    modifiedClasses: string[];
  };

  // Raw data for AI
  contextSummary: string;
  significantChanges: string[];
}

export class CodeAnalyzer {
  private static readonly FUNCTION_PATTERNS = [
    /(?:^|\n)[-+]\s*(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    /(?:^|\n)[-+]\s*(?:public|private|protected)?\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    /(?:^|\n)[-+]\s*const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\(/g,
    /(?:^|\n)[-+]\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\(/g, // Interface methods
  ];

  private static readonly CLASS_PATTERNS = [
    /(?:^|\n)[-+]\s*(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    /(?:^|\n)[-+]\s*(?:export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    /(?:^|\n)[-+]\s*(?:export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    /(?:^|\n)[-+]\s*(?:export\s+)?enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
  ];

  private static readonly IMPORT_PATTERNS = [
    /(?:^|\n)[-+]\s*import\s+.*?from\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)[-+]\s*import\s+['"]([^'"]+)['"]/g,
  ];

  static analyzeCodeChanges(changes: CodeChange[]): SmartContext {
    console.log(`[CODE-ANALYZER] Analyzing ${changes.length} code changes`);

    const fileMetrics = this.analyzeFileMetrics(changes);
    const changePatterns = this.extractChangePatterns(changes);
    const contextSummary = this.buildContextSummary(
      changes,
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

  static processChangedFile(
    filename: string,
    diffPatch: string,
    changeType: 'added' | 'modified' | 'deleted' | 'renamed',
    linesAdded: number,
    linesRemoved: number
  ): CodeChange {
    console.log(`[CODE-ANALYZER] Processing ${filename} (${changeType})`);

    return {
      file: filename,
      diffHunk: diffPatch,
      changeType,
      linesAdded,
      linesRemoved,
      functionsChanged: this.extractFunctions(diffPatch),
      classesChanged: this.extractClasses(diffPatch),
      importsChanged: this.extractImports(diffPatch),
      fileType: this.getFileType(filename),
      isTestFile: this.isTestFile(filename),
      isConfigFile: this.isConfigFile(filename),
    };
  }

  private static analyzeFileMetrics(changes: CodeChange[]): {
    totalFiles: number;
    fileTypes: string[];
    hasTests: boolean;
    hasConfig: boolean;
    codeComplexity: 'low' | 'medium' | 'high';
  } {
    const fileTypes = [...new Set(changes.map((c) => c.fileType))];
    const totalLines = changes.reduce(
      (sum, c) => sum + c.linesAdded + c.linesRemoved,
      0
    );
    const fileCount = changes.length;

    // Complexity scoring based on file count and line changes
    let codeComplexity: 'low' | 'medium' | 'high' = 'low';
    if (fileCount > 5 || totalLines > 200) {
      codeComplexity = 'high';
    } else if (fileCount > 2 || totalLines > 50) {
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

  private static extractChangePatterns(changes: CodeChange[]): {
    newFunctions: string[];
    modifiedFunctions: string[];
    newImports: string[];
    removedImports: string[];
    newClasses: string[];
    modifiedClasses: string[];
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

    // Import analysis
    const addedImports = this.extractImportChanges(changes, 'added');
    const removedImports = this.extractImportChanges(changes, 'removed');

    return {
      newFunctions: [...new Set(newFunctions)],
      modifiedFunctions: [...new Set(modifiedFunctions)],
      newImports: addedImports,
      removedImports: removedImports,
      newClasses: [...new Set(newClasses)],
      modifiedClasses: [...new Set(modifiedClasses)],
    };
  }

  private static extractFunctions(diffContent: string): string[] {
    const functions = new Set<string>();

    for (const pattern of this.FUNCTION_PATTERNS) {
      let match;
      while ((match = pattern.exec(diffContent)) !== null) {
        if (match[1] && match[1].length > 0) {
          functions.add(match[1]);
        }
      }
      pattern.lastIndex = 0; // Reset regex state
    }

    return Array.from(functions);
  }

  private static extractClasses(diffContent: string): string[] {
    const classes = new Set<string>();

    for (const pattern of this.CLASS_PATTERNS) {
      let match;
      while ((match = pattern.exec(diffContent)) !== null) {
        if (match[1] && match[1].length > 0) {
          classes.add(match[1]);
        }
      }
      pattern.lastIndex = 0; // Reset regex state
    }

    return Array.from(classes);
  }

  private static extractImports(diffContent: string): string[] {
    const imports = new Set<string>();

    for (const pattern of this.IMPORT_PATTERNS) {
      let match;
      while ((match = pattern.exec(diffContent)) !== null) {
        if (match[1] && match[1].length > 0) {
          imports.add(match[1]);
        }
      }
      pattern.lastIndex = 0; // Reset regex state
    }

    return Array.from(imports);
  }

  private static extractImportChanges(
    changes: CodeChange[],
    changeType: 'added' | 'removed'
  ): string[] {
    const imports = new Set<string>();

    for (const change of changes) {
      const lines = change.diffHunk.split('\n');
      const prefix = changeType === 'added' ? '+' : '-';

      for (const line of lines) {
        if (line.startsWith(prefix) && line.includes('import')) {
          const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
          if (importMatch) {
            imports.add(importMatch[1]);
          }
        }
      }
    }

    return Array.from(imports);
  }

  private static getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? `.${ext}` : 'unknown';
  }

  private static isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /^tests?\//,
      /^spec\//,
      /__tests__\//,
    ];

    return testPatterns.some((pattern) => pattern.test(filename));
  }

  private static isConfigFile(filename: string): boolean {
    const configPatterns = [
      /\.config\./,
      /^package\.json$/,
      /^tsconfig/,
      /^jest\.config/,
      /^webpack\.config/,
      /^\.env/,
      /^\.eslintrc/,
      /^\.prettierrc/,
    ];

    return configPatterns.some((pattern) => pattern.test(filename));
  }

  private static buildContextSummary(
    changes: CodeChange[],
    metrics: {
      totalFiles: number;
      fileTypes: string[];
      codeComplexity: string;
    },
    patterns: {
      newFunctions: string[];
      modifiedFunctions: string[];
      newImports: string[];
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

  private static extractSignificantChanges(changes: CodeChange[]): string[] {
    const significant = [];

    // Large files
    const largeChanges = changes.filter(
      (c) => c.linesAdded + c.linesRemoved > 50
    );
    for (const change of largeChanges) {
      significant.push(
        `Large change in ${change.file} (+${change.linesAdded}/-${change.linesRemoved})`
      );
    }

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

    return significant;
  }
}
