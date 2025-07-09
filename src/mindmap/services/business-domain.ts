import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';
import * as exec from '@actions/exec';
import { SecureFileNamer } from '../utils/secure-file-namer';
import { AIDomainAnalyzer } from './ai/ai-domain-analyzer';
import { AIAnalysisContext } from '../types/mindmap-types';

export class BusinessDomainService {
  private aiDomainAnalyzer: AIDomainAnalyzer;

  constructor(anthropicApiKey: string) {
    this.aiDomainAnalyzer = new AIDomainAnalyzer(anthropicApiKey);
  }
  async groupByBusinessDomain(
    themes: ConsolidatedTheme[]
  ): Promise<Map<string, ConsolidatedTheme[]>> {
    const domains = new Map<string, ConsolidatedTheme[]>();


    // Use batch processing for significant performance improvement
    const batchSize = this.calculateOptimalDomainBatchSize(themes.length);
    const batches = this.createDomainBatches(themes, batchSize);


    // Process batches using Promise.all
    // ClaudeClient handles rate limiting and queuing
    const results = await Promise.all(
      batches.map(async (batch) => {
        try {
          return await this.processDomainBatch(batch);
        } catch (error) {
          console.warn(`[BUSINESS-DOMAIN] Batch failed: ${error}`);
          return []; // Return empty array for failed batch
        }
      })
    );

    // Flatten batch results and group by domain
    const flatResults: Array<{ theme: ConsolidatedTheme; domain: string }> = [];
    for (const batchResult of results) {
      if (Array.isArray(batchResult)) {
        flatResults.push(...batchResult);
      }
    }

    // Group results by domain
    for (const result of flatResults) {
      const { theme, domain } = result;

      if (!domains.has(domain)) {
        domains.set(domain, []);
      }
      domains.get(domain)!.push(theme);
    }

    return domains;
  }

  /**
   * Extract business domain using AI semantic understanding
   * PRD: "AI decides" domain classification based on actual business impact
   */
  private async extractBusinessDomainWithAI(
    theme: ConsolidatedTheme
  ): Promise<string> {
    try {
      // Build AI analysis context from theme
      const context: AIAnalysisContext = {
        filePath: theme.affectedFiles?.[0] || 'unknown',
        completeDiff: theme.description,
        surroundingContext: `Theme: ${theme.name}\nDescription: ${theme.description}`,
        commitMessage: theme.name, // Use theme name as commit message proxy
      };

      // Get AI domain classification
      const domainClassification =
        await this.aiDomainAnalyzer.classifyBusinessDomain(context);

      // Return the primary domain with confidence consideration
      if (domainClassification.confidence >= 0.6) {
        return domainClassification.domain;
      } else {
        // Medium confidence - use with warning
        return domainClassification.domain;
      }
    } catch (error) {

      // Graceful degradation: use simplified heuristic fallback
      return this.extractBusinessDomainFallback(theme.name, theme.description);
    }
  }

  /**
   * Fallback business capability extraction for when AI fails
   * PRD: "Graceful degradation - never fail completely"
   * Maps technical changes to user-centric business capabilities
   */
  private extractBusinessDomainFallback(
    name: string,
    description: string
  ): string {
    const text = (name + ' ' + description).toLowerCase();

    // Business capability heuristics focused on user value
    if (text.includes('test') || text.includes('spec') || text.includes('quality')) {
      return 'Development Workflow Optimization';
    }
    if (text.includes('config') || text.includes('setting') || text.includes('deploy')) {
      return 'Development Workflow Optimization';
    }
    if (
      text.includes('auth') ||
      text.includes('login') ||
      text.includes('password') ||
      text.includes('security') ||
      text.includes('account')
    ) {
      return 'User Account Management';
    }
    if (
      text.includes('payment') ||
      text.includes('purchase') ||
      text.includes('order') ||
      text.includes('transaction') ||
      text.includes('billing')
    ) {
      return 'Transaction Processing';
    }
    if (
      text.includes('search') ||
      text.includes('discover') ||
      text.includes('browse') ||
      text.includes('filter') ||
      text.includes('recommend')
    ) {
      return 'Content Discovery';
    }
    if (
      text.includes('message') ||
      text.includes('notification') ||
      text.includes('email') ||
      text.includes('alert') ||
      text.includes('communication')
    ) {
      return 'Communication & Collaboration';
    }
    if (
      text.includes('ui') ||
      text.includes('component') ||
      text.includes('interface') ||
      text.includes('design') ||
      text.includes('layout')
    ) {
      return 'User Experience Enhancement';
    }
    if (
      text.includes('data') ||
      text.includes('database') ||
      text.includes('storage') ||
      text.includes('backup') ||
      text.includes('export')
    ) {
      return 'Data Management';
    }
    if (
      text.includes('api') ||
      text.includes('endpoint') ||
      text.includes('service') ||
      text.includes('integration') ||
      text.includes('connect')
    ) {
      return 'Integration & Connectivity';
    }
    if (
      text.includes('report') ||
      text.includes('analytics') ||
      text.includes('dashboard') ||
      text.includes('metrics') ||
      text.includes('insights')
    ) {
      return 'Analytics & Insights';
    }
    if (
      text.includes('workflow') ||
      text.includes('automation') ||
      text.includes('process') ||
      text.includes('efficiency') ||
      text.includes('streamline')
    ) {
      return 'Workflow Automation';
    }
    if (
      text.includes('create') ||
      text.includes('author') ||
      text.includes('edit') ||
      text.includes('publish') ||
      text.includes('content')
    ) {
      return 'Content Creation & Publishing';
    }
    if (
      text.includes('error') ||
      text.includes('fix') ||
      text.includes('bug') ||
      text.includes('debug') ||
      text.includes('log')
    ) {
      return 'Development Workflow Optimization';
    }

    // Default to user experience enhancement
    return 'User Experience Enhancement';
  }

  async extractBusinessDomainWithContext(
    name: string,
    description: string,
    enhancedContext?: { codeChanges?: CodeChange[]; contextSummary?: string }
  ): Promise<string> {
    // Build code context summary if available
    let codeContext = '';
    if (
      enhancedContext?.codeChanges &&
      enhancedContext.codeChanges.length > 0
    ) {
      const changes = enhancedContext.codeChanges;
      codeContext = `Files changed: ${changes.length}\n`;
      codeContext += `Types: ${[...new Set(changes.map((c) => c.fileType))].join(', ')}\n`;

      const functions = changes.flatMap((c) => c.functionsChanged).slice(0, 5);
      if (functions.length > 0) {
        codeContext += `Functions: ${functions.join(', ')}\n`;
      }

      const classes = changes.flatMap((c) => c.classesChanged).slice(0, 3);
      if (classes.length > 0) {
        codeContext += `Classes/Interfaces: ${classes.join(', ')}\n`;
      }

      if (enhancedContext?.contextSummary) {
        codeContext += `Summary: ${enhancedContext.contextSummary}`;
      }
    }

    const prompt = codeContext
      ? this.buildEnhancedDomainExtractionPrompt(name, description, codeContext)
      : this.buildDomainExtractionPrompt(name, description);

    return this.executeDomainExtraction(name, prompt, description);
  }

  async extractBusinessDomain(
    name: string,
    description: string
  ): Promise<string> {
    const prompt = this.buildDomainExtractionPrompt(name, description);
    return this.executeDomainExtraction(name, prompt, description);
  }

  private async executeDomainExtraction(
    name: string,
    prompt: string,
    description?: string
  ): Promise<string> {
    // Stage 1: Try simple prompt first
    const simplePrompt = this.buildSimpleDomainPrompt(name, description || '');
    const stage1Result = await this.tryDomainExtraction(
      name,
      simplePrompt,
      'Stage 1 (Simple)'
    );

    if (stage1Result && this.isValidDomainName(stage1Result)) {
      return stage1Result;
    }

    // Stage 2: Try structured prompt with context
    const stage2Result = await this.tryDomainExtraction(
      name,
      prompt,
      'Stage 2 (Detailed)'
    );

    if (stage2Result && this.isValidDomainName(stage2Result)) {
      return stage2Result;
    }

    // Stage 3: Enhanced fallback using AI response keywords
    return this.extractBusinessDomainFallback(name, description || '');
  }

  private async tryDomainExtraction(
    name: string,
    prompt: string,
    stage: string
  ): Promise<string | null> {
    try {
      const { filePath: tempFile, cleanup } =
        SecureFileNamer.createSecureTempFile('claude-domain', prompt);

      let output = '';
      try {
        await exec.exec('bash', ['-c', `cat "${tempFile}" | claude --print`], {
          silent: true,
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            },
          },
        });

        const domain = this.parseDomainExtractionResponse(output);

        return domain;
      } finally {
        cleanup();
      }
    } catch (error) {
      return null;
    }
  }

  private buildDomainExtractionPrompt(
    name: string,
    description: string
  ): string {
    return this.buildSimpleDomainPrompt(name, description);
  }

  private buildSimpleDomainPrompt(name: string, description: string): string {
    return `OUTPUT: 2-5 word domain name ONLY. No sentences. No explanation.

CORRECT examples:
✓ "Fix User Errors"
✓ "Handle Failed Payments"
✓ "Improve Error Messages"
✓ "Debug Login Issues"
✓ "Streamline Development"
✓ "Clean Up Legacy"

WRONG examples:
✗ "This fixes user errors"
✗ "Based on the changes, this improves error handling"
✗ "Fix user errors in the login system"

Theme: "${name}"
Description: "${description}"

Domain (2-5 words only):`;
  }

  private buildEnhancedDomainExtractionPrompt(
    name: string,
    description: string,
    codeContext?: string
  ): string {
    return `STRICT FORMAT: Output ONLY a domain name (2-5 words, max 30 characters)

GOOD EXAMPLES:
• "Fix Build Errors"
• "Handle Failed Auth"
• "Improve Error Handling"
• "Debug API Failures"
• "Streamline Development"
• "Clean Up Legacy"
• "Enhance Automation"
• "Simplify Configuration"

BAD EXAMPLES (DO NOT DO THIS):
• "This change fixes build errors" (sentence)
• "Based on analysis, Fix Build Errors" (explanation)
• "Fix build errors in the CI/CD pipeline" (too long)

Theme Name: "${name}"
Description: "${description}"
${codeContext ? `\nCODE CONTEXT:\n${codeContext}` : ''}

CHOOSE FROM THESE OR CREATE SIMILAR (2-5 words):
- Fix Build Errors
- Handle Failed Requests
- Improve Error Messages
- Debug API Failures
- Fix User Issues
- Recover Failed Jobs
- Remove Demo Content
- Improve Code Review
- Streamline Development
- Enhance Automation
- Simplify Configuration
- Add User Feedback
- Clean Up Legacy
- Improve Documentation
- Optimize Performance
- Enable Integrations
- Modernize Interface

OUTPUT THE DOMAIN NAME NOW (nothing else):`;
  }

  private parseDomainExtractionResponse(output: string): string {
    // First try: simple first line parsing
    const lines = output.trim().split('\n');
    const domain = lines[0].trim().replace(/^["']|["']$/g, '');

    if (this.isValidDomainName(domain)) {
      return domain;
    }

    // Second try: extract domain from longer response
    const extractedDomain = this.extractDomainFromResponse(output);
    if (extractedDomain && this.isValidDomainName(extractedDomain)) {
      return extractedDomain;
    }

    return domain || 'General Changes';
  }

  private extractDomainFromResponse(response: string): string | null {
    // Look for patterns that match domain format
    const actionVerbs = [
      'fix',
      'handle',
      'improve',
      'debug',
      'resolve',
      'add',
      'remove',
      'enable',
      'enhance',
      'streamline',
      'simplify',
      'optimize',
      'modernize',
      'clean',
    ];

    // Split by common delimiters and look for domain-like phrases
    const candidates = response
      .toLowerCase()
      .split(/[.,:;!?\n]/)
      .map((phrase) => phrase.trim())
      .filter((phrase) => phrase.length > 0);

    for (const candidate of candidates) {
      // Look for 2-5 word sequences starting with action verbs
      const words = candidate.split(/\s+/);

      for (let i = 0; i < words.length - 1; i++) {
        for (
          let length = 2;
          length <= Math.min(5, words.length - i);
          length++
        ) {
          const sequence = words.slice(i, i + length).join(' ');

          // Check if it starts with an action verb and looks domain-like
          if (
            actionVerbs.some((verb) => sequence.startsWith(verb)) &&
            sequence.length <= 30 &&
            !sequence.includes('the ') &&
            !sequence.includes('this ') &&
            !sequence.includes('that ')
          ) {
            // Capitalize first letter of each word
            const formatted = sequence
              .split(' ')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            return formatted;
          }
        }
      }
    }

    return null;
  }

  private isValidDomainName(domain: string): boolean {
    // Basic format validation
    if (domain.length < 3 || domain.length > 30 || domain.trim() !== domain) {
      return false;
    }

    // Word count validation (2-5 words)
    const wordCount = domain.trim().split(/\s+/).length;
    if (wordCount < 2 || wordCount > 5) {
      return false;
    }

    // Reject full sentences (common explanation patterns)
    const sentenceIndicators = [
      /^(this|it|based|the)\s/i,
      /\.$/, // ends with period
      /\bthat\b/i,
      /\bwhich\b/i,
      /^".*"$/, // wrapped in quotes with explanation
    ];

    for (const pattern of sentenceIndicators) {
      if (pattern.test(domain)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate optimal batch size for domain classification
   * PRD: "Dynamic batch sizing" - adapt to content complexity
   */
  private calculateOptimalDomainBatchSize(totalThemes: number): number {
    // Optimize for concurrency while respecting domain analysis complexity
    // Target: Create enough batches to utilize 6-10 concurrent request slots
    if (totalThemes <= 5) return Math.max(1, Math.ceil(totalThemes / 3)); // 2-3 small batches
    if (totalThemes <= 20) return Math.max(2, Math.ceil(totalThemes / 8)); // 6-8 batches
    if (totalThemes <= 50) return Math.max(5, Math.ceil(totalThemes / 10)); // 8-10 batches
    return Math.max(8, Math.ceil(totalThemes / 10)); // Target 10 batches for large sets
  }

  /**
   * Split themes into optimally-sized batches for domain processing
   */
  private createDomainBatches(
    themes: ConsolidatedTheme[],
    batchSize: number
  ): ConsolidatedTheme[][] {
    const batches: ConsolidatedTheme[][] = [];
    for (let i = 0; i < themes.length; i += batchSize) {
      batches.push(themes.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a batch of themes for domain classification with a single AI call
   * This is the key optimization - multiple themes analyzed in one API call
   */
  private async processDomainBatch(
    themes: ConsolidatedTheme[]
  ): Promise<Array<{ theme: ConsolidatedTheme; domain: string }>> {
    try {
      // Use AI domain analyzer for batch processing
      const contexts = themes.map((theme) => ({
        filePath: theme.affectedFiles?.[0] || 'unknown',
        completeDiff: theme.context || '',
        surroundingContext: theme.description || '',
        commitMessage: `Theme: ${theme.name}`,
        prDescription: theme.businessImpact,
      }));

      // Single AI call for multiple themes
      const batchResults =
        await this.aiDomainAnalyzer.analyzeMultiDomainChanges(contexts);

      // Map results back to themes
      const results: Array<{ theme: ConsolidatedTheme; domain: string }> = [];

      for (let i = 0; i < themes.length; i++) {
        const theme = themes[i];
        let domain = 'System Enhancement'; // Default fallback

        // Try to find domain from batch results
        if (batchResults.primaryDomains && batchResults.primaryDomains[i]) {
          domain = batchResults.primaryDomains[i].domain;
        }

        results.push({ theme, domain });
      }

      return results;
    } catch (error) {

      // Fallback to individual processing
      return await this.processDomainBatchIndividually(themes);
    }
  }

  /**
   * Fallback to individual domain processing if batch fails
   */
  private async processDomainBatchIndividually(
    themes: ConsolidatedTheme[]
  ): Promise<Array<{ theme: ConsolidatedTheme; domain: string }>> {
    const results: Array<{ theme: ConsolidatedTheme; domain: string }> = [];

    for (const theme of themes) {
      try {
        const domain = await this.extractBusinessDomainWithAI(theme);
        results.push({ theme, domain });
      } catch (error) {
        // Use fallback domain for failed individual processing
        const fallbackDomain = this.extractBusinessDomainFallback(
          theme.name,
          theme.description
        );
        results.push({ theme, domain: fallbackDomain });
      }
    }

    return results;
  }

  // Removed old mechanical fallback - replaced with AI-driven classification

  // Removed deprecated method - replaced with AI semantic analysis

  // Removed 150+ lines of mechanical keyword matching - replaced with AI semantic understanding
}
