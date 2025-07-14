/**
 * AI-driven complexity analysis for theme naming strategy
 * Replaces algorithmic pattern matching with Claude AI analysis
 */

import { ClaudeClient } from '@/shared/utils/claude-client';
import { JsonExtractor } from '@/shared/utils/json-extractor';
import { logger } from '@/shared/logger/logger';

export interface ComplexityAnalysis {
  isSimpleTechnicalChange: boolean;
  isComplexBusinessFeature: boolean;
  confidence: number;
  reasoning: string;
}

export interface ChangeComplexityProfile {
  complexity: 'simple' | 'moderate' | 'complex';
  confidence: number;
  reasoning: string;
  recommendedApproach: 'technical-specific' | 'hybrid' | 'business-focused';
  detectedPatterns: string[];
}

export class ComplexityAnalyzer {
  private static claudeClient: ClaudeClient | null = null;

  /**
   * Initialize with API key for AI analysis
   */
  static initialize(anthropicApiKey: string): void {
    this.claudeClient = new ClaudeClient(anthropicApiKey);
  }

  /**
   * AI-driven analysis of code change complexity
   */
  static async analyzeChangeComplexity(
    codeChanges: string,
    filePath: string,
    contextSummary?: string
  ): Promise<ComplexityAnalysis> {
    if (!this.claudeClient) {
      throw new Error(
        'ComplexityAnalyzer not initialized. Call initialize(apiKey) first.\n' +
        'AI-driven complexity analysis requires Claude API access.'
      );
    }

    const prompt = `You are analyzing code changes to determine their complexity and nature.

CODE CHANGES:
${codeChanges}

FILE PATH: ${filePath}

CONTEXT SUMMARY: ${contextSummary || 'Not provided'}

TASK: Analyze the complexity and nature of this change.

ANALYSIS CRITERIA:
1. **Simple Technical Change**: Basic refactoring, imports, logging changes, minor fixes
2. **Complex Business Feature**: User workflows, business logic, authentication, payments
3. **Confidence**: How certain you are about this classification

RESPOND WITH ONLY VALID JSON:
{
  "isSimpleTechnicalChange": boolean,
  "isComplexBusinessFeature": boolean,
  "confidence": number (0.0-1.0),
  "reasoning": "Explanation of why you classified it this way"
}`;

    try {
      const response = await this.claudeClient.callClaude(
        prompt,
        'complexity-analysis',
        `complexity analysis for ${filePath}`
      );

      const extractionResult = JsonExtractor.extractJson(response);
      if (!extractionResult.success) {
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }

      const result = extractionResult.data as ComplexityAnalysis;
      
      // Validate response structure
      if (typeof result.isSimpleTechnicalChange !== 'boolean' ||
          typeof result.isComplexBusinessFeature !== 'boolean' ||
          typeof result.confidence !== 'number' ||
          typeof result.reasoning !== 'string') {
        throw new Error('Invalid response structure from AI complexity analysis');
      }

      logger.debug('COMPLEXITY_ANALYZER', 
        `AI complexity analysis: ${result.isSimpleTechnicalChange ? 'simple' : result.isComplexBusinessFeature ? 'complex' : 'moderate'} (confidence: ${result.confidence})`
      );

      return result;
    } catch (error) {
      throw new Error(
        `AI complexity analysis failed for ${filePath}: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * AI-driven comprehensive complexity profile generation
   */
  static async generateComplexityProfile(
    themeCount: number,
    affectedFiles: string[],
    themeName?: string,
    themeDescription?: string,
    codeChanges?: string,
    contextSummary?: string
  ): Promise<ChangeComplexityProfile> {
    if (!this.claudeClient) {
      throw new Error(
        'ComplexityAnalyzer not initialized. Call initialize(apiKey) first.\n' +
        'AI-driven complexity analysis requires Claude API access.'
      );
    }

    const prompt = `You are analyzing code changes to create a comprehensive complexity profile.

CONTEXT:
- Theme Count: ${themeCount}
- Affected Files: ${affectedFiles.join(', ')}
- Theme Name: ${themeName || 'Not provided'}
- Theme Description: ${themeDescription || 'Not provided'}
- Code Changes: ${codeChanges || 'Not provided'}
- Context Summary: ${contextSummary || 'Not provided'}

TASK: Generate a comprehensive complexity profile with recommendations.

ANALYSIS CRITERIA:
1. **Complexity Levels**:
   - simple: Single technical change, minor refactoring
   - moderate: Mixed technical/business, moderate scope
   - complex: Business features, multiple components, user workflows

2. **Recommended Approaches**:
   - technical-specific: Focus on technical implementation details
   - hybrid: Balance technical and business perspectives
   - business-focused: Emphasize user value and business impact

3. **Pattern Detection**: Identify specific patterns in the change

RESPOND WITH ONLY VALID JSON:
{
  "complexity": "simple|moderate|complex",
  "confidence": number (0.0-1.0),
  "reasoning": "Detailed explanation of complexity assessment",
  "recommendedApproach": "technical-specific|hybrid|business-focused",
  "detectedPatterns": ["array", "of", "detected", "patterns"]
}`;

    try {
      const response = await this.claudeClient.callClaude(
        prompt,
        'complexity-profile',
        `complexity profile for ${themeCount} themes`
      );

      const extractionResult = JsonExtractor.extractJson(response);
      if (!extractionResult.success) {
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }

      const result = extractionResult.data as ChangeComplexityProfile;
      
      // Validate response structure
      if (!['simple', 'moderate', 'complex'].includes(result.complexity) ||
          typeof result.confidence !== 'number' ||
          typeof result.reasoning !== 'string' ||
          !['technical-specific', 'hybrid', 'business-focused'].includes(result.recommendedApproach) ||
          !Array.isArray(result.detectedPatterns)) {
        throw new Error('Invalid response structure from AI complexity profile generation');
      }

      logger.debug('COMPLEXITY_ANALYZER', 
        `AI complexity profile: ${result.complexity} complexity, ${result.recommendedApproach} approach (confidence: ${result.confidence})`
      );

      return result;
    } catch (error) {
      throw new Error(
        `AI complexity profile generation failed: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }

  /**
   * AI-driven pattern examples generation
   */
  static async getPatternExamples(detectedPatterns: string[]): Promise<string[]> {
    if (!this.claudeClient) {
      throw new Error(
        'ComplexityAnalyzer not initialized. Call initialize(apiKey) first.\n' +
        'AI-driven pattern analysis requires Claude API access.'
      );
    }

    if (detectedPatterns.length === 0) {
      return ['No patterns detected for example generation'];
    }

    const prompt = `You are generating practical examples for detected code change patterns.

DETECTED PATTERNS: ${detectedPatterns.join(', ')}

TASK: Generate 3-5 clear, practical examples of changes that would match these patterns.

GUIDELINES:
- Examples should be specific and actionable
- Focus on real-world scenarios
- Include both technical and business perspectives where relevant
- Each example should be a concise description (1-2 sentences)

RESPOND WITH ONLY VALID JSON:
{
  "examples": ["Array of practical examples matching the detected patterns"]
}`;

    try {
      const response = await this.claudeClient.callClaude(
        prompt,
        'pattern-examples',
        `examples for ${detectedPatterns.length} patterns`
      );

      const extractionResult = JsonExtractor.extractJson(response);
      if (!extractionResult.success) {
        throw new Error(`JSON extraction failed: ${extractionResult.error}`);
      }

      const result = extractionResult.data as { examples: string[] };
      
      if (!Array.isArray(result.examples)) {
        throw new Error('Invalid response structure: examples must be an array');
      }

      return result.examples;
    } catch (error) {
      throw new Error(
        `AI pattern examples generation failed: ${error}\n` +
        `This indicates an AI configuration or API issue that must be resolved.\n` +
        `Check: 1) API key validity, 2) Network connectivity, 3) Claude API status\n` +
        `No algorithmic fallback is available - fix AI integration to proceed.`
      );
    }
  }
}