# Product Requirements Document: Intent-Aware Hierarchical AI Code Review (Phase 2)

## Vision Statement
Transform the intent-based hierarchical PR mindmap into an intelligent, context-aware code review system that validates changes against their detected intent - ensuring code achieves its intended purpose rather than just meeting quality standards.

## AI-First Review Philosophy

### Core Principle: AI-Driven Review Decisions
All review analysis must use AI for code quality assessment, risk evaluation, and test coverage analysis. Never use algorithmic shortcuts or mechanical rules like checking if files contain 'test' to skip review. Let AI determine review depth and focus based on actual code complexity, rejecting procedural logic in favor of decisions that emerge from AI understanding rather than counting patterns.

### AI Decision Supremacy
AI analyzes actual code patterns in context of the detected intent rather than abstract quality standards. AI evaluates whether changes achieve their intended purpose, not just correctness. AI determines if the implementation is complete based on intent requirements. AI identifies contradictions between code changes and stated intent. AI adapts review criteria based on intent type (removal, refactoring, enhancement, etc.).

### Intent-Aware Node Review (AI-Driven)
AI analyzes each mindmap node in context of its detected intent:

```yaml
AI Input Context:
  - detectedIntent: Type and confidence from Phase 1
  - intentAlignment: How this node serves the intent
  - codeSnippets: Full git diffs
  - intentCompleteness: Progress toward intent completion
  - contradictions: Changes that oppose the intent

AI Determines:
  - reviewFocus: intent-completion|intent-contradiction|intent-quality
  - issueTypes: missing-implementation|contradicts-intent|poor-execution
  - completionGaps: What's needed to fully achieve intent
  - riskLevel: Based on intent incompleteness or contradictions
  - recommendations: Intent-specific suggestions
```

**Intent-Driven Classification**: Review criteria change based on intent type. A "removal" intent flags remaining instances as issues. A "refactoring" intent flags behavior changes as issues. An "enhancement" intent flags missing functionality as issues.

## Executive Summary
Phase 2 leverages the intent-based hierarchical mindmap from Phase 1 to validate that code changes achieve their detected intent. Rather than reviewing for generic quality, the system verifies intent completion, identifies contradictions, and ensures changes serve their stated purpose.

## Core Review Philosophy

### Bottom-Up Analysis
The system starts small with atomic, unit-testable changes and builds understanding where each level adds context from its children. Progressive validation verifies correctness at each abstraction level while higher levels inherit insights from below through context accumulation.

### Review Dimensions at Each Level
Each level examines intent alignment to verify changes support the detected intent, assesses completeness to ensure the intent is fully implemented, identifies contradictions where changes work against the intent, evaluates execution quality within the context of the intent, and performs risk assessment based on intent incompleteness or conflicts.

## Review Process Architecture

### Level-Specific Review Types

#### Leaf Level (Atomic Changes)
Leaf level reviews verify each atomic change serves the intent. They examine whether the change supports or contradicts the intent, if the implementation is complete for this atomic unit, quality of execution within intent context, and identification of missing pieces needed for intent completion. The context needed includes detected intent, this node's intent alignment score, and the specific code changes.

#### Intermediate Levels
Intermediate levels assess how components collectively serve the intent. They verify all child nodes align with the intent, identify gaps in intent implementation across components, check for contradictions between different parts, and evaluate if the combined changes achieve the intent goal. The context needed includes parent intent, all child intent alignments, and completion metrics from children.

#### Root Level (Intent Verification)
Root level reviews confirm the overall intent is achieved. They validate the detected intent matches actual changes, assess overall completeness percentage, identify all remaining gaps for full intent achievement, and evaluate risks of incomplete or contradictory implementation. The context needed includes the detected intent with confidence, all descendant completion metrics, and any unaligned changes.

## Review Data Structure

### Data Structures
Input comes from Phase 1 mindmap nodes containing ID, name, description, business impact, affected files, code snippets, confidence scores, child themes, technical details, and user impact. Output produces review nodes with source references, review analysis including findings and quality metrics, context integration from the mindmap data, and final decisions with recommendations and reasoning.

## Recursive Review Algorithm

### Core Approach: Natural Recursion
```typescript
async reviewTheme(theme: ConsolidatedTheme): Promise<ReviewResult> {
  // Step 1: Review all children in parallel (natural dependency handling)
  const childResults = await Promise.all(
    theme.childThemes?.map(child => this.reviewTheme(child)) || []
  );
  
  // Step 2: AI compresses child context for parent review
  const compressedContext = childResults.length > 0 
    ? await this.compressChildContext(childResults, theme)
    : null;
    
  // Step 3: Review this theme with compressed child context
  return await this.reviewSingleTheme(theme, compressedContext);
}
```

### Benefits of Recursive Approach
The recursive approach automatically handles dependencies since children always complete before parents, enables natural parallelization where all themes at the same level process simultaneously, provides simple coordination through the recursion stack, and achieves optimal resource usage without complex orchestration.

### Context Flow Management
```typescript
// AI compresses child results to prevent context explosion
async compressChildContext(childResults: ReviewResult[], parentTheme: ConsolidatedTheme) {
  // AI selects relevant child information for parent review
  // Prevents 47 individual reviews from overwhelming parent context
  // Maintains AI-first principle (no mechanical filtering)
}
```

### Parallel Processing Strategy
```
Root Theme A (20 levels deep) |
Root Theme B (18 levels deep) | → Process in parallel
Root Theme C (5 levels deep)  |

Within each root:
  Level N: All themes process in parallel
  Level N-1: Waits for Level N to complete, then processes in parallel
  Level N-2: Waits for Level N-1 to complete, then processes in parallel
  ...
  Root: Waits for Level 1 to complete, then processes
```
### Processing Flow Example

**Given hierarchy:**
```
Root: "User Authentication"
├── Intermediate: "OAuth Integration" 
│   ├── Leaf: "Token Validation"
│   └── Leaf: "Session Management"
└── Intermediate: "Password Security"
    ├── Leaf: "Hash Algorithm"
    └── Leaf: "Input Validation"
```

**Execution order (automatic via recursion):**
1. **Parallel Leaf Processing**: "Token Validation", "Session Management", "Hash Algorithm", "Input Validation" all start simultaneously
2. **Intermediate Processing**: Once leaves complete, "OAuth Integration" and "Password Security" start in parallel (each with compressed child context)
3. **Root Processing**: Once intermediates complete, "User Authentication" processes with compressed intermediate context

**Context Compression at Each Level:**
- **Leaves**: Raw code review (implementation correctness)
- **Intermediates**: Integration assessment with compressed leaf summaries
- **Root**: Business value assessment with compressed intermediate summaries

**Key Insight**: Each level focuses on appropriate abstraction level, with AI managing context relevance through intelligent compression rather than mechanical rules.

## Simplified AI Prompting Strategy

### Context Building Through Recursion
Leaf levels receive direct code review with git diffs and business context, while parent levels review with AI-compressed child context. Recursion naturally provides appropriate context at each level without complex orchestration.

### Review Prompt Templates

#### Leaf Level Prompt (Intent Validation)
```
You are reviewing if this atomic change serves its intended purpose.

DETECTED INTENT: {intentType} - {intentDescription}
INTENT CONFIDENCE: {intentConfidence}
THIS NODE'S ALIGNMENT: {intentAlignment}

CODE CHANGES:
{codeSnippets}

Verify if this change correctly implements the intent.
For "{intentType}" intent, check:
- Does it support the intent goal?
- Is it complete for this atomic unit?
- Are there contradictions?

RESPOND WITH ONLY VALID JSON:
{
  "intentSupport": "supports|contradicts|unrelated",
  "completeness": 0.0-1.0,
  "issues": ["intent-specific problems"],
  "missingForIntent": ["what's needed to fully support intent"],
  "recommendation": "approve|fix-intent-issues|reconsider-intent"
}
```

#### Parent Level Prompt (Intent Integration Review)
```
You are reviewing how components collectively serve the intent.

INTENT: {parentIntent}
NODE: {name}
INTENT ALIGNMENT: {intentAlignment}

CHILD INTENT RESULTS:
{compressedChildContext}

Assess if children collectively achieve this node's intent contribution.
Check for:
- Completeness across all child components
- Contradictions between children
- Missing pieces for full intent achievement

RESPOND WITH ONLY VALID JSON:
{
  "overallIntentProgress": 0.0-1.0,
  "childrenAlignment": "all-aligned|mostly-aligned|conflicts-exist",
  "integrationGaps": ["missing intent implementations"],
  "contradictions": ["conflicting implementations"],
  "recommendation": "intent-achieved|partial-implementation|intent-blocked"
}
```

#### Context Compression Prompt
```
Compress child review results for parent intent verification.

PARENT INTENT: {parentIntent}
PARENT NODE: {parentTheme.name}
EXPECTED ALIGNMENT: {parentTheme.intentAlignment}

CHILD INTENT REVIEWS:
{JSON.stringify(childResults)}

Select information relevant to intent achievement.
Focus on: intent completion gaps, contradictions, alignment issues.
Preserve specific examples of incomplete or contradictory implementations.

RESPOND WITH ONLY VALID JSON:
{
  "aggregateCompletion": 0.0-1.0,
  "alignmentSummary": "how well children support parent intent",
  "criticalGaps": ["specific missing implementations"],
  "contradictions": ["specific conflicting changes"],
  "recommendation": "proceed|address-gaps|reconsider-approach"
}
```

## Risk Aggregation Through Recursion

### Natural Risk Propagation
Leaf risks come from direct code issues identified in leaf reviews, while parent risks combine child risks with integration risks. Recursion automatically propagates risks by naturally bubbling up the highest risks through the hierarchy.

### Risk Calculation
```typescript
// Risk automatically aggregates through recursive calls
const childResults = await Promise.all(children.map(child => reviewTheme(child)));
const maxChildRisk = Math.max(...childResults.map(r => r.riskScore));
const integrationRisk = await assessIntegrationRisk(theme, childResults);
const overallRisk = Math.max(maxChildRisk, integrationRisk);
```

## Review Quality Assurance

### Confidence Scoring
- **Evidence-based**: Higher confidence with more context
- **Calibrated thresholds**: Different per review level
- **Explicit uncertainty**: Flag low-confidence findings

### Review Validation
- **Consistency checks**: Parent-child review alignment
- **Completeness verification**: All aspects covered
- **Sanity testing**: No contradictory findings

## AI-First Quality Assurance

### Confidence Scoring System
- **Score range**: 0.0 to 1.0 for every AI review decision
- **Thresholds**: 
  - >0.8: High confidence, proceed with recommendations
  - 0.5-0.8: Medium confidence, flag for human validation
  - <0.5: Low confidence, mark as uncertain but still use AI analysis
- **Score factors**: Code complexity, review depth achieved, context completeness
- **Learning loop**: Track review accuracy to improve future confidence scoring
- **No Confidence Fallbacks**: Even low confidence AI reviews are preferred over mechanical analysis

### AI-First Error Handling
- **Retry Strategy**: Retry failed AI review calls with identical prompts up to maximum attempts (5x)
- **No Content Truncation**: Never split or truncate code context unless explicitly specified
- **No Analysis Simplification**: Never create "simplified" review prompts when complex ones fail
- **Hard Error on Failure**: After maximum retries, fail with clear error rather than algorithmic fallback
- **No Mechanical Fallbacks**: Absolutely no rule-based, pattern-matching, or algorithmic alternatives to AI review
- **Complete Context**: Always provide full code context to AI - let AI decide what's relevant
- **Fail Fast**: Better to fail explicitly than provide misleading non-AI review results

#### Intent-Aware Review Examples

```typescript
// Example: Reviewing under "Systematic Removal" intent
if (intent.type === 'removal') {
  // ✅ CORRECT - Flag remaining instances as issues
  const remainingInstances = await ai.findRemainingPatterns(intent.targetPattern);
  if (remainingInstances.length > 0) {
    return {
      issue: 'Incomplete removal - instances remain',
      locations: remainingInstances,
      severity: 'critical' // Critical because it directly contradicts intent
    };
  }
}

// Example: Reviewing under "Refactoring" intent  
if (intent.type === 'refactoring') {
  // ✅ CORRECT - Verify behavior unchanged
  const behaviorAnalysis = await ai.compareBehavior(oldCode, newCode);
  if (behaviorAnalysis.changed) {
    return {
      issue: 'Refactoring changed behavior',
      details: behaviorAnalysis.differences,
      severity: 'critical' // Refactoring must preserve behavior
    };
  }
}
```

#### Prohibited Review Fallback Patterns
```typescript
// ❌ NEVER DO THIS - Algorithmic review fallback
if (fileName.includes('test')) {
    return { recommendation: 'skip', reason: 'test file' };
}

// ❌ NEVER DO THIS - Pattern-based risk assessment
if (codeChanges.includes('auth')) {
    return { riskLevel: 'high', reason: 'security-related' };
}

// ❌ NEVER DO THIS - Mechanical test coverage assessment
const testCoverage = (testFiles.length / codeFiles.length) * 100;

// ❌ NEVER DO THIS - Rule-based review depth
if (linesChanged < 10) {
    return performShallowReview();
}

// ✅ CORRECT - AI-driven review analysis
const reviewAnalysis = await ai.reviewCode({
    codeContext: fullCodeSnippets,
    businessContext: businessImpact,
    technicalContext: combinedTechnicalDetails,
    previousReviews: childReviews
});

// ✅ CORRECT - AI-driven risk assessment
const riskAnalysis = await ai.assessRisk({
    codeChanges: fullCodeDiffs,
    systemContext: affectedComponents,
    historicalData: previousIncidents
});
```

### AI Integration Guidelines
- **Structured prompts**: Use consistent templates with clear sections for different review types
- **Response constraints**: Enforce JSON-only responses for parsing reliability
- **Context windows**: Manage token limits by prioritizing relevant context (full code diffs first)
- **Example-driven**: Provide good/bad review examples in prompts
- **Progressive enhancement**: Build complex prompts from simpler validated components

## Output Generation

### Developer-Friendly Format
```markdown
## 🔍 Intent-Based Code Review Summary

### 🎯 Detected Intent: [Systematic Removal: Eliminate algorithmic fallbacks]
- **Confidence**: 92%
- **Completion**: 85%

### ✅ Overall Recommendation: [Fix Intent Gaps Before Merging]

### 📊 Intent Achievement Metrics
- Changes Supporting Intent: 43/47 (91%)
- Contradicting Changes: 2/47 (4%)
- Unrelated Changes: 2/47 (4%)
- Missing Implementations: 3 components

### 🚨 Intent Completion Gaps (Must Fix)
1. **Fallback remains in ErrorHandler** (error-handler.ts:67)
   - Still has algorithmic fallback for network errors
   - Fix: Remove fallback, throw error directly

2. **Incomplete removal in ConfigLoader** (config-loader.ts:23)
   - Partial fallback logic still present
   - Fix: Complete the removal pattern

### ⚠️ Intent Contradictions
1. **New fallback added in Logger** (logger.ts:45)
   - Contradicts removal intent
   - Fix: Remove or justify why this is needed

### 💪 Intent Achievements
- Response validation fully converted to AI-first
- Domain analysis successfully removed all fallbacks
- Complexity analyzer properly throws on AI failure

### 📈 Risk Assessment
- **Intent Risk**: Medium (85% complete)
- **Contradiction Risk**: Low (2 instances)
- **Missing Implementation Risk**: High (critical components)
```

### Hierarchical Review Navigation
- **Expandable tree view**: Drill down into specific findings
- **Level filtering**: View only integration issues
- **Severity sorting**: Critical issues first

## Implementation Phases
Start with basic leaf-level code review, simple risk aggregation, and final recommendation generation. Enhanced features will add multi-level integration analysis, cross-reference impact assessment, and historical pattern learning. Advanced features can include auto-fix generation for common issues, performance regression prediction, and security vulnerability scanning.

## Success Metrics

### Intent Detection Accuracy
The system should correctly identify primary intent in over 85% of PRs, properly categorize 90% of changes by intent alignment, and flag mixed-intent PRs that need splitting with 95% accuracy.

### Review Effectiveness  
The system should reduce false positives by 50% through intent context, catch 95% of incomplete intent implementations, identify all contradictions between code and intent, and provide clear guidance for intent completion.

### Developer Experience
Developers should understand why changes are flagged based on intent, receive actionable tasks to complete detected intent, see clear progress toward intent achievement, and trust that intended changes won't be flagged as issues.

## Integration Points
The system integrates with Phase 1 mindmaps through direct consumption of existing hierarchy, metadata enrichment by adding review data to nodes, and bidirectional updates where review findings update the mindmap. Integration with development workflows includes posting findings as GitHub PR comments, blocking merges on critical issues through status checks, and showing findings in editor through IDE integration.

## Future Considerations
Future learning systems could build pattern databases of common issue patterns, accommodate team preferences for customized review focus, and develop codebase knowledge with repository-specific rules. Collaborative reviews would enable human override to accept or reject AI findings, explanation requests where AI clarifies decisions, and continuous improvement through learning from human feedback.

---

## Intent-Based Review Summary

This evolution from quality-focused to intent-aware review represents a paradigm shift in code review philosophy. By understanding what code is trying to achieve, the system can distinguish between bugs and intended changes, dramatically reducing false positives.

Key transformations:
- **Review focus** shifts from generic quality to intent achievement
- **Issue detection** based on intent incompleteness, not abstract standards
- **Risk assessment** derived from how far the code is from achieving its intent
- **Recommendations** become intent-specific tasks rather than generic improvements

For AI-generated code, this is particularly crucial - the system can now verify that the AI correctly understood and implemented the requested changes, catching subtle misinterpretations that traditional quality-focused reviews would miss. The review becomes a verification that code achieves its purpose, not just that it follows best practices.