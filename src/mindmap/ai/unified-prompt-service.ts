import { ClaudeClient } from '@/shared/utils/claude-client';
import { PromptTemplates } from '../utils/prompt-templates';
import { OptimizedPromptTemplates } from './optimized-prompt-templates';
import {
  PromptType,
  PromptResponse,
  FallbackStrategy,
  PromptMetrics,
} from './prompt-types';
import {
  PromptConfig,
  ResponseSchemas,
  CacheTTLConfig,
  TemperatureConfig,
} from './prompt-config';
import { ResponseValidator } from './response-validator';
import { AIResponseCache } from './cache/ai-response-cache';

/**
 * Unified service for all AI prompt interactions
 * Centralizes prompt execution, caching, error handling, and monitoring
 */
export class UnifiedPromptService {
  private static instance: UnifiedPromptService;
  private claudeClient: ClaudeClient;
  private promptTemplates: OptimizedPromptTemplates;
  private cache: AIResponseCache;
  private metrics: Map<PromptType, PromptMetrics> = new Map();
  private useOptimizedPrompts: boolean = true;
  private apiKey: string;

  private constructor(anthropicApiKey: string) {
    this.apiKey = anthropicApiKey;
    this.claudeClient = new ClaudeClient(anthropicApiKey);
    this.promptTemplates = new OptimizedPromptTemplates();
    this.cache = AIResponseCache.getInstance();
    this.initializeMetrics();
  }

  static getInstance(anthropicApiKey: string): UnifiedPromptService {
    if (!UnifiedPromptService.instance) {
      UnifiedPromptService.instance = new UnifiedPromptService(anthropicApiKey);
    }
    return UnifiedPromptService.instance;
  }

  /**
   * Execute a prompt with automatic validation, caching, and error handling
   */
  async execute<T>(
    promptType: PromptType,
    variables: Record<string, any>,
    config?: Partial<PromptConfig>
  ): Promise<PromptResponse<T>> {
    const startTime = Date.now();
    const promptConfig = this.getPromptConfig(promptType, config);

    // Check cache first
    const cachedResponse = this.cache.get<T>(promptType, variables);
    if (cachedResponse) {
      // Update metrics for cache hit
      this.updateMetrics(promptType, true, Date.now() - startTime, true);
      return cachedResponse;
    }

    try {
      // Build the prompt
      const prompt = this.buildPrompt(promptType, variables, promptConfig);

      // Execute the prompt
      const rawResponse = await this.executeWithRetry(
        prompt,
        promptConfig.maxRetries || 3
      );

      // Validate the response
      const validationResult = ResponseValidator.validate<T>(
        rawResponse,
        promptType
      );

      if (!validationResult.success) {
        // Handle validation failure based on fallback strategy
        return this.handleValidationFailure<T>(
          promptType,
          validationResult.error || 'Validation failed',
          promptConfig.fallbackStrategy,
          variables
        );
      }

      // Create response object
      const response: PromptResponse<T> = {
        success: true,
        data: validationResult.data,
        confidence: this.extractConfidence(validationResult.data),
        tokensUsed: this.estimateTokens(prompt + rawResponse),
        cached: false,
      };

      // Cache the successful response
      this.cache.set(promptType, variables, response);

      // Update metrics
      this.updateMetrics(promptType, true, Date.now() - startTime, false);

      return response;
    } catch (error) {
      // Update metrics
      this.updateMetrics(promptType, false, Date.now() - startTime, false);

      // Handle execution error based on fallback strategy
      return this.handleExecutionError<T>(
        promptType,
        error,
        promptConfig.fallbackStrategy,
        variables
      );
    }
  }

  /**
   * Execute multiple prompts in a batch
   * This now delegates to the advanced batch processor for supported types
   */
  async executeBatch<T>(
    promptType: PromptType,
    batchVariables: Array<Record<string, any>>,
    config?: Partial<PromptConfig>
  ): Promise<Array<PromptResponse<T>>> {
    // Import dynamically to avoid circular dependency
    const { BatchProcessor } = await import('./batch/batch-processor');
    const { BatchStrategyFactory } = await import('./batch/batch-strategies');

    // Check if this prompt type supports advanced batching
    if (BatchStrategyFactory.canBatch(promptType)) {
      const batchProcessor = BatchProcessor.getInstance(this.apiKey);

      // Use advanced batch processor
      const items = batchVariables.map((variables, index) => ({
        variables,
        priority: 0, // Default priority
      }));

      return batchProcessor.addBatch<T>(promptType, items);
    }

    // Fallback to simple batching for unsupported types with parallel cache optimization
    const batchSize = this.getOptimalBatchSize(promptType);
    const results: Array<PromptResponse<T>> = [];

    // Process in batches with parallel cache lookups
    for (let i = 0; i < batchVariables.length; i += batchSize) {
      const batch = batchVariables.slice(i, i + batchSize);

      // Check cache for entire batch in parallel
      const cachedResults = this.cache.getBatch<T>(promptType, batch);

      // Identify uncached items
      const uncachedIndices: number[] = [];
      const uncachedVariables: Record<string, any>[] = [];

      cachedResults.forEach((cached, index) => {
        if (!cached) {
          uncachedIndices.push(index);
          uncachedVariables.push(batch[index]);
        }
      });

      // Execute only uncached items
      const uncachedPromises = uncachedVariables.map((variables) =>
        this.execute<T>(promptType, variables, config)
      );

      const uncachedResults = await Promise.all(uncachedPromises);

      // Merge cached and fresh results
      const mergedResults: Array<PromptResponse<T>> = cachedResults.map(
        (cached, index) => {
          if (cached) {
            return cached;
          } else {
            const uncachedIndex = uncachedIndices.indexOf(index);
            return uncachedResults[uncachedIndex];
          }
        }
      );

      results.push(...mergedResults);
    }

    return results;
  }

  /**
   * Build prompt based on type and variables
   */
  private buildPrompt(
    promptType: PromptType,
    variables: Record<string, any>,
    config: PromptConfig
  ): string {
    // Get base template
    const template = this.getPromptTemplate(promptType);

    // Use optimized prompt building if enabled
    if (this.useOptimizedPrompts) {
      return this.promptTemplates.createEfficientPrompt(
        template,
        variables,
        config.maxTokens || 3000
      );
    }

    // Original prompt building logic
    let prompt = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Add examples if provided
    if (config.examples && config.examples.length > 0) {
      prompt += '\n\nExamples:\n';
      config.examples.forEach((example, index) => {
        prompt += `\nExample ${index + 1}:\nInput: ${example.input}\nOutput: ${example.output}\n`;
        if (example.explanation) {
          prompt += `Explanation: ${example.explanation}\n`;
        }
      });
    }

    // Add response format instruction
    prompt +=
      '\n\nIMPORTANT: Respond with ONLY valid JSON starting with { or [';

    return prompt;
  }

  /**
   * Get prompt template based on type
   */
  private getPromptTemplate(promptType: PromptType): string {
    // Use optimized templates if enabled
    if (this.useOptimizedPrompts) {
      return this.promptTemplates.getOptimizedTemplate(promptType);
    }

    // Fallback to original templates
    const templates: Record<PromptType, string> = {
      [PromptType.CODE_ANALYSIS]: `Analyze this code change and extract structural information:

File: {{filename}}
Change Type: {{changeType}}
Language: {{language}}

Code Diff:
{{diffContent}}

Extract the following information as JSON. Be accurate and specific:
- functionsChanged: All function/method names that were added/modified/removed
- classesChanged: Classes, interfaces, types, enums that were added/modified/removed
- importsChanged: Import/dependency changes (module names only)
- fileType: File extension
- isTestFile: Is this a test file?
- isConfigFile: Is this a configuration file?
- architecturalPatterns: Design patterns you can identify
- businessDomain: Business domain/feature area (one word)
- codeComplexity: low/medium/high based on complexity of changes
- semanticDescription: Brief description of what changed`,

      [PromptType.THEME_EXTRACTION]: `{{context}}

Analyze this code change. Be specific but concise.

File: {{filename}}
Code changes:
{{content}}

Focus on WHAT changed with exact details:
- Exact values changed (before → after)
- Business purpose of the changes
- User impact

Respond with JSON containing:
- themeName: what this accomplishes (max 10 words)
- description: one specific sentence with exact names/values (max 20 words)
- detailedDescription: additional context if needed (max 15 words, or null)
- businessImpact: user benefit in one sentence (max 15 words)
- technicalSummary: exact technical change (max 12 words)
- keyChanges: max 3 changes, each max 10 words
- userScenario: null
- suggestedParent: null
- confidence: 0.0-1.0
- codePattern: change type (max 3 words)`,

      [PromptType.SIMILARITY_CHECK]: `Analyze if these two themes should be merged:

Theme 1: {{theme1Name}}
Description: {{theme1Description}}
Files: {{theme1Files}}
Context: {{theme1Context}}

Theme 2: {{theme2Name}}
Description: {{theme2Description}}
Files: {{theme2Files}}
Context: {{theme2Context}}

Consider:
- Are they addressing the same feature/capability?
- Do they share significant code changes?
- Would merging provide clearer understanding?

Respond with JSON containing:
- shouldMerge: boolean
- confidence: 0.0-1.0
- reasoning: explanation
- nameScore: 0.0-1.0
- descriptionScore: 0.0-1.0
- patternScore: 0.0-1.0
- businessScore: 0.0-1.0
- semanticScore: 0.0-1.0`,

      [PromptType.THEME_EXPANSION]: `Analyze this theme for potential sub-themes:

Theme: {{themeName}}
Description: {{themeDescription}}
Files: {{affectedFiles}}
Code Context: {{codeContext}}

Identify distinct sub-concerns that could be separate themes.

Respond with JSON containing:
- shouldExpand: boolean
- confidence: 0.0-1.0
- subThemes: array of {name, description, businessValue, affectedComponents, relatedFiles}
- reasoning: explanation`,

      [PromptType.DOMAIN_EXTRACTION]: `Group these themes by business domain:

Themes:
{{themes}}

Available domains: {{availableDomains}}

Respond with JSON containing:
- domains: array of {domain, themes (array of theme names), confidence, userValue}`,

      [PromptType.THEME_NAMING]: `Generate a concise, user-focused name for this theme:

Current name: {{currentName}}
Description: {{description}}
Key changes: {{keyChanges}}
Affected files: {{affectedFiles}}

Create a name that:
- Focuses on user value, not implementation
- Is 2-5 words long
- Uses business terminology

Respond with JSON containing:
- themeName: the best name
- alternativeNames: 2-3 alternatives
- reasoning: why this name was chosen`,

      [PromptType.BATCH_SIMILARITY]: `Analyze multiple theme pairs for similarity:

{{pairs}}

For each pair, determine if they should be merged.

Respond with JSON containing:
- results: array of {pairId, shouldMerge, confidence, scores: {name, description, pattern, business, semantic}}`,

      [PromptType.CROSS_LEVEL_SIMILARITY]: `Analyze the relationship between these themes at different hierarchy levels:

Parent Theme: {{parentTheme}}
Child Theme: {{childTheme}}

Determine their relationship and recommended action.

Respond with JSON containing:
- relationship: 'parent_child' | 'duplicate' | 'none'
- confidence: 0.0-1.0
- action: 'keep_both' | 'merge_into_parent' | 'merge_into_child' | 'make_sibling'
- reasoning: explanation`,
    };

    return templates[promptType] || '';
  }

  /**
   * Execute prompt with retry logic
   */
  private async executeWithRetry(
    prompt: string,
    maxRetries: number
  ): Promise<string> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.claudeClient.callClaude(prompt, 'unified-prompt');
        return response;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Handle validation failure based on fallback strategy
   */
  private handleValidationFailure<T>(
    promptType: PromptType,
    error: string,
    fallbackStrategy?: FallbackStrategy,
    variables?: Record<string, any>
  ): PromptResponse<T> {
    const strategy = fallbackStrategy || FallbackStrategy.USE_DEFAULT;

    switch (strategy) {
      case FallbackStrategy.RETRY_SIMPLIFIED:
        console.warn(`Validation failed, using simplified retry fallback: ${error}`);
        return {
          success: false,
          error,
          data: ResponseValidator.createFallbackResponse<T>(
            promptType,
            variables
          ),
        };

      case FallbackStrategy.USE_DEFAULT:
        return {
          success: true,
          data: ResponseValidator.createFallbackResponse<T>(
            promptType,
            variables
          ),
          confidence: 0.3,
        };

      case FallbackStrategy.THROW_ERROR:
        return {
          success: false,
          error,
        };

      case FallbackStrategy.PARTIAL_RESPONSE:
        console.warn(`Validation failed, partial response not supported: ${error}`);
        return {
          success: false,
          error,
        };

      default:
        return {
          success: false,
          error,
        };
    }
  }

  /**
   * Handle execution error based on fallback strategy
   */
  private handleExecutionError<T>(
    promptType: PromptType,
    error: any,
    fallbackStrategy?: FallbackStrategy,
    variables?: Record<string, any>
  ): PromptResponse<T> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Prompt execution failed: ${errorMessage}`);

    return this.handleValidationFailure<T>(
      promptType,
      errorMessage,
      fallbackStrategy,
      variables
    );
  }

  /**
   * Get prompt configuration
   */
  private getPromptConfig(
    promptType: PromptType,
    overrides?: Partial<PromptConfig>
  ): PromptConfig {
    const schema = ResponseSchemas[promptType];
    const cacheTTL = CacheTTLConfig[promptType] || 0;
    const temperature = TemperatureConfig[promptType] || 0.3;

    return {
      type: promptType,
      template: '', // Will be filled by buildPrompt
      maxTokens: 4000,
      temperature,
      responseSchema: schema,
      cacheTTL,
      maxRetries: 3,
      fallbackStrategy: FallbackStrategy.USE_DEFAULT,
      ...overrides,
    };
  }

  /**
   * Extract confidence from response data
   */
  private extractConfidence(data: any): number {
    if (data && typeof data.confidence === 'number') {
      return data.confidence;
    }
    return 0.5;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Get optimal batch size for prompt type
   */
  private getOptimalBatchSize(promptType: PromptType): number {
    const batchSizes: Partial<Record<PromptType, number>> = {
      [PromptType.SIMILARITY_CHECK]: 10,
      [PromptType.THEME_EXPANSION]: 5,
      [PromptType.DOMAIN_EXTRACTION]: 20,
      [PromptType.BATCH_SIMILARITY]: 15,
    };

    return batchSizes[promptType] || 5;
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    for (const promptType of Object.values(PromptType)) {
      this.metrics.set(promptType as PromptType, {
        promptType: promptType as PromptType,
        executionTime: 0,
        tokenCount: 0,
        successRate: 0,
        averageConfidence: 0,
        cacheHitRate: 0,
      });
    }
  }

  /**
   * Update metrics for a prompt execution
   */
  private updateMetrics(
    promptType: PromptType,
    success: boolean,
    executionTime: number,
    cacheHit: boolean = false
  ): void {
    const metrics = this.metrics.get(promptType);
    if (!metrics) return;

    // Simple exponential moving average for metrics
    const weight = 0.1; // Weight for new data point
    metrics.executionTime =
      metrics.executionTime * (1 - weight) + executionTime * weight;
    metrics.successRate =
      metrics.successRate * (1 - weight) + (success ? 1 : 0) * weight;
    metrics.cacheHitRate =
      metrics.cacheHitRate * (1 - weight) + (cacheHit ? 1 : 0) * weight;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Map<PromptType, PromptMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get cache metrics and efficiency report
   */
  getCacheReport(): {
    metrics: any;
    efficiency: string;
    memory: { used: number; max: number; percentage: number };
  } {
    return {
      metrics: this.cache.getMetrics(),
      efficiency: this.cache.getEfficiencyReport(),
      memory: this.cache.getMemoryUsage(),
    };
  }

  /**
   * Clear cache for specific prompt type or all
   */
  clearCache(promptType?: PromptType): void {
    this.cache.clear(promptType);
  }

  /**
   * Warm cache with predicted inputs
   */
  async warmCache(
    promptType: PromptType,
    predictedInputs: Array<Record<string, any>>
  ): Promise<void> {
    await this.cache.warmCache(promptType, predictedInputs, async (inputs) =>
      this.execute(promptType, inputs)
    );
  }

  /**
   * Set maximum cache memory usage
   */
  setCacheMemoryLimit(megabytes: number): void {
    this.cache.setMaxMemoryUsage(megabytes * 1024 * 1024);
  }

  /**
   * Toggle optimized prompts
   */
  setUseOptimizedPrompts(enabled: boolean): void {
    this.useOptimizedPrompts = enabled;
  }

  /**
   * Get optimization status
   */
  isUsingOptimizedPrompts(): boolean {
    return this.useOptimizedPrompts;
  }

  /**
   * Get batch processor statistics
   */
  async getBatchStats(): Promise<Record<string, any>> {
    const { BatchProcessor } = await import('./batch/batch-processor');
    const batchProcessor = BatchProcessor.getInstance(this.apiKey);
    return batchProcessor.getQueueStats();
  }

  /**
   * Flush all batch queues
   */
  async flushBatches(): Promise<void> {
    const { BatchProcessor } = await import('./batch/batch-processor');
    const batchProcessor = BatchProcessor.getInstance(this.apiKey);
    await batchProcessor.flush();
  }
}
