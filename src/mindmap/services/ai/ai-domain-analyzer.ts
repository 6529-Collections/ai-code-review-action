import {
  AIDomainClassification,
  AIAnalysisContext,
  SemanticDiff,
} from '../../types/mindmap-types';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { ConcurrencyManager } from '@/shared/utils/concurrency-manager';
import { logInfo } from '../../../utils';

/**
 * AI-driven business domain analyzer
 * Replaces mechanical keyword matching with semantic understanding
 * PRD: "AI decides" domain classification based on actual business impact
 */
export class AIDomainAnalyzer {
  private claudeClient: ClaudeClient;

  constructor(anthropicApiKey: string) {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Classify business domain using AI semantic understanding
   * PRD: Root level represents "distinct user flow, story, or business capability"
   */
  async classifyBusinessDomain(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff
  ): Promise<AIDomainClassification> {
    const prompt = this.buildDomainClassificationPrompt(context, semanticDiff);

    try {
      const response = await this.claudeClient.callClaude(prompt);
      const result = JsonExtractor.extractAndValidateJson(response, 'object', [
        'domain',
        'userValue',
        'businessCapability',
        'confidence',
        'reasoning',
      ]);

      if (result.success) {
        const data = result.data as AIDomainClassification;
        return this.validateDomainClassification(data);
      }
    } catch (error) {
      logInfo(`AI domain classification failed: ${error}`);
    }

    // Graceful degradation: return generic domain with low confidence
    return this.createFallbackDomain(context);
  }

  /**
   * Build AI prompt for business domain classification
   * PRD: "Structure emerges from code, not forced into preset levels"
   */
  private buildDomainClassificationPrompt(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff
  ): string {
    const additionalContext = semanticDiff
      ? this.formatSemanticDiffContext(semanticDiff)
      : '';

    return `You are a product manager analyzing code changes for business impact.

CONTEXT:
File: ${context.filePath}
${context.commitMessage ? `Commit: ${context.commitMessage}` : ''}
${context.prDescription ? `PR Description: ${context.prDescription}` : ''}

COMPLETE CODE CHANGES:
${context.completeDiff}

SURROUNDING CODE CONTEXT:
${context.surroundingContext}

${additionalContext}

TASK: Identify the PRIMARY business domain this change affects.

PERSPECTIVE: Focus on end-user value and business capability, not technical implementation.

CONSIDER:
1. What user problem does this solve or improve?
2. What business process does it enable or enhance?
3. What user journey or workflow does it affect?
4. Is this creating new capability or improving existing?

EXAMPLES:
✅ Good domains: "User Account Management", "Payment Processing", "Content Discovery"
✅ Good user value: "Users can reset passwords securely"
✅ Good capability: "Enable secure self-service account recovery"

❌ Avoid technical terms: "Database Migration", "Refactor Utils"
❌ Avoid generic: "Fix Issues", "Update Code"

RESPOND WITH ONLY VALID JSON:
{
  "domain": "Clear business domain (max 5 words)",
  "userValue": "End user benefit (max 12 words)", 
  "businessCapability": "What this enables users to do (max 15 words)",
  "confidence": 0.0-1.0,
  "reasoning": "Why this domain classification (max 20 words)",
  "subDomains": ["Optional specific user flows within capability"],
  "crossCuttingConcerns": ["Optional other domains this also affects"]
}`;
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
   * Validate and normalize AI domain classification response
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
      subDomains: data.subDomains || [], // Include all sub-domains
      crossCuttingConcerns: data.crossCuttingConcerns || [], // Include all concerns
    };
  }

  /**
   * Create fallback domain when AI analysis fails
   * PRD: "Graceful degradation - never fail completely"
   */
  private createFallbackDomain(
    context: AIAnalysisContext
  ): AIDomainClassification {
    const fileName = context.filePath.split('/').pop() || 'unknown';
    const isTest =
      context.filePath.includes('test') || context.filePath.includes('spec');
    const isConfig =
      context.filePath.includes('config') || fileName.endsWith('.json');
    const isUI =
      context.filePath.includes('component') || context.filePath.includes('ui');

    if (isTest) {
      return {
        domain: 'Test Coverage',
        userValue: 'Ensure system reliability and quality',
        businessCapability:
          'Maintain high-quality user experience through testing',
        confidence: 0.4,
        reasoning: 'Test file detected - quality assurance domain',
        subDomains: ['Unit Testing'],
      };
    }

    if (isConfig) {
      return {
        domain: 'System Configuration',
        userValue: 'Maintain system operational stability',
        businessCapability: 'Configure system behavior and settings',
        confidence: 0.4,
        reasoning: 'Configuration file detected - infrastructure domain',
        subDomains: ['Infrastructure Management'],
      };
    }

    if (isUI) {
      return {
        domain: 'User Interface',
        userValue: 'Improve user interaction experience',
        businessCapability: 'Enable intuitive user interactions and workflows',
        confidence: 0.4,
        reasoning: 'UI component detected - user experience domain',
        subDomains: ['User Experience'],
      };
    }

    // Generic fallback
    return {
      domain: 'System Enhancement',
      userValue: 'Improve overall system functionality',
      businessCapability: 'Enhance system capabilities for users',
      confidence: 0.3,
      reasoning: 'AI analysis unavailable - generic enhancement domain',
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
      const response = await this.claudeClient.callClaude(prompt);
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
    } catch (error) {
      logInfo(`Multi-domain analysis failed: ${error}`);
    }

    // Fallback: analyze each individually with concurrency control
    console.log(
      `[AI-DOMAIN] Fallback to individual analysis for ${contexts.length} contexts`
    );

    const domains = await ConcurrencyManager.processConcurrentlyWithLimit(
      contexts,
      async (ctx) => await this.classifyBusinessDomain(ctx),
      {
        concurrencyLimit: 5,
        maxRetries: 2,
        enableLogging: false,
        onProgress: (completed, total) => {
          console.log(
            `[AI-DOMAIN] Individual analysis progress: ${completed}/${total}`
          );
        },
        onError: (error, ctx, retryCount) => {
          console.warn(
            `[AI-DOMAIN] Retry ${retryCount} for context: ${error.message}`
          );
        },
      }
    );

    // Filter successful results and handle errors
    const successfulDomains: AIDomainClassification[] = [];

    for (const result of domains) {
      if (result && typeof result === 'object' && 'error' in result) {
        console.warn(`[AI-DOMAIN] Individual analysis failed, using fallback`);
        // Add fallback domain for failed analysis
        successfulDomains.push({
          domain: 'System Enhancement',
          userValue: 'Improve system functionality',
          businessCapability: 'Enhance system capabilities',
          confidence: 0.3,
          reasoning: 'AI analysis failed - using fallback',
        });
      } else {
        successfulDomains.push(result as AIDomainClassification);
      }
    }

    return {
      primaryDomains: successfulDomains,
      crossCuttingDomains: [],
      domainRelationships: [],
    };
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
