## Interaction Guidelines
- Do not run lint, build, test or any git command yourself if not asked

## Code Organization Philosophy
- **Aggressive file/module splitting**: Favor small, focused files over large monolithic ones
- **Single responsibility**: Each file should have one clear purpose
- **Prefer multiple small files**: Split functions, classes, types, and utilities into separate files
- **Clear boundaries**: If a file handles multiple concerns, split it immediately
- **Import clarity**: Small files make dependencies explicit and reduce coupling