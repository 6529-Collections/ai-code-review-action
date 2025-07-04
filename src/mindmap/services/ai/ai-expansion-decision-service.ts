import { ConsolidatedTheme } from '../../types/similarity-types';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logInfo } from '../../../utils';
import { CodeStructureAnalyzer } from '../code-structure-analyzer';
import { DynamicPromptBuilder } from '../dynamic-prompt-builder';

/**
 * Simplified AI-driven expansion decision service
 * Implements PRD vision: "AI decides when further decomposition is needed"
 */
export class AIExpansionDecisionService {
  private claudeClient: ClaudeClient;
  private decisionCache: Map<string, ExpansionDecision>;
  private codeAnalyzer: CodeStructureAnalyzer;
  private promptBuilder: DynamicPromptBuilder;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.decisionCache = new Map();
    this.codeAnalyzer = new CodeStructureAnalyzer();
    this.promptBuilder = new DynamicPromptBuilder();
  }

  /**
   * Main decision point: Should this theme be expanded?
   * Uses intelligent code analysis and dynamic prompting for optimal decisions
   */
  async shouldExpandTheme(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): Promise<ExpansionDecision> {
    // Enhanced cache check with analysis hash
    const analysisHash = await this.getAnalysisHash(theme);
    const cacheKey = `${theme.id}_${currentDepth}_${analysisHash}`;
    if (this.decisionCache.has(cacheKey)) {
      const cachedDecision = this.decisionCache.get(cacheKey);
      if (cachedDecision) {
        return cachedDecision;
      }
    }

    // PRD: Let AI make ALL expansion decisions - no programmatic filtering

    // Analyze code structure for intelligent hints
    const codeAnalysis = await this.codeAnalyzer.analyzeThemeStructure(theme);

    // Build dynamic, context-aware prompt
    const prompt = this.promptBuilder.buildExpansionPrompt(
      theme,
      currentDepth,
      codeAnalysis,
      parentTheme,
      siblingThemes
    );

    logInfo(
      `Enhanced AI analysis for "${theme.name}": ${codeAnalysis.functionCount} functions, ${codeAnalysis.changeTypes.length} change types, ${codeAnalysis.expansionHints.length} hints`
    );

    const decision = await this.getAIDecision(prompt);

    this.decisionCache.set(cacheKey, decision);
    return decision;
  }

  /**
   * Generate a simple hash for theme analysis caching
   */
  private async getAnalysisHash(theme: ConsolidatedTheme): Promise<string> {
    const content = `${theme.id}_${theme.affectedFiles.join(',')}_${theme.codeSnippets.join('')}`;
    // Simple hash - in production you might want a proper hash function
    return Buffer.from(content).toString('base64').slice(0, 16);
  }

  /**
   * Calculate total lines from code snippets (which contain full file patches)
   */
  private calculateTotalLines(theme: ConsolidatedTheme): number {
    // Each code snippet contains a full file patch/diff
    return theme.codeSnippets.reduce((count, snippet) => {
      return count + snippet.split('\n').length;
    }, 0);
  }

  /**
   * Get AI decision from Claude
   */
  private async getAIDecision(prompt: string): Promise<ExpansionDecision> {
    try {
      const response = await this.claudeClient.callClaude(prompt);

      const extractionResult = JsonExtractor.extractAndValidateJson(
        response,
        'object',
        ['shouldExpand', 'reasoning']
      );

      if (extractionResult.success) {
        const data = extractionResult.data as {
          shouldExpand?: boolean;
          isAtomic?: boolean;
          reasoning?: string;
          businessContext?: string;
          technicalContext?: string;
          testabilityAssessment?: string;
          suggestedSubThemes?: Array<{
            name: string;
            description: string;
            files: string[];
            rationale: string;
            businessContext?: string;
            technicalContext?: string;
            estimatedLines?: number;
          }>;
        };

        return {
          shouldExpand: data.shouldExpand ?? true, // PRD: Default to expand
          isAtomic: data.isAtomic ?? false,
          reasoning: data.reasoning ?? 'No reasoning provided',
          businessContext: data.businessContext ?? '',
          technicalContext: data.technicalContext ?? '',
          testabilityAssessment: data.testabilityAssessment ?? '',
          suggestedSubThemes: data.suggestedSubThemes || null,
        };
      }

      // Fallback on parsing error
      logInfo(
        `Failed to parse AI expansion decision: ${extractionResult.error}`
      );
      return {
        shouldExpand: true, // PRD: Default to expand on error
        isAtomic: false,
        reasoning: 'Failed to parse AI response',
        businessContext: '',
        technicalContext: '',
        testabilityAssessment: '',
        suggestedSubThemes: null,
      };
    } catch (error) {
      logInfo(`AI expansion decision failed: ${error}`);
      return {
        shouldExpand: true, // PRD: Default to expand on error
        isAtomic: false,
        reasoning: `AI analysis failed: ${error}`,
        businessContext: '',
        technicalContext: '',
        testabilityAssessment: '',
        suggestedSubThemes: null,
      };
    }
  }

  /**
   * Clear the decision cache
   */
  clearCache(): void {
    this.decisionCache.clear();
  }
}

/**
 * Simplified expansion decision structure
 */
export interface ExpansionDecision {
  shouldExpand: boolean;
  isAtomic: boolean;
  reasoning: string;
  businessContext: string;
  technicalContext: string;
  testabilityAssessment: string;
  suggestedSubThemes: Array<{
    name: string;
    description: string;
    files: string[];
    rationale: string;
  }> | null;
}
