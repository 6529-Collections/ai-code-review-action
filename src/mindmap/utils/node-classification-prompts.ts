import { Theme } from '@/shared/types/theme-types';
import { CodeChange } from '@/shared/utils/ai-code-analyzer';

export class NodeClassificationPrompts {
  
  /**
   * Build classification prompt for a theme
   */
  buildClassificationPrompt(theme: Theme): string {
    const contextInfo = this.buildContextInfo(theme);
    const examples = this.getClassificationExamples();
    
    return `You are an expert software architect analyzing code changes to determine their review classification.

${contextInfo}

CLASSIFICATION TASK:
Analyze this code change and classify it into one of three categories based on its characteristics and scope:

CLASSIFICATION CATEGORIES:

1. **atomic-technical**: 
   - Single, focused technical change
   - Unit-testable in isolation
   - Affects 1-3 files typically
   - Clear technical boundary
   - Examples: Bug fix, refactor single function, add utility method

2. **business-feature**: 
   - Implements or modifies business capability
   - Affects user workflows or business logic
   - Has clear business value/impact
   - May span multiple technical components
   - Examples: New user feature, payment flow, business rule change

3. **integration-hybrid**: 
   - Multiple components working together
   - Architectural or cross-cutting change
   - Affects system integration points
   - Complex dependencies or interactions
   - Examples: API integration, service coordination, infrastructure change

ANALYSIS FACTORS:
- **Code Scope**: Number of files, functions, classes affected
- **Business Impact**: Does it change user experience or business logic?
- **Technical Complexity**: Is it a simple change or complex integration?
- **Testing Strategy**: What type of testing is most appropriate?
- **Dependencies**: How many other components are affected?

${examples}

CLASSIFICATION RULES:
1. Prioritize business impact over technical complexity
2. Consider the primary purpose of the change
3. Atomic changes can still have business value
4. Integration changes often affect multiple business domains
5. When in doubt, consider the testing strategy that would be most effective

RESPOND WITH ONLY VALID JSON:
{
  "nodeType": "atomic-technical|business-feature|integration-hybrid",
  "reasoning": "2-3 sentence explanation of why this classification was chosen",
  "confidence": 0.0-1.0
}`;
  }

  /**
   * Build context information for the theme
   */
  private buildContextInfo(theme: Theme): string {
    const sections = [
      `THEME ANALYSIS:`,
      `Theme Name: ${theme.name}`,
      `Description: ${theme.description || 'Not specified'}`,
      `Level: ${theme.level || 0} (${theme.level === 0 ? 'root' : 'child'})`
    ];

    if (theme.affectedFiles?.length) {
      sections.push(`Files Affected (${theme.affectedFiles.length}): ${theme.affectedFiles.slice(0, 5).join(', ')}${theme.affectedFiles.length > 5 ? '...' : ''}`);
    }

    if (theme.mainFunctionsChanged?.length) {
      sections.push(`Key Functions: ${theme.mainFunctionsChanged.slice(0, 3).join(', ')}${theme.mainFunctionsChanged.length > 3 ? '...' : ''}`);
    }

    if (theme.mainClassesChanged?.length) {
      sections.push(`Key Classes: ${theme.mainClassesChanged.slice(0, 3).join(', ')}${theme.mainClassesChanged.length > 3 ? '...' : ''}`);
    }

    if (theme.technicalSummary) {
      sections.push(`Technical Summary: ${theme.technicalSummary}`);
    }

    if (theme.keyChanges?.length) {
      sections.push(`Key Changes:`);
      theme.keyChanges.slice(0, 3).forEach(change => {
        sections.push(`- ${change}`);
      });
    }

    if (theme.userScenario) {
      sections.push(`User Scenario: ${theme.userScenario}`);
    }

    if (theme.context) {
      sections.push(`Context: ${theme.context}`);
    }

    // Add code complexity indicators
    if (theme.codeChanges?.length) {
      const fileTypes = this.analyzeFileTypes(theme.codeChanges);
      if (fileTypes.length > 0) {
        sections.push(`File Types: ${fileTypes.join(', ')}`);
      }
    }

    if (theme.codeMetrics?.filesChanged) {
      sections.push(`Files Changed: ${theme.codeMetrics.filesChanged}`);
    }

    if (theme.confidence) {
      sections.push(`Original Confidence: ${theme.confidence.toFixed(2)}`);
    }

    return sections.join('\n');
  }

  /**
   * Analyze file types from code changes
   */
  private analyzeFileTypes(codeChanges: CodeChange[]): string[] {
    const types = new Set<string>();
    
    for (const change of codeChanges) {
      if (change.isTestFile) {
        types.add('test');
      } else if (change.isConfigFile) {
        types.add('config');
      } else if (change.fileType) {
        types.add(change.fileType);
      }
    }
    
    return Array.from(types);
  }

  /**
   * Get classification examples for better AI understanding
   */
  private getClassificationExamples(): string {
    return `
CLASSIFICATION EXAMPLES:

**atomic-technical** Examples:
✅ "Fix null pointer exception in user validation"
   - Single bug fix, clear technical boundary, unit-testable
✅ "Refactor password encryption helper method"
   - Single function change, technical improvement, isolated
✅ "Add input validation to email field"
   - Single component change, clear scope, unit-testable

**business-feature** Examples:
✅ "Implement user profile editing workflow"
   - New user capability, business value, affects user experience
✅ "Add payment processing with Stripe integration"
   - Business functionality, user-facing feature, business impact
✅ "Create admin dashboard for user management"
   - Business capability, user workflow, business domain focus

**integration-hybrid** Examples:
✅ "Integrate authentication service with user management"
   - Multiple services, architectural change, system integration
✅ "Add caching layer across multiple API endpoints"
   - Cross-cutting concern, system-wide impact, architectural
✅ "Implement event-driven messaging between services"
   - System integration, multiple components, architectural change

**Edge Cases & Decisions:**
- Large refactoring with business impact → **business-feature** (focus on business outcome)
- Small integration change → **atomic-technical** (if scope is truly atomic)
- Business rule in single file → **business-feature** (business logic is key)
- Multiple files for one component → **atomic-technical** (if single responsibility)
`;
  }
}