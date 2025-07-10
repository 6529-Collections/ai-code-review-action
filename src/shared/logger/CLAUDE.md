# AI Code Review Action Logging Standards

## Core Principles
- **Centralized logging only** - NO direct console.log, console.warn, or console.error calls
- **Remove noise** - Only log information valuable for debugging or user feedback
- **Clear service categorization** - Use consistent service names for easy filtering
- **Appropriate log levels** - Match severity to log level

## Import Pattern
```typescript
import { logger } from '@/shared/logger/logger';
import { LoggerServices } from '@/shared/logger/constants';
```

## Service Naming Convention
Use predefined constants from `LoggerServices` or follow UPPERCASE_UNDERSCORE format:
```typescript
// ✅ Good
logger.info(LoggerServices.EXPANSION, 'Processing themes');
logger.debug('CLAUDE_CLIENT', 'API call completed');

// ❌ Bad  
logger.info('expansion', 'processing themes');
logger.info('Claude-Client', 'api call completed');
```

## Log Level Guidelines

### `logger.error()` - Critical failures, exceptions
- Application crashes
- API failures that break functionality
- Data corruption or loss
- Unrecoverable errors

```typescript
// ✅ Good
logger.error(LoggerServices.CLAUDE_CLIENT, `API call failed: ${error.message}`);
logger.error(LoggerServices.CODE_ANALYSIS, 'Failed to parse code structure');

// ❌ Bad - not critical
logger.error(LoggerServices.CACHE, 'Cache miss occurred');
```

### `logger.warn()` - Important warnings, fallbacks
- Fallback mechanisms activated
- Actual system failures (not AI processing time)
- Unexpected but recoverable conditions
- Configuration issues

```typescript
// ✅ Good
logger.warn(LoggerServices.EXPANSION, 'Using fallback expansion due to AI failure');
logger.info(LoggerServices.PERF, 'AI analysis completed: 5.2 minutes');

// ❌ Bad - not a warning
logger.warn(LoggerServices.MAIN, 'Starting analysis');
```

### `logger.info()` - Key operations, user-visible actions
- Major process milestones
- User-relevant state changes  
- Important business logic events
- Summary information

```typescript
// ✅ Good
logger.info(LoggerServices.MAIN, 'Analysis complete: Found 5 themes');
logger.info(LoggerServices.EXPANSION, 'Starting hierarchical expansion of 3 themes');

// ❌ Bad - too detailed
logger.info(LoggerServices.EXPANSION, 'Checking if theme needs expansion');
```

### `logger.debug()` - Development debugging
- Internal state changes
- Decision points in algorithms
- Performance metrics
- Detailed operation traces

```typescript
// ✅ Good
logger.debug(LoggerServices.SIMILARITY, `Similarity score: ${score} (threshold: ${threshold})`);
logger.debug(LoggerServices.CACHE_SEMANTIC, 'Found semantic match with 87% similarity');

// ❌ Bad - use trace for this
logger.debug(LoggerServices.EXPANSION, 'Entering expandTheme function');
```

### `logger.trace()` - Verbose execution flow
- Function entry/exit
- Loop iterations
- Variable dumps
- Step-by-step execution

```typescript
// ✅ Good
logger.trace(LoggerServices.SIMILARITY, `Processing pair ${i}/${total}`);
logger.trace(LoggerServices.CLAUDE_CLIENT, `Queue status: ${active} active, ${waiting} waiting`);
```

## What to Remove vs Refactor

### ❌ Remove These (Noise)
```typescript
// Status messages that add no value
console.log('[DEBUG] Entering function');
console.log('[TRACE] Processing item 1 of 10');
console.log('[INFO] Variable x = 5');

// Verbose development logging
if (process.env.VERBOSE_DEBUG_LOGGING === 'true') {
  console.log('Detailed internal state');
}

// Redundant status updates
console.log('Starting operation...');
console.log('Operation in progress...');
console.log('Operation complete');
```

### ✅ Refactor These (Valuable)
```typescript
// Error information
console.error('API call failed:', error);
// → logger.error(LoggerServices.CLAUDE_CLIENT, `API call failed: ${error.message}`);

// Performance data
console.log(`[PERF] Operation took ${duration}ms`);
// → logger.info(LoggerServices.PERF, `Operation completed in ${duration}ms`);

// User-relevant information
console.log(`[THEME] Found ${count} themes`);
// → logger.info(LoggerServices.EXPANSION, `Found ${count} themes`);

// Important warnings
console.warn('Falling back to simple analysis due to complexity');
// → logger.warn(LoggerServices.CODE_ANALYSIS, 'Using fallback analysis due to complexity');
```

## Environment Variables
- **Remove** all `VERBOSE_*_LOGGING` environment variable checks
- **Replace** with appropriate log levels controlled by `LOG_LEVEL`
- **Move** any logging-related constants to `constants.ts`

```typescript
// ❌ Remove this pattern
if (process.env.VERBOSE_DEDUP_LOGGING === 'true') {
  console.log('[DEDUP] Detailed state');
}

// ✅ Replace with this
logger.debug(LoggerServices.SIMILARITY, 'Detailed deduplication state');
```

## Message Format Guidelines
- **Be specific** - Include relevant context
- **Be concise** - Avoid unnecessary words
- **Be actionable** - Help developers understand what happened
- **Include metrics** - When relevant for debugging

```typescript
// ✅ Good messages
logger.info(LoggerServices.EXPANSION, `Expanded ${count} themes (${rate}% success rate)`);
logger.warn(LoggerServices.CLAUDE_CLIENT, `Rate limit detected, activating circuit breaker for 30s`);
logger.debug(LoggerServices.CACHE_SEMANTIC, `Cache hit: ${contextType} (${hitRate}% hit rate)`);

// ❌ Bad messages  
logger.info(LoggerServices.EXPANSION, 'Processing');
logger.warn(LoggerServices.CLAUDE_CLIENT, 'Something went wrong');
logger.debug(LoggerServices.CACHE_SEMANTIC, 'Cache operation');
```

## Testing Logging
After making changes:
1. Run local test to verify logs appear in `test-output/` files
2. Check log format matches existing patterns
3. Verify appropriate service categorization
4. Test log level filtering with `LOG_LEVEL=DEBUG`

## Common Patterns

### Error Handling
```typescript
try {
  // operation
} catch (error) {
  logger.error(LoggerServices.SERVICE_NAME, `Operation failed: ${error instanceof Error ? error.message : String(error)}`);
  // fallback logic
}
```

### Performance Tracking
```typescript
const startTime = Date.now();
// operation
const duration = Date.now() - startTime;
logger.info(LoggerServices.PERF, `Operation completed in ${duration}ms`);

// For AI operations (multi-minute processing is normal)
logger.info(LoggerServices.PERF, `AI theme analysis completed in ${Math.round(duration/1000/60)} minutes`);
```

### Progress Updates
```typescript
logger.info(LoggerServices.SERVICE_NAME, `Processing ${current}/${total} items`);
```

## AI Processing Time Guidelines

**CRITICAL**: AI operations typically take 5-15 minutes and this is NORMAL, EXPECTED behavior:
- Complete analysis pipeline: 10-15 minutes normal for 8+ files
- Theme analysis: 5-10 minutes normal
- Review processing: 2-5 minutes normal  
- Mindmap generation: 3-8 minutes normal
- Complex PR analysis: Up to 20 minutes is acceptable

**Processing Time Philosophy**:
- **Quality over Speed**: AI analysis prioritizes accuracy and thorough reasoning
- **Normal Operations**: Multi-minute processing indicates sophisticated AI reasoning, not problems
- **Expected Behavior**: Longer processing often correlates with higher quality outcomes

**Logging AI timing**:
- ✅ Log completion time as `info` level: `"AI analysis completed: 11.2 minutes"`
- ✅ Frame timing as normal: `"Complex analysis completed in expected 12.5 minutes"`
- ❌ NEVER log AI processing time as warnings, errors, or "bottlenecks"
- ❌ NEVER flag multi-minute processing as "performance degradation", "crisis", or needing "optimization"
- ❌ NEVER treat timing as a primary success metric - focus on quality outcomes

**Analysis Command Guidelines**:
- Processing time is informational context, not a problem indicator
- Success is measured by accuracy, confidence, and quality of insights
- 15+ minute analysis time with high-quality results is preferable to 2-minute analysis with poor results

Remember: Every log entry should help developers understand what the system is doing and aid in debugging. If a log doesn't serve that purpose, remove it.