import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '../utils/ai-code-analyzer';
import * as exec from '@actions/exec';
import { ConcurrencyManager } from '../utils/concurrency-manager';
import { SecureFileNamer } from '../utils/secure-file-namer';

export class BusinessDomainService {
  async groupByBusinessDomain(
    themes: ConsolidatedTheme[]
  ): Promise<Map<string, ConsolidatedTheme[]>> {
    const domains = new Map<string, ConsolidatedTheme[]>();

    console.log(
      `[DOMAIN] Extracting business domains for ${themes.length} themes`
    );

    // Extract domains concurrently
    const results = await ConcurrencyManager.processConcurrentlyWithLimit(
      themes,
      async (theme) => ({
        theme,
        domain: await this.extractBusinessDomain(theme.name, theme.description),
      }),
      {
        concurrencyLimit: 5, // Lower limit for domain extraction
        maxRetries: 3,
        enableLogging: true,
        onProgress: (completed, total) => {
          console.log(
            `[DOMAIN] Domain extraction progress: ${completed}/${total} themes`
          );
        },
        onError: (error, theme, retryCount) => {
          console.warn(
            `[DOMAIN] Retry ${retryCount} for theme "${theme.name}": ${error.message}`
          );
        },
      }
    );

    // Group results by domain
    for (const result of results) {
      if (result && typeof result === 'object' && 'error' in result) {
        // Use fallback domain for failed extractions
        const fallbackDomain = this.extractBusinessDomainFallback(
          result.item.name,
          result.item.description
        );
        console.warn(
          `[DOMAIN] Using fallback domain "${fallbackDomain}" for "${result.item.name}"`
        );

        if (!domains.has(fallbackDomain)) {
          domains.set(fallbackDomain, []);
        }
        domains.get(fallbackDomain)!.push(result.item);
      } else {
        const { theme, domain } = result;
        console.log(`[DOMAIN] Theme "${theme.name}" → Domain "${domain}"`);

        if (!domains.has(domain)) {
          domains.set(domain, []);
        }
        domains.get(domain)!.push(theme);
      }
    }

    return domains;
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
    console.log(`[AI-DOMAIN] Stage 1 failed for "${name}", trying Stage 2`);
    const stage2Result = await this.tryDomainExtraction(
      name,
      prompt,
      'Stage 2 (Detailed)'
    );

    if (stage2Result && this.isValidDomainName(stage2Result)) {
      return stage2Result;
    }

    // Stage 3: Enhanced fallback using AI response keywords
    console.warn(
      `[AI-DOMAIN] Both stages failed for "${name}", using enhanced fallback`
    );
    return this.extractBusinessDomainEnhancedFallback(
      name,
      description || '',
      stage1Result || stage2Result || ''
    );
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
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString();
            },
          },
        });

        const domain = this.parseDomainExtractionResponse(output);
        console.log(`[AI-DOMAIN] ${stage} result for "${name}": "${domain}"`);

        return domain;
      } finally {
        cleanup();
      }
    } catch (error) {
      console.warn(`[AI-DOMAIN] ${stage} extraction failed:`, error);
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
      console.log(
        `[AI-DOMAIN] Extracted domain from response: "${extractedDomain}"`
      );
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

  private extractBusinessDomainFallback(
    name: string,
    description: string
  ): string {
    return this.extractBusinessDomainEnhancedFallback(name, description, '');
  }

  private extractBusinessDomainEnhancedFallback(
    name: string,
    description: string,
    aiResponse: string
  ): string {
    const text = (name + ' ' + description + ' ' + aiResponse).toLowerCase();

    // Error and failure handling (new categories)
    if (
      text.includes('error') ||
      text.includes('exception') ||
      text.includes('failure')
    ) {
      if (text.includes('build') || text.includes('compile')) {
        return 'Fix Build Errors';
      }
      if (
        text.includes('auth') ||
        text.includes('login') ||
        text.includes('permission')
      ) {
        return 'Handle Failed Auth';
      }
      if (
        text.includes('api') ||
        text.includes('request') ||
        text.includes('response')
      ) {
        return 'Debug API Failures';
      }
      if (text.includes('test') || text.includes('validation')) {
        return 'Fix Failed Tests';
      }
      if (text.includes('payment') || text.includes('transaction')) {
        return 'Handle Failed Payments';
      }
      if (text.includes('sync') || text.includes('data')) {
        return 'Resolve Sync Errors';
      }
      return 'Fix User Issues';
    }

    // Original categories with improved keywords
    if (
      text.includes('greeting') ||
      text.includes('demo') ||
      text.includes('scaffolding') ||
      text.includes('example') ||
      text.includes('placeholder')
    ) {
      return 'Remove Demo Content';
    }
    if (
      text.includes('review') ||
      text.includes('analysis') ||
      text.includes('feedback') ||
      text.includes('mindmap') ||
      text.includes('visualization')
    ) {
      return 'Improve Code Review';
    }
    if (
      text.includes('workflow') ||
      text.includes('action') ||
      text.includes('automation') ||
      text.includes('pipeline') ||
      text.includes('ci/cd')
    ) {
      return 'Streamline Development';
    }
    if (
      text.includes('config') ||
      text.includes('setup') ||
      text.includes('install') ||
      text.includes('environment')
    ) {
      return 'Simplify Configuration';
    }
    if (
      text.includes('comment') ||
      text.includes('pr') ||
      text.includes('pull request') ||
      text.includes('feedback')
    ) {
      return 'Add User Feedback';
    }
    if (
      text.includes('test') ||
      text.includes('validation') ||
      text.includes('quality') ||
      text.includes('coverage')
    ) {
      return 'Enhance Automation';
    }
    if (
      text.includes('documentation') ||
      text.includes('readme') ||
      text.includes('guide') ||
      text.includes('docs')
    ) {
      return 'Improve Documentation';
    }
    if (
      text.includes('performance') ||
      text.includes('speed') ||
      text.includes('optimization') ||
      text.includes('cache')
    ) {
      return 'Optimize Performance';
    }
    if (
      text.includes('integration') ||
      text.includes('api') ||
      text.includes('service') ||
      text.includes('webhook')
    ) {
      return 'Enable Integrations';
    }
    if (
      text.includes('interface') ||
      text.includes('ui') ||
      text.includes('user') ||
      text.includes('frontend')
    ) {
      return 'Modernize Interface';
    }
    if (
      text.includes('remove') ||
      text.includes('delete') ||
      text.includes('cleanup') ||
      text.includes('legacy') ||
      text.includes('deprecated')
    ) {
      return 'Clean Up Legacy';
    }
    if (
      text.includes('fix') ||
      text.includes('bug') ||
      text.includes('issue') ||
      text.includes('problem')
    ) {
      return 'Fix User Issues';
    }
    if (
      text.includes('debug') ||
      text.includes('troubleshoot') ||
      text.includes('investigate')
    ) {
      return 'Debug API Failures';
    }

    return 'General Improvements';
  }
}
