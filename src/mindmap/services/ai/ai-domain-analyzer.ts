import {
  AIDomainClassification,
  AIAnalysisContext,
  SemanticDiff,
} from '../../types/mindmap-types';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logInfo } from '../../../utils';
import { BusinessPromptTemplates } from '../../utils/business-prompt-templates';
import { ComplexityAnalyzer, ChangeComplexityProfile } from '../../utils/complexity-analyzer';

/**
 * AI-driven business domain analyzer
 * Replaces mechanical keyword matching with semantic understanding
 * PRD: "AI decides" domain classification based on actual business impact
 */
export class AIDomainAnalyzer {
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    // Initialize ComplexityAnalyzer for AI-driven analysis
    ComplexityAnalyzer.initialize(anthropicApiKey);
  }

  /**
   * Classify business capability using AI semantic understanding with complexity awareness
   * PRD: Root level represents "distinct user flow, story, or business capability"
   */
  async classifyBusinessDomain(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff
  ): Promise<AIDomainClassification> {
    // Generate complexity profile to inform naming strategy
    const complexityProfile = await this.generateComplexityProfile(context, semanticDiff);
    const prompt = await this.buildComplexityAwareDomainClassificationPrompt(context, semanticDiff, complexityProfile);

    try {
      const response = await this.claudeClient.callClaude(prompt, 'business-capability-classification');
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'primaryCapability',
        'userValue',
        'businessImpact',
        'confidence',
        'reasoning',
      ]);

      if (result.success) {
        const data = result.data as {
          primaryCapability: string;
          userValue: string;
          businessImpact: string;
          userJourney: string;
          affectedUserTypes: string[];
          businessMetrics: string[];
          confidence: number;
          reasoning: string;
        };
        return this.transformToAIDomainClassification(data);
      }
      
      throw new Error(`JSON extraction failed: ${result.error}`);
    } catch (error) {
      throw new Error(
        `AI business capability classification failed: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * Build AI prompt for business capability classification
   * PRD: "Structure emerges from code, not forced into preset levels"
   */
  private buildDomainClassificationPrompt(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff
  ): string {
    const additionalContext = semanticDiff
      ? this.formatSemanticDiffContext(semanticDiff)
      : '';

    // Use business-first prompt template
    const functionalContext = `
${context.surroundingContext}

${additionalContext}

COMMIT CONTEXT:
${context.commitMessage ? `Commit: ${context.commitMessage}` : ''}
${context.prDescription ? `PR Description: ${context.prDescription}` : ''}`;

    return BusinessPromptTemplates.createBusinessCapabilityPrompt(
      context.filePath,
      context.completeDiff,
      functionalContext
    );
  }

  /**
   * Format semantic diff context for additional insight
   */
  private formatSemanticDiffContext(semanticDiff: SemanticDiff): string {
    const patterns = semanticDiff.businessPatterns
      .map((p) => `- ${p.name}: ${p.description}`)
      .join('\n');

    const complexity = `Total complexity: ${semanticDiff.totalComplexity}`;
    const fileCount = `Files affected: ${semanticDiff.files.length}`;

    return `
BROADER CHANGE CONTEXT:
${complexity}
${fileCount}

DETECTED PATTERNS:
${patterns || 'No specific patterns detected'}

CROSS-FILE RELATIONSHIPS:
${semanticDiff.crossFileRelationships.length} relationships detected
`;
  }

  /**
   * Transform business capability response to AIDomainClassification format
   */
  private transformToAIDomainClassification(data: {
    primaryCapability: string;
    userValue: string;
    businessImpact: string;
    userJourney?: string;
    affectedUserTypes?: string[];
    businessMetrics?: string[];
    confidence: number;
    reasoning: string;
  }): AIDomainClassification {
    return {
      domain: this.trimToWordLimit(data.primaryCapability || 'Code Changes', 5),
      userValue: this.trimToWordLimit(
        data.userValue || 'Improve system functionality',
        15
      ),
      businessCapability: this.trimToWordLimit(
        data.businessImpact || 'Enable users to accomplish tasks',
        15
      ),
      confidence: Math.max(0, Math.min(1, data.confidence || 0.5)),
      reasoning: this.trimToWordLimit(
        data.reasoning || 'Standard code modification',
        20
      ),
      subDomains: data.affectedUserTypes || [],
      crossCuttingConcerns: data.businessMetrics || [],
      userJourney: data.userJourney,
      businessMetrics: data.businessMetrics,
    };
  }

  /**
   * Validate and normalize AI domain classification response (legacy support)
   */
  private validateDomainClassification(
    data: AIDomainClassification
  ): AIDomainClassification {
    return {
      domain: this.trimToWordLimit(data.domain || 'Code Changes', 5),
      userValue: this.trimToWordLimit(
        data.userValue || 'Improve system functionality',
        12
      ),
      businessCapability: this.trimToWordLimit(
        data.businessCapability || 'Enable users to accomplish tasks',
        15
      ),
      confidence: Math.max(0, Math.min(1, data.confidence || 0.5)),
      reasoning: this.trimToWordLimit(
        data.reasoning || 'Standard code modification',
        20
      ),
      subDomains: data.subDomains || [],
      crossCuttingConcerns: data.crossCuttingConcerns || [],
    };
  }


  /**
   * Analyze multiple changes for domain grouping
   * PRD: "Intelligent cross-referencing" and domain relationships
   */
  async analyzeMultiDomainChanges(contexts: AIAnalysisContext[]): Promise<{
    primaryDomains: AIDomainClassification[];
    crossCuttingDomains: AIDomainClassification[];
    domainRelationships: Array<{
      domain1: string;
      domain2: string;
      relationship: string;
      strength: number;
    }>;
  }> {
    const prompt = this.buildMultiDomainAnalysisPrompt(contexts);

    try {
      const response = await this.claudeClient.callClaude(prompt, 'multi-domain-analysis');
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'primaryDomains',
      ]);

      if (result.success) {
        return result.data as {
          primaryDomains: AIDomainClassification[];
          crossCuttingDomains: AIDomainClassification[];
          domainRelationships: Array<{
            domain1: string;
            domain2: string;
            relationship: string;
            strength: number;
          }>;
        };
      }
      
      throw new Error(`JSON extraction failed: ${result.error}`);
    } catch (error) {
      throw new Error(
        `AI multi-domain analysis failed: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * Build prompt for multi-domain analysis
   */
  private buildMultiDomainAnalysisPrompt(
    contexts: AIAnalysisContext[]
  ): string {
    const changesContext = contexts
      .map(
        (ctx, i) => `
CHANGE ${i + 1}:
File: ${ctx.filePath}
${ctx.commitMessage ? `Commit: ${ctx.commitMessage}` : ''}
Diff: ${ctx.completeDiff}
`
      )
      .join('\n');

    return `You are a product manager analyzing multiple related code changes for business domain organization.

MULTIPLE CODE CHANGES:
${changesContext}

TASK: Analyze these changes as a cohesive set and identify:
1. Primary business domains (distinct user capabilities)
2. Cross-cutting concerns that span domains
3. Relationships between domains

RESPOND WITH ONLY VALID JSON:
{
  "primaryDomains": [
    {
      "domain": "Domain name (max 5 words)",
      "userValue": "User benefit (max 12 words)",
      "businessCapability": "What this enables (max 15 words)",
      "confidence": 0.0-1.0,
      "reasoning": "Why this domain (max 20 words)",
      "affectedChanges": [0, 1, 2]
    }
  ],
  "crossCuttingDomains": [
    {
      "domain": "Cross-cutting concern",
      "userValue": "Benefit across domains",
      "businessCapability": "What this enables across system",
      "confidence": 0.0-1.0,
      "reasoning": "Why cross-cutting",
      "affectedChanges": [0, 1, 2]
    }
  ],
  "domainRelationships": [
    {
      "domain1": "First domain",
      "domain2": "Second domain", 
      "relationship": "depends-on|enables|shares-utility|related-flow",
      "strength": 0.0-1.0
    }
  ]
}`;
  }

  /**
   * Generate AI-driven complexity profile for the given context
   */
  private async generateComplexityProfile(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff
  ): Promise<ChangeComplexityProfile> {
    const themeCount = semanticDiff?.totalComplexity || 1;
    const affectedFiles = semanticDiff?.files.map(f => f.path) || [context.filePath];
    
    // Extract theme-like information from context
    const fileName = context.filePath.split('/').pop() || '';
    const themeName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const themeDescription = context.commitMessage || context.prDescription || '';
    
    return await ComplexityAnalyzer.generateComplexityProfile(
      themeCount,
      affectedFiles,
      themeName,
      themeDescription,
      context.completeDiff,
      context.surroundingContext
    );
  }

  /**
   * Build complexity-aware domain classification prompt
   */
  private async buildComplexityAwareDomainClassificationPrompt(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff,
    complexityProfile?: ChangeComplexityProfile
  ): Promise<string> {
    // If no complexity profile provided, generate one
    if (!complexityProfile) {
      complexityProfile = await this.generateComplexityProfile(context, semanticDiff);
    }

    const additionalContext = semanticDiff
      ? this.formatSemanticDiffContext(semanticDiff)
      : '';

    // Enhanced functional context with complexity information
    const functionalContext = `
${context.surroundingContext}

${additionalContext}

COMPLEXITY ANALYSIS:
Complexity Level: ${complexityProfile.complexity.toUpperCase()}
Recommended Approach: ${complexityProfile.recommendedApproach}
Reasoning: ${complexityProfile.reasoning}
Detected Patterns: ${complexityProfile.detectedPatterns.join(', ')}

COMMIT CONTEXT:
${context.commitMessage ? `Commit: ${context.commitMessage}` : ''}
${context.prDescription ? `PR Description: ${context.prDescription}` : ''}`;

    // Use the enhanced business prompt templates with complexity awareness
    return BusinessPromptTemplates.createBusinessImpactPrompt(
      context.filePath,
      context.completeDiff,
      functionalContext,
      complexityProfile.complexity
    );
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