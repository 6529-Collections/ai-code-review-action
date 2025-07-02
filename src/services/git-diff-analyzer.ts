/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger } from '../utils/logger';

/**
 * Represents a single change in a file
 */
export interface CodeChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  startLine: number;
  endLine: number;
  linesAdded: number;
  linesRemoved: number;
  content: string;
  diff: string;
  methods?: string[];
  classes?: string[];
  imports?: string[];
}

/**
 * Represents analyzed diff results
 */
export interface DiffAnalysis {
  files: Map<string, CodeChange[]>;
  totalFiles: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  totalMethods: string[];
  totalClasses: string[];
  changeTypes: Map<string, number>;
}

/**
 * Service for analyzing git diffs to extract exact change information
 */
export class GitDiffAnalyzer {
  private readonly METHOD_REGEX =
    /^\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*(?:\([^)]*\)|\s*=)/;
  private readonly CLASS_REGEX =
    /^\s*(?:export\s+)?(?:class|interface|type|enum)\s+(\w+)/;
  private readonly IMPORT_REGEX = /^\s*import\s+.*from\s+['"]([^'"]+)['"]/;

  /**
   * Analyze a git diff to extract structured change information
   */
  analyzeDiff(diffContent: string): DiffAnalysis {
    const context = logger.startOperation('Git Diff Analysis');

    try {
      const files = new Map<string, CodeChange[]>();
      let currentFile: string | null = null;
      let currentChanges: CodeChange[] = [];
      let currentChange: Partial<CodeChange> | null = null;

      const lines = diffContent.split('\n');
      let totalLinesAdded = 0;
      let totalLinesRemoved = 0;
      const allMethods = new Set<string>();
      const allClasses = new Set<string>();
      const changeTypes = new Map<string, number>();

      for (const line of lines) {
        // File header
        if (line.startsWith('diff --git')) {
          this.finalizeCurrentChange(
            currentFile,
            currentChange,
            currentChanges,
            files
          );
          currentFile = this.extractFileName(line);
          currentChanges = [];
          currentChange = null;
        }

        // Hunk header
        else if (line.startsWith('@@')) {
          this.finalizeCurrentChange(
            currentFile,
            currentChange,
            currentChanges,
            files
          );
          const lineNumbers = this.parseHunkHeader(line);
          if (currentFile && lineNumbers) {
            currentChange = {
              file: currentFile,
              type: 'modified',
              startLine: lineNumbers.startLine,
              endLine: lineNumbers.startLine + lineNumbers.lineCount - 1,
              linesAdded: 0,
              linesRemoved: 0,
              content: '',
              diff: line + '\n',
              methods: [],
              classes: [],
              imports: [],
            };
          }
        }

        // Added line
        else if (line.startsWith('+') && !line.startsWith('+++')) {
          if (currentChange) {
            currentChange.linesAdded! += 1;
            currentChange.diff += line + '\n';
            currentChange.content += line.substring(1) + '\n';
            totalLinesAdded++;

            // Extract code elements
            this.extractCodeElements(
              line.substring(1),
              currentChange,
              allMethods,
              allClasses
            );
          }
        }

        // Removed line
        else if (line.startsWith('-') && !line.startsWith('---')) {
          if (currentChange) {
            currentChange.linesRemoved! += 1;
            currentChange.diff += line + '\n';
            totalLinesRemoved++;
          }
        }

        // Context line
        else if (currentChange && !line.startsWith('\\')) {
          currentChange.diff += line + '\n';
        }
      }

      // Finalize last change
      this.finalizeCurrentChange(
        currentFile,
        currentChange,
        currentChanges,
        files
      );

      // Determine change types
      files.forEach((changes, _file) => {
        // eslint-disable-line @typescript-eslint/no-unused-vars
        const type = this.determineFileChangeType(
          changes,
          totalLinesAdded,
          totalLinesRemoved
        );
        changeTypes.set(type, (changeTypes.get(type) || 0) + 1);
      });

      const analysis: DiffAnalysis = {
        files,
        totalFiles: files.size,
        totalLinesAdded,
        totalLinesRemoved,
        totalMethods: Array.from(allMethods),
        totalClasses: Array.from(allClasses),
        changeTypes,
      };

      logger.endOperation(context, true, {
        filesAnalyzed: analysis.totalFiles,
        linesAdded: analysis.totalLinesAdded,
        linesRemoved: analysis.totalLinesRemoved,
        methodsFound: analysis.totalMethods.length,
        classesFound: analysis.totalClasses.length,
      });

      return analysis;
    } catch (error) {
      logger.endOperation(context, false);
      throw error;
    }
  }

  /**
   * Extract file name from diff header
   */
  private extractFileName(diffLine: string): string | null {
    const match = diffLine.match(/diff --git a\/(.+) b\/(.+)/);
    return match ? match[2] : null;
  }

  /**
   * Parse hunk header to get line numbers
   */
  private parseHunkHeader(
    hunkLine: string
  ): { startLine: number; lineCount: number } | null {
    const match = hunkLine.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (match) {
      return {
        startLine: parseInt(match[1], 10),
        lineCount: match[2] ? parseInt(match[2], 10) : 1,
      };
    }
    return null;
  }

  /**
   * Extract code elements (methods, classes, imports) from a line
   */
  private extractCodeElements(
    line: string,
    change: Partial<CodeChange>,
    allMethods: Set<string>,
    allClasses: Set<string>
  ): void {
    // Check for method
    const methodMatch = line.match(this.METHOD_REGEX);
    if (methodMatch && methodMatch[1]) {
      change.methods?.push(methodMatch[1]);
      allMethods.add(methodMatch[1]);
    }

    // Check for class/interface/type
    const classMatch = line.match(this.CLASS_REGEX);
    if (classMatch && classMatch[1]) {
      change.classes?.push(classMatch[1]);
      allClasses.add(classMatch[1]);
    }

    // Check for import
    const importMatch = line.match(this.IMPORT_REGEX);
    if (importMatch && importMatch[1]) {
      change.imports?.push(importMatch[1]);
    }
  }

  /**
   * Finalize current change and add to changes list
   */
  private finalizeCurrentChange(
    currentFile: string | null,
    currentChange: Partial<CodeChange> | null,
    currentChanges: CodeChange[],
    files: Map<string, CodeChange[]>
  ): void {
    if (currentFile && currentChange && this.isValidChange(currentChange)) {
      currentChanges.push(currentChange as CodeChange);
      files.set(currentFile, currentChanges);
    }
  }

  /**
   * Check if a change is valid (has actual modifications)
   */
  private isValidChange(change: Partial<CodeChange>): boolean {
    return (change.linesAdded || 0) > 0 || (change.linesRemoved || 0) > 0;
  }

  /**
   * Determine the type of file change
   */
  private determineFileChangeType(
    changes: CodeChange[],
    _totalAdded: number, // eslint-disable-line @typescript-eslint/no-unused-vars
    _totalRemoved: number // eslint-disable-line @typescript-eslint/no-unused-vars
  ): string {
    if (changes.every((c) => c.linesAdded > 0 && c.linesRemoved === 0)) {
      return 'added';
    } else if (changes.every((c) => c.linesRemoved > 0 && c.linesAdded === 0)) {
      return 'deleted';
    } else {
      return 'modified';
    }
  }

  /**
   * Get a summary of changes for a specific file
   */
  getFileSummary(analysis: DiffAnalysis, filePath: string): string {
    const changes = analysis.files.get(filePath);
    if (!changes || changes.length === 0) {
      return `No changes in ${filePath}`;
    }

    const totalAdded = changes.reduce((sum, c) => sum + c.linesAdded, 0);
    const totalRemoved = changes.reduce((sum, c) => sum + c.linesRemoved, 0);
    const methods = [...new Set(changes.flatMap((c) => c.methods || []))];
    const classes = [...new Set(changes.flatMap((c) => c.classes || []))];

    let summary = `${filePath}: +${totalAdded}/-${totalRemoved} lines`;

    if (methods.length > 0) {
      summary += `, methods: ${methods.join(', ')}`;
    }
    if (classes.length > 0) {
      summary += `, classes: ${classes.join(', ')}`;
    }

    return summary;
  }

  /**
   * Check if changes are atomic (single concern, testable)
   */
  isAtomicChange(analysis: DiffAnalysis): boolean {
    // Single line change is always atomic
    if (analysis.totalLinesAdded + analysis.totalLinesRemoved <= 1) {
      return true;
    }

    // Single file with limited changes
    if (analysis.totalFiles === 1) {
      const changes = Array.from(analysis.files.values())[0];
      const totalLines = changes.reduce(
        (sum, c) => sum + c.linesAdded + c.linesRemoved,
        0
      );

      // PRD: 5-15 lines for atomic changes
      if (totalLines <= 15) {
        // Single method change is atomic
        const uniqueMethods = new Set(changes.flatMap((c) => c.methods || []));
        if (uniqueMethods.size <= 1) {
          return true;
        }
      }
    }

    return false;
  }
}
