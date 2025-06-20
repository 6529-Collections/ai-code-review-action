import { Theme } from './theme-service';
import { ConsolidatedTheme } from '../types/similarity-types';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class ThemeNamingService {
  async generateMergedThemeNameAndDescription(
    themes: Theme[]
  ): Promise<{ name: string; description: string }> {
    const prompt = this.buildMergedThemeNamingPrompt(themes);

    try {
      const tempFile = path.join(
        os.tmpdir(),
        `claude-naming-${Date.now()}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      let output = '';
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      fs.unlinkSync(tempFile);

      const result = this.parseMergedThemeNamingResponse(output);
      console.log(`[AI-NAMING] Generated merged theme: "${result.name}"`);

      // Validate the generated name
      if (this.isValidThemeName(result.name)) {
        return result;
      } else {
        console.warn(
          `[AI-NAMING] Generated name invalid, using fallback: "${result.name}"`
        );
        return this.createFallbackMergedThemeName(themes);
      }
    } catch (error) {
      console.warn('AI theme naming failed:', error);
      return this.createFallbackMergedThemeName(themes);
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
      id: `parent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: domain,
      description: `Consolidated theme for ${children.length} related changes: ${children.map((c) => c.name).join(', ')}`,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / children.length,
      businessImpact: `Umbrella theme covering ${children.length} related changes in ${domain.toLowerCase()}`,
      codeSnippets: allSnippets.slice(0, 10), // Limit snippets
      context: children.map((c) => c.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes,
      consolidationMethod: 'hierarchy',
    };
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

  private parseMergedThemeNamingResponse(output: string): {
    name: string;
    description: string;
  } {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Merged Changes',
          description: parsed.description || 'Consolidated related changes',
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI naming response:', error);
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
