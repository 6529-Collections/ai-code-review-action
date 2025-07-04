import { Theme } from '@/shared/types/theme-types';
import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import * as exec from '@actions/exec';
import { SecureFileNamer } from '../utils/secure-file-namer';

export class ThemeNamingService {
  async generateMergedThemeNameAndDescription(
    themes: Theme[]
  ): Promise<{ name: string; description: string }> {
    const prompt = this.buildMergedThemeNamingPrompt(themes);
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
        console.log(`[AI-NAMING] Generated merged theme: "${result.name}"`);

        // Validate the generated name
        if (this.isValidThemeName(result.name)) {
          return result;
        } else {
          console.warn(
            `[AI-NAMING] Generated name invalid, using fallback: "${result.name}"`
          );
          return {
            name: 'Merged Changes',
            description: 'Consolidated related changes',
          };
        }
      } finally {
        cleanup(); // Ensure file is cleaned up even if execution fails
      }
    } catch (error) {
      console.warn('AI theme naming failed:', error);
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

    console.warn(
      '[THEME-NAMING] JSON extraction failed:',
      extractionResult.error
    );
    if (extractionResult.originalResponse) {
      console.debug(
        '[THEME-NAMING] Original response:',
        extractionResult.originalResponse?.substring(0, 200) + '...'
      );
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
}
