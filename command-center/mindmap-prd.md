# Product Requirements Document: Intent-Aware Dynamic AI-Powered PR Mindmap

## Vision Statement
Create an intelligent, self-organizing mindmap that first detects the intent behind code changes, then adapts its depth to match the complexity of implementing that intent - ensuring every change is understood in context of what it's trying to achieve.

## Core Concept
An AI-driven system that:
- **Detects intent** from code patterns before organizing changes
- **Self-organizes** based on how changes serve the detected intent
- **Maintains intent context** at every level of the hierarchy
- **Adapts depth** based on intent complexity and completeness

## Dynamic Hierarchy Principles

### Adaptive Depth
- **AI decides** when further decomposition is needed
- **Natural termination** when reaching atomic, unit-testable changes
- **No artificial limits** - depth emerges from code complexity
- **Mixed depths** within same PR (typo = 2 levels, auth system = 30 levels)

### Level Characteristics

#### Root Level (Detected Intents)
- **Definition**: The systematic purpose detected from analyzing code patterns
- **Examples**: "Systematic Removal: Eliminate algorithmic fallbacks", "Refactoring: Async/await conversion", "Enhancement: Add comprehensive logging"
- **Content**: Intent type, confidence score, evidence, and scope

#### Intermediate Levels (Intent Application)
- **Definition**: How the intent is applied to different components/areas
- **Depth**: As many levels as needed to show complete intent implementation
- **Content**: Component-specific application of the parent intent

#### Leaf Level (Atomic Changes)
- **Definition**: Smallest unit-testable code change that serves the intent
- **Characteristics**: Single responsibility, verifiable against intent
- **Content**: Specific code diff with intent alignment score

## Data Structure at Each Level

### Required Information
```yaml
Node:
  id: Unique identifier
  name: Clear, contextual title (intent-aware)
  description: Detailed explanation (1-3 sentences)
  
  # Intent context
  intent: 
    type: removal|refactoring|enhancement|bugfix|optimization
    confidence: 0.0-1.0
    alignment: supports|contradicts|unrelated
  
  # Context fields
  intentContext: How this change serves the detected intent
  technicalContext: What this change does
  businessContext: Why this matters (if applicable)
  
  # Structure
  affectedFiles: List of files involved at this level
  codeDiff: Relevant code changes for this specific node
  metrics:
    complexity: low|medium|high
    affectedFiles: number
    changeTypes: [config|logic|ui|test]
    intentCompleteness: 0.0-1.0 # How much this contributes to intent
  
  children: [] (empty for leaves)
  crossReferences: [] (IDs of related nodes for shared code)
```

### Context Completeness
- **Self-contained**: Each node has ALL context needed to understand it
- **No inheritance dependency**: Can understand node without traversing tree
- **Progressive detail**: More technical as you go deeper
- **Audience-aware**: Language adapts to expected viewer at each level

## Intent Detection Framework

### Pattern Analysis Phase
Before building the hierarchy, the system analyzes all code changes to detect the primary intent:

1. **Pattern Recognition**: Identify repeated patterns across files
2. **Intent Inference**: Map patterns to likely intent types
3. **Confidence Scoring**: Assess how clearly the intent is expressed
4. **Conflict Detection**: Identify mixed or conflicting intents

### Core Intent Types
- **Systematic Removal**: Removing patterns/features across codebase
- **Refactoring**: Changing implementation while preserving behavior  
- **Enhancement**: Adding new capabilities or features
- **Bug Fix**: Correcting incorrect behavior
- **Optimization**: Improving performance or efficiency
- **Hardening**: Adding validation, error handling, or security

### Intent Confidence Levels
- **High (>0.8)**: Clear, consistent pattern across all changes
- **Medium (0.5-0.8)**: Dominant pattern with some exceptions
- **Low (<0.5)**: Mixed patterns or unclear intent

### Multi-Intent Handling
When multiple intents are detected:
- Create separate root nodes for each high-confidence intent
- Group changes under their most aligned intent
- Flag changes that don't clearly align with any intent
- Suggest PR splitting for better clarity

## AI Decision Framework

### When to Create Child Nodes
1. **Intent branching**: Different components implement the intent differently
2. **Incomplete implementation**: Part of intent is missing in this area
3. **Complexity threshold**: Single node too complex for clear intent verification
4. **Mixed alignment**: Some changes support intent, others don't

### When to Stop Decomposition
1. **Atomic intent unit**: Change clearly serves or contradicts intent
2. **Single responsibility**: Node does exactly one thing for the intent
3. **Intent clarity**: Can definitively say if this supports the intent
4. **Natural boundary**: Reached indivisible intent-serving unit

## Coverage Philosophy

### Intelligent Coverage (Not Strict Mapping)
- **Primary ownership**: Each code change has a primary home in the mindmap
- **Cross-references allowed**: Shared utilities/components can appear in multiple contexts
- **Context-aware duplication**: Same code shown differently based on usage context
- **AI-managed overlap**: System prevents excessive duplication while allowing necessary repetition

### Examples of Acceptable Overlap
```yaml
Shared Utility Function:
  - Appears in "User Authentication" → showing auth usage
  - Appears in "Admin Dashboard" → showing admin usage
  - Each context shows relevant aspects of the change

Reusable Component:
  - Primary node: "Create Shared Button Component"
  - Reference in: "Update Login UI" (as used component)
  - Reference in: "Redesign Settings Page" (as used component)
```

### Coverage Guidelines
1. **Primary responsibility**: Every change has one primary location
2. **Contextual references**: Additional appearances where genuinely helpful
3. **Avoid redundancy**: Don't duplicate for the sake of completeness
4. **User value focus**: Include where it helps understand user impact

### Analysis Scope
- **Code files only**: Analysis focuses on executable code changes (.ts, .js, .py, .java, etc.)
- **Documentation excluded**: Documentation files (.md, .txt, .rst) are intentionally excluded from theme analysis
- **Build artifacts excluded**: Distribution folders (dist/, build/, target/) are intentionally excluded as they contain generated code
- **Configuration included**: Config files (.json, .yaml, .toml) are included as they affect system behavior
- **Tests included**: Test files are analyzed as they represent verifiable business requirements

## Examples

### Simple Change (2 levels)
```
Root: "Bug Fix: Correct spelling errors" (Intent confidence: 0.95)
└── Leaf: "README.md: Fix spelling of 'authentication'"
    - Intent alignment: supports
    - Diff: -authntication +authentication
```

### Intent-Driven Decomposition
```
Root: "Systematic Removal: Eliminate algorithmic fallbacks" (Intent confidence: 0.92)
├── "Response Validation: Remove fallback mechanisms"
│   ├── Intent alignment: supports
│   ├── "Remove quick validation checks" 
│   └── "Remove partial validation methods"
├── "Domain Analysis: Remove fallback creation"
│   ├── Intent alignment: supports
│   └── "Delete createFallbackDomain method"
└── "Unaligned Changes"
    └── "Add debug logging" 
        └── Intent alignment: unrelated (flag for review)

Root: "Mixed Intent PR - Consider Splitting"
├── Intent 1: "Enhancement: Add OAuth2" (confidence: 0.85)
│   ├── "Create OAuth Utilities"
│   ├── "Add Google Provider"
│   └── "Add GitHub Provider"
└── Intent 2: "Refactoring: Standardize errors" (confidence: 0.78)
    └── "Update error message format"
        └── Warning: Modifies OAuth utilities from Intent 1
```

## Key Differentiators

### From Fixed Levels
- **Natural organization**: Structure emerges from code, not forced into preset levels
- **Appropriate depth**: Simple changes stay simple, complex changes get proper decomposition
- **No empty levels**: No artificial intermediate nodes just to maintain structure

### Intelligent Cross-Referencing
- **Smart duplication**: AI decides when showing code in multiple contexts adds value
- **Primary vs reference**: Clear indication of where code primarily belongs
- **Context preservation**: Each appearance maintains its specific context

### Complete Context
- **Every node standalone**: Can understand any node without parent context
- **Rich metadata**: Technical + business context at every level
- **Full traceability**: Complete diff information at appropriate granularity

## Success Criteria

1. **Accurate Intent Detection**: Correctly identifies the primary purpose of changes
2. **Intent Alignment**: All changes properly categorized by intent support
3. **Complete Implementation Tracking**: Shows what % of intent is implemented
4. **Mixed Intent Detection**: Identifies and flags PRs that should be split
5. **Contextual Understanding**: Reviews understand intent, not just code quality
6. **Reduced False Positives**: No flagging intended changes as problems
7. **Actionable Insights**: Clear indication of what's missing for intent completion

## Use Cases

### Code Review
- Navigate to exact level of detail needed
- See all usages of shared components
- Understand change impact across features

### Release Notes
- Auto-generate notes at any abstraction level
- Include cross-cutting changes appropriately
- Maintain full traceability to code

### Impact Analysis
- See all features affected by utility changes
- Understand ripple effects of modifications
- Identify shared dependencies

## Implementation Considerations

### AI Requirements
- Identify shared code and dependencies
- Determine primary vs secondary contexts
- Balance completeness with clarity
- Manage cross-references intelligently

### Technical Robustness
- Reliable expansion handling for complex PRs
- Complete cross-reference maintenance
- Thorough analysis coverage

### Validation
- Ensure all code is represented at least once
- Verify cross-references are meaningful
- Check for excessive duplication
- Validate context completeness

## System Reliability Requirements

### Processing Approach
- **Quality-first processing**: Prioritize accuracy and thoroughness over speed
- **Expected processing time**: 10-20 minutes for complex analysis is normal and acceptable
- **Retry strategy**: Exponential backoff with jitter (base delay: 1000ms, multiplier: 2)
- **Batch processing**: Process items in logical groups for AI analysis
- **Progress reporting**: Status updates for multi-minute operations

### Analysis Reliability
- **Complete analysis**: Ensure all code changes are properly analyzed
- **Context preservation**: Maintain rich context throughout all processing stages
- **Quality validation**: Verify analysis completeness and accuracy


## Quality Assurance

### Confidence Scoring System
- **Score range**: 0.0 to 1.0 for every AI decision
- **Thresholds**: 
  - >0.8: High confidence, proceed automatically
  - 0.5-0.8: Medium confidence, flag for review
  - <0.5: Low confidence, mark as uncertain but still use AI result
- **Score factors**: Code clarity, pattern recognition, context completeness
- **Learning loop**: Track user corrections to improve future scoring
- **No Confidence Fallbacks**: Even low confidence AI decisions are preferred over algorithmic alternatives

### AI-First Error Handling
- **Retry Strategy**: Retry failed AI calls with identical prompts up to maximum attempts (5x)
- **No Content Truncation**: Never split or truncate content unless explicitly specified
- **No Prompt Simplification**: Never create "simplified" prompts when complex ones fail
- **Hard Error on Failure**: After maximum retries, fail with clear error rather than algorithmic fallback
- **No Mechanical Fallbacks**: Absolutely no rule-based, pattern-matching, or algorithmic alternatives to AI decisions
- **Complete Context**: Always provide full context to AI - let AI decide what's relevant
- **Fail Fast**: Better to fail explicitly than provide misleading non-AI results

#### Prohibited Fallback Patterns
```typescript
// ❌ NEVER DO THIS - Algorithmic fallback
if (fileName.includes('auth')) {
    return 'User Account Management';
}

// ❌ NEVER DO THIS - Content truncation
const truncated = content.substring(0, 1000);

// ❌ NEVER DO THIS - Simplified prompts on failure
if (attempt > 1) {
    return createSimplePrompt(context);
}

// ✅ CORRECT - Retry identical prompt then hard error
for (let i = 0; i < MAX_RETRIES; i++) {
    try {
        return await ai.analyze(fullPrompt, fullContext);
    } catch (error) {
        if (i === MAX_RETRIES - 1) {
            throw new Error(`AI analysis failed after ${MAX_RETRIES} attempts`);
        }
    }
}
```

### AI Interaction Guidelines
- **Structured prompts**: Use consistent templates with clear sections
- **Response constraints**: Enforce word/character limits for each field
- **Example-driven**: Provide good/bad examples in prompts
- **JSON-only responses**: Reduce parsing errors with strict formatting
- **Context windows**: Manage token limits by prioritizing relevant context

## Prompting Techniques & Best Practices

### Prompt Structure Framework
- **Role definition**: Start with clear role ("You are a product manager analyzing...")
- **Context setting**: Provide current state before asking for analysis
- **Task clarity**: Use numbered steps for complex analyses
- **Output specification**: Define exact format with examples
- **Constraint enforcement**: Specify limits explicitly (e.g., "max 15 words")

### Word/Character Limits Strategy
```yaml
Theme Names: "max 8 words"
Descriptions: "max 15 words"
Business Impact: "max 12 words"
Technical Summary: "max 10 words"
Reasoning: "max 20 words"
```
- **Why limits matter**: Prevents verbose responses that dilute focus
- **Progressive detail**: Shorter at higher levels, more detailed at leaves
- **Audience alignment**: Business levels get shorter, clearer summaries

### Example-Driven Specifications
```
Good examples:
✅ "Changed pull_request.branches from ['main'] to ['**']"
✅ "Enable CI/CD testing on feature branches"
❌ "Enhanced workflow configuration"
❌ "Updated various settings"
```
- **Concrete vs abstract**: Always prefer specific over generic
- **Before/after format**: Show transformations clearly
- **Anti-patterns**: Explicitly show what to avoid

### JSON Response Enforcement
```json
{
  "CRITICAL: Respond with ONLY valid JSON",
  "No explanatory text before or after",
  "Use exact field names specified",
  "Include all required fields"
}
```
- **Parsing reliability**: Reduces extraction failures
- **Fallback handling**: Clear structure for degraded responses
- **Validation ready**: Easy to verify required fields

### Context Management Techniques
- **Relevance ordering**: Most important context first
- **Context compression**: Summarize long sections
- **Chunking strategy**: Break large contexts into focused segments
- **Token budgeting**: Reserve tokens for response
  - Context: ~60% of limit
  - Examples: ~20% of limit  
  - Response space: ~20% of limit

### Prompt Templates by Purpose

#### Intent Detection
```
Analyze this complete diff and identify the primary intent:
[Full PR diff]

Common patterns to look for:
- Systematic removal (deleting similar code across files)
- Refactoring (changing HOW without changing WHAT)
- Enhancement (adding new capabilities)
- Bug fix (correcting wrong behavior)

Respond: {
  "intent": "type",
  "confidence": 0.0-1.0,
  "evidence": ["pattern1", "pattern2"],
  "conflictingPatterns": ["if any"]
}
```

#### Intent-Aware Decomposition
```
Parent intent: [Systematic Removal: algorithmic fallbacks]
Current code section: [specific component]
Question: How does this section implement the intent?

Respond: {
  "shouldExpand": boolean,
  "intentAlignment": "supports|contradicts|unrelated",
  "subIntents": ["specific applications of parent intent"],
  "completeness": 0.0-1.0
}
```

#### Intent Verification
```
Detected intent: [Remove all fallbacks]
Code change: [specific diff]
Task: Verify if this change supports the intent

Respond: {
  "alignment": "supports|contradicts|unrelated", 
  "confidence": 0.0-1.0,
  "reasoning": "max 20 words",
  "completesIntent": boolean
}
```

### Prompt Optimization Strategies
- **Iterative refinement**: Track prompt success rates
- **A/B testing**: Compare prompt variations
- **Failure analysis**: Study when prompts produce poor results
- **Model-specific tuning**: Adjust for Claude's strengths

### Dynamic Prompt Generation
- **Context-aware prompts**: Adjust based on code complexity
- **Depth-specific prompts**: Different templates per hierarchy level
- **File-type prompts**: Specialized for tests, configs, UI, etc.
- **Confidence-based prompts**: More detailed for low-confidence scenarios

### Prompt Versioning & Evolution
- **Version tracking**: Maintain prompt history
- **Performance metrics**: Success rate per prompt version
- **Gradual rollout**: Test new prompts on subset first
- **Rollback capability**: Quick revert to previous versions

## Pattern Recognition Framework

### Business Pattern Detection
- **Pattern types**:
  - User interaction flows
  - Business logic concerns
  - Data processing patterns
  - Integration points
- **Pattern library**: Build reusable pattern database over time
- **Cross-PR learning**: Identify recurring patterns across multiple PRs
- **Pattern-guided decomposition**: Use recognized patterns to suggest hierarchy

### Contextual File Understanding
- **File type intelligence**:
  - Test files → Focus on what's being tested
  - Config files → Highlight configuration changes
  - API files → Emphasize contract changes
  - UI components → Focus on user experience impact
- **Specialized analysis**: Different prompts and focus per file type
- **Context preservation**: Maintain file-type-specific insights

## Complexity Scoring Framework

### Multi-Factor Assessment
- **Quantitative factors**:
  - File count (normalized by typical PR size)
  - Lines changed (with diminishing returns)
  - Cyclomatic complexity increase
  - Number of dependencies affected
- **Qualitative factors**:
  - Business impact description length
  - Number of distinct user flows
  - Cross-cutting concerns
  - Architectural significance
- **Weighted scoring**: Adjust weights based on repository type
- **Threshold calibration**: Learn from user feedback on expansion decisions

### Context Evolution
- **Progressive enhancement**:
  1. Basic context: File changes and diffs
  2. Smart context: Algorithmic code analysis
  3. Enhanced context: AI-augmented understanding
  4. Rich context: Cross-file relationships and patterns
- **Context types**: Different contexts for different analysis stages
- **Inheritance strategy**: Build upon parent context vs. regenerate

## Observability Requirements

### Error Tracking
- **Detailed logging**: Capture full context for every AI failure
- **Error categorization**:
  - API timeouts
  - Parsing failures
  - Confidence threshold misses
  - Unexpected responses
- **Recovery metrics**: Track success rate of retry attempts
- **Performance analytics**: Monitor API call duration, token usage

### System Metrics
- **Analysis metrics**:
  - Average hierarchy depth per PR type
  - Deduplication effectiveness
  - Cache hit rates
  - Confidence score distribution
- **User metrics**:
  - Navigation patterns in mindmap
  - Most/least used abstraction levels
  - Manual correction frequency
- **Continuous improvement**: Use metrics to refine algorithms

## ID Architecture

### Hierarchical ID System
- **Format**: `{parent-id}_{type}_{index}_{uuid}_{random}`
- **Benefits**:
  - Human-readable relationships
  - Collision-resistant
  - Debuggable structure
  - Natural sorting
- **Types**: `root`, `theme`, `sub`, `leaf`, `ref`
- **Traceability**: Encode full ancestry in ID for quick lookups

---

## Intent-Based Architecture Summary

This evolution from feature-based to intent-based mindmaps represents a fundamental shift in how we understand code changes. By detecting intent first, we solve the core problem of contextual understanding - the system now knows what changes are trying to achieve, not just what they affect.

Key transformations:
- **Root nodes** now represent detected intents, not business features
- **Hierarchy** organizes by how changes serve the intent, not by component structure  
- **Review context** understands intended changes aren't bugs
- **Task generation** focuses on completing the detected intent
- **Success** is measured by accurate intent detection and reduced false positives

This approach is particularly crucial for AI-generated code, where understanding intent helps distinguish between incomplete implementation and intentional design choices. The mindmap becomes not just a visualization, but an intent verification system that ensures AI code achieves its stated purpose.