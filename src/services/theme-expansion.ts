import { ConsolidatedTheme } from '../types/similarity-types';
import { GenericCache } from '../utils/generic-cache';
import { ClaudeClient } from '../utils/claude-client';
import { CodeChange, SmartContext } from '../utils/code-analyzer';
import { logInfo } from '../utils';

// Configuration for theme expansion
export interface ExpansionConfig {
  maxDepth: number; // Maximum hierarchy depth (default: 4)
  minComplexityScore: number; // Minimum complexity to warrant expansion (default: 0.7)
  minFilesForExpansion: number; // Minimum files required for expansion (default: 2)
  businessImpactThreshold: number; // Minimum business impact for expansion (default: 0.6)
  parallelBatchSize: number; // Batch size for parallel processing (default: 5)
}

export const DEFAULT_EXPANSION_CONFIG: ExpansionConfig = {
  maxDepth: 4,
  minComplexityScore: 0.7,
  minFilesForExpansion: 2,
  businessImpactThreshold: 0.6,
  parallelBatchSize: 5,
};

export interface ExpansionCandidate {
  theme: ConsolidatedTheme;
  parentTheme?: ConsolidatedTheme;
  expansionReason: string;
  complexityScore: number;
  businessPatterns: string[];
}

export interface SubThemeAnalysis {
  subThemes: ConsolidatedTheme[];
  shouldExpand: boolean;
  confidence: number;
  reasoning: string;
  businessLogicPatterns: string[];
  userFlowPatterns: string[];
}

export interface ExpansionRequest {
  id: string;
  theme: ConsolidatedTheme;
  parentTheme?: ConsolidatedTheme;
  depth: number;
  context: ExpansionContext;
}

export interface ExpansionContext {
  relevantFiles: string[];
  codeChanges: CodeChange[];
  smartContext: SmartContext;
  businessScope: string;
  parentBusinessLogic?: string;
}

export interface ExpansionResult {
  requestId: string;
  success: boolean;
  expandedTheme?: ConsolidatedTheme;
  subThemes: ConsolidatedTheme[];
  error?: string;
  processingTime: number;
}

export class ThemeExpansionService {
  private claudeClient: ClaudeClient;
  private cache: GenericCache;
  private config: ExpansionConfig;

  constructor(anthropicApiKey: string, config: Partial<ExpansionConfig> = {}) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.cache = new GenericCache(3600000); // 1 hour TTL
    this.config = { ...DEFAULT_EXPANSION_CONFIG, ...config };
  }

  /**
   * Main entry point for expanding themes hierarchically
   */
  async expandThemesHierarchically(
    consolidatedThemes: ConsolidatedTheme[]
  ): Promise<ConsolidatedTheme[]> {
    logInfo(
      `Starting hierarchical expansion of ${consolidatedThemes.length} themes`
    );

    const expandedThemes: ConsolidatedTheme[] = [];

    // Process each theme recursively
    for (const theme of consolidatedThemes) {
      const expanded = await this.expandThemeRecursively(theme, 0);
      expandedThemes.push(expanded);
    }

    logInfo(
      `Completed hierarchical expansion: ${expandedThemes.length} themes processed`
    );
    return expandedThemes;
  }

  /**
   * Recursively expand a theme to maximum depth
   */
  private async expandThemeRecursively(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme
  ): Promise<ConsolidatedTheme> {
    // Check depth limit
    if (currentDepth >= this.config.maxDepth) {
      return theme;
    }

    // Check if theme is candidate for expansion
    const expansionCandidate = await this.evaluateExpansionCandidate(
      theme,
      parentTheme
    );
    if (!expansionCandidate) {
      // Still process existing child themes recursively
      const expandedChildren = await Promise.all(
        theme.childThemes.map((child: ConsolidatedTheme) =>
          this.expandThemeRecursively(child, currentDepth + 1, theme)
        )
      );
      return { ...theme, childThemes: expandedChildren };
    }

    // Create expansion request
    const expansionRequest: ExpansionRequest = {
      id: `expansion_${theme.id}_${Date.now()}`,
      theme,
      parentTheme,
      depth: currentDepth,
      context: await this.buildExpansionContext(theme, parentTheme),
    };

    // Process expansion
    const result = await this.processExpansionRequest(expansionRequest);

    if (!result.success || !result.expandedTheme) {
      logInfo(`Expansion failed for theme ${theme.name}: ${result.error}`);
      return theme;
    }

    // Recursively expand new sub-themes
    const expandedSubThemes = await Promise.all(
      result.subThemes.map((subTheme: ConsolidatedTheme) =>
        this.expandThemeRecursively(
          subTheme,
          currentDepth + 1,
          result.expandedTheme
        )
      )
    );

    // Also expand existing child themes
    const expandedExistingChildren = await Promise.all(
      result.expandedTheme!.childThemes.map((child: ConsolidatedTheme) =>
        this.expandThemeRecursively(
          child,
          currentDepth + 1,
          result.expandedTheme
        )
      )
    );

    return {
      ...result.expandedTheme!,
      childThemes: [...expandedExistingChildren, ...expandedSubThemes],
    };
  }

  /**
   * Evaluate if a theme is a candidate for expansion
   */
  private async evaluateExpansionCandidate(
    theme: ConsolidatedTheme,
    parentTheme?: ConsolidatedTheme
  ): Promise<ExpansionCandidate | null> {
    // Basic checks
    if (theme.affectedFiles.length < this.config.minFilesForExpansion) {
      return null;
    }

    // Calculate complexity score based on various factors
    const complexityScore = this.calculateComplexityScore(theme);
    if (complexityScore < this.config.minComplexityScore) {
      return null;
    }

    // Analyze business patterns
    const businessPatterns = await this.identifyBusinessPatterns(theme);
    if (businessPatterns.length < 2) {
      return null; // Need at least 2 distinct patterns for expansion
    }

    return {
      theme,
      parentTheme,
      expansionReason: `Complex theme with ${businessPatterns.length} business patterns`,
      complexityScore,
      businessPatterns,
    };
  }

  /**
   * Calculate complexity score for expansion candidacy
   */
  private calculateComplexityScore(theme: ConsolidatedTheme): number {
    let score = 0;

    // File count factor (normalized)
    score += Math.min(theme.affectedFiles.length / 10, 0.3);

    // Description length factor (complexity often correlates with description length)
    score += Math.min(theme.description.length / 500, 0.2);

    // Business impact factor
    score += Math.min(theme.businessImpact.length / 300, 0.2);

    // Code snippets diversity
    score += Math.min(theme.codeSnippets.length / 20, 0.15);

    // Child theme count (existing complexity)
    score += Math.min(theme.childThemes.length / 5, 0.15);

    return Math.min(score, 1.0);
  }

  /**
   * Identify distinct business patterns within a theme
   */
  private async identifyBusinessPatterns(
    theme: ConsolidatedTheme
  ): Promise<string[]> {
    const cacheKey = `business_patterns_${theme.id}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached as string[];
    }

    const prompt = `
Analyze this code theme for distinct business logic patterns and user flows:

Theme: ${theme.name}
Description: ${theme.description}
Business Impact: ${theme.businessImpact}
Affected Files: ${theme.affectedFiles.join(', ')}

Code Context:
${theme.codeSnippets.slice(0, 3).join('\n---\n')}

Identify distinct business patterns within this theme. Look for:
1. Different user interaction flows
2. Separate business logic concerns
3. Distinct functional areas
4. Different data processing patterns
5. Separate integration points

Return a JSON array of distinct business pattern names (max 6):
["pattern1", "pattern2", ...]

Focus on business value, not technical implementation details.
`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const patterns = JSON.parse(response.trim()) as string[];

      this.cache.set(cacheKey, patterns, 3600000); // Cache for 1 hour
      return patterns;
    } catch (error) {
      logInfo(
        `Failed to identify business patterns for ${theme.name}: ${error}`
      );
      return [];
    }
  }

  /**
   * Build expansion context for AI analysis
   */
  private async buildExpansionContext(
    theme: ConsolidatedTheme,
    parentTheme?: ConsolidatedTheme
  ): Promise<ExpansionContext> {
    return {
      relevantFiles: theme.affectedFiles,
      codeChanges: [], // Would be populated from theme context
      smartContext: {} as SmartContext, // Would be populated from theme context
      businessScope: theme.businessImpact,
      parentBusinessLogic: parentTheme?.businessImpact,
    };
  }

  /**
   * Process a single expansion request
   */
  private async processExpansionRequest(
    request: ExpansionRequest
  ): Promise<ExpansionResult> {
    const startTime = Date.now();

    try {
      const analysis = await this.analyzeThemeForSubThemes(request);

      if (analysis.shouldExpand && analysis.subThemes.length > 0) {
        // Create expanded theme with new sub-themes
        const expandedTheme: ConsolidatedTheme = {
          ...request.theme,
          childThemes: [...request.theme.childThemes, ...analysis.subThemes],
        };

        return {
          requestId: request.id,
          success: true,
          expandedTheme,
          subThemes: analysis.subThemes,
          processingTime: Date.now() - startTime,
        };
      } else {
        return {
          requestId: request.id,
          success: true,
          expandedTheme: request.theme,
          subThemes: [],
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        requestId: request.id,
        success: false,
        subThemes: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze theme for potential sub-themes using AI
   */
  private async analyzeThemeForSubThemes(
    request: ExpansionRequest
  ): Promise<SubThemeAnalysis> {
    const { theme, parentTheme, depth } = request;

    const prompt = `
Analyze this code theme for potential sub-theme expansion:

THEME TO ANALYZE:
Name: ${theme.name}
Description: ${theme.description}
Business Impact: ${theme.businessImpact}
Current Level: ${theme.level}
Expansion Depth: ${depth}
Files: ${theme.affectedFiles.join(', ')}

${
  parentTheme
    ? `PARENT THEME CONTEXT:
Name: ${parentTheme.name}
Business Logic: ${parentTheme.businessImpact}`
    : ''
}

CODE CONTEXT:
${theme.codeSnippets.slice(0, 5).join('\n---\n')}

ANALYSIS TASK:
Determine if this theme contains distinct sub-patterns that warrant separate sub-themes.
Focus on:
1. Business logic separation (different business rules/processes)
2. User flow distinction (different user interaction patterns)
3. Functional area separation (different system responsibilities)
4. Data processing patterns (different data handling approaches)

EXPANSION CRITERIA:
- Sub-themes must have distinct business value
- Each sub-theme should represent a coherent business concept
- Avoid technical implementation splitting
- Maintain file scope relevance
- Ensure no duplication with parent or sibling themes

Return JSON:
{
  "shouldExpand": boolean,
  "confidence": number (0-1),
  "reasoning": "explanation of decision",
  "businessLogicPatterns": ["pattern1", "pattern2"],
  "userFlowPatterns": ["flow1", "flow2"],
  "subThemes": [
    {
      "name": "Sub-theme name",
      "description": "Business-focused description",
      "businessImpact": "User/business value",
      "relevantFiles": ["file1.ts", "file2.ts"],
      "confidence": number (0-1)
    }
  ]
}

Only create sub-themes if there are genuinely distinct business concerns.
`;

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const analysis = JSON.parse(response.trim());

      // Convert to ConsolidatedTheme objects
      const subThemes: ConsolidatedTheme[] = analysis.subThemes.map(
        (
          subTheme: {
            name: string;
            description: string;
            businessImpact: string;
            relevantFiles: string[];
            confidence: number;
          },
          index: number
        ) => ({
          id: `${theme.id}_sub_${index}_${Date.now()}`,
          name: subTheme.name,
          description: subTheme.description,
          level: theme.level + 1,
          parentId: theme.id,
          childThemes: [],
          affectedFiles: subTheme.relevantFiles.filter((file: string) =>
            theme.affectedFiles.includes(file)
          ),
          confidence: subTheme.confidence,
          businessImpact: subTheme.businessImpact,
          codeSnippets: theme.codeSnippets.filter((snippet) =>
            subTheme.relevantFiles.some((file: string) =>
              snippet.includes(file)
            )
          ),
          context: theme.context,
          lastAnalysis: new Date(),
          sourceThemes: [theme.id],
          consolidationMethod: 'hierarchy' as const,
        })
      );

      return {
        subThemes,
        shouldExpand: analysis.shouldExpand && subThemes.length > 0,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        businessLogicPatterns: analysis.businessLogicPatterns || [],
        userFlowPatterns: analysis.userFlowPatterns || [],
      };
    } catch (error) {
      logInfo(`AI analysis failed for theme ${theme.name}: ${error}`);
      return {
        subThemes: [],
        shouldExpand: false,
        confidence: 0,
        reasoning: `Analysis failed: ${error}`,
        businessLogicPatterns: [],
        userFlowPatterns: [],
      };
    }
  }
}
