/**
 * Example integration showing how to use all the enhanced services together
 * This demonstrates the complete refactored flow
 */

import { GitDiffAnalyzer, DiffAnalysis, CodeChange } from './git-diff-analyzer';
import { EnhancedCodeStructureAnalyzer } from './enhanced-code-structure-analyzer';
import { EnhancedThemeNamingService } from './enhanced-theme-naming';
import { ThemeDescriptionBuilder } from './theme-description-builder';
import { ExpansionCircuitBreaker } from './expansion-circuit-breaker';
import { EnhancedAIExpansionDecisionService } from './enhanced-ai-expansion-decision';
import { NodeContextBuilder, NodeContext } from './node-context-builder';
import { getStructuredPromptTemplates } from './structured-prompt-templates';
import { EnhancedCrossReferenceDetector } from './enhanced-cross-reference-detector';
import { ConsolidatedTheme } from '../types/similarity-types';
import { logger } from '../utils/logger';

export class ThemeProcessingIntegration {
  private gitDiffAnalyzer: GitDiffAnalyzer;
  private codeAnalyzer: EnhancedCodeStructureAnalyzer;
  private nameService: EnhancedThemeNamingService;
  private descriptionBuilder: ThemeDescriptionBuilder;
  private circuitBreaker: ExpansionCircuitBreaker;
  private expansionService: EnhancedAIExpansionDecisionService;
  private nodeContextBuilder: NodeContextBuilder;
  private crossReferenceDetector: EnhancedCrossReferenceDetector;

  constructor(anthropicApiKey?: string) {
    this.gitDiffAnalyzer = new GitDiffAnalyzer();
    this.codeAnalyzer = new EnhancedCodeStructureAnalyzer();
    this.nameService = new EnhancedThemeNamingService(anthropicApiKey);
    this.descriptionBuilder = new ThemeDescriptionBuilder();
    this.circuitBreaker = new ExpansionCircuitBreaker();
    this.expansionService = new EnhancedAIExpansionDecisionService(
      anthropicApiKey || ''
    );
    this.nodeContextBuilder = new NodeContextBuilder();
    this.crossReferenceDetector = new EnhancedCrossReferenceDetector();
  }

  /**
   * Process a code change to create an accurate theme
   */
  async processCodeChange(
    diffContent: string,
    businessContext?: string
  ): Promise<ConsolidatedTheme> {
    const context = logger.startOperation('Theme Processing Integration');

    try {
      // Step 1: Analyze actual git diff
      const diffAnalysis = this.gitDiffAnalyzer.analyzeDiff(diffContent);

      logger.logProcess('Diff analysis complete', {
        files: diffAnalysis.totalFiles,
        linesAdded: diffAnalysis.totalLinesAdded,
        linesRemoved: diffAnalysis.totalLinesRemoved,
        methods: diffAnalysis.totalMethods.length,
        classes: diffAnalysis.totalClasses.length,
      });

      // Step 2: Generate accurate theme name from actual changes
      const naming = await this.nameService.generateThemeName(
        diffAnalysis,
        businessContext
      );

      // Step 3: Build comprehensive descriptions
      const descriptions = this.descriptionBuilder.buildDescription(
        diffAnalysis,
        { includeMetrics: true }
      );

      // Step 4: Create theme with accurate data
      const theme: ConsolidatedTheme = {
        id: `theme-${Date.now()}`,
        name: naming.name,
        description: descriptions.description,
        detailedDescription: descriptions.detailedDescription,
        technicalSummary: descriptions.technicalSummary,
        keyChanges: descriptions.keyChanges,
        level: 0,
        childThemes: [],
        affectedFiles: Array.from(diffAnalysis.files.keys()),
        confidence: naming.confidence,
        businessImpact: businessContext || 'Code improvement',
        codeSnippets: this.extractCodeSnippets(diffAnalysis),
        context: diffContent,
        lastAnalysis: new Date(),
        sourceThemes: [],
        consolidationMethod: 'single',
        codeContext: {
          files: Array.from(diffAnalysis.files.entries()).map(
            ([path, changes]) => ({
              path,
              changes: changes.map((c) => ({
                type: c.type as 'added' | 'modified' | 'removed',
                startLine: c.startLine,
                endLine: c.endLine,
                content: c.content,
                diff: c.diff,
              })),
            })
          ),
          totalLinesChanged:
            diffAnalysis.totalLinesAdded + diffAnalysis.totalLinesRemoved,
        },
        // Include actual metrics
        codeMetrics: {
          linesAdded: diffAnalysis.totalLinesAdded,
          linesRemoved: diffAnalysis.totalLinesRemoved,
          filesChanged: diffAnalysis.totalFiles,
        },
        mainFunctionsChanged: diffAnalysis.totalMethods,
        mainClassesChanged: diffAnalysis.totalClasses,
      };

      // Step 5: Build complete node context (Phase 4)
      const nodeContext = await this.nodeContextBuilder.buildNodeContext(
        theme,
        diffContent
      );

      logger.logProcess('Node context built', {
        isComplete: nodeContext.isComplete,
        missingContext: nodeContext.missingContext,
        fileContexts: nodeContext.files.length,
        methodContexts: nodeContext.methods.length,
      });

      logger.endOperation(context, true, {
        themeName: theme.name,
        confidence: theme.confidence,
        contextComplete: nodeContext.isComplete,
      });

      return theme;
    } catch (error) {
      logger.endOperation(context, false);
      throw error;
    }
  }

  /**
   * Check if a theme should be expanded
   */
  async checkExpansion(
    theme: ConsolidatedTheme,
    currentDepth: number,
    diffContent?: string,
    parentTheme?: ConsolidatedTheme
  ): Promise<{
    shouldExpand: boolean;
    decision: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }> {
    // Build node context first
    const nodeContext = await this.nodeContextBuilder.buildNodeContext(
      theme,
      diffContent
    );

    // Use structured prompt templates (Phase 5)
    const promptTemplates = getStructuredPromptTemplates();
    const _expansionPrompt = promptTemplates.createExpansionPrompt(
      nodeContext,
      currentDepth
    );

    logger.logProcess('Using structured expansion prompt', {
      contextComplete: nodeContext.isComplete,
      promptLength: _expansionPrompt.length,
    });

    // Use enhanced expansion decision with circuit breaker
    const decision = await this.expansionService.shouldExpandTheme(
      theme,
      currentDepth,
      diffContent,
      parentTheme
    );

    logger.logProcess('Expansion decision', {
      theme: theme.name,
      depth: currentDepth,
      shouldExpand: decision.shouldExpand,
      reason: decision.reasoning,
      confidence: decision.confidence,
    });

    return {
      shouldExpand: decision.shouldExpand,
      decision,
    };
  }

  /**
   * Extract code snippets from diff analysis
   */
  private extractCodeSnippets(diffAnalysis: DiffAnalysis): string[] {
    const snippets: string[] = [];

    diffAnalysis.files.forEach((changes: CodeChange[], file: string) => {
      changes.forEach((change: CodeChange) => {
        if (change.content) {
          snippets.push(`// ${file}\n${change.content}`);
        }
      });
    });

    return snippets;
  }

  /**
   * Analyze cross-references across multiple themes (Phase 6)
   */
  async analyzeCrossReferences(
    themes: ConsolidatedTheme[],
    diffContents: Map<string, string>
  ): Promise<{
    crossReferences: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    valuableRefs: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    nodeContexts: Map<string, NodeContext>;
  }> {
    const context = logger.startOperation('Cross-Reference Analysis');

    try {
      // Build node contexts for all themes
      const nodeContexts = new Map<string, NodeContext>();

      for (const theme of themes) {
        const diffContent = diffContents.get(theme.id);
        const nodeContext = await this.nodeContextBuilder.buildNodeContext(
          theme,
          diffContent
        );
        nodeContexts.set(theme.id, nodeContext);
      }

      // Detect cross-references
      const crossReferences = this.crossReferenceDetector.detectCrossReferences(
        nodeContexts,
        themes
      );

      logger.logProcess('Cross-references detected', {
        totalReferences: crossReferences.references.length,
        duplications: crossReferences.duplications.length,
        sharedComponents: crossReferences.sharedComponents.length,
        dependencies: crossReferences.dependencies.length,
      });

      // Analyze value of cross-references
      const valuableRefs = crossReferences.references.filter((ref) => {
        const value =
          this.crossReferenceDetector.analyzeCrossReferenceValue(ref);
        return value.isValuable && value.confidence > 0.7;
      });

      logger.endOperation(context, true, {
        valuableReferences: valuableRefs.length,
      });

      return {
        crossReferences,
        valuableRefs,
        nodeContexts,
      };
    } catch (error) {
      logger.endOperation(context, false);
      throw error;
    }
  }
}

/**
 * Example usage showing the complete flow
 */
export async function exampleUsage(): Promise<void> {
  const integration = new ThemeProcessingIntegration('your-api-key');

  // Example diff content
  const diffContent = `
diff --git a/src/services/theme-service.ts b/src/services/theme-service.ts
index abc123..def456 100644
--- a/src/services/theme-service.ts
+++ b/src/services/theme-service.ts
@@ -100,7 +100,7 @@ export class ThemeService {
   async analyzeTheme(theme: Theme): Promise<void> {
-    const result = await this.simpleAnalysis(theme);
+    const result = await this.enhancedAnalysis(theme);
     return result;
   }
`;

  // Process the change
  const theme = await integration.processCodeChange(
    diffContent,
    'Upgrade theme analysis to use enhanced algorithm'
  );

  console.log('Generated theme:', {
    name: theme.name,
    description: theme.description,
    metrics: theme.codeMetrics,
    methods: theme.mainFunctionsChanged,
  });

  // Check if it should expand
  const expansion = await integration.checkExpansion(theme, 1);
  console.log('Expansion decision:', expansion.decision);

  // Example: Analyze cross-references across multiple themes
  const theme2 = await integration.processCodeChange(
    `diff --git a/src/utils/logger.ts b/src/utils/logger.ts
index abc123..def456 100644
--- a/src/utils/logger.ts
+++ b/src/utils/logger.ts
@@ -50,7 +50,7 @@ export class Logger {
   logError(message: string, error: Error): void {
-    console.error(message, error);
+    console.error(\`[ERROR] \${message}\`, error);
   }
}`,
    'Improve error logging format'
  );

  // Analyze cross-references
  const diffContents = new Map<string, string>();
  diffContents.set(theme.id, diffContent);
  diffContents.set(theme2.id, `diff content for theme2`);

  const crossRefAnalysis = await integration.analyzeCrossReferences(
    [theme, theme2],
    diffContents
  );

  console.log('Cross-reference analysis:', {
    references: crossRefAnalysis.crossReferences.references.length,
    valuableRefs: crossRefAnalysis.valuableRefs.length,
    sharedComponents: crossRefAnalysis.crossReferences.sharedComponents.length,
  });
}
