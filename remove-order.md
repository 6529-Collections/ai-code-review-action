⏺ 🎯 Step-by-Step Removal Order (Safest → Most Impactful)

  Phase 1: Remove Line Counting (Safest Start)

  Impact: Low - mostly used in decision logicFiles affected: 3-4 core files

  Step 1.1: Remove from interfaces first

  - NodeMetrics interface: remove linesAdded, linesRemoved, linesModified
  - CodeChange interface: remove linesAdded, linesRemoved
  - Why safe: Interfaces are leaf dependencies

  Step 1.2: Remove line counting calculations

  - calculateTotalLines() functions
  - Line-based atomic detection
  - Why safe: Just math calculations, easy to remove

  Step 1.3: Update AI prompts to remove line references

  - Remove "5-15 lines" from prompts
  - Remove line count metrics from AI context
  - Why safe: Prompt changes don't break code structure

  ---
  Phase 2: Remove Expansion Hints (Medium Impact)

  Impact: Medium - used by AI decision serviceFiles affected: 2 core files

  Step 2.1: Remove hint generation

  - generateExpansionHints() in code-structure-analyzer.ts
  - Why safe: Hints are just suggestions, not critical logic

  Step 2.2: Remove hint usage

  - Remove hints from AI prompts
  - Why safe: AI can make decisions without pre-generated hints

  ---
  Phase 3: Remove File Type Detection (Medium Impact)

  Impact: Medium - several files use thisFiles affected: 4-5 files

  Step 3.1: Remove file type fields

  - isTestFile, isConfigFile, fileType from interfaces
  - Why safe: AI can detect file types from paths

  Step 3.2: Remove file type logic

  - File type detection functions
  - Why safe: No complex dependencies

  ---
  Phase 4: Remove Function/Class Counting (Higher Impact)

  Impact: Higher - used in complexity scoringFiles affected: 5-6 files

  Step 4.1: Remove counting functions

  - countFunctions(), countClasses(), countModules()
  - Why manageable: These are isolated calculation functions

  Step 4.2: Remove count usage

  - Remove from complexity scoring
  - Remove from AI prompts
  - Why manageable: Can replace with simpler heuristics temporarily

  ---
  Phase 5: Remove Complexity Analysis (High Impact)

  Impact: High - central to many decisionsFiles affected: 8-10 files

  Step 5.1: Remove complexity indicators

  - ComplexityIndicators interface and calculations
  - Why careful: Need to replace decision logic

  Step 5.2: Replace complexity scoring

  - Replace with simple file count heuristics
  - Why careful: Critical for theme expansion decisions

  ---
  Phase 6: Remove Entire Analysis Classes (Highest Impact)

  Impact: Highest - major architecture changeFiles affected: 15+ files

  Step 6.1: Remove CodeStructureAnalyzer

  - Last step: This class ties everything together
  - Why last: Most dependencies point to this

  Step 6.2: Remove AICodeAnalyzer

  - Final step: Complete replacement with simple diff passing
  - Why final: Touches the most files

  ---
  🚀 Recommended Starting Point

  Start with Phase 1.1: Interface Cleanup

  // BEFORE (in mindmap-types.ts)
  export interface NodeMetrics {
    linesAdded: number;        // ← REMOVE
    linesRemoved: number;      // ← REMOVE  
    linesModified: number;     // ← REMOVE
    complexity: 'low' | 'medium' | 'high';  // ← KEEP
  }

  // AFTER
  export interface NodeMetrics {
    complexity: 'low' | 'medium' | 'high';
    affectedFiles: number;     // ← ADD (simple replacement)
  }

  Why this is safest:
  1. Minimal breakage - just remove unused fields
  2. Easy to test - TypeScript will show exactly what breaks
  3. Quick wins - immediate simplification
  4. Reversible - easy to rollback if needed
