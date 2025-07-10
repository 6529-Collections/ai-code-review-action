# Task: Enhance JSON Parsing Failure Logging

## Context & Problem
The synthesis analysis identified critical JSON parsing failures in the review service that are currently only logging generic error messages, losing valuable debugging information. According to log analysis, there were "2 critical parsing errors" with patterns like "JSON extraction failed" and "Unexpected token . in JSON" that degraded analysis quality despite high confidence scores.

**Current Issue Location:** `src/review/services/review-service.ts:262` in `analyzeNodeFindings()` method

**Current Behavior:**
```typescript
} catch (error) {
  logger.warn('REVIEW_SERVICE', `Failed to analyze node findings: ${error}`);
  return { /* fallback empty findings */ };
}
```

## Objective
Enhance the existing error logging to capture the actual AI response text that failed to parse, providing actionable debugging information while maintaining the current fallback behavior and following established logging standards.

## Requirements

### Core Requirements
1. **Preserve existing functionality** - No changes to current fallback behavior
2. **Use existing logging system** - Follow `src/shared/logger/CLAUDE.md` standards  
3. **Log the failed response text** - Capture actual AI response for debugging
4. **Maintain appropriate log levels** - WARN for error, DEBUG for response content
5. **Respect log size limits** - Truncate long responses appropriately

### Implementation Constraints
- **No overengineering** - Simple, focused solution
- **Minimal code changes** - Enhance existing catch block only
- **No breaking changes** - Preserve all current behavior
- **Follow existing patterns** - Match current logging style in the file

### Success Criteria
- When JSON parsing fails, log includes both error message AND truncated response text
- Logs follow existing service naming convention ('REVIEW_SERVICE')
- Response text is appropriately truncated (suggested: 500-1000 characters)
- No performance impact on successful parsing path
- Easy to correlate failed responses with specific nodes being analyzed

## Implementation Notes

### Key Files to Examine
- `src/review/services/review-service.ts` (primary change location)
- `src/shared/logger/CLAUDE.md` (logging standards reference)
- `src/shared/utils/json-extractor.ts` (understand extraction process)

### Current Flow Analysis Needed
1. Understand how `response` variable is available in catch block
2. Verify `JsonExtractor.extractJson()` provides `originalResponse` in result
3. Check if additional context (node ID/name) is available for correlation
4. Determine appropriate truncation length for response text

### Suggested Approach
1. **Minimal enhancement** - Add one additional DEBUG log line in existing catch block
2. **Smart truncation** - Show beginning of response with clear truncation indicator
3. **Context preservation** - Include node identifier if easily available
4. **Safe handling** - Protect against undefined/null response values

### Testing Validation
- Verify logs appear correctly when JSON parsing fails
- Ensure no impact when JSON parsing succeeds
- Confirm log truncation works with very long responses
- Validate log levels and service names match standards

## Anti-Patterns to Avoid
- **Don't** restructure the entire error handling flow
- **Don't** add complex response analysis or processing
- **Don't** change the fallback return behavior
- **Don't** add new dependencies or utilities
- **Don't** create configuration options for this simple enhancement
- **Don't** add multiple log levels for the same failure

## Expected Outcome
A simple, robust enhancement that provides actionable debugging information when JSON parsing fails, making it easier to understand and fix AI response formatting issues without any risk to existing functionality.

The implementation should be straightforward enough that it could be safely deployed immediately while providing significant debugging value for understanding the root cause of JSON parsing failures identified in the system analysis.