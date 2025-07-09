import { Theme } from '@/shared/types/theme-types';
import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import * as exec from '@actions/exec';
import { SecureFileNamer } from '../utils/secure-file-namer';
import { NamingStrategy } from '../utils/business-prompt-templates';

export interface ChangeComplexityAnalysis {
  complexity: 'simple' | 'moderate' | 'complex';
  confidence: number;
  reasoning: string;
  recommendedApproach: 'technical-specific' | 'hybrid' | 'business-focused';
}

export class ThemeNamingService {
  async generateMergedThemeNameAndDescription(
    themes: Theme[]
  ): Promise<{ name: string; description: string }> {
    const complexity = this.assessChangeComplexity(themes);
    const prompt = this.buildComplexityAwareMergedThemeNamingPrompt(themes, complexity);
    return this.executeMergedThemeNaming(prompt);
  }

  private async executeMergedThemeNaming(
    prompt: string
  ): Promise<{ name: string; description: string }> {
    try {
      const { filePath: tempFile, cleanup } =
        SecureFileNamer.createSecureTempFile('claude-naming', prompt);

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

        const result = this.parseMergedThemeNamingResponse(output);

        // Validate the generated name
        if (this.isValidThemeName(result.name)) {
          return result;
        } else {
          return {
            name: 'Merged Changes',
            description: 'Consolidated related changes',
          };
        }
      } finally {
        cleanup(); // Ensure file is cleaned up even if execution fails
      }
    } catch (error) {
      return {
        name: 'Merged Changes',
        description: 'Consolidated related changes',
      };
    }
  }

  createParentTheme(
    domain: string,
    children: ConsolidatedTheme[]
  ): ConsolidatedTheme {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;
    const sourceThemes: string[] = [];

    children.forEach((child) => {
      child.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...child.codeSnippets);
      totalConfidence += child.confidence;
      sourceThemes.push(...child.sourceThemes);
    });

    return {
      id: SecureFileNamer.generateSecureId('parent'),
      name: domain,
      description: `Consolidated theme for ${children.length} related changes: ${children.map((c) => c.name).join(', ')}`,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / children.length,
      businessImpact: `Umbrella theme covering ${children.length} related changes in ${domain.toLowerCase()}`,
      codeSnippets: allSnippets, // Include all snippets
      context: children.map((c) => c.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes,
      consolidationMethod: 'hierarchy',
    };
  }

  generateMergedThemeNameWithContext(
    themes: Theme[],
    enhancedContext?: { codeChanges?: CodeChange[]; contextSummary?: string }
  ): Promise<{ name: string; description: string }> {
    const complexity = this.assessChangeComplexityWithContext(themes, enhancedContext);
    const prompt = this.buildEnhancedComplexityAwareMergedThemeNamingPrompt(
      themes,
      enhancedContext,
      complexity
    );
    return this.executeMergedThemeNaming(prompt);
  }

  generateMergedThemeNameWithContextLegacy(
    themes: Theme[],
    enhancedContext?: { codeChanges?: CodeChange[]; contextSummary?: string }
  ): Promise<{ name: string; description: string }> {
    // Build enhanced context if available
    let codeContext = '';
    if (
      enhancedContext?.codeChanges &&
      enhancedContext.codeChanges.length > 0
    ) {
      const changes = enhancedContext.codeChanges;
      codeContext = `\nACTUAL CODE CHANGES:\n`;
      codeContext += `- Files: ${changes.length} files affected\n`;
      codeContext += `- Types: ${[...new Set(changes.map((c) => c.fileType))].join(', ')}\n`;

      const functions = changes.flatMap((c) => c.functionsChanged);
      if (functions.length > 0) {
        codeContext += `- Functions added/modified: ${functions.slice(0, 5).join(', ')}${functions.length > 5 ? '...' : ''}\n`;
      }

      const imports = changes.flatMap((c) => c.importsChanged);
      if (imports.length > 0) {
        codeContext += `- Dependencies: ${imports.slice(0, 3).join(', ')}${imports.length > 3 ? '...' : ''}\n`;
      }

      if (enhancedContext?.contextSummary) {
        codeContext += `- Summary: ${enhancedContext.contextSummary}\n`;
      }
    }

    const prompt = this.buildEnhancedMergedThemeNamingPrompt(
      themes,
      codeContext
    );
    return this.executeMergedThemeNaming(prompt);
  }

  private buildMergedThemeNamingPrompt(themes: Theme[]): string {
    const themeDetails = themes
      .map(
        (theme) =>
          `"${theme.name}": ${theme.description} (confidence: ${theme.confidence}, files: ${theme.affectedFiles.join(', ')})`
      )
      .join('\n');

    return `You are a product manager analyzing related code changes to create a USER-FOCUSED theme name.

These ${themes.length} themes have been identified as similar and will be consolidated:

${themeDetails}

Create a unified theme name focused on USER VALUE and BUSINESS IMPACT, not technical implementation. Ask:
- What user experience is being improved by these changes collectively?
- What business capability is being enhanced/added/removed?
- What problem do these changes solve for end users?
- Think like a product manager explaining value to users

Good examples:
- "Remove demo functionality" (not "Delete greeting parameters")
- "Improve code review automation" (not "Add AI services")
- "Streamline configuration" (not "Update workflow files")
- "Add pull request feedback" (not "Implement commenting system")

The name should be:
- User/business-focused (what value does this provide?)
- Concise (2-5 words)
- Descriptive of the user benefit, not technical implementation
- Focused on outcomes, not code changes

Respond in this exact JSON format (no other text):
{
  "name": "Remove Authentication Scaffolding",
  "description": "Removes demo authentication components and related scaffolding code that are no longer needed"
}`;
  }

  private buildEnhancedMergedThemeNamingPrompt(
    themes: Theme[],
    codeContext: string
  ): string {
    const themeDetails = themes
      .map(
        (theme) =>
          `"${theme.name}": ${theme.description} (confidence: ${theme.confidence}, files: ${theme.affectedFiles?.join(', ') || 'unknown'})`
      )
      .join('\n');

    return `You are a product manager analyzing related code changes to create a USER-FOCUSED theme name.

These ${themes.length} themes have been identified as similar and will be consolidated:

${themeDetails}
${codeContext}

Create a unified theme name focused on USER VALUE and BUSINESS IMPACT, not technical implementation. Use the actual code changes above to understand what's really happening.

Ask:
- What user experience is being improved by these specific code changes?
- What business capability is being enhanced/added/removed?
- What problem do these changes solve for end users?
- Think like a product manager explaining value to users

Good examples:
- "Remove demo functionality" (not "Delete greeting parameters")
- "Improve code review automation" (not "Add AI services")
- "Streamline configuration" (not "Update workflow files")
- "Add pull request feedback" (not "Implement commenting system")

The name should be:
- User/business-focused (what value does this provide?)
- Concise (2-5 words)
- Descriptive of the user benefit, not technical implementation
- Focused on outcomes, not code changes

Respond in this exact JSON format (no other text):
{
  "name": "Remove Authentication Scaffolding",
  "description": "Removes demo authentication components and related scaffolding code that are no longer needed"
}`;
  }

  private parseMergedThemeNamingResponse(output: string): {
    name: string;
    description: string;
  } {
    const extractionResult = JsonExtractor.extractAndValidateJson(
      output,
      'object',
      ['name', 'description']
    );

    if (extractionResult.success) {
      const parsed = extractionResult.data as {
        name?: string;
        description?: string;
      };
      return {
        name: parsed.name || 'Merged Changes',
        description: parsed.description || 'Consolidated related changes',
      };
    }

    return {
      name: 'Merged Changes',
      description: 'Consolidated related changes',
    };
  }

  private isValidThemeName(name: string): boolean {
    return (
      name.length >= 3 &&
      name.length <= 50 &&
      !name.toLowerCase().includes('error') &&
      !name.toLowerCase().includes('failed') &&
      name.trim() === name
    );
  }

  private createFallbackMergedThemeName(themes: Theme[]): {
    name: string;
    description: string;
  } {
    const leadTheme = themes[0];
    return {
      name: leadTheme.name,
      description: `Consolidated: ${themes.map((t) => t.name).join(', ')}`,
    };
  }

  /**
   * Assess change complexity for naming strategy
   */
  private assessChangeComplexity(themes: Theme[]): ChangeComplexityAnalysis {
    // Simple: Single theme, basic technical changes
    if (themes.length === 1) {
      const theme = themes[0];
      const files = theme.affectedFiles || [];
      const isSimple = files.length <= 2 && this.isSimpleTechnicalPattern(theme.name, theme.description);
      
      if (isSimple) {
        return {
          complexity: 'simple',
          confidence: 0.9,
          reasoning: 'Single theme with simple technical change',
          recommendedApproach: 'technical-specific'
        };
      }
    }
    
    // Complex: Multiple themes or business features
    if (themes.length >= 3 || this.hasBusinessFeaturePatterns(themes)) {
      return {
        complexity: 'complex',
        confidence: 0.8,
        reasoning: 'Multiple themes or business feature detected',
        recommendedApproach: 'business-focused'
      };
    }
    
    // Moderate: Default middle ground
    return {
      complexity: 'moderate',
      confidence: 0.7,
      reasoning: 'Moderate complexity change requiring hybrid approach',
      recommendedApproach: 'hybrid'
    };
  }

  /**
   * Assess complexity with enhanced context
   */
  private assessChangeComplexityWithContext(
    themes: Theme[],
    enhancedContext?: { codeChanges?: CodeChange[]; contextSummary?: string }
  ): ChangeComplexityAnalysis {
    const baseComplexity = this.assessChangeComplexity(themes);
    
    if (!enhancedContext?.contextSummary) {
      return baseComplexity;
    }
    
    const contextText = enhancedContext.contextSummary.toLowerCase();
    
    // Simple technical patterns in context
    const simplePatterns = [
      /replaced console\.warn with/,
      /add.*import/,
      /logger.*service/,
      /structured logging/,
      /fix.*typo/,
      /update.*comment/
    ];
    
    if (simplePatterns.some(pattern => pattern.test(contextText))) {
      return {
        complexity: 'simple',
        confidence: 0.95,
        reasoning: 'Simple technical change pattern detected in context',
        recommendedApproach: 'technical-specific'
      };
    }
    
    return baseComplexity;
  }

  /**
   * Check for simple technical patterns
   */
  private isSimpleTechnicalPattern(name: string, description: string): boolean {
    const text = (name + ' ' + description).toLowerCase();
    const patterns = [
      /console\.warn/,
      /logger/,
      /import/,
      /logging/,
      /replace.*with/,
      /add.*import/,
      /fix.*typo/,
      /update.*comment/
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Check for business feature patterns
   */
  private hasBusinessFeaturePatterns(themes: Theme[]): boolean {
    const allText = themes.map(t => t.name + ' ' + t.description).join(' ').toLowerCase();
    const patterns = [
      /authentication/,
      /authorization/,
      /user.*flow/,
      /business.*logic/,
      /workflow/,
      /onboarding/,
      /payment/,
      /checkout/
    ];
    
    return patterns.some(pattern => pattern.test(allText));
  }

  /**
   * Build complexity-aware merged theme naming prompt
   */
  private buildComplexityAwareMergedThemeNamingPrompt(
    themes: Theme[],
    complexity: ChangeComplexityAnalysis
  ): string {
    const themeDetails = themes
      .map(
        (theme) =>
          `"${theme.name}": ${theme.description} (confidence: ${theme.confidence}, files: ${theme.affectedFiles.join(', ')})`
      )
      .join('\n');

    const namingGuidelines = this.getNamingGuidelines(complexity);

    return `You are analyzing related code changes with ${complexity.recommendedApproach.toUpperCase()} naming approach.

COMPLEXITY: ${complexity.complexity.toUpperCase()} (${complexity.confidence} confidence)
REASONING: ${complexity.reasoning}
APPROACH: ${complexity.recommendedApproach}

These ${themes.length} themes will be consolidated:

${themeDetails}

${namingGuidelines.instructions}

Examples for ${complexity.complexity} changes:
${namingGuidelines.examples.map(ex => `- ${ex}`).join('\n')}

Respond in this exact JSON format (no other text):
{
  "name": "${namingGuidelines.namePrompt}",
  "description": "${namingGuidelines.descriptionPrompt}"
}`;
  }

  /**
   * Build enhanced complexity-aware prompt with context
   */
  private buildEnhancedComplexityAwareMergedThemeNamingPrompt(
    themes: Theme[],
    enhancedContext?: { codeChanges?: CodeChange[]; contextSummary?: string },
    complexity?: ChangeComplexityAnalysis
  ): string {
    if (!complexity) {
      complexity = this.assessChangeComplexityWithContext(themes, enhancedContext);
    }

    const themeDetails = themes
      .map(
        (theme) =>
          `"${theme.name}": ${theme.description} (confidence: ${theme.confidence}, files: ${theme.affectedFiles?.join(', ') || 'unknown'})`
      )
      .join('\n');

    // Build enhanced context if available
    let codeContext = '';
    if (
      enhancedContext?.codeChanges &&
      enhancedContext.codeChanges.length > 0
    ) {
      const changes = enhancedContext.codeChanges;
      codeContext = `\nACTUAL CODE CHANGES:\n`;
      codeContext += `- Files: ${changes.length} files affected\n`;
      codeContext += `- Types: ${[...new Set(changes.map((c) => c.fileType))].join(', ')}\n`;

      const functions = changes.flatMap((c) => c.functionsChanged);
      if (functions.length > 0) {
        codeContext += `- Functions added/modified: ${functions.slice(0, 5).join(', ')}${functions.length > 5 ? '...' : ''}\n`;
      }

      const imports = changes.flatMap((c) => c.importsChanged);
      if (imports.length > 0) {
        codeContext += `- Dependencies: ${imports.slice(0, 3).join(', ')}${imports.length > 3 ? '...' : ''}\n`;
      }

      if (enhancedContext?.contextSummary) {
        codeContext += `- Summary: ${enhancedContext.contextSummary}\n`;
      }
    }

    const namingGuidelines = this.getNamingGuidelines(complexity);

    return `You are analyzing related code changes with ${complexity.recommendedApproach.toUpperCase()} naming approach.

COMPLEXITY: ${complexity.complexity.toUpperCase()} (${complexity.confidence} confidence)
REASONING: ${complexity.reasoning}
APPROACH: ${complexity.recommendedApproach}

These ${themes.length} themes will be consolidated:

${themeDetails}
${codeContext}

${namingGuidelines.instructions}

Examples for ${complexity.complexity} changes:
${namingGuidelines.examples.map(ex => `- ${ex}`).join('\n')}

Respond in this exact JSON format (no other text):
{
  "name": "${namingGuidelines.namePrompt}",
  "description": "${namingGuidelines.descriptionPrompt}"
}`;
  }

  /**
   * Get naming guidelines based on complexity
   */
  private getNamingGuidelines(complexity: ChangeComplexityAnalysis) {
    const guidelines = {
      simple: {
        instructions: `TECHNICAL-SPECIFIC NAMING GUIDELINES:
- Describe the specific technical action taken (max 12 words)
- Use precise technical terms that clarify what changed
- Mention specific functions, methods, or patterns modified
- Focus on WHAT changed, not just WHY
- Example: "Replace console.warn with structured logger calls"`,
        examples: [
          '"Replace console.warn with logger.warn calls"',
          '"Add LoggerServices import for centralized logging"',
          '"Update error handling to use structured logging"'
        ],
        namePrompt: 'Specific technical action description (max 12 words)',
        descriptionPrompt: 'Detailed explanation of technical change made'
      },
      complex: {
        instructions: `BUSINESS-FOCUSED NAMING GUIDELINES:
- Focus on user value and business capability (max 8 words)
- Use business language avoiding technical implementation details
- Emphasize business outcomes and user benefits
- Think from product manager perspective explaining to executives
- Example: "Enhance User Authentication Security"`,
        examples: [
          '"Enable Secure User Authentication"',
          '"Streamline Customer Onboarding Process"',
          '"Improve Error Resolution Workflow"'
        ],
        namePrompt: 'Business capability or user value created (max 8 words)',
        descriptionPrompt: 'Business value and user benefit explanation'
      },
      moderate: {
        instructions: `HYBRID NAMING GUIDELINES:
- Balance technical specificity with business context (max 10 words)
- Include both technical action and business value
- Use technical terms when they add clarity
- Connect technical change to business outcome
- Example: "Implement Structured Logging for Better Error Diagnosis"`,
        examples: [
          '"Implement Structured Logging for Error Diagnosis"',
          '"Add OAuth2 Integration for User Security"',
          '"Enhance API Validation for Data Integrity"'
        ],
        namePrompt: 'Technical change with business context (max 10 words)',
        descriptionPrompt: 'Technical change explanation with business value'
      }
    };
    
    return guidelines[complexity.complexity] || guidelines.moderate;
  }
}