# AI Code Review Action - Architecture Diagram

```mermaid
flowchart TB
    %% Entry Point
    A[GitHub Action Trigger] --> B[index.ts - run()]
    
    %% Initialization Phase
    B --> C[Validate Inputs]
    C --> D[Install Claude CLI]
    D --> E[Initialize Services]
    
    %% Service Initialization
    E --> F[GitService]
    E --> G[ThemeService]
    
    %% Git Analysis Phase
    F --> H[Get PR Context]
    F --> I[Get Changed Files]
    
    %% Theme Analysis Phase - Main Flow
    G --> J[ThemeContextManager]
    I --> K[ChunkProcessor]
    
    %% Theme Processing Pipeline
    K --> L[Split Files into Chunks]
    L --> M[For Each Chunk]
    M --> N[ClaudeService.analyzeChunk()]
    
    %% Claude Analysis
    N --> O[Build Analysis Prompt]
    O --> P[Execute Claude CLI]
    P --> Q{Analysis Success?}
    Q -->|Yes| R[Parse JSON Response]
    Q -->|No| S[Create Fallback Analysis]
    
    %% Theme Management
    R --> T[Determine Theme Placement]
    S --> T
    T --> U{Merge with Existing?}
    U -->|Yes| V[Update Existing Theme]
    U -->|No| W[Create New Theme]
    
    %% Theme Consolidation Phase
    V --> X[ThemeSimilarityService]
    W --> X
    X --> Y[Consolidate Similar Themes]
    Y --> Z[Apply Hierarchical Structure]
    
    %% Output Generation
    Z --> AA[Format Theme Output]
    AA --> AB[Generate Detailed Themes String]
    AB --> AC[Set GitHub Actions Outputs]
    AC --> AD[Log Results]
    
    %% Error Handling
    AD --> AE{Any Errors?}
    AE -->|Yes| AF[handleError()]
    AE -->|No| AG[Complete Successfully]
    
    %% Styling
    classDef serviceClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef processClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef dataClass fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef outputClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    
    class F,G,J,K,N,X serviceClass
    class C,D,H,I,L,O,P,T,Y,Z processClass
    class M,R,S,V,W dataClass
    class AA,AB,AC,AD,AG outputClass
```

## System Components

### Core Services
- **GitService**: Handles Git operations and PR context
- **ThemeService**: Main orchestrator for theme analysis
- **ThemeContextManager**: Manages live theme context and processing
- **ClaudeService**: Interfaces with Claude AI for analysis
- **ThemeSimilarityService**: Consolidates and merges similar themes

### Data Flow

1. **Input Processing**
   - GitHub Action receives PR/push event
   - Validates configuration and API keys
   - Installs Claude CLI tool

2. **Git Analysis**
   - Extracts PR context (base/head branches, SHA)
   - Identifies changed files with patches
   - Supports both PR mode and dev mode

3. **Theme Analysis Pipeline**
   ```
   Changed Files → Code Chunks → Claude Analysis → Theme Placement → Consolidation
   ```

4. **AI Processing**
   - Each code chunk analyzed by Claude AI
   - Generates theme name, description, confidence score
   - Determines if should merge with existing themes

5. **Theme Consolidation**
   - Merges similar themes based on similarity scores
   - Creates hierarchical theme structures
   - Calculates consolidation statistics

6. **Output Generation**
   - Formats themes with confidence percentages
   - Shows affected files and descriptions
   - Includes consolidation metadata
   - Sets GitHub Actions outputs

### Key Features

- **Fallback Handling**: Creates fallback themes if AI analysis fails
- **Hierarchical Themes**: Supports parent-child theme relationships  
- **Confidence Scoring**: Each theme has confidence percentage
- **File Tracking**: Tracks which files contribute to each theme
- **Performance Metrics**: Measures processing and consolidation time
- **Dev Mode**: Supports branch-to-branch comparison outside PRs

### Error Handling

- Graceful degradation when Claude CLI fails
- Fallback theme creation for failed analyses
- Comprehensive error logging and reporting
- Safe JSON parsing with error recovery