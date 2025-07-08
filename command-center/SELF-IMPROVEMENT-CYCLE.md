# Self-Improvement Cycle

## Overview

This document defines our continuous improvement methodology for the AI Code Review Action project. Each cycle follows:

**Do → Measure → Analyze → Learn → Update → Plan**

## Core Philosophy

- Use the AI Code Review system on itself as a feedback loop
- Every cycle should improve PRDs, commands, CLAUDE files, or code
- Small, focused improvements compound over time
- Document learnings to avoid repeating mistakes

## Workflow Steps

### 1. Do: Make Changes & Run Tests
```bash
# Edit code based on current task
# Run tests to generate output
npm test  # or ./test-local.sh
# Output appears in test-output/
```

### 2. Measure: Review Quality
```bash
# Check quality of results
/review-results
# Analyzes most recent JSON in test-output/
# Outputs: Grade, coverage gaps, and THE ONE IMPROVEMENT
```

### 3. Analyze: Deep Investigation
```bash
# Investigate specific issues
/review-logs
# Analyzes most recent log in test-output/
# Outputs: AI decision patterns, root causes, ONE improvement
```

### 4. Learn: Meta-Analysis
```bash
# Analyze the bigger picture
/meta-review [focus-area]
# Optional focus: quality, performance, usability, documentation, architecture
# Outputs: System health, patterns, strategic recommendations
```

### 5. Update: Apply Learnings
```bash
# Update PRDs if needed
/improve-mindmap-prd  # or /improve-review-prd
# Outputs: Updated PRD with specific improvements

# Update commands if they need refinement
/improve-command [command-name]
# Outputs: Enhanced command with better functionality

# Update CLAUDE.md with new guidelines
# Update code based on learnings
```

### 6. Plan: Next Cycle
```bash
# Generate cycle summary and next task
/cycle-report
# Outputs: Cycle summary, learnings, and next priority recommendation
```

## Cycle History

### Cycle Template
```markdown
### Cycle N: [Date] - [Focus Area]
**Changes Made**: What was implemented
**Results**: Quality grade, key metrics
**Learnings**: What we discovered
**Updates**: PRD/command/CLAUDE changes
**Next Priority**: What to tackle next
```

---

### Cycle 1: [Date] - Initial Setup
**Changes Made**: Created self-improvement system
**Results**: N/A - Infrastructure setup
**Learnings**: Need simple markdown-based workflow
**Updates**: Created this document and meta-commands
**Next Priority**: Run first analysis and establish baseline

---

## Focus Areas Rotation

To ensure comprehensive improvement, rotate focus between:

1. **Quality Cycles**: Improve analysis accuracy and coverage
2. **Performance Cycles**: Optimize speed and efficiency  
3. **Usability Cycles**: Enhance commands and workflows
4. **Documentation Cycles**: Update PRDs and guides
5. **Innovation Cycles**: Try new approaches and ideas

## Success Metrics

Track improvement velocity with:
- Quality grade progression (C → B → A)
- Time to complete analysis (decreasing)
- Command effectiveness (actionable suggestions)
- PRD accuracy (matches reality)
- Cycle completion time (getting faster)

## Key Principles

1. **One Big Improvement Per Cycle**: Focus beats scatter
2. **Document Everything**: Future you will thank you
3. **Measure Impact**: Data drives decisions
4. **Update Docs**: Keep PRDs and guides current
5. **Small Steps**: Incremental progress compounds

## Quick Reference

```bash
# Standard cycle commands in order
/review-results          # Measure - Grade, coverage, ONE improvement
/review-logs            # Analyze - AI decisions, root causes, improvement
/meta-review           # Learn - System health, patterns, strategic recommendations
/improve-mindmap-prd   # Update - If PRD gaps identified
/cycle-report          # Plan - Summary and next priority
```

Remember: The goal is continuous improvement, not perfection. Each cycle should leave the system slightly better than before.