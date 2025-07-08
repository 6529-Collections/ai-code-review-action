# Product Requirements Document: Dynamic AI-Powered PR Mindmap

## Vision Statement
Create an intelligent, self-organizing mindmap that adapts its depth to match the complexity of code changes, ensuring every change is represented at its natural level of abstraction - from high-level business themes down to atomic, testable code units.

## Core Concept
An AI-driven system that:
- **Dynamically determines depth** based on change complexity
- **Self-organizes** into natural hierarchical structures
- **Maintains complete context** at every level
- **Adapts** from simple 2-level typo fixes to complex 30-level system implementations

## Dynamic Hierarchy Principles

### Adaptive Depth
- **AI decides** when further decomposition is needed
- **Natural termination** when reaching atomic, unit-testable changes
- **No artificial limits** - depth emerges from code complexity
- **Mixed depths** within same PR (typo = 2 levels, auth system = 30 levels)

### Level Characteristics

#### Root Level (Business Themes)
- **Definition**: Distinct user flow, story, or business capability
- **Examples**: "User Authentication", "Search Optimization", "Fix Documentation Typos"
- **Content**: Complete business context for this theme

#### Intermediate Levels (Dynamic)
- **Definition**: Logical decomposition of parent functionality
- **Depth**: As many levels as needed for clarity
- **Content**: Focused on specific aspect of parent theme

#### Leaf Level (Atomic Changes)
- **Definition**: Smallest unit-testable code change
- **Characteristics**: Single responsibility, independently testable
- **Content**: Specific code diff that could have its own unit test

## Data Structure at Each Level

### Required Information
```yaml
Node:
  id: Unique identifier
  name: Clear, contextual title (audience-appropriate)
  description: Detailed explanation (1-3 sentences)
  businessContext: Why this change matters
  technicalContext: What this change does
  affectedFiles: List of files involved at this level
  codeDiff: Relevant code changes for this specific node
  metrics:
    complexity: low|medium|high
    affectedFiles: number
    changeTypes: [config|logic|ui|test]
  children: [] (empty for leaves)
  crossReferences: [] (IDs of related nodes for shared code)
```

### Context Completeness
- **Self-contained**: Each node has ALL context needed to understand it
- **No inheritance dependency**: Can understand node without traversing tree
- **Progressive detail**: More technical as you go deeper
- **Audience-aware**: Language adapts to expected viewer at each level

## AI Decision Framework

### When to Create Child Nodes
1. **Multiple concerns**: Parent contains distinct functional areas
2. **Complexity threshold**: Single node too complex to understand atomically  
3. **Different audiences**: Technical vs business aspects need separation
4. **Testability**: Changes aren't independently testable at current level

### When to Stop Decomposition
1. **Atomic change**: Code change is unit-testable as-is
2. **Single responsibility**: Node does exactly one thing
3. **Clarity achieved**: Further breakdown adds no value
4. **Natural boundary**: Reached indivisible code unit

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
Root: "Fix Documentation Typos"
└── Leaf: "README.md: Fix spelling of 'authentication'"
    - Diff: -authntication +authentication
```

### Complex Change with Shared Components
```
Root: "Implement User Authentication"
├── "Add OAuth2 Integration"
│   ├── "Create OAuth Utilities" (PRIMARY)
│   │   └── Leaf: "Add token validation helper"
│   ├── "Google OAuth Provider"
│   │   └── Uses: token validation helper (REFERENCE)
│   └── "GitHub OAuth Provider"
│       └── Uses: token validation helper (REFERENCE)
└── "Secure API Endpoints"
    └── "Add Authentication Middleware"
        └── Uses: token validation helper (REFERENCE)

Root: "Improve Error Handling"
└── "Standardize Error Messages"
    └── "Update OAuth Errors"
        └── Modifies: token validation helper (SECONDARY CONTEXT)
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

1. **Natural Structure**: Depth feels intuitive, not forced
2. **Comprehensive Coverage**: All changes represented, with intelligent handling of shared code
3. **Minimal Redundancy**: Duplication only where it adds understanding
4. **Standalone Nodes**: Each node understandable in isolation
5. **Testable Leaves**: Every leaf represents unit-testable change
6. **Business Alignment**: Root themes match actual business value
7. **Cross-Reference Clarity**: Shared components clearly marked and linked

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

### Performance
- Lazy expansion for large PRs
- Efficient cross-reference indexing
- Cache intermediate analysis results
- Progressive rendering of deep trees

### Validation
- Ensure all code is represented at least once
- Verify cross-references are meaningful
- Check for excessive duplication
- Validate context completeness

## Scalability & Performance Requirements

### Concurrency Management
- **Adaptive concurrency**: Start with 5 concurrent operations, adjust based on API response times
- **Retry strategy**: Exponential backoff with jitter (base delay: 1000ms, multiplier: 2)
- **Dynamic batch sizing**: 4 items for small PRs, up to 10 for large PRs
- **Progress reporting**: Real-time updates for operations taking >5 seconds

### Caching & Efficiency
- **Analysis caching**: Store AI results with 1-hour TTL to avoid redundant API calls
- **Pattern caching**: Cache identified business patterns for reuse within same PR
- **Incremental updates**: Only re-analyze changed portions during iterative development
- **Smart invalidation**: Clear cache selectively based on file modifications


## Quality Assurance

### Confidence Scoring System
- **Score range**: 0.0 to 1.0 for every AI decision
- **Thresholds**: 
  - >0.8: High confidence, proceed automatically
  - 0.5-0.8: Medium confidence, flag for review
  - <0.5: Low confidence, use fallback
- **Score factors**: Code clarity, pattern recognition, context completeness
- **Learning loop**: Track user corrections to improve future scoring

### Graceful Degradation
- **Never fail completely**: Always provide meaningful output
- **Fallback hierarchy**:
  1. Full AI analysis
  2. Simplified AI analysis with reduced context
  3. Rule-based analysis
  4. Basic file grouping
- **Quality indicators**: Mark degraded results clearly
- **Progressive enhancement**: Upgrade analysis when possible

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

#### Decomposition Analysis
```
Current theme: [name and details]
Complexity indicators: [metrics]
Question: Should this be broken into sub-themes?
Criteria: [specific rules]
Respond: {"shouldExpand": boolean, "reasoning": "max 15 words"}
```

#### Similarity Detection
```
Compare these themes:
Theme A: [details]
Theme B: [details]
Focus on: Business logic overlap, not implementation
Respond: {"similarity": 0.0-1.0, "reasoning": "specific overlap"}
```

#### Business Context Extraction
```
Code change: [specific diff]
Technical context: [what changed]
Task: Explain the business value
Perspective: End user benefit, not technical details
Respond: {"businessValue": "max 12 words"}
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

This dynamic approach ensures the mindmap naturally reflects code complexity while intelligently handling shared components and utilities, maintaining complete context at every level without forcing rigid one-to-one mappings. The system is designed to scale gracefully, maintain high quality through intelligent fallbacks, and continuously improve through pattern recognition and user feedback.