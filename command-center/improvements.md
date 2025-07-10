# Improve Command History

## Simple Log

This file tracks improve command usage for basic reference. No complex learning systems.

### 2025-07-10 - "remove overengineering"
- **Context**: Remove patterns.json complexity, fix context focus
- **Issue**: Improve command had overengineered learning system that didn't work
- **Action**: Removed patterns.json/context.md, created simple MD log
- **Status**: Implemented

### 2025-07-10 - "performance expectations"
- **Context**: User feedback about performance timing expectations  
- **Issue**: Command flagged AI processing time as problem
- **Learning**: 5+ minute AI processing is expected and normal
- **Action**: Stop flagging processing time as performance issue
- **Status**: Noted

### 2025-07-10 - "documentation performance focus"
- **Context**: Fix documentation that inappropriately treats AI processing time as problems
- **Issue**: Logging guidelines treat normal AI processing times as performance warnings
- **Action**: Update src/shared/logger/CLAUDE.md to remove inappropriate performance concerns
- **Files**: src/shared/logger/CLAUDE.md lines 46, 53, and added AI timing guidelines
- **Status**: ✅ Implemented

### 2025-07-10 - "next step suggestions for commands"
- **Context**: Which commands would benefit from outputting next step suggestions
- **Issue**: Commands end without clear guidance on what to do next
- **Action**: Analyze commands and identify which need next step suggestions
- **Status**: Analyzing

---

*Simple append-only log. Each improve command run adds an entry here.*