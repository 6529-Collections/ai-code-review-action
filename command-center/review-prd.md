# Product Requirements Document: Hierarchical AI Code Review (Phase 2)

## Vision Statement
Transform the hierarchical PR mindmap into an intelligent, context-aware code review system that performs bottom-up analysis - starting from atomic code changes and progressively building understanding up to business-level impact.

## AI-First Review Philosophy

### Core Principle: AI-Driven Review Decisions
- **All review analysis must use AI**: Code quality assessment, risk evaluation, test coverage analysis
- **No algorithmic shortcuts**: Never use mechanical rules like "if file contains 'test' then skip review"
- **Context-aware review**: Let AI determine review depth and focus based on actual code complexity
- **Reject procedural logic**: Review decisions emerge from AI understanding, not counting patterns

### AI Decision Supremacy
- **Code Analysis**: AI analyzes actual code patterns, logic, and implementation quality
- **Risk Assessment**: AI evaluates real risks based on code changes, not file name patterns
- **Test Strategy**: AI determines testing needs based on code complexity and change patterns
- **Review Depth**: AI decides when to dig deeper vs. when change is sufficiently reviewed
- **Complexity Classification**: AI determines node type (atomic/business/hybrid) from code context, not mechanical rules
- **Review Strategy Selection**: AI chooses appropriate review approach based on understanding, not file patterns

### Node Type Detection (AI-Driven)
AI analyzes each mindmap node to determine its review approach:

```yaml
AI Input Context:
  - businessImpact: Rich business context
  - codeSnippets: Full git diffs
  - combinedTechnicalDetails: Technical implementation summary
  - keyChanges: Change categories from Phase 1
  - mainFunctionsChanged: Function-level changes

AI Determines:
  - nodeType: atomic-technical|business-feature|integration-hybrid
  - reviewDepth: shallow|standard|deep
  - testingStrategy: unit|integration|e2e|mixed
  - riskLevel: low|medium|high|critical
  - reviewFocus: [security, performance, logic, business-alignment]
```

**No Algorithmic Classification**: Never use rules like "if childThemes.length === 0 then atomic" or "if fileName.includes('test') then skip". Let AI understand the actual change context and determine appropriate treatment.

## Executive Summary
Phase 2 leverages the hierarchical mindmap from Phase 1 to enable sophisticated AI-driven code reviews. By starting at the atomic leaf level and working upward, the system builds comprehensive understanding while maintaining context at every level of abstraction.

## Core Review Philosophy

### Bottom-Up Analysis
- **Start Small**: Begin with atomic, unit-testable changes
- **Build Understanding**: Each level adds context from its children
- **Progressive Validation**: Verify correctness at each abstraction level
- **Context Accumulation**: Higher levels inherit insights from below

### Review Dimensions at Each Level
1. **Code Quality**: Is the implementation correct and well-written?
2. **Test Coverage**: Are changes properly tested?
3. **Design Coherence**: Do changes fit the broader architecture?
4. **Business Alignment**: Does implementation match stated intent?
5. **Risk Assessment**: What could go wrong at this level?

## Review Process Architecture

### Level-Specific Review Types

#### Leaf Level (Atomic Changes)
**Focus**: Code correctness and implementation quality
```yaml
Review Aspects:
  - Syntax and style compliance
  - Logic correctness
  - Error handling
  - Performance implications
  - Security considerations
  - Unit test existence and quality
Context Needed:
  - Code diff
  - File type and purpose
  - Immediate dependencies
```

#### Intermediate Levels
**Focus**: Integration and design coherence
```yaml
Review Aspects:
  - Component interaction correctness
  - Design pattern consistency
  - API contract adherence
  - Integration test coverage
  - Cross-cutting concerns
Context Needed:
  - All child node reviews
  - Parent's business intent
  - Related component changes
```

#### Root Level (Business Themes)
**Focus**: Business value and system impact
```yaml
Review Aspects:
  - Feature completeness
  - Business requirement satisfaction
  - System-wide impact assessment
  - User experience implications
  - Deployment risks
Context Needed:
  - All descendant reviews
  - PR description and intent
  - Historical context
```

## Review Data Structure

### Input: Mindmap Node (from Phase 1)
```yaml
MindmapNode:
  id: string # Unique identifier
  name: string # Clear, contextual title
  description: string # Detailed explanation (1-3 sentences)
  businessImpact: string # Why this change matters (rich business context)
  affectedFiles: string[] # List of files involved at this level
  codeSnippets: string[] # Full git diffs with line-by-line changes
  confidence: number # 0-1 AI decision confidence from Phase 1
  childThemes: MindmapNode[] # Hierarchy structure
  sourceThemes: string[] # Cross-references to related nodes
  combinedTechnicalDetails: string # Technical context summary
  unifiedUserImpact: string # User-facing impact description
  keyChanges: string[] # Key change categories
  level: number # Hierarchy depth (0=root)
```

### Output: Review Node Format
```yaml
ReviewNode:
  # Source Reference
  nodeId: string # Reference to mindmap node ID
  level: leaf|intermediate|root # Derived from childThemes.length
  reviewType: implementation|integration|business # Based on hierarchy level
  
  # Review Analysis
  findings:
    issues:
      - severity: critical|major|minor|suggestion
        category: logic|security|performance|style|test
        description: Clear explanation
        suggestedFix: Concrete improvement
        codeContext: string # Extracted from codeSnippets
    
    strengths:
      - aspect: What was done well
        impact: Why it matters
    
    risks:
      - probability: high|medium|low
        impact: high|medium|low
        description: What could go wrong
        mitigation: How to prevent it
  
  # Quality Metrics
  metrics:
    codeQuality: 0-100
    testCoverage: 0-100
    riskScore: 0-100
    reviewConfidence: 0-100 # How confident AI is in this review
    sourceConfidence: number # Original mindmap confidence
  
  # Context Integration
  contextUsed:
    businessImpact: string # From mindmap.businessImpact
    technicalDetails: string # From mindmap.combinedTechnicalDetails
    codeSnippets: string[] # From mindmap.codeSnippets
    crossReferences: string[] # From mindmap.sourceThemes
    fromChildren: ReviewNode[] # Child review summaries
  
  # Decision
  decision:
    recommendation: approve|requestChanges|needsDiscussion
    reasoning: Clear justification
    blockingIssues: string[] # Must fix before approval
```

## Progressive Review Algorithm

### Phase 1: Leaf Analysis (Code-Level Review)
```
For each leaf node (childThemes.length === 0):
  1. Extract code diffs from codeSnippets array
  2. Parse git diffs for function/method changes
  3. Analyze implementation quality from actual code
  4. Assess change patterns and complexity
  5. Generate atomic-level review findings
  
Available Context:
  - Full git diffs with line-by-line changes
  - Business impact explanation
  - Technical implementation details
  - Confidence score from Phase 1 analysis
```

### Phase 2: Bottom-Up Aggregation (Integration Review)
```
For each intermediate level (childThemes.length > 0):
  1. Collect child review summaries
  2. Analyze business coherence across children
  3. Assess technical integration patterns
  4. Leverage cross-references (sourceThemes)
  5. Roll up risks and quality metrics
  
Available Context:
  - Combined technical details
  - Business impact of the theme group
  - Cross-reference relationships
  - Child review findings
```

### Phase 3: Holistic Assessment (Business Review)
```
At root level:
  1. Synthesize business impact assessment
  2. Validate against original business context
  3. Calculate overall risk from aggregated metrics
  4. Generate executive-level recommendation
  
Available Context:
  - Rich business impact descriptions
  - User-facing impact summaries
  - Complete hierarchy of technical findings
  - Cross-cutting concerns via sourceThemes
```

## AI Prompting Strategy

### Context Building
- **Rich Context Available**: Leverage full git diffs, business impact, and confidence scores
- **Incremental Enhancement**: Add child review summaries as moving up hierarchy
- **Cross-Reference Integration**: Utilize sourceThemes for related change context

### Review Prompt Templates

#### Leaf Level Prompt (Code Review)
```
Role: You are a senior developer reviewing atomic code changes.
Task: Review this specific code change for correctness and quality.

Available Context:
- Full git diff: {codeSnippets}
- Business Impact: {businessImpact}
- Technical Details: {combinedTechnicalDetails}
- Files Affected: {affectedFiles}
- Phase 1 Confidence: {confidence}

Focus: Implementation details, code quality, potential issues.
Output: Structured review with specific code references.
```

#### Integration Level Prompt (Architecture Review)
```
Role: You are a software architect reviewing component integration.
Task: Assess how these changes work together cohesively.

Available Context:
- Theme Description: {name} - {description}
- Business Impact: {businessImpact}
- Technical Integration: {combinedTechnicalDetails}
- Child Reviews: {childThemes reviews}
- Cross-References: {sourceThemes}

Focus: Design coherence, integration patterns, architectural alignment.
Output: Integration assessment with architectural recommendations.
```

#### Business Level Prompt (Product Review)
```
Role: You are a technical product manager reviewing feature delivery.
Task: Evaluate if implementation achieves business goals.

Available Context:
- Business Impact: {businessImpact}
- User Impact: {unifiedUserImpact}
- Key Changes: {keyChanges}
- Technical Summary: {combinedTechnicalDetails}
- All Child Reviews: {complete hierarchy}

Focus: Business value delivery, user impact, strategic alignment.
Output: Executive summary with business recommendation.
```

## Risk Aggregation Model

### Risk Calculation
- **Leaf risks**: Direct code issues
- **Integration risks**: Emerge from component interaction
- **System risks**: Overall impact on production

### Risk Propagation
```yaml
Parent Risk = Max(
  Own Risk Level,
  Highest Child Risk,
  Aggregated Risk Score
)
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
## 🔍 AI Code Review Summary

### ✅ Overall Recommendation: [Approve/Request Changes]

### 📊 Metrics
- Code Quality: 85/100
- Test Coverage: 92/100
- Risk Level: Low

### 🚨 Critical Issues (Must Fix)
1. **Memory leak in auth handler** (auth-service.ts:45)
   - Risk: High
   - Fix: Add cleanup in useEffect

### ⚠️ Suggestions for Improvement
1. **Consider caching API responses** (api-client.ts:23)
   - Impact: Performance
   - Benefit: 50% faster subsequent loads

### 💪 Strengths
- Excellent test coverage for new features
- Clean separation of concerns
- Good error handling patterns

### 📈 Risk Assessment
- **Deployment Risk**: Low
- **Performance Impact**: Minimal
- **Security Concerns**: None identified
```

### Hierarchical Review Navigation
- **Expandable tree view**: Drill down into specific findings
- **Level filtering**: View only integration issues
- **Severity sorting**: Critical issues first

## Implementation Phases

### MVP Features
1. Basic leaf-level code review
2. Simple risk aggregation
3. Final recommendation generation

### Enhanced Features
1. Multi-level integration analysis
2. Cross-reference impact assessment
3. Historical pattern learning

### Advanced Features
1. Auto-fix generation for common issues
2. Performance regression prediction
3. Security vulnerability scanning

## Success Metrics

### Review Quality
- **False positive rate**: <10%
- **Issue detection rate**: >90% of human-found issues
- **Actionable feedback**: >95% of suggestions implementable

### Developer Experience
- **Review completion time**: <2 minutes for average PR
- **Clarity score**: 4.5/5 developer rating
- **Adoption rate**: >80% of teams using

### Business Impact
- **Defect reduction**: 30% fewer production issues
- **Review efficiency**: 70% less human review time
- **Deployment confidence**: 90% successful deployments

## Integration Points

### With Phase 1 Mindmap
- **Direct consumption**: Use existing hierarchy
- **Metadata enrichment**: Add review data to nodes
- **Bidirectional updates**: Review findings update mindmap

### With Development Workflow
- **PR comments**: Post findings as GitHub comments
- **Status checks**: Block merge on critical issues
- **IDE integration**: Show findings in editor

## Future Considerations

### Learning System
- **Pattern database**: Common issue patterns
- **Team preferences**: Customized review focus
- **Codebase knowledge**: Repository-specific rules

### Collaborative Reviews
- **Human override**: Accept/reject AI findings
- **Explanation requests**: AI clarifies decisions
- **Continuous improvement**: Learn from human feedback

---

This hierarchical review system transforms code review from a flat, file-based process into an intelligent, context-aware analysis that builds understanding from atomic changes up to business impact, ensuring both code quality and business value delivery.