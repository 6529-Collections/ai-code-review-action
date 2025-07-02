# Deduplication Configuration Options

This document describes the environment variables available to control the aggressive deduplication that was negating theme expansion effectiveness.

## Problem Solved

The theme expansion was taking 10,449.4s but achieving 0% effectiveness (3→3 themes) because aggressive deduplication was immediately merging the expanded sub-themes back together.

## Environment Variables

### Deduplication Layer Controls

#### `SKIP_BATCH_DEDUP`
- **Default**: `false`
- **Purpose**: Skip batch deduplication within theme expansion
- **Usage**: `SKIP_BATCH_DEDUP=true` to disable batch deduplication entirely
- **Impact**: Preserves all sub-themes created during expansion

#### `SKIP_SECOND_PASS_DEDUP`
- **Default**: `false`
- **Purpose**: Skip second-pass deduplication that catches "duplicates across batches"
- **Usage**: `SKIP_SECOND_PASS_DEDUP=true` to disable second pass
- **Impact**: Prevents cross-batch theme merging

#### `SKIP_CROSS_LEVEL_DEDUP`
- **Default**: `false` (existing variable, now enhanced)
- **Purpose**: Skip hierarchical cross-level deduplication
- **Usage**: `SKIP_CROSS_LEVEL_DEDUP=true` to disable entirely
- **Impact**: Prevents parent-child theme merging

### Threshold Controls

#### `CROSS_LEVEL_DEDUP_THRESHOLD`
- **Default**: `0.95` (increased from `0.85`)
- **Purpose**: Similarity threshold for cross-level deduplication
- **Usage**: `CROSS_LEVEL_DEDUP_THRESHOLD=0.98` for even stricter merging
- **Impact**: Only merge themes with >95% similarity (vs original 85%)

#### `ALLOW_OVERLAP_MERGING`
- **Default**: `true`
- **Purpose**: Whether to merge themes with "overlap" relationship (vs only "duplicate")
- **Usage**: `ALLOW_OVERLAP_MERGING=false` to only merge exact duplicates
- **Impact**: Preserves themes that have partial overlap but different purposes

### Minimum Theme Count Controls

#### `MIN_THEMES_FOR_BATCH_DEDUP`
- **Default**: `5`
- **Purpose**: Minimum theme count to trigger batch deduplication
- **Usage**: `MIN_THEMES_FOR_BATCH_DEDUP=10` to only dedup larger sets
- **Impact**: Skip deduplication for small theme sets

#### `MIN_THEMES_FOR_SECOND_PASS_DEDUP`
- **Default**: `10`
- **Purpose**: Minimum theme count to trigger second-pass deduplication
- **Usage**: `MIN_THEMES_FOR_SECOND_PASS_DEDUP=20` for even higher threshold
- **Impact**: Avoid second pass for medium-sized theme sets

#### `MIN_THEMES_FOR_CROSS_LEVEL_DEDUP`
- **Default**: `20`
- **Purpose**: Minimum theme count to trigger cross-level deduplication
- **Usage**: `MIN_THEMES_FOR_CROSS_LEVEL_DEDUP=50` for very large sets only
- **Impact**: Only run expensive cross-level analysis for large hierarchies

### Logging Controls

#### `VERBOSE_DEDUP_LOGGING`
- **Default**: `false`
- **Purpose**: Enable detailed logging of deduplication decisions
- **Usage**: `VERBOSE_DEDUP_LOGGING=true` to see all similarity scores and decisions
- **Impact**: Helps debug why themes are being merged

## Recommended Settings for Maximum Expansion

To preserve maximum theme granularity (your goal), use these settings:

```bash
# Disable most aggressive deduplication
export SKIP_BATCH_DEDUP=true
export SKIP_SECOND_PASS_DEDUP=true

# Make cross-level deduplication very strict
export CROSS_LEVEL_DEDUP_THRESHOLD=0.98
export ALLOW_OVERLAP_MERGING=false
export MIN_THEMES_FOR_CROSS_LEVEL_DEDUP=50

# Enable logging to monitor
export VERBOSE_DEDUP_LOGGING=true
```

## Conservative Settings (Balanced)

For some deduplication but preserving expansion:

```bash
# Keep batch dedup but make it stricter
export MIN_THEMES_FOR_BATCH_DEDUP=10
export MIN_THEMES_FOR_SECOND_PASS_DEDUP=20

# Stricter cross-level thresholds
export CROSS_LEVEL_DEDUP_THRESHOLD=0.95
export MIN_THEMES_FOR_CROSS_LEVEL_DEDUP=30
```

## Expected Results

With these changes, you should see:
- **Expansion**: 3 → 15+ themes (instead of 3 → 3)
- **Time efficiency**: Deduplication steps will be skipped or much faster
- **Granularity preserved**: Sub-themes will remain separate for detailed review
- **Performance logs**: Should show positive expansion effectiveness instead of 0%