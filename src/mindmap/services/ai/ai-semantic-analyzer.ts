import {
  AISemanticAnalysis,
  AIFileContext,
  AIAnalysisContext,
  SemanticChangeType,
} from '../../types/mindmap-types';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logInfo } from '../../../utils';

/**
 * AI-driven semantic change analyzer
 * Replaces regex pattern matching with contextual understanding
 * PRD: "AI decides" semantic meaning based on actual code impact
 */
export class AISemanticAnalyzer {
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Analyze semantic nature and impact of code changes
   * PRD: "Natural organization" based on actual change semantics
   */
  async analyzeSemanticChange(
    context: AIAnalysisContext
  ): Promise<AISemanticAnalysis> {
    const prompt = this.buildSemanticAnalysisPrompt(context);

    try {
      const response = await this.claudeClient.callClaude(prompt, 'semantic-analysis');
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'changeType',
        'semanticImpact',
        'userImpact',
        'technicalNature',
        'confidence',
        'reasoning',
      ]);

      if (result.success) {
        const data = result.data as AISemanticAnalysis;
        return this.validateSemanticAnalysis(data);
      }
      
      throw new Error(`JSON extraction failed: ${result.error}`);
    } catch (error) {
      throw new Error(
        `AI semantic analysis failed: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * Build AI prompt for semantic change analysis
   * PRD: "Context completeness" - provide full context for understanding
   */
  private buildSemanticAnalysisPrompt(context: AIAnalysisContext): string {
    const fileExtension =
      context.filePath.split('.').pop()?.toLowerCase() || '';
    const languageContext = this.getLanguageContext(fileExtension);

    return `You are a senior engineer analyzing code changes for semantic impact and meaning.

FILE CONTEXT:
- Path: ${context.filePath}
- Language: ${languageContext}
${context.commitMessage ? `- Commit: ${context.commitMessage}` : ''}
${context.prDescription ? `- PR Context: ${context.prDescription}` : ''}

COMPLETE CODE CHANGES:
${context.completeDiff}

SURROUNDING CODE CONTEXT:
${context.surroundingContext}

${context.dependencies ? `DEPENDENCIES: ${context.dependencies.join(', ')}` : ''}
${context.dependents ? `DEPENDENTS: ${context.dependents.join(', ')}` : ''}

TASK: Classify the semantic nature and impact of these changes.

SEMANTIC ANALYSIS CRITERIA:
1. Is this fixing existing behavior or adding new capability?
2. Does this change user-facing behavior or user experience?
3. Is this a breaking change for consumers of this code?
4. What is the primary intent behind this change?
5. How does this affect the system's architecture or design?

CHANGE TYPE DEFINITIONS:
- "new-feature": Adds new functionality users can access
- "bug-fix": Corrects existing behavior that was broken
- "refactoring": Improves code structure without changing behavior
- "performance-improvement": Optimizes speed, memory, or efficiency
- "api-change": Modifies public interfaces or contracts
- "behavior-change": Alters how existing features work
- "deprecation": Marks code/features for future removal

IMPACT LEVELS:
- "breaking": Changes that require consumer code modifications
- "enhancement": Improves or extends existing capabilities
- "fix": Corrects problems without breaking existing functionality
- "internal": Changes implementation without affecting external behavior

EXAMPLES:
✅ Good analysis: "Adds user profile picture upload" → new-feature, enhancement
✅ Good analysis: "Fixes null pointer in user validation" → bug-fix, fix
✅ Good analysis: "Refactors database connection pooling" → refactoring, internal
✅ Good analysis: "Changes API response format" → api-change, breaking

❌ Avoid surface-level: Don't judge by keywords like "fix" or "add" in comments
❌ Avoid assumptions: Don't assume file type determines change type

RESPOND WITH ONLY VALID JSON:
{
  "changeType": "new-feature|bug-fix|refactoring|performance-improvement|api-change|behavior-change|deprecation",
  "semanticImpact": "breaking|enhancement|fix|internal",
  "userImpact": "Description of user-visible impact (max 20 words)",
  "technicalNature": "What technically changed (max 15 words)",
  "affectedCapabilities": ["List of affected features or capabilities"],
  "confidence": 0.0-1.0,
  "reasoning": "Classification reasoning (max 25 words)",
  "filePurpose": "What this file's primary purpose is (max 10 words)",
  "relatedChanges": ["Optional: file paths of semantically related changes"]
}`;
  }

  /**
   * Get language-specific context for better analysis
   */
  private getLanguageContext(extension: string): string {
    const languageMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript React',
      js: 'JavaScript',
      jsx: 'JavaScript React',
      py: 'Python',
      java: 'Java',
      cpp: 'C++',
      cs: 'C#',
      go: 'Go',
      rs: 'Rust',
      rb: 'Ruby',
      php: 'PHP',
      json: 'JSON Configuration',
      yaml: 'YAML Configuration',
      yml: 'YAML Configuration',
      sql: 'SQL Database',
      md: 'Markdown Documentation',
    };

    return languageMap[extension] || 'Unknown';
  }

  /**
   * Validate and normalize AI semantic analysis response
   */
  private validateSemanticAnalysis(
    data: AISemanticAnalysis
  ): AISemanticAnalysis {
    const validChangeTypes: SemanticChangeType[] = [
      'new-feature',
      'bug-fix',
      'refactoring',
      'performance-improvement',
      'api-change',
      'behavior-change',
      'deprecation',
    ];

    const validImpacts = ['breaking', 'enhancement', 'fix', 'internal'];

    return {
      changeType: validChangeTypes.includes(data.changeType)
        ? data.changeType
        : 'refactoring',
      semanticImpact: validImpacts.includes(data.semanticImpact)
        ? (data.semanticImpact as
            | 'breaking'
            | 'enhancement'
            | 'fix'
            | 'internal')
        : 'internal',
      userImpact: this.trimToWordLimit(
        data.userImpact || 'Internal system changes',
        20
      ),
      technicalNature: this.trimToWordLimit(
        data.technicalNature || 'Code modifications',
        15
      ),
      affectedCapabilities: data.affectedCapabilities || [],
      confidence: Math.max(0, Math.min(1, data.confidence || 0.5)),
      reasoning: this.trimToWordLimit(
        data.reasoning || 'Standard code modification',
        25
      ),
      filePurpose: this.trimToWordLimit(
        data.filePurpose || 'System component',
        10
      ),
      relatedChanges: data.relatedChanges || [],
    };
  }


  /**
   * Analyze file purpose from content using AI
   * PRD: "File type intelligence" - understand actual purpose, not just extension
   */
  async analyzeFilePurpose(
    filePath: string,
    content: string,
    context?: string
  ): Promise<AIFileContext> {
    const prompt = this.buildFilePurposePrompt(filePath, content, context);

    try {
      const response = await this.claudeClient.callClaude(prompt, 'semantic-analysis');
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'actualPurpose',
        'businessRelevance',
        'technicalRole',
        'userFacing',
        'architecturalSignificance',
      ]);

      if (result.success) {
        const data = result.data as Record<string, unknown>;
        return this.createAIFileContext(filePath, data);
      }
      
      throw new Error(`JSON extraction failed: ${result.error}`);
    } catch (error) {
      throw new Error(
        `AI file purpose analysis failed for ${filePath}: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * Build prompt for file purpose analysis
   */
  private buildFilePurposePrompt(
    filePath: string,
    content: string,
    context?: string
  ): string {
    const truncatedContent = content; // Use full content - modern AI can handle it

    return `You are analyzing a file to understand its actual purpose and role in the system.

FILE PATH: ${filePath}

FILE CONTENT:
${truncatedContent}

${context ? `ADDITIONAL CONTEXT:\n${context}` : ''}

TASK: Determine the actual purpose and significance of this file.

CONSIDER:
1. What is this file's primary responsibility?
2. How does it relate to business logic vs infrastructure?
3. What technical role does it play in the system?
4. Do changes here affect end users directly?
5. How architecturally significant are modifications to this file?

RESPOND WITH ONLY VALID JSON:
{
  "actualPurpose": "Primary purpose of this file (max 10 words)",
  "businessRelevance": "How this relates to business logic (max 15 words)",
  "technicalRole": "Technical role in system (max 12 words)",
  "userFacing": true/false,
  "architecturalSignificance": "high|medium|low",
  "contextType": "function|class|module|config|test",
  "primaryResponsibilities": ["List key responsibilities"],
  "dependencies": ["Key dependencies this file has"],
  "impactRadius": "local|module|system|global"
}`;
  }

  /**
   * Create AI file context from analysis result
   */
  private createAIFileContext(
    filePath: string,
    data: Record<string, unknown>
  ): AIFileContext {
    return {
      functionName: undefined,
      className: undefined,
      namespace: undefined,
      startLine: 0,
      endLine: 0,
      contextType: (data.contextType as any) || 'function',
      actualPurpose: this.trimToWordLimit(
        (data.actualPurpose as string) || 'System component',
        10
      ),
      businessRelevance: this.trimToWordLimit(
        (data.businessRelevance as string) || 'Supporting system functionality',
        15
      ),
      technicalRole: this.trimToWordLimit(
        (data.technicalRole as string) || 'Code implementation',
        12
      ),
      userFacing: Boolean(data.userFacing),
      architecturalSignificance: ['high', 'medium', 'low'].includes(
        data.architecturalSignificance as string
      )
        ? (data.architecturalSignificance as 'high' | 'medium' | 'low')
        : 'medium',
    };
  }


  /**
   * Analyze related changes across multiple files
   * PRD: "Cross-file relationships and patterns"
   */
  async analyzeRelatedChanges(contexts: AIAnalysisContext[]): Promise<{
    clusters: Array<{
      theme: string;
      changes: number[];
      relationship: string;
      confidence: number;
    }>;
    crossCuttingConcerns: Array<{
      concern: string;
      affectedChanges: number[];
      impact: string;
    }>;
  }> {
    if (contexts.length < 2) {
      return { clusters: [], crossCuttingConcerns: [] };
    }

    const prompt = this.buildRelatedChangesPrompt(contexts);

    try {
      const response = await this.claudeClient.callClaude(prompt, 'semantic-analysis');
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'clusters',
      ]);

      if (result.success) {
        return result.data as {
          clusters: Array<{
            theme: string;
            changes: number[];
            relationship: string;
            confidence: number;
          }>;
          crossCuttingConcerns: Array<{
            concern: string;
            affectedChanges: number[];
            impact: string;
          }>;
        };
      }
      
      throw new Error(`JSON extraction failed: ${result.error}`);
    } catch (error) {
      throw new Error(
        `AI related changes analysis failed: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * Build prompt for related changes analysis
   */
  private buildRelatedChangesPrompt(contexts: AIAnalysisContext[]): string {
    const changesContext = contexts
      .map(
        (ctx, i) => `
CHANGE ${i}:
File: ${ctx.filePath}
Diff: ${ctx.completeDiff}
${ctx.commitMessage ? `Commit: ${ctx.commitMessage}` : ''}
`
      )
      .join('\n');

    return `You are analyzing multiple code changes to identify semantic relationships and patterns.

CHANGES TO ANALYZE:
${changesContext}

TASK: Identify clusters of related changes and cross-cutting concerns.

CONSIDER:
1. Which changes implement parts of the same feature?
2. Which changes affect the same business capability?
3. Which changes share the same technical pattern?
4. What concerns span multiple unrelated features?

RESPOND WITH ONLY VALID JSON:
{
  "clusters": [
    {
      "theme": "What unifies these changes (max 8 words)",
      "changes": [0, 1, 2],
      "relationship": "same-feature|same-domain|same-pattern|dependency",
      "confidence": 0.0-1.0
    }
  ],
  "crossCuttingConcerns": [
    {
      "concern": "Cross-cutting concern name (max 8 words)",
      "affectedChanges": [0, 1, 2],
      "impact": "How this affects multiple areas (max 15 words)"
    }
  ]
}`;
  }

  /**
   * Trim text to word limit
   */
  private trimToWordLimit(text: string, maxWords: number): string {
    if (!text) return '';
    const words = text.split(/\s+/);
    if (words.length <= maxWords) {
      return text;
    }
    return words.slice(0, maxWords).join(' ');
  }
}
