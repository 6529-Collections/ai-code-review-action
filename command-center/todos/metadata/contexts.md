# Todo Context System

*Defines how todos are automatically categorized by functional area*

## Context Categories

### 🎯 **Quality** (Improving Analysis Accuracy)
- **Focus**: Grade improvements, accuracy, confidence levels
- **Keywords**: grade, accuracy, confidence, theme, business, classification, PRD
- **Current Goals**: B+ → A grade progression
- **Related Commands**: /review-results, /review-logs, /improve-mindmap-prd
- **Success Metrics**: Quality grade trend, coverage completeness

**Example Todos**:
- Improve theme name variation algorithm
- Fix business vs technical classification accuracy
- Align PRD requirements with actual behavior
- Add concrete examples to mindmap PRD

### ⚡ **Performance** (Speed and Efficiency)
- **Focus**: Analysis speed, caching, optimization
- **Keywords**: speed, cache, optimization, time, performance, latency
- **Current Goals**: Reduce analysis time, improve cache hit rates
- **Related Commands**: /review-logs (performance analysis)
- **Success Metrics**: Analysis completion time, cache effectiveness

**Example Todos**:
- Implement content-based cache keys
- Optimize theme expansion decision logic
- Add batch processing for similar patterns
- Profile and optimize slow analysis steps

### 🏗️ **Infrastructure** (Commands, Docs, System)
- **Focus**: Command functionality, documentation, system maintenance  
- **Keywords**: command, documentation, validation, system, infrastructure
- **Current Goals**: Validate all commands, update documentation
- **Related Commands**: /improve-command, /validate-changes
- **Success Metrics**: Command coverage, documentation accuracy

**Example Todos**:
- Validate remaining 8 commands for accuracy
- Update outdated command descriptions
- Create missing review-prd.md documentation
- Implement command effectiveness tracking

### 💡 **Innovation** (New Approaches, Research)
- **Focus**: New features, research, experimental approaches
- **Keywords**: new, pattern, learning, AI, approach, experiment, research
- **Current Goals**: Build foundation for next-generation improvements
- **Related Commands**: /meta-review (innovation opportunities)
- **Success Metrics**: Successful experiments, new capability delivery

**Example Todos**:
- Create pattern library for successful approaches
- Implement AI decision learning system
- Develop cross-cycle trend analysis
- Experiment with semantic similarity caching

### 📋 **Process** (Workflow, Methodology)
- **Focus**: Improvement cycle workflow, methodology refinement
- **Keywords**: cycle, workflow, process, methodology, improvement
- **Current Goals**: Optimize improvement cycle effectiveness
- **Related Commands**: /cycle-report, /next
- **Success Metrics**: Cycle completion time, improvement velocity

**Example Todos**:
- Optimize /next command decision logic
- Add cycle efficiency tracking
- Develop workflow automation opportunities
- Create success pattern documentation

## Context Detection Rules

### Auto-Assignment Logic
```
Quality Context:
- Contains: grade, accuracy, confidence, theme, business, classification
- OR: Related to /review-results, /review-logs output
- OR: Mentions PRD alignment or quality metrics

Performance Context:  
- Contains: speed, cache, optimization, time, performance
- OR: Related to timing, latency, or efficiency
- OR: Mentions cache hits, processing speed

Infrastructure Context:
- Contains: command, documentation, validation, system
- OR: Related to .claude/commands/ files
- OR: Mentions documentation updates, command fixes

Innovation Context:
- Contains: new, pattern, learning, AI, approach, experiment
- OR: Related to research or experimental features
- OR: Mentions future capabilities or novel approaches

Process Context:
- Contains: cycle, workflow, process, methodology
- OR: Related to improvement cycle operations
- OR: Mentions workflow optimization or automation
```

### Multi-Context Todos
Some todos may span multiple contexts:
- **Primary Context**: Main area of impact (used for organization)
- **Secondary Contexts**: Additional areas affected (tagged for reference)
- **Cross-Context Items**: Explicitly marked for coordination across areas

### Context Priority by Cycle Focus
Current cycle focus area gets priority boost:

- **Quality Focus Cycle**: Quality context todos get +1 priority
- **Performance Focus Cycle**: Performance context todos get +1 priority  
- **Infrastructure Focus Cycle**: Infrastructure context todos get +1 priority
- **Innovation Focus Cycle**: Innovation context todos get +1 priority

## Context-Specific Organization

### Quality Context Structure
```
active/quality-improvements.md
├── Current Grade Issues (B+ → A path)
├── PRD Alignment Items  
├── Accuracy Improvements
└── Coverage Enhancements
```

### Performance Context Structure
```
active/performance-optimizations.md
├── Cache Improvements
├── Speed Optimizations
├── Efficiency Enhancements
└── Resource Usage
```

### Infrastructure Context Structure
```
active/infrastructure.md
├── Command Updates
├── Documentation Fixes
├── System Maintenance
└── Validation Tasks
```

### Innovation Context Structure
```
backlog/innovation-ideas.md
├── Research Projects
├── Experimental Features
├── New Approaches
└── Future Capabilities
```

## Context Review and Maintenance

### **Auto-Categorization** (Every /todo command)
- Apply context detection rules to new todos
- Re-evaluate existing todos if keywords change
- Update context tags based on current cycle focus

### **Context Validation** (Weekly)
- Review auto-assigned contexts for accuracy
- Identify cross-context dependencies
- Rebalance context workloads

### **Context Evolution** (Per-Cycle)
- Add new contexts as system grows
- Retire obsolete contexts
- Update detection rules based on usage patterns

---

*Context system is automatically applied by /todo command.*  
*Manual context overrides can be made in individual todo files.*