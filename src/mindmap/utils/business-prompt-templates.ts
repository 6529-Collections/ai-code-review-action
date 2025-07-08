/**
 * Business-first prompt templates for transforming technical code analysis
 * into business-oriented themes aligned with PRD requirements
 */

import { PromptTemplates, PromptConfig } from './prompt-templates';

export interface BusinessCapabilityConfig {
  userCapability: string;
  businessValue: string;
  businessProcess: string;
  userScenarios: string[];
  technicalScope: string;
}

export interface ProgressiveLanguageConfig {
  level: number;
  maxWords: number;
  audienceFocus: 'executive' | 'product-manager' | 'technical-product' | 'developer';
  allowedTerms: string[];
  forbiddenTerms: string[];
}

export interface NamingStrategy {
  changeComplexity: 'simple' | 'moderate' | 'complex';
  namingApproach: 'technical-specific' | 'hybrid' | 'business-focused';
  maxWords: number;
  allowTechnicalTerms: boolean;
}

export interface ComplexityAnalysis {
  isSimpleTechnicalChange: boolean;
  isComplexBusinessFeature: boolean;
  confidence: number;
  reasoning: string;
}

export class BusinessPromptTemplates extends PromptTemplates {
  
  /**
   * Business capability identification prompt - transforms technical changes to user value
   * Now includes complexity-aware naming strategy
   */
  static createBusinessImpactPrompt(
    filePath: string,
    codeChanges: string,
    technicalContext: string,
    changeComplexity?: 'simple' | 'moderate' | 'complex'
  ): string {
    const strategy = this.determineNamingStrategy(changeComplexity, codeChanges, filePath);
    return this.createComplexityAwarePrompt(filePath, codeChanges, technicalContext, strategy);
  }

  /**
   * Create prompt based on naming strategy
   */
  private static createComplexityAwarePrompt(
    filePath: string,
    codeChanges: string,
    technicalContext: string,
    strategy: NamingStrategy
  ): string {
    return this.createJsonPrompt({
      instruction: `You are analyzing code changes with ${strategy.namingApproach.toUpperCase()} naming approach.

NAMING STRATEGY: ${strategy.namingApproach} (${strategy.changeComplexity} complexity)
${this.getNamingInstructions(strategy)}

CONTEXT:
File: ${filePath}
Code Changes: ${codeChanges}
Technical Context: ${technicalContext}

${this.getAnalysisQuestions(strategy)}`,
      
      jsonSchema: `{
  "businessCapability": "${this.getNamePrompt(strategy)}",
  "userValue": "Direct benefit to end users (max 12 words)",
  "businessProcess": "Business workflow this improves (max 15 words)",
  "userScenarios": ["Specific user scenarios this enables (array)"],
  "businessDomain": "Primary business area affected",
  "executiveSummary": "Executive summary of business impact (max 25 words)",
  "technicalImplementation": "Technical approach and implementation details",
  "confidence": 0.0-1.0
}`,
      
      examples: [
        `{
  "businessCapability": "Streamline User Password Recovery",
  "userValue": "Users reset passwords without contacting support",
  "businessProcess": "Self-service account recovery reduces support burden",
  "userScenarios": ["User forgets password", "Account locked situations"],
  "businessDomain": "User Account Management",
  "executiveSummary": "Reduces support costs while improving user experience through automated password recovery.",
  "technicalImplementation": "Email verification and reset token system",
  "confidence": 0.9
}`,
        `{
  "businessCapability": "Accelerate Developer Productivity",
  "userValue": "Developers find and fix issues 50% faster",
  "businessProcess": "Streamlined debugging and error diagnosis workflow",
  "userScenarios": ["Production issue investigation", "Code quality analysis"],
  "businessDomain": "Development Workflow Optimization", 
  "executiveSummary": "Improves development velocity and reduces time-to-resolution for customer issues.",
  "technicalImplementation": "Centralized logging and monitoring system",
  "confidence": 0.85
}`
      ],
      
      constraints: [
        'Business capability must be user-facing or directly support user value',
        'User value must be measurable and specific',
        'Business process must connect to actual business workflows',
        'Executive summary must be compelling to non-technical stakeholders',
        'Avoid technical terms in business fields',
        'Confidence reflects certainty of business impact assessment'
      ]
    });
  }

  /**
   * Determine naming strategy based on change complexity and patterns
   */
  private static determineNamingStrategy(
    complexity: string = 'moderate',
    codeChanges: string,
    filePath: string
  ): NamingStrategy {
    const analysis = this.analyzeChangeComplexity(codeChanges, filePath);
    
    // Simple technical changes get technical-specific naming
    if (complexity === 'simple' || analysis.isSimpleTechnicalChange) {
      return {
        changeComplexity: 'simple',
        namingApproach: 'technical-specific',
        maxWords: 12,
        allowTechnicalTerms: true
      };
    }
    
    // Complex business features get business-focused naming
    if (complexity === 'complex' || analysis.isComplexBusinessFeature) {
      return {
        changeComplexity: 'complex', 
        namingApproach: 'business-focused',
        maxWords: 8,
        allowTechnicalTerms: false
      };
    }
    
    // Moderate changes get hybrid approach
    return {
      changeComplexity: 'moderate',
      namingApproach: 'hybrid',
      maxWords: 10,
      allowTechnicalTerms: true
    };
  }

  /**
   * Analyze code changes to determine complexity
   */
  private static analyzeChangeComplexity(
    codeChanges: string,
    filePath: string
  ): ComplexityAnalysis {
    const changeText = codeChanges.toLowerCase();
    const pathText = filePath.toLowerCase();
    
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
      /add.*semicolon/
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
      /feature.*flag/
    ];
    
    const isSimple = simplePatterns.some(pattern => pattern.test(changeText)) ||
                    pathText.includes('test') ||
                    pathText.includes('spec') ||
                    (changeText.includes('import') && changeText.split('\n').length < 5);
    
    const isComplex = complexPatterns.some(pattern => pattern.test(changeText)) ||
                     changeText.split('file').length > 3 ||
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
   * Get naming instructions based on strategy
   */
  private static getNamingInstructions(strategy: NamingStrategy): string {
    switch (strategy.namingApproach) {
      case 'technical-specific':
        return `FOCUS: Describe the specific technical action taken
- Use precise technical terms that clarify what changed
- Mention specific functions, methods, or patterns modified
- Aim for clarity over business abstraction
- Example: "Replace console.warn with structured logger calls"`;
        
      case 'business-focused':
        return `FOCUS: Emphasize user value and business capability
- Use business language avoiding technical implementation details
- Focus on user outcomes and business processes
- Think from product manager perspective
- Example: "Enhance System Reliability and User Experience"`;
        
      case 'hybrid':
        return `FOCUS: Balance technical specificity with business context
- Include both what technically changed and why it matters
- Use technical terms when they add clarity
- Connect technical action to business value
- Example: "Implement Structured Logging for Better Error Diagnosis"`;
        
      default:
        return 'FOCUS: Analyze the change and provide appropriate naming';
    }
  }

  /**
   * Get analysis questions based on strategy
   */
  private static getAnalysisQuestions(strategy: NamingStrategy): string {
    switch (strategy.namingApproach) {
      case 'technical-specific':
        return `ANALYSIS QUESTIONS:
1. What specific technical change was made?
2. Which functions, methods, or patterns were modified?
3. What was replaced, added, or removed?
4. How would a developer describe this change?`;
        
      case 'business-focused':
        return `ANALYSIS QUESTIONS:
1. What user problem does this solve or improve?
2. What business process does this enable or enhance?
3. What user journey or workflow does this affect?
4. How does this create value for end users?`;
        
      case 'hybrid':
        return `ANALYSIS QUESTIONS:
1. What technical change was made and why?
2. How does this technical change improve user experience?
3. What business capability does this technical improvement enable?
4. What would both a developer and product manager find valuable about this change?`;
        
      default:
        return 'Analyze the change for appropriate naming approach.';
    }
  }

  /**
   * Get name prompt based on strategy
   */
  private static getNamePrompt(strategy: NamingStrategy): string {
    switch (strategy.namingApproach) {
      case 'technical-specific':
        return `Specific technical action description (max ${strategy.maxWords} words)`;
      case 'business-focused':
        return `Business capability or user value created (max ${strategy.maxWords} words)`;
      case 'hybrid':
        return `Technical change with business context (max ${strategy.maxWords} words)`;
      default:
        return `Change description (max ${strategy.maxWords} words)`;
    }
  }

  /**
   * Business domain classification - maps code to business capabilities
   */
  static createBusinessCapabilityPrompt(
    filePath: string,
    codeChanges: string,
    functionalContext: string
  ): string {
    return this.createJsonPrompt({
      instruction: `You are a business analyst identifying the PRIMARY USER CAPABILITY affected by code changes.

USER-CENTRIC ANALYSIS:
File: ${filePath}
Changes: ${codeChanges}
Context: ${functionalContext}

BUSINESS CAPABILITY FRAMEWORK:
Ask: "What can users now DO that they couldn't before, or do BETTER than before?"

PRIMARY CAPABILITY CATEGORIES (Choose ONE):
- "User Account Management" - Registration, login, profile, preferences, security
- "Content Discovery" - Search, browse, recommendations, navigation, filtering
- "Transaction Processing" - Payments, orders, purchases, bookings, financial operations
- "Communication & Collaboration" - Messaging, notifications, sharing, team features
- "Data Management" - Upload, organize, analyze, export, backup user data
- "Workflow Automation" - Process simplification, task automation, efficiency tools
- "User Experience Enhancement" - Interface improvements, accessibility, performance
- "Content Creation & Publishing" - Authoring, editing, publishing, content management
- "Security & Privacy" - Data protection, access control, compliance, privacy controls
- "Integration & Connectivity" - Third-party connections, API access, data synchronization
- "Analytics & Insights" - Reporting, dashboards, data visualization, metrics
- "Development Workflow Optimization" - Developer tools, debugging, monitoring, deployment`,

      jsonSchema: `{
  "primaryCapability": "Main user capability (from categories above)",
  "userValue": "What users can now accomplish (max 15 words)",
  "businessImpact": "Business outcome this enables (max 12 words)",
  "userJourney": "Step in user workflow this improves",
  "affectedUserTypes": ["Primary users who benefit"],
  "businessMetrics": ["Metrics this improvement could affect"],
  "confidence": 0.0-1.0,
  "reasoning": "Why this capability classification (max 20 words)"
}`,

      examples: [
        `{
  "primaryCapability": "User Account Management",
  "userValue": "Users create accounts and access personalized features securely",
  "businessImpact": "Increased user engagement and retention through personalization",
  "userJourney": "Account creation and initial setup",
  "affectedUserTypes": ["New users", "Returning users"],
  "businessMetrics": ["User registration rate", "Time to first value", "Account security incidents"],
  "confidence": 0.9,
  "reasoning": "Changes directly affect user registration and authentication flows"
}`,
        `{
  "primaryCapability": "Development Workflow Optimization", 
  "userValue": "Developers diagnose and resolve issues faster and more effectively",
  "businessImpact": "Reduced development costs and faster feature delivery",
  "userJourney": "Error investigation and debugging process",
  "affectedUserTypes": ["Software developers", "DevOps engineers"],
  "businessMetrics": ["Time to resolution", "Developer productivity", "Bug fix cycle time"],
  "confidence": 0.85,
  "reasoning": "Improves developer tools and debugging capabilities for faster issue resolution"
}`
      ],

      constraints: [
        'Must choose from predefined capability categories',
        'User value must be specific and measurable',
        'Business impact must connect to actual business outcomes',
        'User journey must be a recognizable workflow step',
        'Affected user types must be specific roles or personas',
        'Business metrics must be trackable and relevant'
      ]
    });
  }

  /**
   * Business hierarchy expansion - determines if capability needs sub-capabilities
   */
  static createBusinessHierarchyPrompt(
    capability: string,
    userValue: string,
    businessProcess: string,
    currentDepth: number,
    technicalScope: string
  ): string {
    return this.createJsonPrompt({
      instruction: `You are a product manager organizing user capabilities into business hierarchy.

CURRENT BUSINESS CAPABILITY: "${capability}"
User Value: ${userValue}
Business Process: ${businessProcess}
Current Depth: ${currentDepth}
Technical Scope: ${technicalScope}

BUSINESS DECOMPOSITION CRITERIA:
- EXPAND if this capability serves MULTIPLE distinct user needs
- EXPAND if users accomplish this through MULTIPLE distinct workflows
- EXPAND if this affects MULTIPLE business processes  
- EXPAND if this capability is too broad for users to understand easily
- ATOMIC if this serves ONE specific user need completely
- ATOMIC if this represents a single, cohesive user workflow

BUSINESS HIERARCHY RULES:
Level 0: User-facing capabilities ("Enable Secure User Login")
Level 1: Business processes ("Account Verification", "Profile Setup") 
Level 2: User workflows ("Email Confirmation", "Welcome Onboarding")
Level 3+: Technical implementations (only if absolutely necessary for user understanding)

AUDIENCE PROGRESSIVE LANGUAGE:
- Level 0: Executive language - business outcomes and user value
- Level 1: Product manager language - business processes and user workflows
- Level 2: Technical product language - system behaviors and user interactions
- Level 3+: Developer language - implementation details (avoid if possible)`,

      jsonSchema: `{
  "shouldExpand": boolean,
  "businessReasoning": "User-centric reason for expansion/atomic decision",
  "atomicReason": "If atomic, why this is a complete user capability",
  "userCapabilities": [
    {
      "name": "Specific user capability (max 8 words)",
      "userValue": "What users accomplish (max 12 words)", 
      "businessProcess": "Business workflow supported (max 10 words)",
      "userScenarios": ["When users need this capability"],
      "audienceLevel": "executive|product-manager|technical-product|developer",
      "technicalScope": "Implementation details (max 8 words)"
    }
  ],
  "confidence": 0.0-1.0
}`,

      examples: [
        `{
  "shouldExpand": true,
  "businessReasoning": "User account management involves distinct workflows: creation, verification, and maintenance",
  "atomicReason": null,
  "userCapabilities": [
    {
      "name": "Account Creation Workflow",
      "userValue": "New users join platform with guided registration",
      "businessProcess": "User onboarding and initial setup",
      "userScenarios": ["First-time visitor wants to sign up", "User needs account for premium features"],
      "audienceLevel": "product-manager",
      "technicalScope": "Registration form and validation logic"
    },
    {
      "name": "Account Verification Process", 
      "userValue": "Users confirm identity for account security",
      "businessProcess": "Identity verification and fraud prevention",
      "userScenarios": ["Email verification required", "Two-factor authentication setup"],
      "audienceLevel": "product-manager", 
      "technicalScope": "Email verification and 2FA systems"
    }
  ],
  "confidence": 0.9
}`,
        `{
  "shouldExpand": false,
  "businessReasoning": "Password reset is a single, cohesive user workflow with one clear outcome",
  "atomicReason": "Users have one specific need: regain access to their account when password is forgotten",
  "userCapabilities": [],
  "confidence": 0.95
}`
      ],

      constraints: [
        'Maximum 4 sub-capabilities per expansion',
        'Each sub-capability must serve distinct user needs',
        'Sub-capabilities must not overlap in user value',
        'Audience level must progress logically with depth',
        'Business reasoning must focus on user needs, not technical complexity',
        'Atomic decisions must justify why further expansion serves no user value'
      ]
    });
  }

  /**
   * Progressive language enforcement - ensures appropriate language for hierarchy level
   */
  static createProgressiveLanguagePrompt(
    currentName: string,
    currentDescription: string,
    targetLevel: number,
    targetAudience: 'executive' | 'product-manager' | 'technical-product' | 'developer'
  ): string {
    const audienceConfig = this.getAudienceConfig(targetAudience);
    
    return this.createJsonPrompt({
      instruction: `Transform this theme to use appropriate language for ${targetAudience} audience at hierarchy level ${targetLevel}.

CURRENT THEME:
Name: ${currentName}
Description: ${currentDescription}

TARGET AUDIENCE: ${targetAudience.toUpperCase()}
${audienceConfig.description}

LANGUAGE REQUIREMENTS:
- Maximum ${audienceConfig.maxWords} words
- Focus: ${audienceConfig.focus}
- Use these terms: ${audienceConfig.allowedTerms.join(', ')}
- Avoid these terms: ${audienceConfig.forbiddenTerms.join(', ')}
- Tone: ${audienceConfig.tone}

TRANSFORMATION GOALS:
1. Make the theme understandable to the target audience
2. Focus on value that matters to this audience 
3. Use appropriate level of technical detail
4. Maintain business accuracy while adjusting language`,

      jsonSchema: `{
  "transformedName": "Theme name for ${targetAudience} (max ${audienceConfig.nameWords} words)",
  "transformedDescription": "Description for ${targetAudience} (max ${audienceConfig.maxWords} words)",
  "audienceValue": "Why this matters to ${targetAudience} specifically",
  "confidence": 0.0-1.0
}`,

      examples: audienceConfig.examples,

      constraints: [
        `Name must be ${audienceConfig.nameWords} words or less`,
        `Description must be ${audienceConfig.maxWords} words or less`,
        `Must use ${targetAudience} appropriate language`,
        'Must maintain factual accuracy',
        'Must focus on value relevant to target audience'
      ]
    });
  }

  /**
   * Business value consolidation - merges themes by user value rather than technical similarity
   */
  static createBusinessValueConsolidationPrompt(
    themes: Array<{
      name: string;
      userValue: string;
      businessProcess: string;
      technicalScope: string;
    }>
  ): string {
    const themesList = themes.map((theme, index) => 
      `Theme ${index + 1}: "${theme.name}"
User Value: ${theme.userValue}
Business Process: ${theme.businessProcess}
Technical Scope: ${theme.technicalScope}`
    ).join('\n\n');

    return this.createJsonPrompt({
      instruction: `Analyze these themes for business value consolidation opportunities.

THEMES TO ANALYZE:
${themesList}

BUSINESS CONSOLIDATION CRITERIA:
- Themes serve the SAME user need (even if technical implementation differs)
- Themes support the SAME business process workflow
- Themes provide similar user value propositions
- Users would perceive these as the same capability

IMPORTANT: Only consolidate themes that users would see as the same capability.
Do NOT consolidate based on technical similarity alone.

CONSOLIDATION RULES:
1. User value must be nearly identical
2. Business process must be the same or complementary
3. Combined theme must be clearer to users than separate themes
4. Consolidation must simplify user understanding, not complicate it`,

      jsonSchema: `{
  "consolidationGroups": [
    {
      "themeIndices": [1, 3],
      "consolidatedName": "Single capability name (max 8 words)",
      "consolidatedUserValue": "Combined user value (max 15 words)",
      "consolidatedBusinessProcess": "Unified business process (max 12 words)",
      "userBenefit": "Why consolidation improves user understanding",
      "reasoning": "Business justification for consolidation"
    }
  ],
  "standaloneThemes": [2, 4],
  "confidence": 0.0-1.0
}`,

      examples: [
        `{
  "consolidationGroups": [
    {
      "themeIndices": [1, 3],
      "consolidatedName": "Streamline User Password Management",
      "consolidatedUserValue": "Users manage passwords securely without support contact",
      "consolidatedBusinessProcess": "Self-service account security management",
      "userBenefit": "Users see one coherent password management capability instead of fragmented features",
      "reasoning": "Both themes serve the same user need: secure password management independence"
    }
  ],
  "standaloneThemes": [2],
  "confidence": 0.9
}`
      ],

      constraints: [
        'Only consolidate themes with truly similar user value',
        'Consolidated themes must be clearer than separate themes',
        'User benefit must explain improved user understanding',
        'Reasoning must justify from user perspective, not technical perspective'
      ]
    });
  }

  /**
   * Get audience-specific configuration for progressive language
   */
  private static getAudienceConfig(audience: string) {
    const configs = {
      executive: {
        description: 'Senior leadership focused on business outcomes, ROI, and strategic value',
        maxWords: 12,
        nameWords: 6,
        focus: 'Business outcomes and strategic value',
        allowedTerms: ['revenue', 'efficiency', 'growth', 'value', 'competitive advantage', 'user satisfaction'],
        forbiddenTerms: ['API', 'function', 'class', 'method', 'implementation', 'refactor', 'technical debt'],
        tone: 'Strategic and outcome-focused',
        examples: [
          `{
  "transformedName": "Accelerate Customer Onboarding",
  "transformedDescription": "Streamline new customer signup process to increase conversion rates and reduce support burden",
  "audienceValue": "Drives revenue growth through improved customer acquisition efficiency",
  "confidence": 0.9
}`
        ]
      },
      'product-manager': {
        description: 'Product managers focused on user workflows, business processes, and feature value',
        maxWords: 18,
        nameWords: 8,
        focus: 'User workflows and business processes',
        allowedTerms: ['workflow', 'process', 'user experience', 'feature', 'integration', 'automation'],
        forbiddenTerms: ['class', 'method', 'function', 'code', 'implementation details'],
        tone: 'Process-oriented and user-focused',
        examples: [
          `{
  "transformedName": "Improve User Authentication Workflow",
  "transformedDescription": "Enhance login process with streamlined verification steps and improved user experience across multiple touchpoints",
  "audienceValue": "Reduces user friction and improves conversion rates through better authentication flow",
  "confidence": 0.85
}`
        ]
      },
      'technical-product': {
        description: 'Technical product managers focused on system behavior and integration points',
        maxWords: 25,
        nameWords: 10,
        focus: 'System behavior and technical capabilities',
        allowedTerms: ['service', 'component', 'integration', 'validation', 'processing', 'system'],
        forbiddenTerms: ['specific function names', 'variable names', 'detailed implementation'],
        tone: 'System-focused with business context',
        examples: [
          `{
  "transformedName": "Authentication Service Integration and Validation",
  "transformedDescription": "Implement robust user authentication service with multi-factor validation and secure session management for improved system security",
  "audienceValue": "Provides technical foundation for secure user access while maintaining development flexibility",
  "confidence": 0.8
}`
        ]
      },
      developer: {
        description: 'Software developers focused on implementation details and technical specifications',
        maxWords: 35,
        nameWords: 15,
        focus: 'Implementation details and technical specifications',
        allowedTerms: ['function', 'class', 'method', 'API', 'component', 'service', 'implementation'],
        forbiddenTerms: [],
        tone: 'Technical and implementation-focused',
        examples: [
          `{
  "transformedName": "Implement authenticateUser() and validateSession() methods",
  "transformedDescription": "Create user authentication functions with JWT token generation, session validation middleware, and database integration for secure user access control",
  "audienceValue": "Provides clear implementation guidelines and technical specifications for secure authentication features",
  "confidence": 0.95
}`
        ]
      }
    };

    return configs[audience as keyof typeof configs] || configs.developer;
  }
}