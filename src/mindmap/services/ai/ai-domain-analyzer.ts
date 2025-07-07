import {
  AIDomainClassification,
  AIAnalysisContext,
  SemanticDiff,
} from '../../types/mindmap-types';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logInfo } from '../../../utils';
import { BusinessPromptTemplates } from '../../utils/business-prompt-templates';

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
   * Classify business capability using AI semantic understanding
   * PRD: Root level represents "distinct user flow, story, or business capability"
   */
  async classifyBusinessDomain(
    context: AIAnalysisContext,
    semanticDiff?: SemanticDiff
  ): Promise<AIDomainClassification> {
    const prompt = this.buildDomainClassificationPrompt(context, semanticDiff);

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
    } catch (error) {
      logInfo(`AI business capability classification failed: ${error}`);
    }

    // Graceful degradation: return generic domain with low confidence
    return this.createFallbackDomain(context);
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
   * Create fallback business capability when AI analysis fails
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
    const isAuth =
      context.filePath.includes('auth') || context.filePath.includes('login');
    const isLogger =
      context.filePath.includes('log') || context.filePath.includes('debug');

    if (isTest) {
      return {
        domain: 'Development Workflow Optimization',
        userValue: 'Developers catch issues before users experience them',
        businessCapability: 'Maintain high-quality user experience through automated testing',
        confidence: 0.4,
        reasoning: 'Test file detected - quality assurance capability',
        subDomains: ['Software developers'],
        userJourney: 'Quality assurance and testing workflow',
      };
    }

    if (isAuth) {
      return {
        domain: 'User Account Management',
        userValue: 'Users access their accounts securely and efficiently',
        businessCapability: 'Enable secure user authentication and access control',
        confidence: 0.5,
        reasoning: 'Authentication file detected - user security capability',
        subDomains: ['End users', 'Account holders'],
        userJourney: 'User login and authentication process',
      };
    }

    if (isLogger) {
      return {
        domain: 'Development Workflow Optimization', 
        userValue: 'Developers diagnose and resolve issues faster',
        businessCapability: 'Enable efficient troubleshooting and system monitoring',
        confidence: 0.5,
        reasoning: 'Logging file detected - debugging and monitoring capability',
        subDomains: ['Software developers', 'DevOps engineers'],
        userJourney: 'Error investigation and system monitoring workflow',
      };
    }

    if (isConfig) {
      return {
        domain: 'Development Workflow Optimization',
        userValue: 'Developers deploy and maintain systems reliably',
        businessCapability: 'Configure system behavior for optimal user experience',
        confidence: 0.4,
        reasoning: 'Configuration file detected - system management capability',
        subDomains: ['DevOps engineers', 'System administrators'],
        userJourney: 'System deployment and configuration workflow',
      };
    }

    if (isUI) {
      return {
        domain: 'User Experience Enhancement',
        userValue: 'Users accomplish tasks intuitively and efficiently',
        businessCapability: 'Enable smooth and intuitive user interactions',
        confidence: 0.4,
        reasoning: 'UI component detected - user interface capability',
        subDomains: ['End users', 'All user types'],
        userJourney: 'User interface interaction and navigation',
      };
    }

    // Generic fallback
    return {
      domain: 'User Experience Enhancement',
      userValue: 'Users benefit from improved system functionality',
      businessCapability: 'Enhance overall system capabilities for better user outcomes',
      confidence: 0.3,
      reasoning: 'AI analysis unavailable - generic user experience capability',
      subDomains: ['All users'],
      userJourney: 'General system usage and interaction',
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
    } catch (error) {
      logInfo(`Multi-domain analysis failed: ${error}`);
    }

    // Fallback: analyze each individually with concurrency control
    console.log(
      `[AI-DOMAIN] Fallback to individual analysis for ${contexts.length} contexts`
    );

    // Process all contexts concurrently - let ClaudeClient handle rate limiting
    // This creates a continuous stream: 10→9→10→9→8→10 instead of batched 10→0→10→0
    console.log(`[AI-DOMAIN] Processing all ${contexts.length} contexts concurrently`);
    
    const contextPromises = contexts.map(async (ctx) => {
      try {
        const result = await this.classifyBusinessDomain(ctx);
        return result;
      } catch (error) {
        console.warn(
          `[AI-DOMAIN] Individual analysis failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        // Return fallback domain for failed analysis
        return {
          domain: 'System Enhancement',
          userValue: 'Improve system functionality',
          businessCapability: 'Enhance system capabilities',
          confidence: 0.3,
          reasoning: 'AI analysis failed - using fallback',
        };
      }
    });
    
    // Wait for all contexts to complete - ClaudeClient manages the 10 concurrent limit
    const successfulDomains = await Promise.all(contextPromises);
    
    console.log(`[AI-DOMAIN] All ${successfulDomains.length} contexts processed`);

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
