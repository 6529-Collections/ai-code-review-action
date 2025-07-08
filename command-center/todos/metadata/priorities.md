# Todo Priority System

*Defines how todos are prioritized and organized automatically*

## Priority Levels

### 🔥 **Critical** (Handle Immediately)
- **Criteria**: Blocking current cycle completion
- **Examples**: Test failures, broken commands, missing dependencies
- **Auto-Assignment**: Keywords like "broken", "failing", "error", "blocked"
- **SLA**: Complete within 1 day

### 🎯 **High** (Current Cycle Focus)
- **Criteria**: High impact + Low/Medium effort + Current cycle relevant
- **Examples**: Quality improvements, PRD fixes, command updates
- **Auto-Assignment**: High impact items from meta-review + current focus area
- **SLA**: Complete within current cycle (1-2 weeks)

### 📋 **Medium** (Next Cycle Candidates)
- **Criteria**: Medium impact + Any effort OR High impact + High effort
- **Examples**: New feature development, architectural changes
- **Auto-Assignment**: Medium impact items or complex improvements
- **SLA**: Complete within 2-3 cycles

### 💡 **Low** (Backlog/Someday)
- **Criteria**: Low impact OR Future cycle relevant
- **Examples**: Nice-to-have features, exploration ideas
- **Auto-Assignment**: Low impact items or "future" tagged items
- **SLA**: No specific timeline

## Impact Assessment

### **High Impact**
- Directly improves quality grades (B+ → A)
- Fixes systemic issues affecting multiple areas
- Enables significant workflow improvements
- Addresses root causes vs symptoms

### **Medium Impact** 
- Improves specific areas without system-wide effects
- Enhances user experience or developer productivity
- Fixes isolated issues or adds useful features
- Provides measurable but limited improvements

### **Low Impact**
- Nice-to-have improvements with minimal effect
- Cosmetic changes or minor convenience features
- Exploratory work with uncertain outcomes
- Academic interest without immediate practical value

## Effort Estimation

### **Low Effort** (1-2 hours)
- Simple configuration changes
- Documentation updates
- Minor command modifications
- Quick fixes and adjustments

### **Medium Effort** (1-2 days)
- New command creation
- Moderate feature development
- Complex documentation overhauls
- Multi-file coordinated changes

### **High Effort** (1+ weeks)
- Architectural changes
- New system components
- Research and experimentation
- Cross-system integration work

## Auto-Priority Rules

### Rule Engine
```
IF impact=High AND effort=Low AND current_cycle=true THEN priority=High
IF impact=High AND effort=Medium AND current_cycle=true THEN priority=High  
IF impact=Medium AND current_cycle=true THEN priority=Medium
IF impact=High AND effort=High THEN priority=Medium
IF current_cycle=false THEN priority=Low
IF keywords_contain("broken", "error", "failing") THEN priority=Critical
```

### Context Multipliers
- **Quality focus cycle**: +1 priority for quality-related todos
- **Performance focus cycle**: +1 priority for performance-related todos
- **Infrastructure focus cycle**: +1 priority for infrastructure todos
- **Innovation focus cycle**: +1 priority for innovation todos

## Priority Review Schedule

### **Daily** (Auto-triggered by /todo command)
- Update priorities based on new information
- Promote urgent items discovered in chat
- Adjust based on current cycle progress

### **Weekly** (Manual review recommended)
- Review priority assignments for accuracy
- Adjust effort estimates based on actual work
- Rebalance priorities across contexts

### **Per-Cycle** (During cycle planning)
- Archive completed high-priority items
- Promote next-cycle items to current cycle
- Align priorities with new cycle focus area

---

*Priority system is automatically applied by /todo command.*  
*Manual overrides can be made by editing specific todo files.*