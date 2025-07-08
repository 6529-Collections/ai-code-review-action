# Main Todo Dashboard

*Central hub for all todo management - automatically maintained by /todo command*

## Quick Stats
- **Active Todos**: 17 items across 4 contexts (12 new from meta-review)
- **Critical Items**: 2 items (system blocking performance issues)
- **High Priority**: 5 items (current cycle focus)
- **Backlog Items**: 3 items for future cycles
- **Recent Completions**: 2 items completed this cycle
- **Last Updated**: Auto-updated by /todo add from meta-review

## Active Todo Areas

### 🎯 **High Priority** (Impact: High, Effort: Medium)
- [quality-improvements.md](active/quality-improvements.md) - **3 items** 
  - Theme name variation improvements
  - Business classification accuracy
  - PRD-reality alignment fixes

### 🚀 **Infrastructure** (Impact: Medium, Effort: Low)
- [infrastructure.md](active/infrastructure.md) - **2 items**
  - Command validation and updates
  - Documentation synchronization

### 🔥 **CRITICAL ISSUES** (System Blocking)
- [meta-review-items.md](active/meta-review-items.md) - **12 items**
  - **2 CRITICAL**: AI performance optimization, caching system
  - **3 HIGH**: PRD alignment, performance targets, complexity tiers
  - **7 MEDIUM/LOW**: Documentation, monitoring, innovation items

## Backlog

### 💡 **Innovation Ideas** (Future Exploration)
- [innovation-ideas.md](backlog/innovation-ideas.md) - **3 items**
  - Pattern library development
  - AI decision learning system
  - Cross-cycle trend analysis

## Recent Completions

### ✅ **Cycle 1 Completed** 
- [cycle-1-completed.md](completed/cycle-1-completed.md) - **2 items**
  - Command center organization
  - State persistence implementation

## Context Navigation

| Context | Active | Backlog | Focus Areas |
|---------|--------|---------|-------------|
| **Quality** | 6 | 1 | Theme naming, PRD alignment, classification |
| **Performance** | 2 | 1 | CRITICAL: 8.6min → <3min execution time |
| **Infrastructure** | 8 | 0 | CRITICAL: AI optimization, caching, monitoring |
| **Innovation** | 1 | 3 | Pattern learning, long-term improvements |

## Todo Management Commands

```bash
/todo                    # Show this dashboard + current status
/todo help               # Show all available commands (quick reference)
/todo add "item"         # Quick add item with auto-categorization
/todo add from chat      # Extract items from recent chat/meta-review
/todo organize           # Review and reorganize structure
/todo focus quality      # Show only quality-related todos
/todo complete T001      # Mark todo T001 as complete
/todo edit T002          # Modify existing todo T002
/todo brainstorm theme   # Brainstorm around theme-related todos
```

## Auto-Organization Rules

### Priority Calculation
- **High**: Impact=High + (Effort=Low|Medium) + CurrentCycle=true
- **Medium**: Impact=Medium + (any effort) + CurrentCycle=true  
- **Low**: Impact=Low OR CurrentCycle=false

### Context Detection
- **Quality**: keywords like grade, accuracy, confidence, theme, business
- **Performance**: keywords like speed, cache, optimization, time
- **Infrastructure**: keywords like command, documentation, validation
- **Innovation**: keywords like new, pattern, learning, AI, approach

### Auto-Actions
- **Daily**: Cleanup completed items older than 7 days
- **Weekly**: Reorganize by priority and context
- **Per-Cycle**: Archive completed items to cycle-specific files
- **On-Add**: Auto-categorize and assign ID

---

*This dashboard is automatically maintained by the /todo command system.*  
*Last Auto-Organization: Ready for first /todo command execution*