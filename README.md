# AI Code Theme Analysis Action

AI-powered GitHub Action that analyzes code changes in pull requests to identify and consolidate business themes using Claude AI.

## Features

- 🎯 **Theme Detection**: AI-powered analysis of business themes in code changes
- 🧠 **Smart Consolidation**: Merges similar themes using Claude AI semantic analysis
- 📊 **Hierarchical Organization**: Creates parent/child theme relationships
- 🔄 **Business Focus**: Describes themes from user/business perspective
- ⚡ **Efficient Processing**: Batch processing with smart caching
- 📈 **Confidence Scoring**: Provides confidence levels for each theme

## Usage

### Basic Usage

```yaml
name: Theme Analysis
on:
  pull_request:
    branches: [ main ]

jobs:
  analyze-themes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: 6529-Collections/ai-code-review-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Advanced Usage

```yaml
- uses: 6529-Collections/ai-code-review-action@main
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
  id: theme-analysis

- name: Use theme analysis output
  run: |
    echo "Themes found: ${{ steps.theme-analysis.outputs.themes }}"
    echo "Summary: ${{ steps.theme-analysis.outputs.summary }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | No | `${{ github.token }}` |
| `anthropic-api-key` | Anthropic API key for Claude access | Yes | - |

## Outputs

| Output | Description |
|--------|-------------|
| `themes` | Detailed theme analysis with consolidation information |
| `summary` | Summary of the theme analysis |

## What it does

1. **Installs Claude Code CLI** for AI analysis capabilities
2. **Analyzes changed files** in pull requests to extract business themes
3. **Consolidates similar themes** using AI-powered semantic analysis
4. **Organizes themes hierarchically** with parent/child relationships
5. **Provides business-focused insights** from a user perspective

## Examples

### Theme Analysis Output
The action outputs detailed theme analysis:

```
Found 3 themes:

1. **Improve code review automation** (85% confidence)
   - Files: src/theme-service.ts, src/ai-similarity.ts (+2 more)
   - Enhances automated analysis capabilities for better developer experience
   - 🔄 Merged from 2 similar themes

2. **Simplify configuration** (72% confidence)
   - Files: action.yml, package.json
   - Streamlines setup process for easier adoption
   - 📁 Contains 1 sub-themes:
     1. **Update input validation** (68%)
        - Files: src/validation.ts
        - Improves input handling and error messages
```

### Advanced Features
- **Smart Consolidation**: Similar themes are automatically merged
- **Confidence Scoring**: Each theme includes a confidence percentage
- **Hierarchical Organization**: Parent themes contain related sub-themes
- **Business Perspective**: Themes described from user/business viewpoint

## Development

### Project Structure

The action is built with a sophisticated, modular architecture:

```
src/
├── index.ts                    # Main entry point - orchestrates theme analysis
├── validation.ts              # Input validation
├── utils.ts                   # Utility functions
├── services/
│   ├── theme-service.ts       # Core theme analysis orchestration
│   ├── git-service.ts         # Git operations and file analysis
│   ├── theme-similarity.ts    # AI-powered theme consolidation
│   ├── ai-similarity.ts       # Claude AI integration
│   ├── batch-processor.ts     # Efficient batch processing
│   ├── business-domain.ts     # Business domain grouping
│   ├── theme-naming.ts        # AI-powered theme naming
│   └── similarity-cache.ts    # Performance caching
├── utils/
│   ├── code-analyzer.ts       # Algorithmic code analysis
│   └── similarity-calculator.ts # Mathematical similarity calculations
└── types/
    └── similarity-types.ts    # Advanced type definitions
```

### Local Development Setup

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. **Available scripts**
   ```bash
   # Build the action
   yarn build

   # Run tests
   yarn test

   # Run linter
   yarn lint

   # Format code
   yarn format

   # Test locally with Node.js
   yarn test:local "Test message"

   # Test with act (GitHub Actions locally)
   yarn test:act
   ```

### Local Testing

#### Method 1: Node.js Testing
```bash
# Uses test-local.js and loads .env file
yarn test:local
```

#### Method 2: GitHub Actions Testing with act
```bash
# Install act
brew install act

# Test the action locally (loads secrets from .env)
yarn test:act
```

### Environment Variables

For local development, create a `.env` file:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

The `.env` file is already in `.gitignore` to keep your API keys secure.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues, please [create an issue](https://github.com/6529-Collections/ai-code-review-action/issues) on GitHub.