# Cleanup Deduplication Command

A self-updating command for safely removing legacy deduplication code in incremental steps.

## ⚠️ CRITICAL: Protected Root Level Functionality

### NEVER REMOVE - Core Theme Consolidation System
The following functionality is ESSENTIAL for basic operation and must be PROTECTED:

**PROTECTED FILES:**
- `src/mindmap/services/theme-similarity.ts` - Core theme consolidation service
- Any code containing `consolidateThemes()` method
- Root level theme merging functionality

**PROTECTED METHODS:**
- `ThemeSimilarityService.consolidateThemes()` - Main theme merge entry point
- `findMergeGroups()` - Identifies similar themes at root level
- `createConsolidatedThemes()` - Creates merged themes
- `mergeThemes()` - Performs actual theme merging
- `buildHierarchies()` - Builds theme hierarchies

**PROTECTED FUNCTIONALITY:**
- Initial theme consolidation during analysis (theme-service.ts:611)
- AI-driven similarity detection for duplicate themes
- Business logic overlap detection
- Root level theme merging based on similarity scores

### Legacy vs Core Distinction
- **LEGACY DEDUPLICATION (removable)**: Sub-theme merging during expansion
  - Batch deduplication within expansion
  - Second-pass deduplication across batches
  - Cross-level deduplication between hierarchy levels
- **CORE CONSOLIDATION (protected)**: Root theme merging during initial analysis
  - Essential for preventing duplicate themes
  - Runs BEFORE expansion
  - Not controlled by any skip flags

## Background: What Legacy Deduplication Was

The LEGACY deduplication system was designed to merge similar themes during AI code review analysis. It had three levels:

1. **Batch Deduplication**: Merge themes during expansion within batches
2. **Second-Pass Deduplication**: Merge themes across different batches  
3. **Cross-Level Deduplication**: Merge themes between hierarchy levels using similarity thresholds

### The Problem
The original aggressive deduplication caused a **3→3 theme problem**: 
- Input: 3 consolidated themes
- Expansion: Created 15 sub-themes (expensive AI calls)
- Deduplication: Merged back to 3 themes (more expensive AI calls)
- Result: 0% effectiveness, ~3 hours wasted

### The Solution
Most deduplication was disabled by default to preserve expansion work, but the infrastructure remained.

## Current State Analysis
*Last updated: 2025-01-08*

### Action.yml Configuration Status
- `skip-batch-dedup`: **true** ✓ (disabled)
- `skip-second-pass-dedup`: **true** ✓ (disabled)  
- `skip-cross-level-dedup`: **true** ✓ (disabled)

### Remaining Components
- [x] ~~Minimum theme count controls (3 inputs)~~ **REMOVED**
- [ ] PRD compliance controls (3 inputs)
- [ ] Environment variable processing in `src/validation.ts`
- [ ] Deduplication service implementations
- [ ] Documentation files

### Current Status: ALL DEDUPLICATION DISABLED
All three deduplication levels are now turned off by default.

## Removal History

### 2025-01-08 Session:
1. ✅ **Verbose Logging Infrastructure** - Removed `verbose-dedup-logging` input and implementation code
2. ✅ **Threshold Controls** - Removed `cross-level-dedup-threshold` and `allow-overlap-merging` inputs and usage
3. ✅ **Cross-Level Deduplication Toggle** - Changed `skip-cross-level-dedup` default from `false` to `true`
4. ✅ **Minimum Theme Count Controls** - Removed hardcoded minimum theme count checks from implementation files:
   - Removed 5-theme minimum for batch deduplication in theme-expansion.ts:596-602 (7 lines)
   - Removed 10-theme minimum for second-pass deduplication in theme-expansion.ts:681 (modified condition)
   - Removed 20-theme minimum for cross-level deduplication in theme-service.ts:652 (modified condition)
   - Note: The inputs were already removed from action.yml and validation.ts in a previous session

**Total Lines Removed**: ~75 lines across 5 files
**Impact**: Eliminated unused logging, threshold, and minimum count infrastructure. Deduplication now runs regardless of theme count when enabled.

## Next Safe Removal Target

**Priority**: PRD Compliance Controls

**Target Components**:
- `max-atomic-size` (action.yml:30-33)
- `re-evaluate-after-merge` (action.yml:35-38)  
- `strict-atomic-limits` (action.yml:40-43)

**Rationale**: These controls are related to PRD compliance and atomic theme size limits, which may be unused if the expansion system is being simplified. Need to verify usage before removal.

**Files to modify**:
1. `action.yml` - Remove the 3 PRD compliance inputs (~12 lines)
2. `src/validation.ts` - Remove environment variable mappings for PRD controls
3. Implementation files - Remove PRD compliance checking logic

**Risk Level**: MEDIUM - These controls may still be used in the expansion system, requires verification.

## 🛑 STOP CONDITIONS - Do Not Proceed If:

1. **Any removal targets `theme-similarity.ts`**
2. **Any removal affects `consolidateThemes` method**
3. **Any removal impacts the main pipeline in `theme-service.ts:611`**
4. **Removal description mentions "root level" or "initial consolidation"**
5. **You're unsure if something is legacy vs core functionality**

If any of these conditions are met, STOP and seek clarification.

## Your Task

### 1. **Execute Next Removal**
Remove the identified "Next Safe Removal Target" components:
- Remove inputs from action.yml
- Remove environment variable mappings  
- Remove usage in implementation code
- Test that nothing breaks

### 2. **Update This Command**
After successful removal, update this document:

**Update "Current State Analysis"**:
- Remove completed items from "Remaining Components"
- Update component count

**Update "Removal History"**:
- Add new entry with date, what was removed, lines removed, impact
- Update total lines removed

**Update "Next Safe Removal Target"**:
- Identify the next smallest, safest component to remove
- Provide rationale and risk assessment
- List specific files and line numbers

### 3. **Validation Steps**
After each removal:
- [ ] Action runs without errors
- [ ] No broken references in code
- [ ] No TypeScript compilation errors
- [ ] Git status shows only intended changes
- [ ] Update this command file

## File Locations

### Configuration Files
- `action.yml` - GitHub Action input definitions
- `src/validation.ts` - Input to environment variable mapping

### Implementation Files  
- `src/mindmap/services/hierarchical-similarity.ts` - Cross-level deduplication (REMOVABLE)
- `src/mindmap/services/theme-expansion.ts` - Batch and second-pass deduplication (REMOVABLE)

⚠️ **DO NOT TOUCH**: `src/mindmap/services/theme-similarity.ts` - Contains CORE consolidation

### Documentation Files
- `DEDUPLICATION_USAGE.md` - Usage examples (can be removed when infrastructure is gone)
- `deduplication-config.md` - Configuration documentation (can be removed when infrastructure is gone)

## Success Criteria
- Incremental removal of unused deduplication infrastructure
- No functional impact on the AI code review system
- Root level theme consolidation remains functional
- Core merging functionality is preserved
- Clean, maintainable codebase without legacy code
- Self-updating command that stays current
- Documentation of removal decisions and progress

## Self-Update Instructions

**After each removal session**:
1. Move completed items from "Next Safe Removal Target" to "Removal History"
2. Update line counts and impact assessment
3. Identify and document the next safe removal target
4. Update "Current State Analysis" to reflect new state
5. Commit the updated command file with your changes

This ensures the command stays current and useful for future cleanup sessions.