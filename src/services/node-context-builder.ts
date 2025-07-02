/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConsolidatedTheme } from '../types/similarity-types';
import { GitDiffAnalyzer, DiffAnalysis } from './git-diff-analyzer';
import { EnhancedCodeStructureAnalyzer } from './enhanced-code-structure-analyzer';
import { logger } from '../utils/logger';

/**
 * NodeContextBuilder ensures every theme node has complete context
 * Implements PRD: "Every node MUST have ALL context needed to understand it"
 */
export class NodeContextBuilder {
  private gitDiffAnalyzer: GitDiffAnalyzer;
  private codeAnalyzer: EnhancedCodeStructureAnalyzer;

  constructor() {
    this.gitDiffAnalyzer = new GitDiffAnalyzer();
    this.codeAnalyzer = new EnhancedCodeStructureAnalyzer();
  }

  /**
   * Build complete context for a theme node
   * Ensures node is self-contained without parent dependency
   */
  async buildNodeContext(
    theme: ConsolidatedTheme,
    diffContent?: string,
    parentContext?: NodeContext
  ): Promise<NodeContext> {
    const context = logger.startOperation('Node Context Building', {
      theme: theme.name,
    });

    try {
      // Step 1: Analyze actual changes if available
      let diffAnalysis: DiffAnalysis | undefined;
      if (diffContent) {
        diffAnalysis = this.gitDiffAnalyzer.analyzeDiff(diffContent);
      }

      // Step 2: Extract file-specific context
      const fileContexts = await this.buildFileContexts(theme, diffAnalysis);

      // Step 3: Build method/function context
      const methodContexts = this.buildMethodContexts(theme, diffAnalysis);

      // Step 4: Extract business context
      const businessContext = this.extractBusinessContext(theme, parentContext);

      // Step 5: Build technical context
      const technicalContext = this.buildTechnicalContext(theme, diffAnalysis);

      // Step 6: Create complete node context
      const nodeContext: NodeContext = {
        // Core theme information
        themeId: theme.id,
        themeName: theme.name,
        description: theme.description,

        // Complete file context
        files: fileContexts,

        // Method/function context
        methods: methodContexts,

        // Business context (self-contained)
        businessContext: {
          purpose: businessContext.purpose,
          impact: businessContext.impact,
          userStory: businessContext.userStory,
          acceptanceCriteria: businessContext.acceptanceCriteria,
        },

        // Technical context (self-contained)
        technicalContext: {
          changeType: technicalContext.changeType,
          complexity: technicalContext.complexity,
          dependencies: technicalContext.dependencies,
          testingStrategy: technicalContext.testingStrategy,
          codePatterns: technicalContext.codePatterns,
        },

        // Metrics for validation
        metrics: {
          totalFiles: theme.affectedFiles.length,
          totalLines: diffAnalysis
            ? diffAnalysis.totalLinesAdded + diffAnalysis.totalLinesRemoved
            : 0,
          totalMethods: diffAnalysis ? diffAnalysis.totalMethods.length : 0,
          isAtomic: this.isAtomicContext(theme, diffAnalysis),
        },

        // Parent reference (minimal)
        parentReference: parentContext
          ? {
              themeId: parentContext.themeId,
              themeName: parentContext.themeName,
              purpose: parentContext.businessContext.purpose,
            }
          : undefined,

        // Validation
        isComplete: true,
        missingContext: [],
      };

      // Step 7: Validate completeness
      const validation = this.validateContextCompleteness(nodeContext);
      nodeContext.isComplete = validation.isComplete;
      nodeContext.missingContext = validation.missing;

      logger.endOperation(context, true, {
        filesWithContext: fileContexts.length,
        methodsWithContext: methodContexts.length,
        isComplete: nodeContext.isComplete,
      });

      return nodeContext;
    } catch (error) {
      logger.endOperation(context, false);
      throw error;
    }
  }

  /**
   * Build context for each file in the theme
   */
  private async buildFileContexts(
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): Promise<FileContext[]> {
    const fileContexts: FileContext[] = [];

    for (const file of theme.affectedFiles) {
      const fileContext: FileContext = {
        path: file,
        purpose: this.inferFilePurpose(file),
        changes: [],
        imports: [],
        exports: [],
        relatedFiles: [],
      };

      // Add change details from diff analysis
      if (diffAnalysis && diffAnalysis.files.has(file)) {
        const changes = diffAnalysis.files.get(file)!;
        fileContext.changes = changes.map((change) => ({
          type: change.type,
          startLine: change.startLine,
          endLine: change.endLine,
          description: this.describeChange(change),
          methods: change.methods || [],
          classes: change.classes || [],
        }));
      }

      // Extract imports/exports from code snippets
      const codeContext = theme.codeContext?.files.find((f) => f.path === file);
      if (codeContext) {
        fileContext.imports = this.extractImports(codeContext);
        fileContext.exports = this.extractExports(codeContext);
        fileContext.relatedFiles = this.findRelatedFiles(
          fileContext.imports,
          theme.affectedFiles
        );
      }

      fileContexts.push(fileContext);
    }

    return fileContexts;
  }

  /**
   * Build context for methods/functions
   */
  private buildMethodContexts(
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): MethodContext[] {
    const methodContexts: MethodContext[] = [];
    const methods =
      diffAnalysis?.totalMethods || theme.mainFunctionsChanged || [];

    for (const method of methods) {
      const methodContext: MethodContext = {
        name: method,
        file: this.findMethodFile(method, theme, diffAnalysis),
        purpose: this.inferMethodPurpose(method),
        signature: this.extractMethodSignature(method, theme),
        dependencies: this.extractMethodDependencies(method, theme),
        tests: this.findRelatedTests(method, theme),
      };

      methodContexts.push(methodContext);
    }

    return methodContexts;
  }

  /**
   * Extract business context ensuring self-containment
   */
  private extractBusinessContext(
    theme: ConsolidatedTheme,
    parentContext?: NodeContext
  ): BusinessContext {
    // Start with theme's own context
    let purpose = theme.businessImpact || theme.description;
    let userStory = '';

    // Enhance with parent context if available, but ensure self-containment
    if (parentContext) {
      // Include parent purpose for context, but make it clear
      const parentPurpose = parentContext.businessContext.purpose;
      if (parentPurpose && !purpose.includes(parentPurpose)) {
        purpose = `${purpose} (Part of: ${parentPurpose})`;
      }

      // Inherit user story if not present
      if (!userStory && parentContext.businessContext.userStory) {
        userStory = parentContext.businessContext.userStory;
      }
    }

    return {
      purpose,
      impact: this.assessBusinessImpact(theme),
      userStory: userStory || this.generateUserStory(theme),
      acceptanceCriteria: this.generateAcceptanceCriteria(theme),
    };
  }

  /**
   * Build complete technical context
   */
  private buildTechnicalContext(
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): TechnicalContext {
    const changeType = this.determineChangeType(theme, diffAnalysis);
    const complexity = this.assessComplexity(theme, diffAnalysis);

    return {
      changeType,
      complexity,
      dependencies: this.extractDependencies(theme),
      testingStrategy: this.determineTestingStrategy(changeType, complexity),
      codePatterns: this.identifyCodePatterns(theme),
    };
  }

  /**
   * Validate that context is complete
   */
  private validateContextCompleteness(context: NodeContext): {
    isComplete: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    // Check business context
    if (!context.businessContext.purpose) {
      missing.push('Business purpose');
    }
    if (!context.businessContext.userStory) {
      missing.push('User story');
    }

    // Check technical context
    if (!context.technicalContext.changeType) {
      missing.push('Change type');
    }
    if (!context.technicalContext.testingStrategy) {
      missing.push('Testing strategy');
    }

    // Check file contexts
    if (context.files.length === 0) {
      missing.push('File contexts');
    }

    // Check method contexts for non-trivial changes
    if (context.metrics.totalMethods > 0 && context.methods.length === 0) {
      missing.push('Method contexts');
    }

    return {
      isComplete: missing.length === 0,
      missing,
    };
  }

  /**
   * Helper: Infer file purpose from path
   */
  private inferFilePurpose(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';

    if (fileName.includes('.test.') || fileName.includes('.spec.')) {
      return 'Test file';
    }
    if (fileName.includes('service')) {
      return 'Service implementation';
    }
    if (fileName.includes('controller')) {
      return 'API controller';
    }
    if (fileName.includes('component')) {
      return 'UI component';
    }
    if (fileName.includes('utils') || fileName.includes('helper')) {
      return 'Utility functions';
    }
    if (fileName.includes('types') || fileName.includes('interface')) {
      return 'Type definitions';
    }
    if (fileName.includes('config')) {
      return 'Configuration';
    }

    return 'Implementation file';
  }

  /**
   * Helper: Describe a change in natural language
   */
  private describeChange(change: any): string {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const lines = change.endLine - change.startLine + 1;
    const lineText = lines === 1 ? 'line' : 'lines';

    switch (change.type) {
      case 'added':
        return `Added ${lines} ${lineText}`;
      case 'modified':
        return `Modified ${lines} ${lineText}`;
      case 'deleted':
        return `Deleted ${lines} ${lineText}`;
      default:
        return `Changed ${lines} ${lineText}`;
    }
  }

  /**
   * Helper: Extract imports from code context
   */
  private extractImports(codeContext: any): string[] {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const imports: string[] = [];

    if (codeContext.changes) {
      for (const change of codeContext.changes) {
        if (change.content) {
          const importMatches = change.content.match(
            /import .* from ['"](.+?)['"]/g
          );
          if (importMatches) {
            imports.push(
              ...importMatches
                .map((m: string) => {
                  const match = m.match(/from ['"](.+?)['"]/);
                  return match ? match[1] : '';
                })
                .filter(Boolean)
            );
          }
        }
      }
    }

    return [...new Set(imports)];
  }

  /**
   * Helper: Extract exports from code context
   */
  private extractExports(codeContext: any): string[] {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const exports: string[] = [];

    if (codeContext.changes) {
      for (const change of codeContext.changes) {
        if (change.content) {
          // Export functions/classes
          const exportMatches = change.content.match(
            /export\s+(class|function|const|interface)\s+(\w+)/g
          );
          if (exportMatches) {
            exports.push(
              ...exportMatches
                .map((m: string) => {
                  const match = m.match(
                    /export\s+(?:class|function|const|interface)\s+(\w+)/
                  );
                  return match ? match[1] : '';
                })
                .filter(Boolean)
            );
          }
        }
      }
    }

    return [...new Set(exports)];
  }

  /**
   * Helper: Find related files based on imports
   */
  private findRelatedFiles(
    imports: string[],
    affectedFiles: string[]
  ): string[] {
    const related: string[] = [];

    for (const imp of imports) {
      // Check if import refers to an affected file
      const matchingFile = affectedFiles.find((file) => {
        const fileName = file
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '');
        return imp.includes(fileName || '');
      });

      if (matchingFile) {
        related.push(matchingFile);
      }
    }

    return [...new Set(related)];
  }

  /**
   * Helper: Find which file contains a method
   */
  private findMethodFile(
    method: string,
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): string {
    if (diffAnalysis) {
      for (const [file, changes] of diffAnalysis.files) {
        for (const change of changes) {
          if (change.methods?.includes(method)) {
            return file;
          }
        }
      }
    }

    // Fallback: check code snippets
    for (let i = 0; i < theme.codeSnippets.length; i++) {
      if (theme.codeSnippets[i].includes(method)) {
        return theme.affectedFiles[Math.min(i, theme.affectedFiles.length - 1)];
      }
    }

    return theme.affectedFiles[0] || 'unknown';
  }

  /**
   * Helper: Infer method purpose from name
   */
  private inferMethodPurpose(methodName: string): string {
    const lower = methodName.toLowerCase();

    if (lower.startsWith('get') || lower.startsWith('fetch')) {
      return 'Retrieve data';
    }
    if (lower.startsWith('set') || lower.startsWith('update')) {
      return 'Update data';
    }
    if (lower.startsWith('create') || lower.startsWith('add')) {
      return 'Create new entity';
    }
    if (lower.startsWith('delete') || lower.startsWith('remove')) {
      return 'Remove entity';
    }
    if (lower.startsWith('validate') || lower.startsWith('check')) {
      return 'Validation logic';
    }
    if (lower.startsWith('handle')) {
      return 'Event handler';
    }
    if (lower.startsWith('process')) {
      return 'Data processing';
    }
    if (lower.startsWith('test') || lower.includes('test')) {
      return 'Test implementation';
    }

    return 'Business logic';
  }

  /**
   * Helper: Extract method signature from code
   */
  private extractMethodSignature(
    method: string,
    theme: ConsolidatedTheme
  ): string {
    for (const snippet of theme.codeSnippets) {
      // Look for function/method definition
      const patterns = [
        new RegExp(`function\\s+${method}\\s*\\([^)]*\\)`, 'i'),
        new RegExp(`${method}\\s*\\([^)]*\\)\\s*=>`, 'i'),
        new RegExp(`${method}\\s*:\\s*\\([^)]*\\)`, 'i'),
        new RegExp(`async\\s+${method}\\s*\\([^)]*\\)`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = snippet.match(pattern);
        if (match) {
          return match[0];
        }
      }
    }

    return `${method}(...)`;
  }

  /**
   * Helper: Extract method dependencies
   */
  private extractMethodDependencies(
    method: string,
    theme: ConsolidatedTheme
  ): string[] {
    const dependencies: string[] = [];

    // Look for method calls within the method
    for (const snippet of theme.codeSnippets) {
      if (snippet.includes(method)) {
        // Find other method calls
        const callMatches = snippet.match(/\b\w+\s*\(/g);
        if (callMatches) {
          dependencies.push(
            ...callMatches
              .map((m) => m.replace('(', '').trim())
              .filter((m) => m !== method && m.length > 2)
          );
        }
      }
    }

    return [...new Set(dependencies)].slice(0, 5); // Limit to top 5
  }

  /**
   * Helper: Find related tests
   */
  private findRelatedTests(method: string, theme: ConsolidatedTheme): string[] {
    const tests: string[] = [];

    for (const file of theme.affectedFiles) {
      if (file.includes('.test.') || file.includes('.spec.')) {
        tests.push(file);
      }
    }

    return tests;
  }

  /**
   * Helper: Assess business impact
   */
  private assessBusinessImpact(theme: ConsolidatedTheme): string {
    const fileCount = theme.affectedFiles.length;
    const hasTests = theme.affectedFiles.some((f) => f.includes('test'));
    const hasAPI = theme.affectedFiles.some(
      (f) =>
        f.includes('controller') || f.includes('route') || f.includes('api')
    );
    const hasUI = theme.affectedFiles.some(
      (f) => f.includes('component') || f.includes('view') || f.includes('page')
    );

    if (hasAPI && hasUI) {
      return 'Full-stack feature affecting API and UI';
    }
    if (hasAPI) {
      return 'Backend API changes';
    }
    if (hasUI) {
      return 'Frontend UI changes';
    }
    if (hasTests) {
      return 'Test coverage improvements';
    }
    if (fileCount > 3) {
      return 'Cross-cutting concern affecting multiple modules';
    }

    return 'Localized code improvement';
  }

  /**
   * Helper: Generate user story
   */
  private generateUserStory(theme: ConsolidatedTheme): string {
    const action = theme.name.split(' ')[0].toLowerCase();

    if (action === 'add' || action === 'create') {
      return `As a developer, I want to ${theme.name.toLowerCase()} so that the system has enhanced functionality`;
    }
    if (action === 'fix' || action === 'resolve') {
      return `As a user, I want ${theme.name.toLowerCase()} so that the system works correctly`;
    }
    if (action === 'update' || action === 'refactor') {
      return `As a developer, I want to ${theme.name.toLowerCase()} so that the code is more maintainable`;
    }

    return `As a developer, I want to ${theme.name.toLowerCase()} to improve the system`;
  }

  /**
   * Helper: Generate acceptance criteria
   */
  private generateAcceptanceCriteria(theme: ConsolidatedTheme): string[] {
    const criteria: string[] = [];

    // Basic criteria
    criteria.push('Code changes are implemented as described');

    // Test criteria
    if (theme.affectedFiles.some((f) => f.includes('test'))) {
      criteria.push('All tests pass');
      criteria.push('Test coverage is maintained or improved');
    } else {
      criteria.push('Consider adding tests for the changes');
    }

    // Type safety
    if (
      theme.affectedFiles.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    ) {
      criteria.push('No TypeScript errors');
    }

    // Code quality
    criteria.push('Code follows project conventions');
    criteria.push('No linting errors');

    return criteria;
  }

  /**
   * Helper: Determine change type
   */
  private determineChangeType(
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): ChangeType {
    const name = theme.name.toLowerCase();

    if (name.includes('add') || name.includes('create')) {
      return 'feature';
    }
    if (name.includes('fix') || name.includes('resolve')) {
      return 'bugfix';
    }
    if (name.includes('refactor')) {
      return 'refactor';
    }
    if (name.includes('test')) {
      return 'test';
    }
    if (name.includes('document')) {
      return 'docs';
    }

    // Check by content
    if (diffAnalysis) {
      const ratio =
        diffAnalysis.totalLinesAdded / (diffAnalysis.totalLinesRemoved || 1);
      if (ratio > 3) return 'feature';
      if (ratio < 0.3) return 'cleanup';
    }

    return 'enhancement';
  }

  /**
   * Helper: Assess complexity
   */
  private assessComplexity(
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): ComplexityLevel {
    const fileCount = theme.affectedFiles.length;
    const totalLines = diffAnalysis
      ? diffAnalysis.totalLinesAdded + diffAnalysis.totalLinesRemoved
      : 0;
    const methodCount = diffAnalysis ? diffAnalysis.totalMethods.length : 0;

    if (fileCount === 1 && totalLines <= 10 && methodCount <= 1) {
      return 'trivial';
    }
    if (fileCount <= 2 && totalLines <= 50 && methodCount <= 3) {
      return 'simple';
    }
    if (fileCount <= 5 && totalLines <= 200 && methodCount <= 10) {
      return 'moderate';
    }
    if (fileCount <= 10 && totalLines <= 500) {
      return 'complex';
    }

    return 'very-complex';
  }

  /**
   * Helper: Extract dependencies
   */
  private extractDependencies(theme: ConsolidatedTheme): string[] {
    const deps = new Set<string>();

    // Extract from code snippets
    for (const snippet of theme.codeSnippets) {
      // Look for imports
      const importMatches = snippet.match(/import .* from ['"](.+?)['"]/g);
      if (importMatches) {
        importMatches.forEach((match) => {
          const m = match.match(/from ['"](.+?)['"]/);
          if (m && m[1]) {
            // Only external deps (not relative paths)
            if (!m[1].startsWith('.')) {
              deps.add(m[1].split('/')[0]);
            }
          }
        });
      }
    }

    return Array.from(deps).slice(0, 10); // Limit to 10
  }

  /**
   * Helper: Determine testing strategy
   */
  private determineTestingStrategy(
    changeType: ChangeType,
    complexity: ComplexityLevel
  ): string {
    if (changeType === 'test') {
      return 'Test implementation - verify test correctness';
    }

    if (complexity === 'trivial') {
      return 'Manual verification sufficient';
    }
    if (complexity === 'simple') {
      return 'Unit tests for changed methods';
    }
    if (complexity === 'moderate') {
      return 'Unit tests + integration tests for affected flows';
    }
    if (complexity === 'complex' || complexity === 'very-complex') {
      return 'Comprehensive testing: unit, integration, and E2E tests';
    }

    return 'Standard unit testing';
  }

  /**
   * Helper: Identify code patterns
   */
  private identifyCodePatterns(theme: ConsolidatedTheme): string[] {
    const patterns: string[] = [];
    const codeText = theme.codeSnippets.join('\n').toLowerCase();

    // Common patterns
    if (codeText.includes('async') || codeText.includes('await')) {
      patterns.push('Async/Await');
    }
    if (codeText.includes('promise')) {
      patterns.push('Promises');
    }
    if (codeText.includes('observable') || codeText.includes('subscribe')) {
      patterns.push('Reactive Programming');
    }
    if (codeText.includes('middleware')) {
      patterns.push('Middleware Pattern');
    }
    if (codeText.includes('singleton')) {
      patterns.push('Singleton Pattern');
    }
    if (codeText.includes('factory')) {
      patterns.push('Factory Pattern');
    }
    if (codeText.includes('decorator') || codeText.includes('@')) {
      patterns.push('Decorators');
    }

    return patterns.slice(0, 5); // Limit to 5
  }

  /**
   * Helper: Check if context represents atomic change
   */
  private isAtomicContext(
    theme: ConsolidatedTheme,
    diffAnalysis?: DiffAnalysis
  ): boolean {
    if (!diffAnalysis) {
      return theme.affectedFiles.length === 1;
    }

    const totalLines =
      diffAnalysis.totalLinesAdded + diffAnalysis.totalLinesRemoved;
    const methodCount = diffAnalysis.totalMethods.length;

    // PRD: 5-15 lines is ideal atomic size
    return (
      diffAnalysis.totalFiles === 1 && totalLines <= 15 && methodCount <= 1
    );
  }
}

/**
 * Complete context for a theme node
 */
export interface NodeContext {
  // Core theme information
  themeId: string;
  themeName: string;
  description: string;

  // Complete file context
  files: FileContext[];

  // Method/function context
  methods: MethodContext[];

  // Business context (self-contained)
  businessContext: BusinessContext;

  // Technical context (self-contained)
  technicalContext: TechnicalContext;

  // Metrics for validation
  metrics: {
    totalFiles: number;
    totalLines: number;
    totalMethods: number;
    isAtomic: boolean;
  };

  // Parent reference (minimal)
  parentReference?: {
    themeId: string;
    themeName: string;
    purpose: string;
  };

  // Validation
  isComplete: boolean;
  missingContext: string[];
}

/**
 * Context for a single file
 */
export interface FileContext {
  path: string;
  purpose: string;
  changes: Array<{
    type: 'added' | 'modified' | 'deleted';
    startLine: number;
    endLine: number;
    description: string;
    methods: string[];
    classes: string[];
  }>;
  imports: string[];
  exports: string[];
  relatedFiles: string[];
}

/**
 * Context for a method/function
 */
export interface MethodContext {
  name: string;
  file: string;
  purpose: string;
  signature: string;
  dependencies: string[];
  tests: string[];
}

/**
 * Business context
 */
export interface BusinessContext {
  purpose: string;
  impact: string;
  userStory: string;
  acceptanceCriteria: string[];
}

/**
 * Technical context
 */
export interface TechnicalContext {
  changeType: ChangeType;
  complexity: ComplexityLevel;
  dependencies: string[];
  testingStrategy: string;
  codePatterns: string[];
}

/**
 * Change types
 */
export type ChangeType =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'enhancement'
  | 'test'
  | 'docs'
  | 'cleanup';

/**
 * Complexity levels
 */
export type ComplexityLevel =
  | 'trivial'
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'very-complex';
