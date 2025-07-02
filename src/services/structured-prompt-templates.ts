import { NodeContext } from './node-context-builder';
import { DiffAnalysis } from './git-diff-analyzer';

/**
 * Structured prompt templates that use complete node context
 * Implements PRD: "Prompts use full node context for accurate decisions"
 */
export class StructuredPromptTemplates {
  /**
   * Create expansion decision prompt with full context
   */
  createExpansionPrompt(
    nodeContext: NodeContext,
    currentDepth: number
  ): string {
    return `Analyze if this theme needs sub-themes based on complete context.

Theme: "${nodeContext.themeName}"
${nodeContext.description}

COMPLETE CONTEXT:
${this.formatBusinessContext(nodeContext.businessContext)}

${this.formatTechnicalContext(nodeContext.technicalContext)}

${this.formatFileContext(nodeContext.files)}

${this.formatMethodContext(nodeContext.methods)}

METRICS:
- Current depth: ${currentDepth} (max: 10)
- Files: ${nodeContext.metrics.totalFiles}
- Lines: ${nodeContext.metrics.totalLines}
- Methods: ${nodeContext.metrics.totalMethods}
- Is Atomic: ${nodeContext.metrics.isAtomic}

${nodeContext.parentReference ? `Parent Context:\n- Theme: "${nodeContext.parentReference.themeName}"\n- Purpose: ${nodeContext.parentReference.purpose}\n` : ''}

DECISION CRITERIA:
1. EXPAND if multiple distinct concerns exist that can be tested separately
2. ATOMIC if change is cohesive, testable as unit (5-15 lines ideal)
3. Consider business impact and technical complexity

RESPOND WITH JSON:
{
  "shouldExpand": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "specific reason based on context (max 30 words)",
  "suggestedSubThemes": null or [
    {
      "name": "specific action",
      "files": ["affected files"],
      "rationale": "why separate",
      "estimatedLines": number
    }
  ]
}`;
  }

  /**
   * Create theme naming prompt with full context
   */
  createNamingPrompt(
    nodeContext: NodeContext,
    diffAnalysis: DiffAnalysis
  ): string {
    return `Generate accurate theme name based on complete context.

CURRENT ANALYSIS:
${this.formatDiffSummary(diffAnalysis)}

${this.formatBusinessContext(nodeContext.businessContext)}

${this.formatFileContext(nodeContext.files)}

${this.formatMethodContext(nodeContext.methods)}

NAMING GUIDELINES:
1. Start with action verb (Add, Update, Fix, Remove, Refactor)
2. Be specific about what changed
3. Reflect actual changes, not assumptions
4. Keep concise (3-6 words)

RESPOND WITH JSON:
{
  "themeName": "concise descriptive name",
  "reasoning": "why this name accurately describes the changes"
}`;
  }

  /**
   * Create similarity analysis prompt with context
   */
  createSimilarityPrompt(
    theme1Context: NodeContext,
    theme2Context: NodeContext
  ): string {
    return `Analyze semantic similarity between two themes using their complete contexts.

THEME 1: "${theme1Context.themeName}"
${this.formatThemeContextBrief(theme1Context)}

THEME 2: "${theme2Context.themeName}"
${this.formatThemeContextBrief(theme2Context)}

SIMILARITY CRITERIA:
1. Business purpose overlap
2. Technical implementation similarity
3. Affected code areas
4. Change patterns

RESPOND WITH JSON:
{
  "similarityScore": 0.0-1.0,
  "reasoning": "specific similarities/differences",
  "businessSimilarity": 0.0-1.0,
  "technicalSimilarity": 0.0-1.0,
  "shouldConsolidate": boolean
}`;
  }

  /**
   * Create consolidation prompt with contexts
   */
  createConsolidationPrompt(contexts: NodeContext[]): string {
    const themeSummaries = contexts
      .map(
        (ctx) =>
          `- "${ctx.themeName}": ${ctx.businessContext.purpose} (${ctx.metrics.totalFiles} files, ${ctx.metrics.totalLines} lines)`
      )
      .join('\n');

    return `Analyze if these themes should be consolidated based on their contexts.

THEMES TO ANALYZE:
${themeSummaries}

DETAILED CONTEXTS:
${contexts.map((ctx, i) => `\nTheme ${i + 1}:\n${this.formatThemeContextBrief(ctx)}`).join('\n')}

CONSOLIDATION CRITERIA:
1. Themes address same business concern
2. Code changes are interdependent
3. Combined theme remains atomic and testable
4. Consolidation improves clarity

RESPOND WITH JSON:
{
  "shouldConsolidate": boolean,
  "consolidatedName": "suggested name if consolidating",
  "reasoning": "why consolidate or keep separate",
  "groups": [[0, 1], [2]] // theme indices to group together
}`;
  }

  /**
   * Create test generation prompt with context
   */
  createTestPrompt(nodeContext: NodeContext): string {
    return `Generate test strategy based on complete theme context.

THEME: "${nodeContext.themeName}"
${nodeContext.description}

${this.formatTechnicalContext(nodeContext.technicalContext)}

${this.formatMethodContext(nodeContext.methods)}

ACCEPTANCE CRITERIA:
${nodeContext.businessContext.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}

GENERATE TEST APPROACH:
1. Unit test requirements
2. Integration test needs
3. Edge cases to cover
4. Test data requirements

RESPOND WITH JSON:
{
  "testStrategy": "overall approach",
  "unitTests": ["test description"],
  "integrationTests": ["test description"],
  "edgeCases": ["edge case"],
  "testComplexity": "simple|moderate|complex"
}`;
  }

  /**
   * Format business context section
   */
  private formatBusinessContext(
    context: NodeContext['businessContext']
  ): string {
    return `BUSINESS CONTEXT:
- Purpose: ${context.purpose}
- Impact: ${context.impact}
- User Story: ${context.userStory}
- Acceptance: ${context.acceptanceCriteria?.join(', ') || 'None defined'}`;
  }

  /**
   * Format technical context section
   */
  private formatTechnicalContext(
    context: NodeContext['technicalContext']
  ): string {
    return `TECHNICAL CONTEXT:
- Change Type: ${context.changeType}
- Complexity: ${context.complexity}
- Dependencies: ${context.dependencies.join(', ') || 'None'}
- Testing: ${context.testingStrategy}
- Patterns: ${context.codePatterns.join(', ') || 'None identified'}`;
  }

  /**
   * Format file context section
   */
  private formatFileContext(files: NodeContext['files']): string {
    if (files.length === 0) return 'FILE CONTEXT: No files';

    const fileDetails = files
      .slice(0, 5)
      .map(
        (f) =>
          `- ${f.path} (${f.purpose}): ${f.changes.map((c) => `${c.type} ${c.description}`).join(', ')}`
      )
      .join('\n');

    return `FILE CONTEXT (${files.length} files):\n${fileDetails}`;
  }

  /**
   * Format method context section
   */
  private formatMethodContext(methods: NodeContext['methods']): string {
    if (methods.length === 0) return 'METHOD CONTEXT: No specific methods';

    const methodDetails = methods
      .slice(0, 5)
      .map((m) => `- ${m.name} (${m.purpose}): ${m.signature}`)
      .join('\n');

    return `METHOD CONTEXT (${methods.length} methods):\n${methodDetails}`;
  }

  /**
   * Format brief theme context
   */
  private formatThemeContextBrief(context: NodeContext): string {
    return [
      `Purpose: ${context.businessContext.purpose}`,
      `Files: ${context.files.map((f) => f.path).join(', ')}`,
      `Methods: ${context.methods.map((m) => m.name).join(', ') || 'None'}`,
      `Change Type: ${context.technicalContext.changeType}`,
      `Complexity: ${context.technicalContext.complexity}`,
    ].join('\n');
  }

  /**
   * Format diff summary
   */
  private formatDiffSummary(analysis: DiffAnalysis): string {
    return [
      `Files Changed: ${analysis.totalFiles}`,
      `Lines: +${analysis.totalLinesAdded}/-${analysis.totalLinesRemoved}`,
      `Methods: ${analysis.totalMethods.join(', ') || 'None'}`,
      `Classes: ${analysis.totalClasses.join(', ') || 'None'}`,
      `Change Types: ${Array.from(analysis.changeTypes.keys()).join(', ')}`,
    ].join('\n');
  }

  /**
   * Create prompt for code quality assessment
   */
  createQualityPrompt(
    nodeContext: NodeContext,
    codeSnippets: string[]
  ): string {
    return `Assess code quality based on theme context.

THEME: "${nodeContext.themeName}"
${this.formatTechnicalContext(nodeContext.technicalContext)}

CODE SAMPLES:
${codeSnippets
  .slice(0, 3)
  .map((s, i) => `Sample ${i + 1}:\n${s}`)
  .join('\n\n')}

QUALITY CRITERIA:
1. Follows project patterns
2. Proper error handling
3. Clear naming and structure
4. Test coverage considerations

RESPOND WITH JSON:
{
  "qualityScore": 0.0-1.0,
  "strengths": ["identified strength"],
  "concerns": ["potential issue"],
  "suggestions": ["improvement suggestion"]
}`;
  }

  /**
   * Create prompt for business impact analysis
   */
  createImpactPrompt(
    nodeContext: NodeContext,
    relatedContexts: NodeContext[]
  ): string {
    return `Analyze business impact of theme changes.

MAIN THEME: "${nodeContext.themeName}"
${this.formatBusinessContext(nodeContext.businessContext)}

RELATED THEMES:
${relatedContexts.map((ctx) => `- "${ctx.themeName}": ${ctx.businessContext.purpose}`).join('\n')}

IMPACT ANALYSIS:
1. Direct user impact
2. System dependencies
3. Performance implications
4. Risk assessment

RESPOND WITH JSON:
{
  "impactLevel": "low|medium|high|critical",
  "userImpact": "description of user impact",
  "systemImpact": "description of system impact",
  "risks": ["identified risk"],
  "mitigations": ["suggested mitigation"]
}`;
  }
}

/**
 * Singleton instance management
 */
let instance: StructuredPromptTemplates | null = null;

export function getStructuredPromptTemplates(): StructuredPromptTemplates {
  if (!instance) {
    instance = new StructuredPromptTemplates();
  }
  return instance;
}
