import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
import { 
  ReviewResult, 
  NodeReview, 
  ReviewFindings, 
  NodeTypeClassification, 
  ReviewConfig,
  FileContextMap,
  DiffHunkInfo
} from '../types/review-types';
import { TestDataLoader } from './test-data-loader';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { logger } from '@/shared/logger/logger';
import { JsonExtractor } from '@/shared/utils/json-extractor';

/**
 * Main review service that orchestrates Phase 2 code review
 * Implements Week 1 strategy: Basic node review with AI analysis
 */
export class ReviewService {
  private claudeClient: ClaudeClient;
  private config: ReviewConfig;
  
  constructor(private apiKey: string, config: ReviewConfig = {}) {
    this.claudeClient = new ClaudeClient(apiKey);
    this.config = {
      maxRetries: 3,
      timeoutMs: 30000,
      ...config
    };
  }
  
  /**
   * Production: Review themes from Phase 1 output using recursive bottom-up approach
   */
  async reviewThemes(themes: ConsolidatedTheme[]): Promise<ReviewResult> {
    const startTime = Date.now();
    
    logger.info('REVIEW_SERVICE', `🚀 Starting recursive review of ${themes.length} root themes`);
    
    // Process all root themes in parallel using recursion
    // Each reviewTheme call returns all reviews from that subtree
    const rootSubtrees = await Promise.all(
      themes.map(rootTheme => this.reviewTheme(rootTheme))
    );
    
    // Flatten all subtree results to get all individual node reviews
    const allNodeReviews: NodeReview[] = [];
    for (const subtree of rootSubtrees) {
      allNodeReviews.push(...subtree);
    }
    
    const overallRecommendation = this.determineOverallRecommendation(allNodeReviews);
    const summary = this.generateReviewSummary(allNodeReviews);
    const processingTime = Date.now() - startTime;
    const averageConfidence = allNodeReviews.reduce((sum, review) => sum + review.confidence, 0) / allNodeReviews.length;
    
    logger.info('REVIEW_SERVICE', `✅ Recursive review completed: ${allNodeReviews.length} themes in ${processingTime}ms with ${overallRecommendation} recommendation`);
    
    return {
      overallRecommendation,
      summary,
      nodeReviews: allNodeReviews,
      processingTime,
      metadata: {
        totalNodes: allNodeReviews.length,
        averageConfidence,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Development: Review from test-output file
   */
  async reviewFromTestOutput(filename?: string): Promise<ReviewResult> {
    logger.info('REVIEW_SERVICE', 'Loading themes from test-output for development mode');
    
    const themes = filename 
      ? TestDataLoader.loadTestOutput(filename)
      : TestDataLoader.loadLatestTestOutput();
    
    return this.reviewThemes(themes);
  }
  
  /**
   * Recursively review a theme and all its children (bottom-up)
   * Children are reviewed first, then their results inform parent review
   * Returns all reviews from this subtree (current theme + all descendants)
   */
  async reviewTheme(theme: ConsolidatedTheme): Promise<NodeReview[]> {
    const startTime = Date.now();
    logger.info('REVIEW_SERVICE', `🔄 Starting recursive review: ${theme.name} (level ${theme.level || 0})`);
    
    const allReviews: NodeReview[] = [];
    
    // Step 1: Review all children in parallel if they exist
    const childResults: NodeReview[] = [];
    if (theme.childThemes && theme.childThemes.length > 0) {
      logger.debug('REVIEW_SERVICE', `📊 Theme ${theme.name} has ${theme.childThemes.length} children - processing them first`);
      
      const childPromises = theme.childThemes.map(child => this.reviewTheme(child));
      const childSubtrees = await Promise.all(childPromises);
      
      // Flatten all child subtree results
      for (const subtree of childSubtrees) {
        allReviews.push(...subtree);
      }
      
      // Extract just the direct child reviews for context compression
      childResults.push(...childSubtrees.map(subtree => subtree[subtree.length - 1])); // Last review in each subtree is the direct child
      
      logger.debug('REVIEW_SERVICE', `✅ Completed ${allReviews.length} total reviews from children of ${theme.name}`);
    }
    
    // Step 2: Compress child context if children were reviewed
    let hierarchyContext: string;
    if (childResults.length > 0) {
      try {
        const compressedChildContext = await this.compressChildContext(childResults, theme);
        hierarchyContext = this.getHierarchyContext(theme, compressedChildContext);
        logger.debug('REVIEW_SERVICE', `🗜️ Compressed ${childResults.length} child reviews for ${theme.name}`);
      } catch (error) {
        logger.error('REVIEW_SERVICE', `❌ Failed to compress child context for ${theme.name}: ${error}`);
        throw new Error(
          `AI context compression failed for theme "${theme.name}": ${error}\n` +
          `Cannot proceed with parent review without child context compression.\n` +
          `This is an AI-first system - no fallback compression available.`
        );
      }
    } else {
      hierarchyContext = this.getHierarchyContext(theme, null);
    }
    
    // Step 3: Review current theme with hierarchy-aware context
    const nodeReview = await this.reviewSingleNodeWithContext(theme, hierarchyContext);
    allReviews.push(nodeReview);
    
    const processingTime = Date.now() - startTime;
    logger.info('REVIEW_SERVICE', `✅ Completed recursive review: ${theme.name} in ${processingTime}ms - ${allReviews.length} total reviews in subtree`);
    
    return allReviews;
  }
  
  /**
   * AI compresses child review results for parent theme review
   * NO mechanical truncation - only intelligent AI selection
   */
  private async compressChildContext(
    childResults: NodeReview[], 
    parentTheme: ConsolidatedTheme
  ): Promise<string> {
    // Extract only essential fields for parent review (complete fields, never truncated)
    const essentialChildData = childResults.map(child => ({
      nodeName: child.nodeName,
      nodeType: child.nodeType,
      riskLevel: child.findings.riskLevel,
      issues: child.findings.issues, // Complete issues array, never truncated
      confidence: child.confidence
    }));

    const prompt = `Compress these child review results for parent theme review.
  
PARENT THEME: ${parentTheme.name}
BUSINESS GOAL: ${parentTheme.businessImpact || 'Not specified'}
PARENT LEVEL: ${parentTheme.level || 0}

CHILD REVIEWS:
${JSON.stringify(essentialChildData, null, 2)}

Select and summarize most relevant information for reviewing the parent.
Focus on: integration risks, blocking issues, business alignment.
Choose complete sections, never truncate.

RESPOND WITH ONLY VALID JSON:
{
  "compressedSummary": "essential context for parent review",
  "criticalIssues": ["blocking issues only"],
  "riskAggregation": "low|medium|high|critical",
  "recommendation": "overall child consensus"
}`;

    try {
      const response = await this.claudeClient.callClaude(prompt, 'context-compression');
      const result = JsonExtractor.extractAndValidateJson(response, 'object', 
        ['compressedSummary', 'criticalIssues', 'riskAggregation', 'recommendation']);
      
      if (!result.success) {
        logger.error('REVIEW_SERVICE', `🚨 JSON extraction failed for context compression`);
        logger.error('REVIEW_SERVICE', `🚨 Original Claude response: ${response}`);
        logger.error('REVIEW_SERVICE', `🚨 Extraction error: ${result.error}`);
        throw new Error(`JSON extraction failed: ${result.error}`);
      }
      
      return JSON.stringify(result.data);
    } catch (error) {
      throw new Error(`AI context compression failed: ${error}`);
    }
  }
  
  /**
   * Generate hierarchy-aware context to help AI understand review focus
   */
  private getHierarchyContext(theme: ConsolidatedTheme, childContext: string | null): string {
    const hasChildren = theme.childThemes && theme.childThemes.length > 0;
    const depth = theme.level || 0;
    
    if (!hasChildren) {
      return `
HIERARCHY POSITION: Leaf node (depth: ${depth})
YOUR FOCUS: Implementation details, code quality, unit testing
REVIEW SCOPE: This specific code change only
${childContext ? `\nCHILD CONTEXT: None (leaf node)` : ''}`;
    }
    
    if (depth === 0) {
      return `
HIERARCHY POSITION: Root theme (${theme.childThemes!.length} direct children)
YOUR FOCUS: Business value delivery, user experience, system coherence
REVIEW SCOPE: How the entire feature works as a complete system
CHILD COMPONENTS: ${childContext}`;
    }
    
    return `
HIERARCHY POSITION: Intermediate node (depth: ${depth}, ${theme.childThemes!.length} children)
YOUR FOCUS: Component integration, data flow, architectural decisions
REVIEW SCOPE: How these components work together
CHILD COMPONENTS: ${childContext}`;
  }
  
  /**
   * Review a single theme node with hierarchy-aware context
   */
  private async reviewSingleNodeWithContext(
    theme: ConsolidatedTheme, 
    hierarchyContext: string
  ): Promise<NodeReview> {
    const startTime = Date.now();
    
    logger.debug('REVIEW_SERVICE', `🔍 Reviewing node: ${theme.name} (with hierarchy context)`);
    
    // AI-driven node type classification with hierarchy awareness
    const nodeType = await this.classifyNodeTypeWithContext(theme, hierarchyContext);
    
    // AI-driven review analysis with hierarchy context
    const findings = await this.analyzeNodeFindingsWithContext(theme, nodeType, hierarchyContext);
    
    // AI confidence in review
    const confidence = this.calculateReviewConfidence(theme, findings);
    
    const processingTime = Date.now() - startTime;
    
    logger.debug('REVIEW_SERVICE', `✅ Completed review of ${theme.name} in ${processingTime}ms`);
    
    return {
      nodeId: theme.id,
      nodeName: theme.name,
      nodeType,
      findings,
      confidence,
      processingTime
    };
  }
  
  /**
   * Review a single theme node (Week 1 strategy: basic node review)
   */
  private async reviewSingleNode(theme: ConsolidatedTheme): Promise<NodeReview> {
    const startTime = Date.now();
    
    logger.debug('REVIEW_SERVICE', `Reviewing node: ${theme.name}`);
    
    // AI-driven node type classification
    const nodeType = await this.classifyNodeType(theme);
    
    // AI-driven review analysis
    const findings = await this.analyzeNodeFindings(theme, nodeType);
    
    // AI confidence in review
    const confidence = this.calculateReviewConfidence(theme, findings);
    
    const processingTime = Date.now() - startTime;
    
    logger.debug('REVIEW_SERVICE', `Completed review of ${theme.name} in ${processingTime}ms`);
    
    return {
      nodeId: theme.id,
      nodeName: theme.name,
      nodeType,
      findings,
      confidence,
      processingTime
    };
  }
  
  /**
   * AI determines node type based on context with hierarchy awareness
   */
  private async classifyNodeTypeWithContext(theme: ConsolidatedTheme, hierarchyContext: string): Promise<NodeReview['nodeType']> {
    const prompt = `You are analyzing a code change to determine its review approach.
    
CONTEXT:
Theme: ${theme.name}
Description: ${theme.description || 'Not specified'}
Business Impact: ${theme.businessImpact || 'Not specified'}
Technical Details: ${theme.combinedTechnicalDetails || 'Not specified'}
Files: ${theme.affectedFiles?.join(', ') || 'Not specified'}
Has Code: ${theme.codeSnippets?.length > 0 ? 'Yes' : 'No'}
Child Themes: ${theme.childThemes?.length || 0}

${hierarchyContext}

TASK: Classify this change for review approach.

CLASSIFICATION RULES:
- atomic-technical: Single technical change, unit-testable, affects few files
- business-feature: Business capability change, affects user workflows
- integration-hybrid: Multiple components working together, architectural changes

RESPOND WITH ONLY VALID JSON:
{
  "nodeType": "atomic-technical|business-feature|integration-hybrid",
  "reasoning": "Why this classification was chosen",
  "confidence": 0.0-1.0
}`;

    try {
      logger.info('REVIEW_SERVICE', '🔍 ENTERING classifyNodeTypeWithContext method');
      const response = await this.claudeClient.callClaude(prompt, 'node-type-classification');
      logger.info('REVIEW_SERVICE', `🔍 Claude response for node type classification: ${response}`);
      const extractionResult = JsonExtractor.extractAndValidateJson(response, 'object', ['nodeType', 'reasoning', 'confidence']);
      
      if (!extractionResult.success) {
        logger.error('REVIEW_SERVICE', `🚨 JSON extraction failed for node type classification`);
        logger.error('REVIEW_SERVICE', `🚨 Original Claude response: ${response}`);
        logger.error('REVIEW_SERVICE', `🚨 Extraction error: ${extractionResult.error}`);
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }
      
      const parsed = extractionResult.data as NodeTypeClassification;
      
      if (!parsed.nodeType || !['atomic-technical', 'business-feature', 'integration-hybrid'].includes(parsed.nodeType)) {
        throw new Error(`Invalid node type: ${parsed.nodeType}`);
      }
      
      logger.debug('REVIEW_SERVICE', `Node type classified as: ${parsed.nodeType} (confidence: ${parsed.confidence})`);
      
      return parsed.nodeType;
    } catch (error) {
      throw new Error(
        `AI node type classification failed for theme "${theme.name}": ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }
  
  /**
   * AI determines node type based on context
   */
  private async classifyNodeType(theme: ConsolidatedTheme): Promise<NodeReview['nodeType']> {
    const prompt = `You are analyzing a code change to determine its review approach.
    
CONTEXT:
Theme: ${theme.name}
Description: ${theme.description || 'Not specified'}
Business Impact: ${theme.businessImpact || 'Not specified'}
Technical Details: ${theme.combinedTechnicalDetails || 'Not specified'}
Files: ${theme.affectedFiles?.join(', ') || 'Not specified'}
Has Code: ${theme.codeSnippets?.length > 0 ? 'Yes' : 'No'}
Child Themes: ${theme.childThemes?.length || 0}

TASK: Classify this change for review approach.

CLASSIFICATION RULES:
- atomic-technical: Single technical change, unit-testable, affects few files
- business-feature: Business capability change, affects user workflows
- integration-hybrid: Multiple components working together, architectural changes

RESPOND WITH ONLY VALID JSON:
{
  "nodeType": "atomic-technical|business-feature|integration-hybrid",
  "reasoning": "Why this classification was chosen",
  "confidence": 0.0-1.0
}`;

    try {
      logger.info('REVIEW_SERVICE', '🔍 ENTERING classifyNodeType method');
      const response = await this.claudeClient.callClaude(prompt, 'node-type-classification');
      logger.info('REVIEW_SERVICE', `🔍 Claude response for node type classification: ${response}`);
      logger.info('REVIEW_SERVICE', `🔍 Response length: ${response?.length}`);
      logger.info('REVIEW_SERVICE', `🔍 Response type: ${typeof response}`);
      const extractionResult = JsonExtractor.extractAndValidateJson(response, 'object', ['nodeType', 'reasoning', 'confidence']);
      
      if (!extractionResult.success) {
        logger.error('REVIEW_SERVICE', `🚨 JSON extraction failed for node type classification (old method)`);
        logger.error('REVIEW_SERVICE', `🚨 Original Claude response: ${response}`);
        logger.error('REVIEW_SERVICE', `🚨 Extraction error: ${extractionResult.error}`);
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }
      
      const parsed = extractionResult.data as NodeTypeClassification;
      
      if (!parsed.nodeType || !['atomic-technical', 'business-feature', 'integration-hybrid'].includes(parsed.nodeType)) {
        throw new Error(`Invalid node type: ${parsed.nodeType}`);
      }
      
      logger.debug('REVIEW_SERVICE', `Node type classified as: ${parsed.nodeType} (confidence: ${parsed.confidence})`);
      
      return parsed.nodeType;
    } catch (error) {
      throw new Error(
        `AI node type classification failed for theme "${theme.name}": ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }
  
  /**
   * AI analyzes node for review findings with hierarchy awareness
   */
  private async analyzeNodeFindingsWithContext(theme: ConsolidatedTheme, nodeType: string, hierarchyContext: string): Promise<ReviewFindings> {
    // Extract file context from existing theme data
    const fileContext = this.extractFileContext(theme);
    const enhancedCodeContext = this.buildEnhancedCodeContext(theme, fileContext);
    
    const prompt = `You are performing a code review with ${nodeType.toUpperCase()} focus.

CONTEXT:
Theme: ${theme.name}
Description: ${theme.description || 'Not specified'}
Business Impact: ${theme.businessImpact || 'Not specified'}
Node Type: ${nodeType}
Files Affected: ${theme.affectedFiles?.join(', ') || 'Not specified'}

${hierarchyContext}

CODE CHANGES:
${enhancedCodeContext}

TASK: Provide a thorough code review focusing on the node type and hierarchy position.

REVIEW FOCUS BY TYPE:
- atomic-technical: Code correctness, unit testing, logic validation
- business-feature: Business requirement validation, user impact, E2E testing
- integration-hybrid: Component integration, architectural coherence, integration testing

RESPOND WITH ONLY VALID JSON:
{
  "issues": [
    {
      "severity": "critical|major|minor|suggestion",
      "category": "logic|security|performance|style|test",
      "description": "Clear description of the issue",
      "suggestedFix": "How to fix it (optional)"
    }
  ],
  "strengths": ["What was done well"],
  "testRecommendations": ["What tests are needed"],
  "riskLevel": "low|medium|high|critical"
}`;

    try {
      logger.info('REVIEW_SERVICE', '🔍 ENTERING analyzeNodeFindingsWithContext method');
      logger.info('REVIEW_SERVICE', `🔍 Prompt size: ${prompt.length} characters`);
      logger.info('REVIEW_SERVICE', `🔍 Enhanced context size: ${enhancedCodeContext.length} characters`);
      const response = await this.claudeClient.callClaude(prompt, 'code-review-analysis');
      logger.info('REVIEW_SERVICE', `🔍 Claude response for code review analysis: ${response}`);
      const extractionResult = JsonExtractor.extractAndValidateJson(response, 'object', ['issues', 'strengths', 'testRecommendations', 'riskLevel']);
      
      if (!extractionResult.success) {
        logger.error('REVIEW_SERVICE', `🚨 JSON extraction failed for code review analysis`);
        logger.error('REVIEW_SERVICE', `🚨 Original Claude response: ${response}`);
        logger.error('REVIEW_SERVICE', `🚨 Extraction error: ${extractionResult.error}`);
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }
      
      const parsed = extractionResult.data as ReviewFindings;
      
      // Validate response structure
      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        parsed.issues = [];
      }
      if (!parsed.strengths || !Array.isArray(parsed.strengths)) {
        parsed.strengths = [];
      }
      if (!parsed.testRecommendations || !Array.isArray(parsed.testRecommendations)) {
        parsed.testRecommendations = [];
      }
      if (!parsed.riskLevel || !['low', 'medium', 'high', 'critical'].includes(parsed.riskLevel)) {
        parsed.riskLevel = 'medium';
      }
      
      logger.debug('REVIEW_SERVICE', `Found ${parsed.issues.length} issues, risk level: ${parsed.riskLevel}`);
      
      // Enrich findings with location context
      return this.enrichFindingsWithLocation(parsed, fileContext);
    } catch (error) {
      throw new Error(
        `AI node findings analysis failed for theme "${theme.name}": ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }
  
  /**
   * AI analyzes node for review findings
   */
  private async analyzeNodeFindings(theme: ConsolidatedTheme, nodeType: string): Promise<ReviewFindings> {
    // Extract file context from existing theme data
    const fileContext = this.extractFileContext(theme);
    const enhancedCodeContext = this.buildEnhancedCodeContext(theme, fileContext);
    
    const prompt = `You are performing a code review with ${nodeType.toUpperCase()} focus.

CONTEXT:
Theme: ${theme.name}
Description: ${theme.description || 'Not specified'}
Business Impact: ${theme.businessImpact || 'Not specified'}
Node Type: ${nodeType}
Files Affected: ${theme.affectedFiles?.join(', ') || 'Not specified'}

CODE CHANGES:
${enhancedCodeContext}

TASK: Provide a thorough code review focusing on the node type.

REVIEW FOCUS BY TYPE:
- atomic-technical: Code correctness, unit testing, logic validation
- business-feature: Business requirement validation, user impact, E2E testing
- integration-hybrid: Component integration, architectural coherence, integration testing

RESPOND WITH ONLY VALID JSON:
{
  "issues": [
    {
      "severity": "critical|major|minor|suggestion",
      "category": "logic|security|performance|style|test",
      "description": "Clear description of the issue",
      "suggestedFix": "How to fix it (optional)"
    }
  ],
  "strengths": ["What was done well"],
  "testRecommendations": ["What tests are needed"],
  "riskLevel": "low|medium|high|critical"
}`;

    try {
      logger.info('REVIEW_SERVICE', '🔍 ENTERING analyzeNodeFindings method');
      logger.info('REVIEW_SERVICE', `🔍 Prompt size: ${prompt.length} characters`);
      logger.info('REVIEW_SERVICE', `🔍 Enhanced context size: ${enhancedCodeContext.length} characters`);
      const response = await this.claudeClient.callClaude(prompt, 'code-review-analysis');
      logger.info('REVIEW_SERVICE', `🔍 Claude response for code review analysis: ${response}`);
      logger.info('REVIEW_SERVICE', `🔍 Response length: ${response?.length}`);
      logger.info('REVIEW_SERVICE', `🔍 Response type: ${typeof response}`);
      const extractionResult = JsonExtractor.extractAndValidateJson(response, 'object', ['issues', 'strengths', 'testRecommendations', 'riskLevel']);
      
      if (!extractionResult.success) {
        logger.error('REVIEW_SERVICE', `🚨 JSON extraction failed for code review analysis (old method)`);
        logger.error('REVIEW_SERVICE', `🚨 Original Claude response: ${response}`);
        logger.error('REVIEW_SERVICE', `🚨 Extraction error: ${extractionResult.error}`);
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }
      
      const parsed = extractionResult.data as ReviewFindings;
      
      // Validate response structure
      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        parsed.issues = [];
      }
      if (!parsed.strengths || !Array.isArray(parsed.strengths)) {
        parsed.strengths = [];
      }
      if (!parsed.testRecommendations || !Array.isArray(parsed.testRecommendations)) {
        parsed.testRecommendations = [];
      }
      if (!parsed.riskLevel || !['low', 'medium', 'high', 'critical'].includes(parsed.riskLevel)) {
        parsed.riskLevel = 'medium';
      }
      
      logger.debug('REVIEW_SERVICE', `Found ${parsed.issues.length} issues, risk level: ${parsed.riskLevel}`);
      
      // Enrich findings with location context
      return this.enrichFindingsWithLocation(parsed, fileContext);
    } catch (error) {
      throw new Error(
        `AI node findings analysis failed for theme "${theme.name}": ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }
  
  /**
   * Calculate review confidence based on available context
   */
  private calculateReviewConfidence(theme: ConsolidatedTheme, findings: ReviewFindings): number {
    let confidence = 0.5; // Base confidence
    
    // More confidence with code snippets
    if (theme.codeSnippets?.length > 0) confidence += 0.2;
    
    // More confidence with business context
    if (theme.businessImpact) confidence += 0.1;
    
    // More confidence with technical details
    if (theme.combinedTechnicalDetails) confidence += 0.1;
    
    // More confidence with file context
    if (theme.affectedFiles?.length > 0) confidence += 0.1;
    
    // Less confidence with high risk (uncertainty)
    if (findings.riskLevel === 'critical') confidence -= 0.2;
    if (findings.riskLevel === 'high') confidence -= 0.1;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }
  
  /**
   * Determine overall recommendation from node reviews
   */
  private determineOverallRecommendation(nodeReviews: NodeReview[]): ReviewResult['overallRecommendation'] {
    const criticalIssues = nodeReviews.some(review => 
      review.findings.issues.some(issue => issue.severity === 'critical')
    );
    
    const majorIssues = nodeReviews.filter(review => 
      review.findings.issues.some(issue => issue.severity === 'major')
    ).length;
    
    const highRiskNodes = nodeReviews.filter(review => 
      review.findings.riskLevel === 'critical' || review.findings.riskLevel === 'high'
    ).length;
    
    const lowConfidenceNodes = nodeReviews.filter(review => 
      review.confidence < 0.3
    ).length;
    
    if (criticalIssues || highRiskNodes > 0) {
      return 'request-changes';
    }
    
    if (majorIssues > 2 || lowConfidenceNodes > nodeReviews.length / 2) {
      return 'needs-discussion';
    }
    
    return 'approve';
  }
  
  /**
   * Generate human-readable review summary
   */
  private generateReviewSummary(nodeReviews: NodeReview[]): string {
    const totalIssues = nodeReviews.reduce((sum, review) => sum + review.findings.issues.length, 0);
    const criticalIssues = nodeReviews.reduce((sum, review) => 
      sum + review.findings.issues.filter(issue => issue.severity === 'critical').length, 0
    );
    const majorIssues = nodeReviews.reduce((sum, review) => 
      sum + review.findings.issues.filter(issue => issue.severity === 'major').length, 0
    );
    const minorIssues = nodeReviews.reduce((sum, review) => 
      sum + review.findings.issues.filter(issue => issue.severity === 'minor').length, 0
    );
    
    const avgConfidence = nodeReviews.reduce((sum, review) => sum + review.confidence, 0) / nodeReviews.length;
    
    const nodeTypes = nodeReviews.reduce((counts, review) => {
      counts[review.nodeType] = (counts[review.nodeType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    const typesSummary = Object.entries(nodeTypes)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    
    return `Reviewed ${nodeReviews.length} changes (${typesSummary}). Found ${totalIssues} issues: ${criticalIssues} critical, ${majorIssues} major, ${minorIssues} minor. Average confidence: ${(avgConfidence * 100).toFixed(1)}%`;
  }

  /**
   * Extract file context from theme data
   */
  private extractFileContext(theme: ConsolidatedTheme): FileContextMap {
    return {
      files: theme.affectedFiles || [],
      codeExamples: theme.codeExamples || [],
      functions: theme.mainFunctionsChanged || [],
      classes: theme.mainClassesChanged || [],
      diffHunks: this.extractDiffHunks(theme)
    };
  }

  /**
   * Build enhanced code context with file/function information
   */
  private buildEnhancedCodeContext(theme: ConsolidatedTheme, fileContext: FileContextMap): string {
    const sections: string[] = [];
    
    // Basic code snippets
    if (theme.codeSnippets?.length > 0) {
      sections.push('=== CODE SNIPPETS ===');
      sections.push(theme.codeSnippets.join('\n\n'));
    }
    
    // File-specific code examples with context
    if (fileContext.codeExamples.length > 0) {
      sections.push('\n=== FILE-SPECIFIC CHANGES ===');
      fileContext.codeExamples.forEach(example => {
        sections.push(`\n📁 File: ${example.file}`);
        sections.push(`Description: ${example.description}`);
        sections.push('```');
        sections.push(example.snippet);
        sections.push('```');
      });
    }
    
    // Functions/classes context
    if (fileContext.functions.length > 0 || fileContext.classes.length > 0) {
      sections.push('\n=== AFFECTED COMPONENTS ===');
      if (fileContext.functions.length > 0) {
        sections.push(`Functions: ${fileContext.functions.join(', ')}`);
      }
      if (fileContext.classes.length > 0) {
        sections.push(`Classes: ${fileContext.classes.join(', ')}`);
      }
    }
    
    return sections.length > 0 ? sections.join('\n') : 'No code snippets available';
  }

  /**
   * Extract diff hunks with line numbers from theme data
   */
  private extractDiffHunks(theme: ConsolidatedTheme): DiffHunkInfo[] {
    const diffHunks: DiffHunkInfo[] = [];
    
    // Extract from theme's codeSnippets that contain diff format
    theme.codeSnippets?.forEach(snippet => {
      const hunkMatches = snippet.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@.*$/gm);
      if (hunkMatches) {
        hunkMatches.forEach(match => {
          const lineMatch = match.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
          if (lineMatch) {
            const [, oldStart, newStart] = lineMatch;
            diffHunks.push({
              oldLineStart: parseInt(oldStart, 10),
              newLineStart: parseInt(newStart, 10),
              content: snippet,
              filePath: this.extractFileFromDiff(snippet)
            });
          }
        });
      }
    });
    
    return diffHunks;
  }

  /**
   * Extract file path from diff content
   */
  private extractFileFromDiff(diffContent: string): string | undefined {
    const fileMatch = diffContent.match(/^[\+\-]{3}\s+(.+)$/m);
    return fileMatch ? fileMatch[1].replace(/^[ab]\//, '') : undefined;
  }

  /**
   * Enrich findings with location context
   */
  private enrichFindingsWithLocation(findings: ReviewFindings, fileContext: FileContextMap): ReviewFindings {
    return {
      ...findings,
      issues: findings.issues.map(issue => ({
        ...issue,
        locationContext: this.mapIssueToLocation(issue, fileContext)
      }))
    };
  }

  /**
   * Map issue to specific file location
   */
  private mapIssueToLocation(issue: any, fileContext: FileContextMap): any {
    // Try to match issue description to specific file/function context
    const issueText = issue.description.toLowerCase();
    
    // Find matching file
    let filePath = fileContext.files[0]; // Default to first file
    for (const file of fileContext.files) {
      const fileName = file.split('/').pop()?.toLowerCase() || '';
      if (issueText.includes(fileName.replace('.ts', '').replace('.js', ''))) {
        filePath = file;
        break;
      }
    }
    
    // Find matching function
    let functionName: string | undefined;
    for (const func of fileContext.functions) {
      if (issueText.includes(func.toLowerCase())) {
        functionName = func;
        break;
      }
    }
    
    // Find matching class
    let className: string | undefined;
    for (const cls of fileContext.classes) {
      if (issueText.includes(cls.toLowerCase())) {
        className = cls;
        break;
      }
    }
    
    // Find matching code example
    let codeSnippet: string | undefined;
    for (const example of fileContext.codeExamples) {
      if (example.file === filePath) {
        codeSnippet = example.snippet;
        break;
      }
    }
    
    // Estimate line number from diff hunks
    let lineNumber: number | undefined;
    if (filePath) {
      const relevantHunk = fileContext.diffHunks.find(hunk => 
        hunk.filePath === filePath || 
        filePath.endsWith(hunk.filePath || '')
      );
      if (relevantHunk) {
        lineNumber = relevantHunk.newLineStart;
      }
    }
    
    return filePath ? {
      filePath,
      functionName,
      className,
      lineNumber,
      codeSnippet
    } : undefined;
  }
}