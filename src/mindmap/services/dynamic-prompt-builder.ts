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
Code metrics: ${theme.affectedFiles.length} files, ${theme.codeSnippets.length} code snippets
Files affected by this theme: ${theme.affectedFiles.map((f) => `"${f}"`).join(', ')}

DEPTH-AWARE EXPANSION STRATEGY:

${this.getDepthSpecificGuidance(currentDepth)}

UNIVERSAL TEST BOUNDARY THINKING:
Ask yourself: "Would a developer write ONE focused unit test for this theme?"
- If YES → Likely atomic (especially at depth 8+)
- If NO, needs multiple tests → Consider expansion (especially at depth <8)
- If unsure → Default to expansion at shallow depths, atomic at deep depths

EXPANSION DECISION FRAMEWORK:
Create child nodes when:
1. Multiple distinct responsibilities present
2. Different test scenarios would be needed
3. Natural code boundaries suggest separation
4. Would improve reviewability and understanding

Stay atomic when:
1. Single cohesive algorithm or process
2. Tightly coupled logic that shouldn't be separated
3. Would be covered by one focused unit test
4. Further splitting would create artificial boundaries

CONSIDER THESE QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CRITICAL FILE ASSIGNMENT RULES:
1. Each sub-theme MUST have "files" array populated
2. Files MUST be selected ONLY from the parent theme's files listed above
3. You CANNOT suggest files that are not in the parent theme's file list
4. If parent has only 1 file, ALL sub-themes must use that SAME file
5. Each file should typically belong to only ONE sub-theme (unless parent has only 1 file)
6. If a sub-theme doesn't modify any specific files, it shouldn't exist
7. The "files" field is REQUIRED - omitting it will cause an error

EXAMPLE: If parent theme affects ["src/services/theme-expansion.ts"], then ALL sub-themes 
must have "files": ["src/services/theme-expansion.ts"]. You CANNOT suggest files like 
"src/utils/concurrency-manager.ts" that are not in the parent's file list.`;

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
      "rationale": "Why separate concern"
    }
  ] or null
}`;

    return section;
  }

  /**
   * Get depth-specific expansion guidance
   */
  private getDepthSpecificGuidance(currentDepth: number): string {
    if (currentDepth <= 2) {
      return `DEPTH ${currentDepth} - BUSINESS LEVEL:
You're examining high-level business themes.
STRONGLY FAVOR EXPANSION unless trivially simple.

Examples needing expansion:
- "User Authentication" (has login, logout, session management)
- "Payment Processing" (has validation, processing, confirmation)
- "Data Migration" (has extraction, transformation, loading)

Rarely atomic at this level:
- "Fix typo in README" (single atomic change)
- "Update version number" (single coordinated change)

DEFAULT: Expand with high confidence (0.8-1.0)`;
    }

    if (currentDepth <= 5) {
      return `DEPTH ${currentDepth} - COMPONENT LEVEL:
You're examining technical components and major features.
FAVOR EXPANSION for multi-faceted components.

Examples needing expansion:
- "OAuth Token Validation" with multiple providers
- "Data transformation pipeline" with multiple steps
- "Form validation" with multiple field types
- "API error handling" with different error types

Potentially atomic:
- "JWT token signature verification" (single algorithm)
- "Email format validation" (single regex check)
- "Calculate tax amount" (single formula)

DEFAULT: Expand if multiple responsibilities visible (0.6-0.8 confidence)`;
    }

    if (currentDepth <= 8) {
      return `DEPTH ${currentDepth} - FEATURE IMPLEMENTATION (Sweet Spot):
You're examining specific feature implementations.
BALANCE expansion with cohesion - look for natural test boundaries.

Consider atomic if:
- Would be covered by ONE focused unit test
- Splitting would separate algorithm from its error handling
- Further division would create artificial boundaries

Examples likely atomic:
- "Validate and format phone number" (cohesive validation)
- "Calculate discount with business rules" (complete algorithm)
- "Extract and transform user data" (single transformation)
- "Line-by-line assignment validation" (single process)

Still expand if:
- Multiple distinct algorithms present
- Different test scenarios needed
- Unrelated responsibilities combined

DEFAULT: Expand only with clear evidence of multiple concerns (0.4-0.7 confidence)`;
    }

    if (currentDepth <= 12) {
      return `DEPTH ${currentDepth} - IMPLEMENTATION DETAILS (Target Atomic Zone):
You're examining implementation details and specific algorithms.
RESIST EXPANSION unless clearly beneficial.

Strong signals for atomic:
- Complete algorithm implementation
- Single responsibility with error handling
- Would need just one unit test
- Further split would separate tightly coupled logic

Examples of atomic themes:
- "Duplicate detection using Set operations"
- "Confidence score calculation with bounds"
- "Format error message with truncation"
- "Extract unique file paths from diffs"

Only expand for:
- Genuinely independent algorithms
- Clearly separable test cases
- Mixed concerns that don't belong together

DEFAULT: Stay atomic unless compelling reason (0.2-0.5 confidence for expansion)`;
    }

    if (currentDepth <= 16) {
      return `DEPTH ${currentDepth} - FINE DETAILS (Avoid Over-Expansion):
You're at implementation detail level.
STRONGLY RESIST EXPANSION - you're likely seeing atomic operations.

Almost always atomic:
- Individual validation rules
- Single calculations or formulas
- Property assignments and mappings
- Loop operations and iterations
- Error formatting and messages

Anti-patterns (DO NOT create themes for):
- Variable assignments: "confidence = 0.5"
- Simple conditionals: "if (x) y += 0.1"
- Return statements: "return { result }"
- Math operations: "Math.max(0, Math.min(1, x))"
- Single method calls: "Set.add(item)"

Only expand if code literally does unrelated things.

DEFAULT: Stay atomic (0.1-0.3 confidence for expansion)`;
    }

    return `DEPTH ${currentDepth} - MAXIMUM DEPTH WARNING:
You've reached extreme granularity.
DO NOT EXPAND FURTHER unless critical error in analysis.
Everything at this level should be atomic.

DEFAULT: Stay atomic (0.0-0.1 confidence for expansion)`;
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
    return this.expansionExamples.filter((example) =>
      this.isExampleRelevant(example, codeAnalysis)
    ); // Include all relevant examples
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
