# Todo Reference System

*Links todos to chat history, commands, and command center state*

## Reference Types

### 📅 **Chat History References**
- **Format**: `chat:YYYY-MM-DD:topic` or `chat:session-id`
- **Purpose**: Link todos to specific chat discussions or command outputs
- **Examples**:
  - `chat:2025-07-08:meta-review-output` - Items from meta-review command
  - `chat:2025-07-08:next-command-design` - Items from /next command discussion
  - `chat:current:quality-discussion` - Current session quality improvement ideas

### 🔧 **Command References**
- **Format**: `cmd:/command-name` or `cmd:/command-name:specific-output`
- **Purpose**: Link todos to specific command functionality or output
- **Examples**:
  - `cmd:/meta-review:quality-focus` - Items from meta-review quality analysis
  - `cmd:/review-results:B+-grade-issues` - Items from latest review results
  - `cmd:/improve-mindmap-prd:alignment-gaps` - PRD improvement suggestions

### 📋 **State References**
- **Format**: `state:file:section` or `state:improvement-state:coverage`
- **Purpose**: Link todos to command center state and tracking
- **Examples**:
  - `state:improvement-state:coverage-matrix` - Items from coverage tracking
  - `state:improvement-state:self-improvement-queue` - Items from improvement queue
  - `state:cycle-history:learnings` - Items from previous cycle learnings

### 🎯 **Issue References**
- **Format**: `issue:area:specific-problem` or `github:issue-number`
- **Purpose**: Link todos to specific problems or GitHub issues
- **Examples**:
  - `issue:quality:theme-naming-variation` - Specific quality issue
  - `issue:performance:cache-hit-rate-zero` - Performance problem
  - `issue:docs:prd-reality-mismatch` - Documentation alignment issue

### 🔄 **Cycle References**
- **Format**: `cycle:N:phase` or `cycle:current:focus-area`
- **Purpose**: Link todos to specific improvement cycles
- **Examples**:
  - `cycle:1:infrastructure-setup` - Items from cycle 1
  - `cycle:current:quality-focus` - Current cycle items
  - `cycle:future:innovation-cycle` - Future cycle planning

## Reference Management

### Auto-Reference Generation
When adding todos via `/todo add from chat`:
- **Automatically detect** command outputs in recent chat
- **Extract context** from meta-review, review-results, etc.
- **Generate references** to source commands and outputs
- **Link to current cycle** and improvement state

### Reference Resolution
All references are automatically resolved when viewing todos:
- **Chat references** → Link to specific chat context or command output
- **Command references** → Link to command files and recent outputs  
- **State references** → Link to current command center state
- **Issue references** → Link to problem description and context
- **Cycle references** → Link to cycle history and planning

### Reference Validation
Periodically validate that references still exist and are accurate:
- **Daily**: Check that recent chat references are still available
- **Weekly**: Validate command references against current command files
- **Per-Cycle**: Archive old references and update cycle references

## Common Reference Patterns

### Meta-Review Output References
```markdown
## T001: Improve Theme Classification Accuracy
**Context**: Quality improvement
**Priority**: High
**References**: 
- `cmd:/meta-review:quality-focus:theme-classification`
- `state:improvement-state:quality-grade-B+`
- `cycle:current:quality-focus`
**Related**: T002, T003 (theme naming improvements)
```

### Current State References
```markdown
## T002: Validate Remaining Commands  
**Context**: Infrastructure
**Priority**: Medium
**References**:
- `state:improvement-state:coverage-matrix:8-commands-unvalidated`
- `cmd:/next:coverage-alerts`
- `cycle:current:infrastructure-setup`
**Progress**: 4/12 commands validated
```

### Chat Discussion References
```markdown
## T003: Implement Todo System
**Context**: Infrastructure  
**Priority**: High
**References**:
- `chat:current:todo-system-design`
- `chat:current:meta-review-gazillion-things`
- `state:improvement-state:self-improvement-queue`
**Status**: In Progress
```

## Reference Link Generation

### Chat History Links
- Parse recent chat for command outputs
- Identify meta-review suggestions, quality issues, etc.
- Generate contextual links to specific discussions
- Maintain chat session context for reference

### Command Output Links  
- Link to latest command outputs in test-output/
- Reference specific sections of command analysis
- Connect to command files for implementation details
- Track command usage patterns for optimization

### State Integration Links
- Link to current improvement-state.md sections
- Reference coverage matrix, priority queues, etc.
- Connect to cycle history and planning documents
- Integrate with SELF-IMPROVEMENT-CYCLE.md workflow

### Cross-Reference Maintenance
- **Bi-directional links**: Todo ↔ Chat ↔ Commands ↔ State
- **Reference cleanup**: Remove broken or obsolete links
- **Reference enhancement**: Add new relevant links as system evolves
- **Reference analytics**: Track which references are most useful

---

*Reference system is automatically maintained by /todo command.*  
*Manual references can be added in individual todo files using standard formats.*