# Architecture Guide

## Overview

This project implements a hierarchical AI-powered code review system in two phases:
- **Phase 1**: Mindmap generation from pull request changes
- **Phase 2**: Bottom-up AI code review using the mindmap structure

## Module Structure

```
src/
├── shared/           # Cross-cutting concerns and utilities
├── mindmap/          # Phase 1: Hierarchical mindmap generation  
├── review/           # Phase 2: Hierarchical code review
├── index.ts          # Main orchestrator
└── validation.ts     # Input validation
```

## Shared Module (`src/shared/`)

Contains utilities and services used across multiple phases.

```
shared/
├── services/         # Cross-phase services
│   ├── git-service.ts           # Git operations
│   └── enhanced-git-service.ts  # Advanced git analysis
├── utils/            # Common utilities
│   ├── claude-client.ts         # Claude AI client
│   ├── logger.ts               # Logging utility
│   ├── ai-code-analyzer.ts     # Code analysis tools
│   ├── concurrency-manager.ts  # Async operation management
│   ├── performance-tracker.ts  # Performance monitoring
│   ├── error-handling.ts       # Error handling utilities
│   ├── json-extractor.ts       # JSON parsing utilities
│   └── similarity-calculator.ts # Mathematical similarity
├── cache/            # Caching systems
│   ├── generic-cache.ts        # Base cache implementation
│   ├── code-analysis-cache.ts  # Code analysis caching
│   └── ai-response-cache.ts    # AI response caching
└── types/            # Shared type definitions
    ├── theme-types.ts          # Core theme interfaces
    ├── ai-types.ts             # AI service types
    └── common-types.ts         # General types
```

## Mindmap Module (`src/mindmap/`)

Phase 1 implementation: Generates hierarchical mindmaps from code changes.

```
mindmap/
├── services/         # Core mindmap services
│   ├── theme-service.ts           # Main theme analysis orchestrator
│   ├── theme-similarity.ts       # Theme consolidation
│   ├── theme-expansion.ts         # Hierarchical expansion
│   ├── theme-naming.ts            # AI-powered naming
│   ├── business-domain.ts         # Domain classification
│   ├── hierarchical-similarity.ts # Cross-level analysis
│   ├── cross-reference-service.ts # Shared code handling
│   ├── direct-code-assignment-service.ts # Code assignment
│   ├── dynamic-prompt-builder.ts  # Context-aware prompts
│   ├── code-structure-analyzer.ts # Code pattern analysis
│   ├── semantic-cache.ts          # Semantic result caching
│   ├── similarity-cache.ts        # Similarity result caching
│   ├── batch-processor.ts         # Batch AI operations
│   └── ai/                        # AI-specific services
│       ├── ai-similarity.ts       # AI similarity analysis
│       ├── ai-domain-analyzer.ts  # AI domain classification
│       ├── ai-expansion-decision-service.ts # AI expansion decisions
│       ├── ai-mindmap-service.ts  # AI mindmap generation
│       └── ai-semantic-analyzer.ts # AI semantic analysis
├── types/            # Mindmap-specific types
│   ├── similarity-types.ts       # Theme similarity types
│   ├── mindmap-types.ts          # Mindmap structure types
│   └── expansion-types.ts        # Hierarchical expansion types
├── utils/            # Mindmap utilities
│   ├── theme-formatter.ts        # Output formatting
│   ├── prompt-templates.ts       # AI prompt templates
│   └── secure-file-namer.ts     # Secure temporary files
├── ai/               # AI infrastructure
│   ├── prompt-config.ts          # AI prompt configurations
│   ├── prompt-types.ts           # Prompt type definitions
│   ├── optimized-prompt-templates.ts # Optimized prompts
│   ├── unified-prompt-service.ts # Centralized AI service
│   ├── response-validator.ts     # AI response validation
│   ├── types.ts                  # AI infrastructure types
│   ├── cache/                    # AI-specific caching
│   │   ├── ai-response-cache.ts  # Response caching
│   │   ├── cache-strategies.ts   # Caching strategies
│   │   └── cache-metrics.ts      # Cache performance metrics
│   └── batch/                    # Batch processing
│       ├── batch-processor.ts    # Batch operation manager
│       ├── batch-strategies.ts   # Batching strategies
│       └── adaptive-batching.ts  # Dynamic batch sizing
└── index.ts          # Phase 1 exports
```

## Review Module (`src/review/`)

Phase 2 implementation: Ready for hierarchical code review system.

```
review/
├── services/         # Review services (to be implemented)
├── types/           # Review-specific types (to be implemented)
└── utils/           # Review utilities (to be implemented)
```

## Import Guidelines

### Path Mapping Rules

Always use path mappings for cross-module imports:

```typescript
// ✅ Correct - Cross-module imports
import { Theme } from '@/shared/types/theme-types';
import { ThemeService } from '@/mindmap/services/theme-service';

// ❌ Incorrect - Avoid relative cross-module imports
import { Theme } from '../../shared/types/theme-types';
```

### Within-Module Imports

Use relative imports within the same module:

```typescript
// ✅ Correct - Within mindmap module
import { ThemeSimilarityService } from './theme-similarity';
import { SimilarityMetrics } from '../types/similarity-types';

// ❌ Incorrect - Unnecessary path mapping within module
import { ThemeSimilarityService } from '@/mindmap/services/theme-similarity';
```

### Available Path Mappings

- `@/shared/*` - Shared utilities and services
- `@/mindmap/*` - Phase 1 mindmap functionality
- `@/review/*` - Phase 2 review functionality

## Adding New Features

### Phase 1 (Mindmap) Features

1. Add new services to `src/mindmap/services/`
2. AI-specific services go in `src/mindmap/services/ai/`
3. Add types to `src/mindmap/types/`
4. Export from `src/mindmap/index.ts`

### Phase 2 (Review) Features

1. Add new services to `src/review/services/`
2. Add types to `src/review/types/`
3. Create entry point at `src/review/index.ts`

### Shared Features

1. Add cross-cutting services to `src/shared/services/`
2. Add general utilities to `src/shared/utils/`
3. Add common types to `src/shared/types/`

## Design Principles

### Separation of Concerns

- **Shared**: Only truly reusable across phases
- **Mindmap**: Phase 1 specific functionality
- **Review**: Phase 2 specific functionality

### Import Consistency

- Path mappings for cross-module imports
- Relative imports within modules
- Clear dependency direction (no circular dependencies)

### Type Safety

- Strong typing throughout
- Shared type definitions in appropriate modules
- No `any` types without justification

### Performance

- Caching at multiple levels
- Concurrent operations where appropriate
- Efficient batch processing

## Testing Strategy

- Unit tests for individual services
- Integration tests for service interactions
- Build verification after changes
- Lint compliance for code quality

## Development Workflow

1. **Make changes** in appropriate module
2. **Update imports** if moving files
3. **Run build** to verify no errors
4. **Run lint** to ensure code quality
5. **Test functionality** before committing

## Common Patterns

### Service Construction

```typescript
// Services typically follow this pattern
export class ExampleService {
  constructor(
    private readonly apiKey: string,
    private readonly config?: ExampleConfig
  ) {
    // Initialize dependencies
  }
}
```

### AI Service Integration

```typescript
// AI services use ClaudeClient and handle responses
const result = await this.claudeClient.executePrompt(prompt);
const extracted = JsonExtractor.extract(result, schema);
```

### Error Handling

```typescript
// Use shared error handling utilities
import { withRetry } from '@/shared/utils/error-handling';

const result = await withRetry(() => riskyOperation(), retryConfig);
```

This architecture provides a solid foundation for both current functionality and future expansion while maintaining clear boundaries and consistent patterns.