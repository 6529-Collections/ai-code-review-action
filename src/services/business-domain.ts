import { ConsolidatedTheme } from '../types/similarity-types';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class BusinessDomainService {
  async groupByBusinessDomain(
    themes: ConsolidatedTheme[]
  ): Promise<Map<string, ConsolidatedTheme[]>> {
    const domains = new Map<string, ConsolidatedTheme[]>();

    for (const theme of themes) {
      const domain = await this.extractBusinessDomain(
        theme.name,
        theme.description
      );
      console.log(`[DOMAIN] Theme "${theme.name}" → Domain "${domain}"`);

      if (!domains.has(domain)) {
        domains.set(domain, []);
      }
      domains.get(domain)!.push(theme);
    }

    return domains;
  }

  async extractBusinessDomain(
    name: string,
    description: string
  ): Promise<string> {
    const prompt = this.buildDomainExtractionPrompt(name, description);

    try {
      const tempFile = path.join(
        os.tmpdir(),
        `claude-domain-${Date.now()}.txt`
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

      const domain = this.parseDomainExtractionResponse(output);
      console.log(`[AI-DOMAIN] Generated domain for "${name}": "${domain}"`);

      // Validate the generated domain
      if (this.isValidDomainName(domain)) {
        return domain;
      } else {
        console.warn(
          `[AI-DOMAIN] Generated domain invalid, using fallback: "${domain}"`
        );
        return this.extractBusinessDomainFallback(name, description);
      }
    } catch (error) {
      console.warn('AI domain extraction failed:', error);
      return this.extractBusinessDomainFallback(name, description);
    }
  }

  private buildDomainExtractionPrompt(
    name: string,
    description: string
  ): string {
    return `You are a product manager categorizing code changes by their USER VALUE and BUSINESS IMPACT (not technical implementation).

Theme Name: "${name}"
Description: "${description}"

Focus on the end-user or business outcome, not the technical details. Ask:
- What user experience is being improved?
- What business capability is being added/enhanced/removed?
- What problem does this solve for end users?
- What workflow or process is being streamlined?

Choose from these USER-FOCUSED domains or create a similar category:
- Remove Demo/Scaffolding Content
- Improve Code Review Experience  
- Streamline Development Workflow
- Enhance Automation Capabilities
- Simplify Configuration & Setup
- Add User Feedback Features
- Clean Up Legacy Code
- Improve Documentation & Onboarding
- Fix User-Facing Issues
- Optimize Performance for Users
- Enable New Integrations
- Modernize User Interface

Think like a product manager explaining value to users, not a developer describing implementation.

Respond with just the user-focused domain name (2-5 words, no extra text):`;
  }

  private parseDomainExtractionResponse(output: string): string {
    // Clean up the response - take first line, trim whitespace, remove quotes
    const lines = output.trim().split('\n');
    const domain = lines[0].trim().replace(/^["']|["']$/g, '');

    return domain || 'General Changes';
  }

  private isValidDomainName(domain: string): boolean {
    return (
      domain.length >= 3 &&
      domain.length <= 30 &&
      !domain.toLowerCase().includes('error') &&
      !domain.toLowerCase().includes('failed') &&
      domain.trim() === domain
    );
  }

  private extractBusinessDomainFallback(
    name: string,
    description: string
  ): string {
    const text = (name + ' ' + description).toLowerCase();

    // User-focused domain keywords (fallback)
    if (
      text.includes('greeting') ||
      text.includes('demo') ||
      text.includes('scaffolding') ||
      text.includes('example')
    ) {
      return 'Remove Demo/Scaffolding Content';
    }
    if (
      text.includes('review') ||
      text.includes('analysis') ||
      text.includes('feedback')
    ) {
      return 'Improve Code Review Experience';
    }
    if (
      text.includes('workflow') ||
      text.includes('action') ||
      text.includes('automation')
    ) {
      return 'Streamline Development Workflow';
    }
    if (
      text.includes('config') ||
      text.includes('setup') ||
      text.includes('install')
    ) {
      return 'Simplify Configuration & Setup';
    }
    if (
      text.includes('comment') ||
      text.includes('pr') ||
      text.includes('pull request')
    ) {
      return 'Add User Feedback Features';
    }
    if (
      text.includes('test') ||
      text.includes('validation') ||
      text.includes('quality')
    ) {
      return 'Enhance Automation Capabilities';
    }
    if (
      text.includes('documentation') ||
      text.includes('readme') ||
      text.includes('guide')
    ) {
      return 'Improve Documentation & Onboarding';
    }
    if (
      text.includes('performance') ||
      text.includes('speed') ||
      text.includes('optimization')
    ) {
      return 'Optimize Performance for Users';
    }
    if (
      text.includes('integration') ||
      text.includes('api') ||
      text.includes('service')
    ) {
      return 'Enable New Integrations';
    }
    if (
      text.includes('interface') ||
      text.includes('ui') ||
      text.includes('user')
    ) {
      return 'Modernize User Interface';
    }
    if (
      text.includes('remove') ||
      text.includes('delete') ||
      text.includes('cleanup')
    ) {
      return 'Clean Up Legacy Code';
    }
    if (
      text.includes('fix') ||
      text.includes('bug') ||
      text.includes('error')
    ) {
      return 'Fix User-Facing Issues';
    }

    return 'General Improvements';
  }
}
