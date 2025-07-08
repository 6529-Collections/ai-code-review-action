# Product Requirements Document: Hierarchical AI Code Review (Phase 2)

## Vision Statement
Transform the hierarchical PR mindmap into an intelligent, context-aware code review system that performs bottom-up analysis - starting from atomic code changes and progressively building understanding up to business-level impact.

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

### Review Node Format
```yaml
ReviewNode:
  nodeId: Reference to mindmap node
  level: leaf|intermediate|root
  reviewType: implementation|integration|business
  
  findings:
    issues:
      - severity: critical|major|minor|suggestion
        category: logic|security|performance|style|test
        description: Clear explanation
        suggestedFix: Concrete improvement
        codeContext: Relevant code snippet
    
    strengths:
      - aspect: What was done well
        impact: Why it matters
    
    risks:
      - probability: high|medium|low
        impact: high|medium|low
        description: What could go wrong
        mitigation: How to prevent it
  
  metrics:
    codeQuality: 0-100
    testCoverage: 0-100
    riskScore: 0-100
    confidence: 0-100
  
  contextUsed:
    fromChildren: [] # Inherited insights
    fromParent: {} # Intent and constraints
    crossReferences: [] # Related changes
  
  decision:
    recommendation: approve|requestChanges|needsDiscussion
    reasoning: Clear justification
    blockingIssues: [] # Must fix before approval
```

## Progressive Review Algorithm

### Phase 1: Leaf Analysis
```
For each leaf node:
  1. Analyze code change in isolation
  2. Check implementation quality
  3. Verify test coverage
  4. Identify local risks
  5. Generate leaf-level review
```

### Phase 2: Bottom-Up Aggregation
```
For each level (from leaves to root):
  1. Collect all child reviews
  2. Analyze integration between children
  3. Verify level-specific concerns
  4. Aggregate metrics and risks
  5. Generate level-appropriate review
```

### Phase 3: Holistic Assessment
```
At root level:
  1. Synthesize all findings
  2. Assess business impact
  3. Calculate overall risk
  4. Generate final recommendation
```

## AI Prompting Strategy

### Context Building
- **Incremental context**: Start minimal, add as moving up
- **Selective inclusion**: Only relevant child findings
- **Abstraction matching**: Technical detail decreases going up

### Review Prompt Templates

#### Leaf Level Prompt
```
Role: You are a senior developer reviewing atomic code changes.
Task: Review this specific code change for correctness and quality.
Context: [code diff, file purpose, immediate dependencies]
Focus: Implementation details, not business impact.
Output: [structured review format]
```

#### Integration Level Prompt
```
Role: You are a software architect reviewing component integration.
Task: Assess how these changes work together.
Context: [component changes, child reviews, design patterns]
Focus: Design coherence and integration correctness.
Output: [structured review format]
```

#### Business Level Prompt
```
Role: You are a technical product manager reviewing feature delivery.
Task: Evaluate if implementation achieves business goals.
Context: [all changes, aggregated reviews, business requirements]
Focus: Business value and system impact.
Output: [structured review format]
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