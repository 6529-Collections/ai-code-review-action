import { ConsolidatedTheme } from '../types/similarity-types';
import { CodeStructureAnalysis, ChangeType } from './code-structure-analyzer';

/**
 * Builds dynamic, context-aware prompts for AI expansion decisions
 */
export class DynamicPromptBuilder {
  private expansionExamples: ExpansionExample[] = [];

  constructor() {
    this.initializeExamples();
  }

  /**
   * Build a context-rich prompt for expansion decisions
   */
  buildExpansionPrompt(
    theme: ConsolidatedTheme,
    currentDepth: number,
    codeAnalysis: CodeStructureAnalysis,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): string {
    const contextSection = this.buildContextSection(
      theme,
      currentDepth,
      parentTheme,
      siblingThemes
    );
    const analysisSection = this.buildAnalysisSection(codeAnalysis);
    const guidanceSection = this.buildGuidanceSection(
      currentDepth,
      codeAnalysis
    );
    const examplesSection = this.buildExamplesSection(codeAnalysis);
    const decisionSection = this.buildDecisionSection(
      currentDepth,
      codeAnalysis
    );

    return `${contextSection}

${analysisSection}

${guidanceSection}

${examplesSection}

${decisionSection}`;
  }

  /**
   * Build context section with theme information
   */
  private buildContextSection(
    theme: ConsolidatedTheme,
    currentDepth: number,
    parentTheme?: ConsolidatedTheme,
    siblingThemes?: ConsolidatedTheme[]
  ): string {
    let context = `You are analyzing a code change to build a hierarchical mindmap.
This mindmap should naturally organize code from high-level themes down to specific, reviewable units.

CURRENT THEME:
Name: "${theme.name}"
Description: ${theme.description}
Current depth: ${currentDepth}
Files involved: ${theme.affectedFiles.length} files`;

    if (parentTheme) {
      context += `

PARENT THEME: "${parentTheme.name}"
Purpose: ${parentTheme.description}`;
    }

    if (siblingThemes && siblingThemes.length > 0) {
      context += `

SIBLING THEMES (already identified at this level):
${siblingThemes.map((s) => `- "${s.name}": ${s.description}`).join('\n')}

Ensure suggested sub-themes don't duplicate these existing themes.`;
    }

    return context;
  }

  /**
   * Build analysis section with code structure insights
   */
  private buildAnalysisSection(codeAnalysis: CodeStructureAnalysis): string {
    let section = `CODE STRUCTURE ANALYSIS:
- Functions/Methods: ${codeAnalysis.functionCount}
- Classes/Interfaces: ${codeAnalysis.classCount}
- Modules/Files: ${codeAnalysis.moduleCount}
- Change Types: ${codeAnalysis.changeTypes.join(', ')}
- Complexity: ${this.formatComplexityIndicators(codeAnalysis.complexityIndicators)}`;

    if (codeAnalysis.expansionHints.length > 0) {
      section += `

EXPANSION INSIGHTS:
${codeAnalysis.expansionHints.map((hint) => `• ${hint}`).join('\n')}`;
    }

    return section;
  }

  /**
   * Build dynamic guidance based on depth and complexity
   */
  private buildGuidanceSection(
    currentDepth: number,
    codeAnalysis: CodeStructureAnalysis
  ): string {
    const achievements = this.identifyAchievements(currentDepth, codeAnalysis);
    const nextGoals = this.identifyNextGoals(currentDepth, codeAnalysis);

    let section = `EXPANSION GUIDANCE:
Focus: Identify distinct functional concerns that could be independently tested or reviewed
- Look for changes that address different requirements or use cases
- Consider separating different functions, classes, or logical units
- Each theme should represent a coherent concern that could have its own unit test
- Consider if different aspects could be tested or reviewed separately`;

    if (achievements.length > 0) {
      section += `

ACHIEVEMENTS SO FAR:
${achievements.map((achievement) => `✓ ${achievement}`).join('\n')}`;
    }

    if (nextGoals.length > 0) {
      section += `

NEXT GOALS TO CONSIDER:
${nextGoals.map((goal) => `→ ${goal}`).join('\n')}`;
    }

    return section;
  }

  /**
   * Build examples section with relevant expansion patterns
   */
  private buildExamplesSection(codeAnalysis: CodeStructureAnalysis): string {
    const relevantExamples = this.selectRelevantExamples(codeAnalysis);

    if (relevantExamples.length === 0) {
      return '';
    }

    let section = `EXPANSION EXAMPLES (similar patterns):`;

    relevantExamples.forEach((example, index) => {
      section += `

Example ${index + 1}: "${example.themeName}"
Pattern: ${example.pattern}
Sub-themes created:
${example.subThemes.map((sub) => `  - "${sub.name}": ${sub.description}`).join('\n')}
Why this worked: ${example.reasoning}`;
    });

    return section;
  }

  /**
   * Build decision section with specific questions
   */
  private buildDecisionSection(
    currentDepth: number,
    codeAnalysis: CodeStructureAnalysis
  ): string {
    const questions = this.generateDecisionQuestions(
      currentDepth,
      codeAnalysis
    );

    let section = `EXPANSION ANALYSIS:
Default action: EXPAND this theme into sub-themes

To STOP expansion, you must prove ALL of these:
1. Single testable unit - Could have exactly ONE unit test
2. Indivisible operation - Cannot split without losing meaning
3. Atomic responsibility - Does exactly one thing
4. No mixed concerns - No "AND" in the description

If ANY condition fails → MUST EXPAND

ATOMIC VALIDATION CHECKLIST:
□ Size: 5-15 lines of functional change
□ Single unit test possible
□ One assertion per test
□ No conditional branches (if/else = 2 concerns)
□ Single function/method modification
□ One clear purpose (SRP)
□ Would be one git commit
□ No "and" in description

Atomic Score = (criteria met / 8)
- Score < 0.7 → MUST expand
- Score 0.7-0.9 → Consider expansion
- Score > 0.9 → May be atomic

CONSIDER THESE QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

EXPANSION BENEFITS:
- More granular code review and understanding
- Better change tracking and impact analysis
- Clearer separation of concerns
- Easier testing and validation

When shouldExpand is false, you MUST:
- Explain which atomic criteria are met
- Confirm no further decomposition possible
- Verify single test coverage
- Provide atomic score`;

    section += `

RESPOND WITH JSON:
{
  "shouldExpand": boolean,
  "isAtomic": boolean,
  "reasoning": "Clear explanation why (max 50 words)",
  "atomicScore": 0.0-1.0,
  "atomicCriteriaMet": ["list criteria met if not expanding"],
  "potentialSubThemes": ["even if not expanding, what COULD be split"],
  "suggestedSubThemes": [
    {
      "name": "What this accomplishes (max 10 words)",
      "description": "What changes (max 20 words)",
      "files": ["relevant", "files"],
      "rationale": "Why this is a separate concern (max 15 words)"
    }
  ] or null if shouldExpand is false
}`;

    return section;
  }

  /**
   * Format complexity indicators for display
   */
  private formatComplexityIndicators(indicators: {
    hasConditionals: boolean;
    hasLoops: boolean;
    hasErrorHandling: boolean;
    hasAsyncOperations: boolean;
    nestingDepth: number;
    branchingFactor: number;
  }): string {
    const features = [];
    if (indicators.hasConditionals)
      features.push(`conditionals (${indicators.branchingFactor} branches)`);
    if (indicators.hasLoops) features.push('loops');
    if (indicators.hasErrorHandling) features.push('error handling');
    if (indicators.hasAsyncOperations) features.push('async operations');
    if (indicators.nestingDepth > 2)
      features.push(`deep nesting (${indicators.nestingDepth})`);

    return features.length > 0 ? features.join(', ') : 'low complexity';
  }

  /**
   * Identify what has been achieved at current depth
   */
  private identifyAchievements(
    currentDepth: number,
    codeAnalysis: CodeStructureAnalysis
  ): string[] {
    const achievements: string[] = [];

    if (currentDepth >= 1) {
      if (codeAnalysis.changeTypes.length <= 2) {
        achievements.push('Focused change types identified');
      }
      if (codeAnalysis.moduleCount <= 3) {
        achievements.push('Module scope well-defined');
      }
    }

    if (currentDepth >= 2) {
      if (codeAnalysis.functionCount <= 2) {
        achievements.push('Function-level granularity reached');
      }
      if (codeAnalysis.classCount <= 1) {
        achievements.push('Single class/interface focus');
      }
    }

    if (currentDepth >= 3) {
      if (
        !codeAnalysis.complexityIndicators.hasConditionals ||
        !codeAnalysis.complexityIndicators.hasLoops
      ) {
        achievements.push('Simplified control flow');
      }
    }

    return achievements;
  }

  /**
   * Identify next goals based on current state
   */
  private identifyNextGoals(
    currentDepth: number,
    codeAnalysis: CodeStructureAnalysis
  ): string[] {
    const goals: string[] = [];

    if (codeAnalysis.changeTypes.length > 2) {
      goals.push('Separate different types of changes (config vs logic vs UI)');
    }

    if (codeAnalysis.functionCount > 3) {
      goals.push('Break down into individual function modifications');
    }

    if (
      codeAnalysis.complexityIndicators.hasConditionals &&
      codeAnalysis.complexityIndicators.hasErrorHandling
    ) {
      goals.push('Separate control flow from error handling');
    }

    if (
      codeAnalysis.complexityIndicators.hasAsyncOperations &&
      codeAnalysis.functionCount > 1
    ) {
      goals.push('Isolate asynchronous operations');
    }

    if (codeAnalysis.fileStructure.isMultiDirectory) {
      goals.push('Group changes by architectural component');
    }

    // Add depth-specific goals
    if (currentDepth < 2 && codeAnalysis.moduleCount > 1) {
      goals.push('Achieve module-level separation');
    }

    if (currentDepth < 3 && codeAnalysis.classCount > 1) {
      goals.push('Reach class/interface level granularity');
    }

    return goals;
  }

  /**
   * Generate context-specific decision questions
   */
  private generateDecisionQuestions(
    currentDepth: number,
    codeAnalysis: CodeStructureAnalysis
  ): string[] {
    const questions: string[] = [
      'Does this theme contain multiple distinct concerns that could be understood separately?',
      'Would decomposition make the changes clearer and more reviewable?',
      'Are there natural boundaries in the code that suggest separate sub-themes?',
    ];

    // Add complexity-specific questions
    if (codeAnalysis.functionCount > 1) {
      questions.push(
        'Could different functions/methods be analyzed as separate concerns?'
      );
    }

    if (codeAnalysis.changeTypes.length > 1) {
      questions.push(
        'Should different types of changes (config vs logic vs UI) be separated?'
      );
    }

    if (codeAnalysis.complexityIndicators.hasConditionals) {
      questions.push(
        'Could different conditional branches or logic paths be treated separately?'
      );
    }

    if (codeAnalysis.complexityIndicators.hasErrorHandling) {
      questions.push(
        'Should error handling be separated from main logic flow?'
      );
    }

    // Add depth-specific questions
    if (currentDepth >= 3) {
      questions.push(
        'Could different parts of this change be tested independently?'
      );
      questions.push(
        'Would a code reviewer comment on different aspects separately?'
      );
    }

    return questions;
  }

  /**
   * Select relevant examples based on code patterns
   */
  private selectRelevantExamples(
    codeAnalysis: CodeStructureAnalysis
  ): ExpansionExample[] {
    return this.expansionExamples
      .filter((example) => this.isExampleRelevant(example, codeAnalysis))
      .slice(0, 2); // Limit to 2 most relevant examples
  }

  /**
   * Check if an example is relevant to current analysis
   */
  private isExampleRelevant(
    example: ExpansionExample,
    analysis: CodeStructureAnalysis
  ): boolean {
    // Match by change types
    const typeMatch = example.changeTypes.some((type) =>
      analysis.changeTypes.includes(type)
    );

    // Match by complexity
    const complexityMatch =
      example.hasConditionals ===
        analysis.complexityIndicators.hasConditionals ||
      (example.hasMultipleFunctions && analysis.functionCount > 1) ||
      (example.hasMultipleFiles && analysis.moduleCount > 1);

    return typeMatch || complexityMatch;
  }

  /**
   * Initialize example expansion patterns
   */
  private initializeExamples(): void {
    this.expansionExamples = [
      {
        themeName: 'Refactor authentication service',
        pattern: 'service-refactor',
        changeTypes: ['logic', 'types'],
        hasConditionals: true,
        hasMultipleFunctions: true,
        hasMultipleFiles: true,
        subThemes: [
          {
            name: 'Update token validation logic',
            description:
              'Modify JWT token verification and expiration handling',
          },
          {
            name: 'Add new authentication methods',
            description: 'Implement OAuth2 and SAML authentication options',
          },
          {
            name: 'Refactor user session management',
            description: 'Improve session storage and cleanup mechanisms',
          },
        ],
        reasoning:
          'Each sub-theme addresses a distinct aspect of authentication',
      },
      {
        themeName: 'Add user feedback system',
        pattern: 'feature-addition',
        changeTypes: ['ui', 'logic', 'config'],
        hasConditionals: false,
        hasMultipleFunctions: true,
        hasMultipleFiles: true,
        subThemes: [
          {
            name: 'Create feedback UI components',
            description: 'Build feedback forms and display components',
          },
          {
            name: 'Implement feedback storage',
            description: 'Add database schema and API endpoints',
          },
          {
            name: 'Configure feedback notifications',
            description: 'Set up email and in-app notification system',
          },
        ],
        reasoning:
          'UI, backend, and notifications are separate technical concerns',
      },
      {
        themeName: 'Fix error handling in data processing',
        pattern: 'error-handling-fix',
        changeTypes: ['logic'],
        hasConditionals: true,
        hasMultipleFunctions: false,
        hasMultipleFiles: false,
        subThemes: [
          {
            name: 'Add input validation',
            description:
              'Validate data format and requirements before processing',
          },
          {
            name: 'Improve error messages',
            description: 'Provide more descriptive error messages to users',
          },
          {
            name: 'Add retry logic',
            description: 'Implement automatic retry for transient failures',
          },
        ],
        reasoning:
          'Prevention, messaging, and recovery are distinct error handling strategies',
      },
    ];
  }
}

/**
 * Example of successful theme expansion
 */
export interface ExpansionExample {
  themeName: string;
  pattern: string;
  changeTypes: ChangeType[];
  hasConditionals: boolean;
  hasMultipleFunctions: boolean;
  hasMultipleFiles: boolean;
  subThemes: Array<{
    name: string;
    description: string;
  }>;
  reasoning: string;
}
