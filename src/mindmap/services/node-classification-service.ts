import { ConsolidatedTheme } from '../types/similarity-types';
import { Theme } from '@/shared/types/theme-types';
import { NodeTypeClassification } from '@/review/types/review-types';
import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logger } from '@/shared/logger/logger';
import { NodeClassificationPrompts } from '../utils/node-classification-prompts';

export interface ClassificationResult {
  nodeType: 'atomic-technical' | 'business-feature' | 'integration-hybrid';
  confidence: number;
  reasoning: string;
}

export interface ClassificationMetrics {
  totalClassified: number;
  classificationCounts: Record<string, number>;
  averageConfidence: number;
  processingTime: number;
}

export class NodeClassificationService {
  private claudeClient: ClaudeClient;
  private promptTemplates: NodeClassificationPrompts;

  constructor(anthropicApiKey?: string) {
    // Use provided API key or get from environment
    const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for NodeClassificationService');
    }
    this.claudeClient = new ClaudeClient(apiKey);
    this.promptTemplates = new NodeClassificationPrompts();
  }

  /**
   * Classify a single theme node
   */
  async classifyTheme(theme: Theme): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.promptTemplates.buildClassificationPrompt(theme);
      
      logger.debug('NODE_CLASSIFICATION', `Classifying theme: ${theme.name}`);
      
      const response = await this.claudeClient.callClaude(
        prompt, 
        'node-classification',
        `classify-theme-${theme.id}`
      );
      
      const extractionResult = JsonExtractor.extractJson(response);
      
      if (!extractionResult.success) {
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }
      
      const parsed = extractionResult.data as NodeTypeClassification;
      
      if (!this.isValidNodeType(parsed.nodeType)) {
        throw new Error(`Invalid node type: ${parsed.nodeType}`);
      }
      
      const result: ClassificationResult = {
        nodeType: parsed.nodeType,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'No reasoning provided'
      };
      
      const processingTime = Date.now() - startTime;
      
      logger.debug('NODE_CLASSIFICATION', 
        `Theme ${theme.name} classified as ${result.nodeType} (confidence: ${result.confidence}, time: ${processingTime}ms)`
      );
      
      return result;
      
    } catch (error) {
      logger.error('NODE_CLASSIFICATION', `Classification failed for theme ${theme.name}: ${error}`);
      
      // Fallback classification based on simple heuristics
      return this.fallbackClassification(theme);
    }
  }

  /**
   * Classify multiple themes in batch
   */
  async classifyThemes(themes: Theme[]): Promise<Map<string, ClassificationResult>> {
    const startTime = Date.now();
    const results = new Map<string, ClassificationResult>();
    
    logger.info('NODE_CLASSIFICATION', `Starting classification of ${themes.length} themes`);
    
    // Process themes in batches to avoid overwhelming the API
    const batchSize = 3;
    const batches = this.createBatches(themes, batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      logger.debug('NODE_CLASSIFICATION', `Processing batch ${i + 1}/${batches.length} (${batch.length} themes)`);
      
      const batchPromises = batch.map(theme => 
        this.classifyTheme(theme).then(result => ({ themeId: theme.id, result }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          const { themeId, result } = promiseResult.value;
          results.set(themeId, result);
        } else {
          logger.error('NODE_CLASSIFICATION', `Batch classification failed: ${promiseResult.reason}`);
        }
      }
    }
    
    const processingTime = Date.now() - startTime;
    const metrics = this.calculateMetrics(results, processingTime);
    
    logger.info('NODE_CLASSIFICATION', 
      `Classification complete: ${results.size}/${themes.length} themes classified in ${processingTime}ms`
    );
    
    this.logMetrics(metrics);
    
    return results;
  }

  /**
   * Apply classification results to consolidated themes
   */
  async applyClassificationToThemes(
    themes: ConsolidatedTheme[], 
    classifications: Map<string, ClassificationResult>
  ): Promise<ConsolidatedTheme[]> {
    return themes.map(theme => {
      // For consolidated themes, check if we have classification from any source theme
      let classification: ClassificationResult | undefined;
      
      // Try to find classification from source themes
      for (const sourceThemeId of theme.sourceThemes || []) {
        const sourceClassification = classifications.get(sourceThemeId);
        if (sourceClassification) {
          classification = sourceClassification;
          break;
        }
      }
      
      // If no classification found, classify the consolidated theme itself
      if (!classification) {
        logger.debug('NODE_CLASSIFICATION', 
          `No source classification found for ${theme.name}, using fallback`
        );
        classification = this.fallbackClassificationForConsolidated(theme);
      }
      
      return {
        ...theme,
        nodeType: classification.nodeType,
        classificationConfidence: classification.confidence,
        classificationReasoning: classification.reasoning
      };
    });
  }

  /**
   * Validate node type
   */
  private isValidNodeType(nodeType: string): nodeType is 'atomic-technical' | 'business-feature' | 'integration-hybrid' {
    return ['atomic-technical', 'business-feature', 'integration-hybrid'].includes(nodeType);
  }

  /**
   * Fallback classification for when AI fails
   */
  private fallbackClassification(theme: Theme): ClassificationResult {
    logger.debug('NODE_CLASSIFICATION', `Using fallback classification for theme: ${theme.name}`);
    
    // Simple heuristic-based classification
    const fileCount = theme.affectedFiles?.length || 0;
    const hasBusinessContext = theme.context?.includes('user') || theme.context?.includes('business');
    const isSimpleChange = fileCount <= 2 && !hasBusinessContext;
    
    if (isSimpleChange) {
      return {
        nodeType: 'atomic-technical',
        confidence: 0.6,
        reasoning: 'Fallback: Simple technical change with few files'
      };
    } else if (hasBusinessContext) {
      return {
        nodeType: 'business-feature',
        confidence: 0.5,
        reasoning: 'Fallback: Contains business context'
      };
    } else {
      return {
        nodeType: 'integration-hybrid',
        confidence: 0.4,
        reasoning: 'Fallback: Complex change, default to integration'
      };
    }
  }

  /**
   * Fallback classification for consolidated themes
   */
  private fallbackClassificationForConsolidated(theme: ConsolidatedTheme): ClassificationResult {
    const childCount = theme.childThemes?.length || 0;
    const fileCount = theme.affectedFiles?.length || 0;
    
    if (childCount === 0 && fileCount <= 2) {
      return {
        nodeType: 'atomic-technical',
        confidence: 0.6,
        reasoning: 'Fallback: Leaf node with few files'
      };
    } else if (childCount > 0) {
      return {
        nodeType: 'integration-hybrid',
        confidence: 0.5,
        reasoning: 'Fallback: Parent node with children'
      };
    } else {
      return {
        nodeType: 'business-feature',
        confidence: 0.4,
        reasoning: 'Fallback: Single node with multiple files'
      };
    }
  }

  /**
   * Create batches for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Calculate classification metrics
   */
  private calculateMetrics(
    results: Map<string, ClassificationResult>, 
    processingTime: number
  ): ClassificationMetrics {
    const classifications = Array.from(results.values());
    const classificationCounts: Record<string, number> = {};
    let totalConfidence = 0;
    
    for (const result of classifications) {
      classificationCounts[result.nodeType] = (classificationCounts[result.nodeType] || 0) + 1;
      totalConfidence += result.confidence;
    }
    
    return {
      totalClassified: results.size,
      classificationCounts,
      averageConfidence: classifications.length > 0 ? totalConfidence / classifications.length : 0,
      processingTime
    };
  }

  /**
   * Log classification metrics
   */
  private logMetrics(metrics: ClassificationMetrics): void {
    logger.info('NODE_CLASSIFICATION', 
      `Classification metrics: ${metrics.totalClassified} classified in ${metrics.processingTime}ms, ` +
      `avg confidence: ${metrics.averageConfidence.toFixed(3)}, ` +
      `distributions: ${JSON.stringify(metrics.classificationCounts)}`
    );
  }
}