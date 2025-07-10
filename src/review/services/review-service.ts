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
   * Production: Review themes from Phase 1 output
   */
  async reviewThemes(themes: ConsolidatedTheme[]): Promise<ReviewResult> {
    const startTime = Date.now();
    
    logger.info('REVIEW_SERVICE', `Starting review of ${themes.length} themes`);
    
    const nodeReviews: NodeReview[] = [];
    
    // Review each theme node
    for (const theme of themes) {
      try {
        const nodeReview = await this.reviewSingleNode(theme);
        nodeReviews.push(nodeReview);
      } catch (error) {
        logger.error('REVIEW_SERVICE', `Failed to review node ${theme.id}: ${error}`);
        
        // Create fallback review for failed nodes
        const fallbackReview: NodeReview = {
          nodeId: theme.id,
          nodeName: theme.name,
          nodeType: 'integration-hybrid',
          findings: {
            issues: [{
              severity: 'minor',
              category: 'test',
              description: 'Review failed due to processing error',
              suggestedFix: 'Manual review recommended'
            }],
            strengths: [],
            testRecommendations: ['Manual testing recommended'],
            riskLevel: 'medium'
          },
          confidence: 0.1,
          processingTime: 0
        };
        
        nodeReviews.push(fallbackReview);
      }
    }
    
    const overallRecommendation = this.determineOverallRecommendation(nodeReviews);
    const summary = this.generateReviewSummary(nodeReviews);
    const processingTime = Date.now() - startTime;
    const averageConfidence = nodeReviews.reduce((sum, review) => sum + review.confidence, 0) / nodeReviews.length;
    
    logger.info('REVIEW_SERVICE', `Review completed in ${processingTime}ms with ${overallRecommendation} recommendation`);
    
    return {
      overallRecommendation,
      summary,
      nodeReviews,
      processingTime,
      metadata: {
        totalNodes: themes.length,
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
      const response = await this.claudeClient.callClaude(prompt, 'node-type-classification');
      const extractionResult = JsonExtractor.extractJson(response);
      
      if (!extractionResult.success) {
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }
      
      const parsed = extractionResult.data as NodeTypeClassification;
      
      if (!parsed.nodeType || !['atomic-technical', 'business-feature', 'integration-hybrid'].includes(parsed.nodeType)) {
        throw new Error(`Invalid node type: ${parsed.nodeType}`);
      }
      
      logger.debug('REVIEW_SERVICE', `Node type classified as: ${parsed.nodeType} (confidence: ${parsed.confidence})`);
      
      return parsed.nodeType;
    } catch (error) {
      logger.warn('REVIEW_SERVICE', `Failed to classify node type: ${error}`);
      return 'integration-hybrid'; // Safe fallback
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
      const response = await this.claudeClient.callClaude(prompt, 'code-review-analysis');
      const extractionResult = JsonExtractor.extractJson(response);
      
      if (!extractionResult.success) {
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
      logger.warn('REVIEW_SERVICE', `Failed to analyze node findings: ${error}`);
      return {
        issues: [],
        strengths: [],
        testRecommendations: [],
        riskLevel: 'medium'
      };
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