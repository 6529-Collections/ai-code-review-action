# Deduplication Configuration Usage

This document shows how to use the new deduplication configuration options in your GitHub Actions workflows.

## Problem Solved

The theme expansion was taking ~3 hours but achieving 0% effectiveness (3→3 themes) because aggressive deduplication was immediately merging the expanded sub-themes back together. These configuration options let you control the deduplication behavior to preserve your expansion work.

## Quick Start Examples

### Balanced Approach (Recommended - preserves expansion but catches duplicates)

```yaml
- name: AI Code Review with Balanced Deduplication
  uses: your-org/ai-code-review-action@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    # Preserve expansion but catch clear duplicates
    skip-second-pass-dedup: 'false'
    cross-level-dedup-threshold: '0.95'
    allow-overlap-merging: 'false'
    min-themes-for-cross-level-dedup: '5'
    min-themes-for-second-pass-dedup: '5'
    # Enable logging to monitor behavior
    verbose-dedup-logging: 'true'
```

### Maximum Expansion (For when you want absolutely no merging)

```yaml
- name: AI Code Review with Maximum Expansion
  uses: your-org/ai-code-review-action@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    # Disable aggressive deduplication
    skip-batch-dedup: 'true'
    skip-second-pass-dedup: 'true'
    # Make cross-level deduplication very strict
    cross-level-dedup-threshold: '0.99'
    allow-overlap-merging: 'false'
    min-themes-for-cross-level-dedup: '50'
    # Enable logging to monitor behavior
    verbose-dedup-logging: 'true'
```

### Conservative (Minimal changes from original behavior)

```yaml
- name: AI Code Review with Conservative Deduplication
  uses: your-org/ai-code-review-action@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    # Keep batch dedup but make it stricter
    min-themes-for-batch-dedup: '10'
    min-themes-for-second-pass-dedup: '20'
    # Stricter cross-level thresholds
    cross-level-dedup-threshold: '0.95'
    min-themes-for-cross-level-dedup: '30'
```

### Conservative (Minimal deduplication changes)

```yaml
- name: AI Code Review with Conservative Deduplication
  uses: your-org/ai-code-review-action@v1
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    # Just increase the similarity threshold slightly
    cross-level-dedup-threshold: '0.90'
    verbose-dedup-logging: 'true'
```

## All Available Options

| Input | Description | Default | Example Values |
|-------|-------------|---------|----------------|
| `skip-batch-dedup` | Skip batch deduplication during expansion | `false` | `true`, `false` |
| `skip-second-pass-dedup` | Skip second-pass deduplication across batches | `false` | `true`, `false` |
| `skip-cross-level-dedup` | Skip cross-level hierarchical deduplication | `false` | `true`, `false` |
| `cross-level-dedup-threshold` | Similarity threshold for cross-level dedup | `0.95` | `0.90`, `0.98`, `0.99` |
| `allow-overlap-merging` | Allow merging themes with overlap relationship | `true` | `true`, `false` |
| `min-themes-for-batch-dedup` | Minimum theme count to trigger batch dedup | `5` | `10`, `15`, `20` |
| `min-themes-for-second-pass-dedup` | Minimum theme count for second-pass dedup | `10` | `15`, `20`, `30` |
| `min-themes-for-cross-level-dedup` | Minimum theme count for cross-level dedup | `20` | `30`, `50`, `100` |
| `verbose-dedup-logging` | Enable detailed deduplication decision logging | `false` | `true`, `false` |

## Understanding the Impact

### Before (Aggressive Deduplication)
- **Input**: 3 consolidated themes
- **Expansion**: Creates 15 sub-themes (expensive AI calls)
- **Deduplication**: Merges back to 3 themes (more expensive AI calls)
- **Result**: 0% effectiveness, ~3 hours wasted

### After (Controlled Deduplication)
- **Input**: 3 consolidated themes  
- **Expansion**: Creates 15 sub-themes
- **Deduplication**: Preserves 12-15 themes (minimal merging)
- **Result**: 300-400% expansion, significant time savings

## Environment Variable Equivalents

You can also set these as environment variables instead of inputs:

```yaml
env:
  SKIP_BATCH_DEDUP: 'true'
  SKIP_SECOND_PASS_DEDUP: 'true'
  CROSS_LEVEL_DEDUP_THRESHOLD: '0.98'
  ALLOW_OVERLAP_MERGING: 'false'
  MIN_THEMES_FOR_CROSS_LEVEL_DEDUP: '50'
  VERBOSE_DEDUP_LOGGING: 'true'
```

## Monitoring Results

With `verbose-dedup-logging: 'true'`, you'll see detailed logs like:

```
[CROSS-LEVEL-DEDUP] Similarity: 0.923 (threshold: 0.950)
[CROSS-LEVEL-DEDUP] Relationship: overlap
[CROSS-LEVEL-DEDUP] Theme1: "User Authentication Flow"
[CROSS-LEVEL-DEDUP] Theme2: "Login Form Validation"  
[CROSS-LEVEL-DEDUP] Decision: KEEP_SEPARATE
[CROSS-LEVEL-DEDUP] Reasoning: Different aspects of auth system
```

This helps you understand why themes are being merged or kept separate, allowing you to fine-tune the settings for your specific needs.