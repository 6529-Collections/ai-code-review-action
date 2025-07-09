/**
 * Utility for analyzing code change complexity for theme naming strategy
 */

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
  
  /**
   * Analyze code changes and file patterns to determine complexity
   */
  static analyzeChangeComplexity(
    codeChanges: string,
    filePath: string,
    contextSummary?: string
  ): ComplexityAnalysis {
    const changeText = codeChanges.toLowerCase();
    const pathText = filePath.toLowerCase();
    const contextText = contextSummary?.toLowerCase() || '';
    
    // Simple technical change patterns
    const simplePatterns = [
      /console\.(log|warn|error)/,
      /import.*logger/i,
      /logger\.(info|warn|error)/,
      /\.warn\(/,
      /console\.warn.*replaced.*logger/,
      /add.*import/,
      /replace.*console/,
      /fix.*typo/,
      /update.*comment/,
      /rename.*variable/,
      /add.*semicolon/,
      /structured logging/,
      /logger.*service/
    ];
    
    // Complex business feature patterns  
    const complexPatterns = [
      /authentication/,
      /authorization/,
      /payment/,
      /checkout/,
      /registration/,
      /onboarding/,
      /workflow/,
      /business.*logic/,
      /user.*flow/,
      /feature.*flag/,
      /user.*journey/,
      /business.*process/
    ];
    
    const isSimple = simplePatterns.some(pattern => 
      pattern.test(changeText) || pattern.test(contextText)
    ) || pathText.includes('test') ||
        pathText.includes('spec') ||
        (changeText.includes('import') && changeText.split('\n').length < 5);
    
    const isComplex = complexPatterns.some(pattern => 
      pattern.test(changeText) || pattern.test(contextText)
    ) || changeText.split('file').length > 3 ||
        changeText.includes('new feature') ||
        changeText.includes('business requirement');
    
    return {
      isSimpleTechnicalChange: isSimple,
      isComplexBusinessFeature: isComplex,
      confidence: isSimple || isComplex ? 0.9 : 0.6,
      reasoning: isSimple ? 'Simple technical change detected' : 
                isComplex ? 'Complex business feature detected' : 
                'Moderate complexity change'
    };
  }

  /**
   * Generate comprehensive complexity profile with recommendations
   */
  static generateComplexityProfile(
    themeCount: number,
    affectedFiles: string[],
    themeName?: string,
    themeDescription?: string,
    codeChanges?: string,
    contextSummary?: string
  ): ChangeComplexityProfile {
    const detectedPatterns: string[] = [];
    
    // Single theme analysis
    if (themeCount === 1 && affectedFiles.length <= 2) {
      const isSimple = this.isSimpleTechnicalPattern(
        themeName || '', 
        themeDescription || '',
        codeChanges,
        contextSummary
      );
      
      if (isSimple) {
        detectedPatterns.push('single-file-technical-change');
        return {
          complexity: 'simple',
          confidence: 0.9,
          reasoning: 'Single theme with simple technical change',
          recommendedApproach: 'technical-specific',
          detectedPatterns
        };
      }
    }
    
    // Multiple themes or business features
    if (themeCount >= 3 || this.hasBusinessFeaturePatterns(themeName, themeDescription, codeChanges)) {
      detectedPatterns.push('multiple-themes-or-business-feature');
      return {
        complexity: 'complex',
        confidence: 0.8,
        reasoning: 'Multiple themes or business feature detected',
        recommendedApproach: 'business-focused',
        detectedPatterns
      };
    }
    
    // Context-aware analysis
    if (contextSummary) {
      const contextAnalysis = this.analyzeContextPatterns(contextSummary);
      if (contextAnalysis.isSimple) {
        detectedPatterns.push('simple-context-pattern');
        return {
          complexity: 'simple',
          confidence: 0.95,
          reasoning: 'Simple technical change pattern detected in context',
          recommendedApproach: 'technical-specific',
          detectedPatterns
        };
      }
    }
    
    // Default moderate complexity
    detectedPatterns.push('moderate-complexity-default');
    return {
      complexity: 'moderate',
      confidence: 0.7,
      reasoning: 'Moderate complexity change requiring hybrid approach',
      recommendedApproach: 'hybrid',
      detectedPatterns
    };
  }

  /**
   * Check for simple technical patterns
   */
  private static isSimpleTechnicalPattern(
    name: string, 
    description: string,
    codeChanges?: string,
    contextSummary?: string
  ): boolean {
    const text = (name + ' ' + description + ' ' + (codeChanges || '') + ' ' + (contextSummary || '')).toLowerCase();
    const patterns = [
      /console\.warn/,
      /logger/,
      /import/,
      /logging/,
      /replace.*with/,
      /add.*import/,
      /fix.*typo/,
      /update.*comment/,
      /structured logging/,
      /replaced.*console.*warn/
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Check for business feature patterns
   */
  private static hasBusinessFeaturePatterns(
    name?: string, 
    description?: string,
    codeChanges?: string
  ): boolean {
    const allText = (name + ' ' + description + ' ' + (codeChanges || '')).toLowerCase();
    const patterns = [
      /authentication/,
      /authorization/,
      /user.*flow/,
      /business.*logic/,
      /workflow/,
      /onboarding/,
      /payment/,
      /checkout/,
      /user.*journey/,
      /business.*process/
    ];
    
    return patterns.some(pattern => pattern.test(allText));
  }

  /**
   * Analyze context summary for complexity indicators
   */
  private static analyzeContextPatterns(contextSummary: string): { isSimple: boolean; isComplex: boolean } {
    const contextText = contextSummary.toLowerCase();
    
    // Simple technical patterns in context
    const simplePatterns = [
      /replaced console\.warn with/,
      /add.*import/,
      /logger.*service/,
      /structured logging/,
      /fix.*typo/,
      /update.*comment/,
      /single.*file.*change/,
      /minor.*refactor/
    ];
    
    // Complex patterns in context
    const complexPatterns = [
      /multiple.*components/,
      /business.*feature/,
      /user.*workflow/,
      /new.*functionality/,
      /feature.*implementation/,
      /system.*integration/
    ];
    
    return {
      isSimple: simplePatterns.some(pattern => pattern.test(contextText)),
      isComplex: complexPatterns.some(pattern => pattern.test(contextText))
    };
  }

  /**
   * Get examples for detected complexity patterns
   */
  static getPatternExamples(detectedPatterns: string[]): string[] {
    const examples: Record<string, string[]> = {
      'single-file-technical-change': [
        'Replace console.warn with logger.warn calls',
        'Add LoggerServices import for centralized logging',
        'Update error handling to use structured logging'
      ],
      'multiple-themes-or-business-feature': [
        'Enable Secure User Authentication',
        'Streamline Customer Onboarding Process',
        'Improve Error Resolution Workflow'
      ],
      'simple-context-pattern': [
        'Replace console.warn with structured logging',
        'Add import statement for logger service',
        'Update logging call to use centralized system'
      ],
      'moderate-complexity-default': [
        'Implement Structured Logging for Error Diagnosis',
        'Add OAuth2 Integration for User Security',
        'Enhance API Validation for Data Integrity'
      ]
    };
    
    const allExamples: string[] = [];
    detectedPatterns.forEach(pattern => {
      if (examples[pattern]) {
        allExamples.push(...examples[pattern]);
      }
    });
    
    return allExamples.length > 0 ? allExamples : examples['moderate-complexity-default'];
  }
}