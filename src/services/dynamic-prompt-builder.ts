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
      codeAnalysis,
      theme
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
Files involved: ${theme.affectedFiles.length} files
File list: ${theme.affectedFiles.join(', ')}`;

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
    codeAnalysis: CodeStructureAnalysis,
    theme: ConsolidatedTheme
  ): string {
    const questions = this.generateDecisionQuestions(
      currentDepth,
      codeAnalysis
    );

    let section = `You are building a hierarchical mindmap per PRD requirements.
Goal: Natural depth (2-30 levels) based on code complexity.

CURRENT THEME: "${theme.name}"
Current depth: ${currentDepth} (no limits - let complexity guide)
Code metrics: ${theme.affectedFiles.length} files, ${theme.codeSnippets.reduce((count, snippet) => count + snippet.split('\n').length, 0)} lines
Files affected by this theme: ${theme.affectedFiles.map(f => `"${f}"`).join(', ')}

EXPANSION DECISION FRAMEWORK (from PRD):

Create child nodes when:
1. Multiple concerns present
2. Not independently testable at this level
3. Too complex for atomic understanding
4. Mixed audiences (technical vs business)

Stop expansion only when ALL true:
1. Atomic: 5-15 lines of focused change
2. Unit-testable as-is
3. Single responsibility
4. Natural code boundary

CRITICAL: Multi-file changes are RARELY atomic. Consider:
- If changing multiple files, each file likely represents a separate concern
- Configuration + implementation = 2 separate atomic changes
- Test + implementation = 2 separate atomic changes
- Documentation + code = 2 separate atomic changes

Multi-file themes should expand unless they are:
1. Simple renames across files (atomic rename operation)
2. Coordinated single-line changes (like version bumps)
3. Pure refactoring with identical logic changes

CONSIDER THESE QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CRITICAL FILE ASSIGNMENT RULES:
1. Each sub-theme MUST have "files" array populated
2. Files MUST be selected from the parent theme's files listed above
3. Each file should typically belong to only ONE sub-theme (no duplication unless truly needed)
4. If a sub-theme doesn't modify any specific files, it shouldn't exist
5. The "files" field is REQUIRED - omitting it will cause an error`;

    section += `

RESPOND WITH PRD-COMPLIANT JSON:
{
  "shouldExpand": boolean,
  "reasoning": "why (max 30 words)",
  "businessContext": "user value (max 20 words)",
  "technicalContext": "what it does (max 20 words)",
  "testabilityAssessment": "how to test (max 15 words)",
  "suggestedSubThemes": [
    {
      "name": "Clear title (max 8 words)",
      "description": "1-3 sentences",
      "businessContext": "Why this matters",
      "technicalContext": "What this does",
      "files": ["REQUIRED: list files from parent theme that this sub-theme modifies"],
      "estimatedLines": number,
      "rationale": "Why separate concern"
    }
  ] or null
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
      ; // Include all relevant examples
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
