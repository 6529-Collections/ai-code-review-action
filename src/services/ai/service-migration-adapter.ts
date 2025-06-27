import { UnifiedPromptService } from './unified-prompt-service';
import { PromptType, PromptResponse } from './prompt-types';
import { ClaudeClient } from '../../utils/claude-client';
import { JsonExtractor } from '../../utils/json-extractor';

/**
 * Adapter to help migrate existing services to use UnifiedPromptService
 * Provides compatibility layer for gradual migration
 */
export class ServiceMigrationAdapter {
  private unifiedService: UnifiedPromptService;
  private claudeClient?: ClaudeClient; // For services that need raw access

  constructor(anthropicApiKey: string) {
    this.unifiedService = UnifiedPromptService.getInstance(anthropicApiKey);
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * Migrate theme analysis calls
   */
  async analyzeTheme(
    chunk: { filename: string; content: string },
    context: string
  ): Promise<any> {
    const response = await this.unifiedService.execute(
      PromptType.THEME_EXTRACTION,
      {
        filename: chunk.filename,
        content: chunk.content,
        context,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Theme analysis failed');
    }

    return response.data;
  }

  /**
   * Migrate code analysis calls
   */
  async analyzeCode(
    filename: string,
    diffContent: string,
    changeType: string,
    language: string
  ): Promise<any> {
    const response = await this.unifiedService.execute(
      PromptType.CODE_ANALYSIS,
      {
        filename,
        diffContent,
        changeType,
        language,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Code analysis failed');
    }

    return response.data;
  }

  /**
   * Migrate similarity check calls
   */
  async checkSimilarity(
    theme1: {
      name: string;
      description: string;
      files: string[];
      context?: string;
    },
    theme2: {
      name: string;
      description: string;
      files: string[];
      context?: string;
    }
  ): Promise<any> {
    const response = await this.unifiedService.execute(
      PromptType.SIMILARITY_CHECK,
      {
        theme1Name: theme1.name,
        theme1Description: theme1.description,
        theme1Files: theme1.files.join(', '),
        theme1Context: theme1.context || '',
        theme2Name: theme2.name,
        theme2Description: theme2.description,
        theme2Files: theme2.files.join(', '),
        theme2Context: theme2.context || '',
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Similarity check failed');
    }

    return response.data;
  }

  /**
   * Migrate batch similarity calls
   */
  async batchSimilarity(
    pairs: Array<{
      id: string;
      theme1: any;
      theme2: any;
    }>
  ): Promise<any> {
    const pairsText = pairs
      .map(
        (p) =>
          `Pair ${p.id}:\nTheme 1: ${p.theme1.name} - ${p.theme1.description}\nTheme 2: ${p.theme2.name} - ${p.theme2.description}`
      )
      .join('\n\n');

    const response = await this.unifiedService.execute(
      PromptType.BATCH_SIMILARITY,
      {
        pairs: pairsText,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Batch similarity check failed');
    }

    return response.data;
  }

  /**
   * Migrate theme expansion calls
   */
  async expandTheme(theme: {
    name: string;
    description: string;
    affectedFiles: string[];
    codeContext?: string;
  }): Promise<any> {
    const response = await this.unifiedService.execute(
      PromptType.THEME_EXPANSION,
      {
        themeName: theme.name,
        themeDescription: theme.description,
        affectedFiles: theme.affectedFiles.join(', '),
        codeContext: theme.codeContext || '',
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Theme expansion failed');
    }

    return response.data;
  }

  /**
   * Migrate domain extraction calls
   */
  async extractDomains(
    themes: Array<{ name: string; description: string }>,
    availableDomains: string[]
  ): Promise<any> {
    const themesText = themes
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    const response = await this.unifiedService.execute(
      PromptType.DOMAIN_EXTRACTION,
      {
        themes: themesText,
        availableDomains: availableDomains.join(', '),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Domain extraction failed');
    }

    return response.data;
  }

  /**
   * Migrate theme naming calls
   */
  async generateThemeName(theme: {
    currentName: string;
    description: string;
    keyChanges?: string[];
    affectedFiles?: string[];
  }): Promise<any> {
    const response = await this.unifiedService.execute(
      PromptType.THEME_NAMING,
      {
        currentName: theme.currentName,
        description: theme.description,
        keyChanges: theme.keyChanges?.join(', ') || '',
        affectedFiles: theme.affectedFiles?.slice(0, 5).join(', ') || '',
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Theme naming failed');
    }

    return response.data;
  }

  /**
   * Migrate cross-level similarity calls
   */
  async checkCrossLevelSimilarity(
    parentTheme: { name: string; description: string },
    childTheme: { name: string; description: string }
  ): Promise<any> {
    const response = await this.unifiedService.execute(
      PromptType.CROSS_LEVEL_SIMILARITY,
      {
        parentTheme: `${parentTheme.name}: ${parentTheme.description}`,
        childTheme: `${childTheme.name}: ${childTheme.description}`,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Cross-level similarity check failed');
    }

    return response.data;
  }

  /**
   * Get cache report for monitoring
   */
  getCacheReport() {
    return this.unifiedService.getCacheReport();
  }

  /**
   * Clear cache
   */
  clearCache(promptType?: PromptType) {
    this.unifiedService.clearCache(promptType);
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(
    promptType: PromptType,
    commonInputs: Array<Record<string, any>>
  ): Promise<void> {
    await this.unifiedService.warmCache(promptType, commonInputs);
  }

  /**
   * Legacy method for services that need raw Claude access
   * @deprecated Use unified methods instead
   */
  async callClaudeDirect(prompt: string): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude client not initialized');
    }
    return this.claudeClient.callClaude(prompt);
  }

  /**
   * Legacy JSON extraction for migration
   * @deprecated Use unified response validation
   */
  extractJson(response: string, requiredFields?: string[]): any {
    const result = JsonExtractor.extractAndValidateJson(
      response,
      'object',
      requiredFields
    );

    if (!result.success) {
      throw new Error(`JSON extraction failed: ${result.error}`);
    }

    return result.data;
  }
}
