import * as github from '@actions/github';
import {
  SemanticDiff,
  FileDiff,
  DiffHunk,
  LineChange,
  ImportChange,
  ExportChange,
  SemanticChange,
  FileRelationship,
  SharedComponent,
  BusinessPattern,
  FileType,
  AIAnalysisContext,
} from '../../mindmap/types/mindmap-types';
import { AISemanticAnalyzer } from '../../mindmap/services/ai/ai-semantic-analyzer';
import { logInfo } from '../../utils';

/**
 * Enhanced Git service for semantic diff analysis
 * Provides AI-driven understanding of code changes beyond raw diffs
 * PRD: "AI decides" semantic meaning, replaces mechanical pattern matching
 */
export class EnhancedGitService {
  private octokit: ReturnType<typeof github.getOctokit>;
  private aiSemanticAnalyzer: AISemanticAnalyzer;

  constructor(githubToken: string, anthropicApiKey: string) {
    this.octokit = github.getOctokit(githubToken);
    this.aiSemanticAnalyzer = new AISemanticAnalyzer(anthropicApiKey);
  }

  /**
   * Extract rich diff information with full semantic context
   */
  async getSemanticDiff(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<SemanticDiff> {
    logInfo(`Fetching semantic diff for PR #${prNumber}`);

    // Get PR details and files
    const [, files] = await Promise.all([
      this.octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
      this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      }),
    ]);

    // Get detailed diffs for each file
    const fileDiffs = await this.parseFilesWithContext(files.data);

    // Analyze cross-file relationships
    const crossFileRelationships = await this.analyzeDependencies(fileDiffs);

    // Identify shared components
    const sharedComponents = await this.identifySharedComponents(
      fileDiffs,
      crossFileRelationships
    );

    // Detect business patterns
    const businessPatterns = await this.detectBusinessPatterns(fileDiffs);

    // Calculate total complexity
    const totalComplexity = this.calculateTotalComplexity(fileDiffs);

    return {
      files: fileDiffs,
      crossFileRelationships,
      sharedComponents,
      businessPatterns,
      totalComplexity,
    };
  }

  /**
   * Parse files with full semantic context
   */
  private async parseFilesWithContext(
    files: Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      changes: number;
      patch?: string;
      previous_filename?: string;
    }>
  ): Promise<FileDiff[]> {
    const fileDiffs: FileDiff[] = [];

    for (const file of files) {
      const fileDiff = await this.parseFileDiff(file);
      fileDiffs.push(fileDiff);
    }

    return fileDiffs;
  }

  /**
   * Parse individual file diff with AI-enhanced semantic understanding
   */
  private async parseFileDiff(file: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    previous_filename?: string;
  }): Promise<FileDiff> {
    const fileType = await this.detectFileType(file.filename, file.patch);
    const hunks = await this.parseDiffHunks(file.patch || '');
    const imports = await this.extractImportChanges(hunks);
    const exports = await this.extractExportChanges(hunks);
    const dependencies = await this.extractDependencies(imports);
    const semanticChanges = await this.analyzeSemanticChangesWithAI(
      hunks,
      file.filename,
      fileType,
      file.patch || ''
    );

    return {
      path: file.filename,
      fileType,
      oldPath: file.previous_filename,
      isNew: file.status === 'added',
      isDeleted: file.status === 'removed',
      isRenamed: file.status === 'renamed',
      hunks,
      imports,
      exports,
      dependencies,
      semanticChanges,
    };
  }

  /**
   * Detect file type with AI assistance for better accuracy
   * PRD: "File type intelligence" - understand actual purpose, not just extension
   */
  private async detectFileType(
    filename: string,
    content?: string
  ): Promise<FileType> {
    // Fast path for obvious cases
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('__tests__')
    ) {
      return 'test';
    }
    if (filename.endsWith('.md') || filename.includes('README')) {
      return 'documentation';
    }
    if (
      filename.endsWith('.css') ||
      filename.endsWith('.scss') ||
      filename.endsWith('.less')
    ) {
      return 'style';
    }

    // For ambiguous cases, use AI if content is available
    if (content) {
      try {
        const aiContext = await this.aiSemanticAnalyzer.analyzeFilePurpose(
          filename,
          content
        );
        // Map AI context types to FileType
        const contextTypeMap: Record<string, FileType> = {
          function: 'source',
          class: 'source',
          module: 'source',
          config: 'config',
          test: 'test',
        };
        return contextTypeMap[aiContext.contextType] || 'source';
      } catch (error) {
        logInfo(`AI file type detection failed for ${filename}: ${error}`);
      }
    }

    // Fallback to basic pattern matching
    if (
      filename.includes('config') ||
      filename.endsWith('.json') ||
      filename.endsWith('.yaml') ||
      filename.endsWith('.yml')
    ) {
      return 'config';
    }
    if (
      filename.includes('webpack') ||
      filename.includes('rollup') ||
      filename.includes('vite') ||
      filename.endsWith('.build.js')
    ) {
      return 'build';
    }
    if (
      filename.endsWith('.sql') ||
      filename.endsWith('.graphql') ||
      filename.includes('schema')
    ) {
      return 'data';
    }
    return 'source';
  }

  /**
   * Parse diff hunks with line-level detail
   */
  private async parseDiffHunks(patch: string): Promise<DiffHunk[]> {
    if (!patch) return [];

    const hunks: DiffHunk[] = [];
    const hunkRegex = /@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)/;
    const lines = patch.split('\n');

    let currentHunk: DiffHunk | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      const hunkMatch = line.match(hunkRegex);

      if (hunkMatch) {
        // Start new hunk
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldLines: parseInt(hunkMatch[2] || '1'),
          newStart: parseInt(hunkMatch[3]),
          newLines: parseInt(hunkMatch[4] || '1'),
          changes: [],
          semanticContext: await this.extractSemanticContext(hunkMatch[5]),
        };
        lineNumber = currentHunk.newStart;
      } else if (currentHunk && line.length > 0) {
        const type =
          line[0] === '+' ? 'add' : line[0] === '-' ? 'delete' : 'context';
        const content = line.substring(1);

        currentHunk.changes.push({
          type,
          lineNumber: type === 'delete' ? -1 : lineNumber,
          content,
          isKeyChange: await this.isKeyChange(content),
        });

        if (type !== 'delete') {
          lineNumber++;
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Extract semantic context from hunk header
   */
  private async extractSemanticContext(
    contextLine: string
  ): Promise<string | undefined> {
    // Extract function/class name from diff context
    const patterns = [
      /function\s+(\w+)/,
      /class\s+(\w+)/,
      /interface\s+(\w+)/,
      /const\s+(\w+)/,
      /export\s+\w+\s+(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = contextLine.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Determine if a line change is a key change
   */
  private async isKeyChange(content: string): Promise<boolean> {
    // Identify critical changes
    const keyPatterns = [
      /api\s*\(/i,
      /export/,
      /public\s+/,
      /return\s+/,
      /throw\s+/,
      /async\s+/,
      /await\s+/,
      /new\s+/,
      /delete\s+/,
    ];

    return keyPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Extract import changes from hunks
   */
  private async extractImportChanges(
    hunks: DiffHunk[]
  ): Promise<ImportChange[]> {
    const imports: ImportChange[] = [];
    const importRegex =
      /import\s+(?:(\*\s+as\s+\w+)|(\{[^}]+\})|(\w+))?\s*(?:,\s*(?:(\*\s+as\s+\w+)|(\{[^}]+\})|(\w+)))?\s*from\s+['"]([^'"]+)['"]/;

    for (const hunk of hunks) {
      for (const change of hunk.changes) {
        if (change.type !== 'context') {
          const match = change.content.match(importRegex);
          if (match) {
            const module = match[7];
            const items: string[] = [];

            // Extract imported items
            if (match[1] || match[4])
              items.push('* as ' + (match[1] || match[4]));
            if (match[2] || match[5]) {
              const namedImports = (match[2] || match[5])
                .replace(/[{}]/g, '')
                .split(',')
                .map((s) => s.trim());
              items.push(...namedImports);
            }
            if (match[3] || match[6]) items.push(match[3] || match[6]);

            imports.push({
              type: change.type === 'add' ? 'added' : 'removed',
              module,
              items,
              line: change.lineNumber,
            });
          }
        }
      }
    }

    return imports;
  }

  /**
   * Extract export changes from hunks
   */
  private async extractExportChanges(
    hunks: DiffHunk[]
  ): Promise<ExportChange[]> {
    const exports: ExportChange[] = [];

    for (const hunk of hunks) {
      for (const change of hunk.changes) {
        if (change.type !== 'context') {
          // Default export
          if (/export\s+default\s+/.test(change.content)) {
            const name =
              change.content.match(/export\s+default\s+(\w+)/)?.[1] ||
              'default';
            exports.push({
              type: change.type === 'add' ? 'added' : 'removed',
              name,
              exportType: 'default',
              line: change.lineNumber,
            });
          }
          // Named export
          else if (
            /export\s+(?:const|let|var|function|class|interface|type)\s+/.test(
              change.content
            )
          ) {
            const match = change.content.match(
              /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/
            );
            if (match) {
              exports.push({
                type: change.type === 'add' ? 'added' : 'removed',
                name: match[1],
                exportType: 'named',
                line: change.lineNumber,
              });
            }
          }
        }
      }
    }

    return exports;
  }

  /**
   * Extract dependencies from imports
   */
  private async extractDependencies(
    imports: ImportChange[]
  ): Promise<string[]> {
    const deps = new Set<string>();

    for (const imp of imports) {
      if (imp.type === 'added' && !imp.module.startsWith('.')) {
        deps.add(imp.module);
      }
    }

    return Array.from(deps);
  }

  /**
   * Analyze semantic changes using AI instead of regex patterns
   * PRD: "AI decides" semantic meaning based on contextual understanding
   */
  private async analyzeSemanticChangesWithAI(
    hunks: DiffHunk[],
    filename: string,
    fileType: FileType,
    completeDiff: string
  ): Promise<SemanticChange[]> {
    try {
      // Build AI analysis context
      const context: AIAnalysisContext = {
        filePath: filename,
        completeDiff,
        surroundingContext: this.extractSurroundingContext(hunks),
      };

      // Get AI semantic analysis
      const aiAnalysis =
        await this.aiSemanticAnalyzer.analyzeSemanticChange(context);

      // Convert AI analysis to SemanticChange format
      return [
        {
          type: aiAnalysis.changeType,
          description: aiAnalysis.userImpact,
          impact: this.mapSemanticImpact(aiAnalysis.semanticImpact),
          affectedSymbols: aiAnalysis.affectedCapabilities,
        },
      ];
    } catch (error) {
      logInfo(`AI semantic analysis failed for ${filename}: ${error}`);

      // Graceful degradation: return basic semantic change
      return [
        {
          type: 'refactoring',
          description: 'Code modifications detected',
          impact: 'refactor',
          affectedSymbols: this.extractSymbols(hunks.flatMap((h) => h.changes)),
        },
      ];
    }
  }

  /**
   * Extract surrounding context from hunks for AI analysis
   */
  private extractSurroundingContext(hunks: DiffHunk[]): string {
    const contextLines: string[] = [];

    for (const hunk of hunks) {
      if (hunk.semanticContext) {
        contextLines.push(`Function/Class: ${hunk.semanticContext}`);
      }

      // Add some context lines to understand the change better
      const contextChanges = hunk.changes
        .filter((c) => c.type === 'context')
        .slice(0, 3) // First 3 context lines
        .map((c) => c.content);

      contextLines.push(...contextChanges);
    }

    return contextLines.join('\n');
  }

  /**
   * Map AI semantic impact to SemanticChange impact type
   */
  private mapSemanticImpact(
    aiImpact: string
  ): 'breaking' | 'enhancement' | 'fix' | 'refactor' {
    switch (aiImpact) {
      case 'breaking':
        return 'breaking';
      case 'enhancement':
        return 'enhancement';
      case 'fix':
        return 'fix';
      case 'internal':
        return 'refactor';
      default:
        return 'refactor';
    }
  }

  // Removed mechanical detection methods - replaced with AI semantic analysis

  /**
   * Extract symbols from changes
   */
  private extractSymbols(changes: LineChange[]): string[] {
    const symbols = new Set<string>();
    const symbolPatterns = [
      /function\s+(\w+)/g,
      /class\s+(\w+)/g,
      /const\s+(\w+)/g,
      /let\s+(\w+)/g,
      /var\s+(\w+)/g,
    ];

    for (const change of changes) {
      if (change.type !== 'context') {
        for (const pattern of symbolPatterns) {
          const matches = [...change.content.matchAll(pattern)];
          for (const match of matches) {
            symbols.add(match[1]);
          }
        }
      }
    }

    return Array.from(symbols);
  }

  /**
   * Analyze cross-file dependencies
   */
  private async analyzeDependencies(
    fileDiffs: FileDiff[]
  ): Promise<FileRelationship[]> {
    const relationships: FileRelationship[] = [];

    for (const file of fileDiffs) {
      // Analyze imports
      for (const imp of file.imports) {
        if (imp.module.startsWith('.')) {
          const targetFile = this.resolveImportPath(file.path, imp.module);
          relationships.push({
            sourceFile: file.path,
            targetFile,
            relationshipType: 'imports',
            symbols: imp.items,
          });
        }
      }

      // Analyze test relationships
      if (file.fileType === 'test') {
        const testedFile = this.getTestedFile(file.path);
        if (testedFile) {
          relationships.push({
            sourceFile: file.path,
            targetFile: testedFile,
            relationshipType: 'tests',
            symbols: [],
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Resolve import path to actual file
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    const dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const resolved = `${dir}/${importPath}`;

    // Handle common extensions
    if (!resolved.includes('.')) {
      const extensions = ['.ts', '.tsx', '.js', '.jsx'];
      for (const ext of extensions) {
        return `${resolved}${ext}`;
      }
    }

    return resolved;
  }

  /**
   * Get the file being tested
   */
  private getTestedFile(testFile: string): string | undefined {
    const patterns = [
      /(.*)\.test\.(ts|tsx|js|jsx)$/,
      /(.*)\.spec\.(ts|tsx|js|jsx)$/,
      /__tests__\/(.+)\.(ts|tsx|js|jsx)$/,
    ];

    for (const pattern of patterns) {
      const match = testFile.match(pattern);
      if (match) {
        return match[1] + '.' + (match[2] || 'ts');
      }
    }

    return undefined;
  }

  /**
   * Identify shared components across files
   */
  private async identifySharedComponents(
    fileDiffs: FileDiff[],
    relationships: FileRelationship[]
  ): Promise<SharedComponent[]> {
    const componentMap = new Map<string, SharedComponent>();

    // Find exported components
    for (const file of fileDiffs) {
      for (const exp of file.exports) {
        const id = `${file.path}:${exp.name}`;
        const component: SharedComponent = {
          id,
          type: this.detectComponentType(exp.name, file),
          name: exp.name,
          definedIn: file.path,
          usedIn: [],
          modifications: [
            {
              file: file.path,
              type: 'definition',
              changeType: exp.type,
              context: 'Primary definition',
            },
          ],
        };
        componentMap.set(id, component);
      }
    }

    // Find usages
    for (const rel of relationships) {
      if (rel.relationshipType === 'imports') {
        for (const symbol of rel.symbols) {
          const componentId = `${rel.targetFile}:${symbol}`;
          const component = componentMap.get(componentId);
          if (component) {
            component.usedIn.push(rel.sourceFile);
            component.modifications.push({
              file: rel.sourceFile,
              type: 'usage',
              changeType: 'modified',
              context: `Used in ${rel.sourceFile}`,
            });
          }
        }
      }
    }

    // Filter to only shared components (used in multiple places)
    return Array.from(componentMap.values()).filter(
      (comp) => comp.usedIn.length > 0
    );
  }

  /**
   * Detect component type from name and context
   */
  private detectComponentType(
    name: string,
    file: FileDiff
  ): SharedComponent['type'] {
    if (/^[A-Z]/.test(name) && file.fileType === 'source') {
      return file.path.includes('components') ? 'class' : 'type';
    }
    if (/^use[A-Z]/.test(name)) return 'function'; // React hooks
    if (/^[A-Z_]+$/.test(name)) return 'constant'; // CONSTANT_CASE
    if (file.path.includes('utils') || file.path.includes('helpers'))
      return 'utility';
    return 'function';
  }

  /**
   * Detect business patterns in changes
   */
  private async detectBusinessPatterns(
    fileDiffs: FileDiff[]
  ): Promise<BusinessPattern[]> {
    const patterns: BusinessPattern[] = [];

    // User flow patterns
    const uiFiles = fileDiffs.filter(
      (f) =>
        f.path.includes('components') ||
        f.path.includes('pages') ||
        f.path.includes('views')
    );
    if (uiFiles.length > 0) {
      patterns.push({
        type: 'user-flow',
        name: 'UI Component Changes',
        description: 'User interface modifications',
        involvedFiles: uiFiles.map((f) => f.path),
        confidence: 0.9,
      });
    }

    // API endpoint patterns
    const apiFiles = fileDiffs.filter(
      (f) =>
        f.path.includes('api') ||
        f.path.includes('routes') ||
        f.path.includes('controllers')
    );
    if (apiFiles.length > 0) {
      patterns.push({
        type: 'api-endpoint',
        name: 'API Modifications',
        description: 'Backend API changes',
        involvedFiles: apiFiles.map((f) => f.path),
        confidence: 0.9,
      });
    }

    // Test patterns
    const testFiles = fileDiffs.filter((f) => f.fileType === 'test');
    if (testFiles.length > 0) {
      patterns.push({
        type: 'testing',
        name: 'Test Coverage Changes',
        description: 'Test additions or modifications',
        involvedFiles: testFiles.map((f) => f.path),
        confidence: 1.0,
      });
    }

    return patterns;
  }

  /**
   * Calculate total complexity score
   */
  private calculateTotalComplexity(fileDiffs: FileDiff[]): number {
    let complexity = 0;

    for (const file of fileDiffs) {
      // File type complexity
      const typeWeight = {
        source: 1.0,
        test: 0.5,
        config: 0.3,
        documentation: 0.1,
        style: 0.2,
        build: 0.4,
        data: 0.6,
      };

      // Calculate file complexity
      const linesChanged = file.hunks.reduce(
        (sum, hunk) =>
          sum + hunk.changes.filter((c) => c.type !== 'context').length,
        0
      );

      const fileComplexity =
        (linesChanged *
          typeWeight[file.fileType] *
          (file.semanticChanges.length + 1) *
          (file.imports.length + file.exports.length + 1)) /
        10;

      complexity += fileComplexity;
    }

    return Math.min(complexity, 100); // Cap at 100
  }
}
