import { ConsolidatedTheme } from '../types/similarity-types';
import { logInfo } from '../../utils';

/**
 * Analyzes code structure to provide intelligent hints for theme expansion
 */
export class CodeStructureAnalyzer {
  /**
   * Analyze code structure to generate expansion hints
   */
  async analyzeThemeStructure(
    theme: ConsolidatedTheme
  ): Promise<CodeStructureAnalysis> {
    const analysis: CodeStructureAnalysis = {
      functionCount: this.countFunctions(theme),
      classCount: this.countClasses(theme),
      moduleCount: this.countModules(theme),
      changeTypes: this.identifyChangeTypes(theme),
      complexityIndicators: this.analyzeComplexity(theme),
      fileStructure: this.analyzeFileStructure(theme),
    };


    return analysis;
  }

  /**
   * Count distinct functions/methods in code changes
   */
  private countFunctions(theme: ConsolidatedTheme): number {
    let functionCount = 0;

    theme.codeSnippets.forEach((snippet) => {
      // Match function declarations in various formats
      const patterns = [
        /function\s+\w+/g, // function name()
        /\w+\s*:\s*function/g, // name: function
        /\w+\s*=>\s*{/g, // arrow functions
        /async\s+\w+\s*\(/g, // async functions
        /\w+\s*\([^)]*\)\s*{/g, // method declarations
        /export\s+function\s+\w+/g, // exported functions
        /private\s+\w+\s*\(/g, // private methods
        /public\s+\w+\s*\(/g, // public methods
      ];

      patterns.forEach((pattern) => {
        const matches = snippet.match(pattern);
        if (matches) {
          functionCount += matches.length;
        }
      });
    });

    return functionCount;
  }

  /**
   * Count distinct classes/interfaces in code changes
   */
  private countClasses(theme: ConsolidatedTheme): number {
    let classCount = 0;

    theme.codeSnippets.forEach((snippet) => {
      const patterns = [
        /class\s+\w+/g, // class declarations
        /interface\s+\w+/g, // interface declarations
        /type\s+\w+\s*=/g, // type definitions
        /enum\s+\w+/g, // enum declarations
        /export\s+class\s+\w+/g, // exported classes
        /export\s+interface\s+\w+/g, // exported interfaces
      ];

      patterns.forEach((pattern) => {
        const matches = snippet.match(pattern);
        if (matches) {
          classCount += matches.length;
        }
      });
    });

    return classCount;
  }

  /**
   * Count distinct modules/files with significant changes
   */
  private countModules(theme: ConsolidatedTheme): number {
    return theme.affectedFiles.length;
  }

  /**
   * Identify types of changes (config, logic, UI, test, etc.)
   */
  private identifyChangeTypes(theme: ConsolidatedTheme): ChangeType[] {
    const types = new Set<ChangeType>();

    theme.affectedFiles.forEach((file) => {
      if (
        file.includes('.test.') ||
        file.includes('.spec.') ||
        file.includes('/test/')
      ) {
        types.add('test');
      } else if (
        file.includes('config') ||
        file.endsWith('.json') ||
        file.endsWith('.yaml') ||
        file.endsWith('.yml')
      ) {
        types.add('config');
      } else if (
        file.includes('/components/') ||
        file.includes('/ui/') ||
        file.includes('.css') ||
        file.includes('.scss')
      ) {
        types.add('ui');
      } else if (
        file.includes('/api/') ||
        file.includes('/services/') ||
        file.includes('/business/')
      ) {
        types.add('logic');
      } else if (file.includes('/types/') || file.endsWith('.d.ts')) {
        types.add('types');
      } else if (file.includes('/utils/') || file.includes('/helpers/')) {
        types.add('utils');
      } else if (file.includes('README') || file.endsWith('.md')) {
        types.add('docs');
      } else {
        types.add('implementation');
      }
    });

    // Also analyze code content for additional type detection
    theme.codeSnippets.forEach((snippet) => {
      if (snippet.includes('import') || snippet.includes('export')) {
        types.add('imports');
      }
      if (
        snippet.includes('test(') ||
        snippet.includes('describe(') ||
        snippet.includes('it(')
      ) {
        types.add('test');
      }
      if (snippet.includes('interface') || snippet.includes('type ')) {
        types.add('types');
      }
    });

    return Array.from(types);
  }

  /**
   * Analyze code complexity indicators
   */
  private analyzeComplexity(theme: ConsolidatedTheme): ComplexityIndicators {
    const indicators: ComplexityIndicators = {
      hasConditionals: false,
      hasLoops: false,
      hasErrorHandling: false,
      hasAsyncOperations: false,
      nestingDepth: 0,
      branchingFactor: 0,
    };

    theme.codeSnippets.forEach((snippet) => {
      // Check for conditionals
      if (/if\s*\(|switch\s*\(|case\s+|ternary\s*\?/.test(snippet)) {
        indicators.hasConditionals = true;
        indicators.branchingFactor += (
          snippet.match(/if\s*\(|case\s+/g) || []
        ).length;
      }

      // Check for loops
      if (/for\s*\(|while\s*\(|forEach|map\(|filter\(/.test(snippet)) {
        indicators.hasLoops = true;
      }

      // Check for error handling
      if (/try\s*{|catch\s*\(|throw\s+|\.catch\(/.test(snippet)) {
        indicators.hasErrorHandling = true;
      }

      // Check for async operations
      if (/async\s+|await\s+|Promise\.|\.then\(/.test(snippet)) {
        indicators.hasAsyncOperations = true;
      }

      // Calculate nesting depth (simplified)
      const openBraces = (snippet.match(/{/g) || []).length;
      const closeBraces = (snippet.match(/}/g) || []).length;
      const netDepth = Math.abs(openBraces - closeBraces);
      indicators.nestingDepth = Math.max(indicators.nestingDepth, netDepth);
    });

    return indicators;
  }

  /**
   * Analyze file structure patterns
   */
  private analyzeFileStructure(
    theme: ConsolidatedTheme
  ): FileStructureAnalysis {
    const analysis: FileStructureAnalysis = {
      directories: new Set(),
      fileExtensions: new Set(),
      isMultiDirectory: false,
      isMultiLanguage: false,
      hasTestFiles: false,
      hasConfigFiles: false,
    };

    theme.affectedFiles.forEach((file) => {
      const dir = file.substring(0, file.lastIndexOf('/'));
      const ext = file.substring(file.lastIndexOf('.'));

      analysis.directories.add(dir);
      analysis.fileExtensions.add(ext);

      if (file.includes('.test.') || file.includes('.spec.')) {
        analysis.hasTestFiles = true;
      }
      if (file.includes('config') || ext === '.json' || ext === '.yaml') {
        analysis.hasConfigFiles = true;
      }
    });

    analysis.isMultiDirectory = analysis.directories.size > 1;
    analysis.isMultiLanguage = analysis.fileExtensions.size > 2; // More than 2 different extensions

    return analysis;
  }

}

/**
 * Analysis result containing code structure insights
 */
export interface CodeStructureAnalysis {
  functionCount: number;
  classCount: number;
  moduleCount: number;
  changeTypes: ChangeType[];
  complexityIndicators: ComplexityIndicators;
  fileStructure: FileStructureAnalysis;
}

/**
 * Types of code changes detected
 */
export type ChangeType =
  | 'config'
  | 'logic'
  | 'ui'
  | 'test'
  | 'types'
  | 'utils'
  | 'docs'
  | 'implementation'
  | 'imports';

/**
 * Code complexity indicators
 */
export interface ComplexityIndicators {
  hasConditionals: boolean;
  hasLoops: boolean;
  hasErrorHandling: boolean;
  hasAsyncOperations: boolean;
  nestingDepth: number;
  branchingFactor: number;
}

/**
 * File structure analysis
 */
export interface FileStructureAnalysis {
  directories: Set<string>;
  fileExtensions: Set<string>;
  isMultiDirectory: boolean;
  isMultiLanguage: boolean;
  hasTestFiles: boolean;
  hasConfigFiles: boolean;
}
