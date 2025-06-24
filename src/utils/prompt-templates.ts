/**
 * Standardized prompt templates for consistent Claude AI responses
 */

export interface PromptConfig {
  instruction: string;
  jsonSchema: string;
  examples?: string[];
  constraints?: string[];
}

export class PromptTemplates {
  /**
   * Create a standardized JSON-only prompt
   */
  static createJsonPrompt(config: PromptConfig): string {
    const { instruction, jsonSchema, examples = [], constraints = [] } = config;

    let prompt = `${instruction}\n\n`;

    // Add strict JSON formatting requirements
    prompt += `CRITICAL RESPONSE FORMAT:\n`;
    prompt += `- Return ONLY valid JSON matching this exact schema: ${jsonSchema}\n`;
    prompt += `- No explanatory text, no markdown formatting, no code blocks\n`;
    prompt += `- Response must start with { or [ character\n`;
    prompt += `- Response must end with } or ] character\n`;
    prompt += `- No text before or after the JSON\n\n`;

    // Add examples if provided
    if (examples.length > 0) {
      prompt += `VALID RESPONSE EXAMPLES:\n`;
      examples.forEach((example, index) => {
        prompt += `Example ${index + 1}: ${example}\n`;
      });
      prompt += `\n`;
    }

    // Add constraints if provided
    if (constraints.length > 0) {
      prompt += `CONSTRAINTS:\n`;
      constraints.forEach((constraint) => {
        prompt += `- ${constraint}\n`;
      });
      prompt += `\n`;
    }

    prompt += `TASK: ${instruction}`;

    return prompt;
  }

  /**
   * Template for business pattern identification
   */
  static createBusinessPatternPrompt(
    themeName: string,
    themeDescription: string,
    businessImpact: string,
    affectedFiles: string[]
  ): string {
    return this.createJsonPrompt({
      instruction: `Analyze this code theme for distinct business logic patterns and user flows:

Theme: ${themeName}
Description: ${themeDescription}
Business Impact: ${businessImpact}
Affected Files: ${affectedFiles.join(', ')}

Identify distinct business patterns within this theme. Look for:
1. Different user interaction flows
2. Separate business logic concerns
3. Distinct functional areas
4. Different data processing patterns
5. Separate integration points

Focus on business value, not technical implementation details.`,
      jsonSchema: '["pattern1", "pattern2", "pattern3"]',
      examples: [
        '["User Authentication Flow", "Data Validation Logic", "API Integration"]',
        '["Payment Processing", "Order Management", "Customer Notifications"]',
        '["Configuration Management", "Error Handling", "Monitoring Integration"]',
      ],
      constraints: [
        'Maximum 6 patterns',
        'Focus on business/user value',
        'Use descriptive pattern names',
        'Avoid technical implementation details',
      ],
    });
  }

  /**
   * Template for sub-theme analysis
   */
  static createSubThemeAnalysisPrompt(
    themeName: string,
    themeDescription: string,
    businessImpact: string,
    level: number,
    affectedFiles: string[],
    parentContext?: string
  ): string {
    const contextSection = parentContext
      ? `\nPARENT THEME CONTEXT:\n${parentContext}\n`
      : '';

    return this.createJsonPrompt({
      instruction: `Analyze this code theme for potential sub-theme expansion:

THEME TO ANALYZE:
Name: ${themeName}
Description: ${themeDescription}
Business Impact: ${businessImpact}
Current Level: ${level}
Files: ${affectedFiles.join(', ')}${contextSection}

Determine if this theme contains distinct sub-patterns that warrant separate sub-themes.
Focus on:
1. Business logic separation (different business rules/processes)
2. User flow distinction (different user interaction patterns)
3. Functional area separation (different system responsibilities)
4. Data processing patterns (different data handling approaches)

EXPANSION CRITERIA:
- Sub-themes must have distinct business value
- Each sub-theme should represent a coherent business concept
- Avoid technical implementation splitting
- Maintain file scope relevance
- Ensure no duplication with parent or sibling themes

Only create sub-themes if there are genuinely distinct business concerns.`,
      jsonSchema: `{
  "shouldExpand": boolean,
  "confidence": number,
  "reasoning": "explanation",
  "businessLogicPatterns": ["pattern1", "pattern2"],
  "userFlowPatterns": ["flow1", "flow2"],
  "subThemes": [
    {
      "name": "Sub-theme name",
      "description": "Business-focused description",
      "businessImpact": "User/business value",
      "relevantFiles": ["file1.ts", "file2.ts"],
      "confidence": number
    }
  ]
}`,
      examples: [
        `{
  "shouldExpand": true,
  "confidence": 0.85,
  "reasoning": "Theme contains distinct authentication and authorization patterns",
  "businessLogicPatterns": ["User Authentication", "Permission Management"],
  "userFlowPatterns": ["Login Flow", "Access Control"],
  "subThemes": [
    {
      "name": "User Authentication System",
      "description": "Handles user login and session management",
      "businessImpact": "Secure user access to the application",
      "relevantFiles": ["auth.ts", "session.ts"],
      "confidence": 0.9
    }
  ]
}`,
      ],
      constraints: [
        'Maximum 4 sub-themes per expansion',
        'Each sub-theme must have confidence >= 0.6',
        'Sub-themes must be distinct from each other',
        'Maintain business focus over technical details',
      ],
    });
  }

  /**
   * Template for cross-level similarity analysis
   */
  static createCrossLevelSimilarityPrompt(
    theme1Name: string,
    theme1Description: string,
    theme1Level: number,
    theme1Files: string[],
    theme2Name: string,
    theme2Description: string,
    theme2Level: number,
    theme2Files: string[],
    levelDifference: number
  ): string {
    return this.createJsonPrompt({
      instruction: `Analyze these two themes from different hierarchy levels for similarity and relationship:

THEME 1:
Level: ${theme1Level}
Name: ${theme1Name}
Description: ${theme1Description}
Files: ${theme1Files.join(', ')}

THEME 2:
Level: ${theme2Level}
Name: ${theme2Name}
Description: ${theme2Description}
Files: ${theme2Files.join(', ')}

Level Difference: ${levelDifference}

Determine the relationship between these themes across hierarchy levels:

1. SIMILARITY SCORE (0-1): How similar are these themes in business purpose?
2. RELATIONSHIP TYPE: 
   - "duplicate": Essentially the same theme (should be merged)
   - "overlap": Significant overlap in scope (should be consolidated)
   - "related": Related but distinct (keep separate)
   - "distinct": Completely different themes

3. MERGE ACTION:
   - "merge_up": Merge into higher-level theme
   - "merge_down": Merge into lower-level theme
   - "merge_sibling": Merge at same level under common parent
   - "keep_separate": Keep as separate themes

Focus on business value and avoid merging themes with distinct business purposes.`,
      jsonSchema: `{
  "similarityScore": number,
  "relationshipType": "duplicate|overlap|related|distinct",
  "action": "merge_up|merge_down|merge_sibling|keep_separate",
  "confidence": number,
  "reasoning": "detailed explanation"
}`,
      examples: [
        `{
  "similarityScore": 0.85,
  "relationshipType": "duplicate",
  "action": "merge_up",
  "confidence": 0.9,
  "reasoning": "Both themes handle user authentication with nearly identical scope and files"
}`,
        `{
  "similarityScore": 0.3,
  "relationshipType": "distinct",
  "action": "keep_separate",
  "confidence": 0.95,
  "reasoning": "Themes address completely different business concerns - authentication vs data processing"
}`,
      ],
      constraints: [
        'Similarity score must be between 0 and 1',
        'Confidence must be between 0 and 1',
        'Reasoning must explain the decision clearly',
        'Consider file overlap and business purpose',
      ],
    });
  }

  /**
   * Template for theme naming
   */
  static createThemeNamingPrompt(
    description: string,
    businessImpact: string,
    codeSnippets: string[]
  ): string {
    return this.createJsonPrompt({
      instruction: `Generate a concise, business-focused name for this code theme:

Description: ${description}
Business Impact: ${businessImpact}
Code Context: ${codeSnippets.slice(0, 2).join('\n---\n')}

Create a theme name that:
1. Focuses on business value, not technical implementation
2. Is clear and understandable to non-technical stakeholders
3. Captures the primary business purpose
4. Is concise (2-6 words)

The name should answer "what business value does this provide?"`,
      jsonSchema: '{"name": "Business-focused theme name"}',
      examples: [
        '{"name": "Improve User Authentication"}',
        '{"name": "Streamline Payment Processing"}',
        '{"name": "Enhance Data Validation"}',
        '{"name": "Automate Report Generation"}',
      ],
      constraints: [
        'Name must be 2-6 words',
        'Focus on business value',
        'Avoid technical jargon',
        'Use action verbs when possible',
      ],
    });
  }
}
