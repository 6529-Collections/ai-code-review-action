## Interaction Guidelines
- Do not run lint, build, test or any git command yourself if not asked

## Code Organization Philosophy
- **Aggressive file/module splitting**: Favor small, focused files over large monolithic ones
- **Single responsibility**: Each file should have one clear purpose
- **Prefer multiple small files**: Split functions, classes, types, and utilities into separate files
- **Clear boundaries**: If a file handles multiple concerns, split it immediately
- **Import clarity**: Small files make dependencies explicit and reduce coupling

## Local Testing Diff Modes

### Available Modes
- **UNCOMMITTED** (default): Analyzes all uncommitted changes (staged + unstaged + untracked)
- **BRANCH**: Analyzes changes between current branch and target branch (requires PR context)

### Usage Examples

#### Default Mode (Uncommitted Changes)
```bash
# Analyze all uncommitted changes
npm run test:act
# or explicitly set
DIFF_MODE=uncommitted npm run test:act
```

#### Branch Mode (PR Context Required)
```bash
# Analyze changes between current branch and target branch
DIFF_MODE=branch npm run test:act
```

### Branch Mode Requirements
- Must be on a feature branch (not main/master)
- Branch must have upstream tracking set up
- Target branch (main/master/develop) must exist in remote
- **Hard error if not in PR context** - no fallbacks

### Setup for Branch Mode
```bash
# Create and switch to feature branch
git checkout -b feature/my-feature

# Set up upstream tracking
git push -u origin feature/my-feature

# Now branch mode will work
DIFF_MODE=branch npm run test:act
```

### Error Handling
Branch mode follows AI-first principles:
- **Hard errors**: Explicit failure when not in PR context
- **No fallbacks**: Never uses algorithmic branch detection
- **Clear messages**: Detailed error explanation with setup instructions