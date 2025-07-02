import { NodeContext } from './node-context-builder';
import { ConsolidatedTheme } from '../types/similarity-types';
import { logger } from '../utils/logger';

/**
 * Enhanced cross-reference detector using complete node contexts
 * Implements PRD: "Smart duplication - AI decides when showing code in multiple contexts adds value"
 */
export class EnhancedCrossReferenceDetector {
  private referenceCache: Map<string, CrossReference[]>;

  constructor() {
    this.referenceCache = new Map();
  }

  /**
   * Detect cross-references between themes using their contexts
   */
  detectCrossReferences(
    contexts: Map<string, NodeContext>,
    themes: ConsolidatedTheme[]
  ): CrossReferenceReport {
    const report: CrossReferenceReport = {
      references: [],
      duplications: [],
      sharedComponents: [],
      dependencies: [],
    };

    const contextArray = Array.from(contexts.values());

    // Step 1: Detect file-level cross-references
    this.detectFileReferences(contextArray, report);

    // Step 2: Detect method-level cross-references
    this.detectMethodReferences(contextArray, report);

    // Step 3: Detect shared components
    this.detectSharedComponents(contextArray, report);

    // Step 4: Detect dependency chains
    this.detectDependencyChains(contextArray, themes, report);

    // Step 5: Detect smart duplications
    this.detectSmartDuplications(contextArray, report);

    logger.logProcess('Cross-reference detection complete', {
      totalReferences: report.references.length,
      duplications: report.duplications.length,
      sharedComponents: report.sharedComponents.length,
      dependencies: report.dependencies.length,
    });

    return report;
  }

  /**
   * Detect file-level cross-references
   */
  private detectFileReferences(
    contexts: NodeContext[],
    report: CrossReferenceReport
  ): void {
    const fileMap = new Map<string, NodeContext[]>();

    // Group contexts by files
    for (const context of contexts) {
      for (const file of context.files) {
        if (!fileMap.has(file.path)) {
          fileMap.set(file.path, []);
        }
        fileMap.get(file.path)!.push(context);
      }
    }

    // Find cross-references
    for (const [filePath, fileContexts] of fileMap) {
      if (fileContexts.length > 1) {
        report.references.push({
          type: 'file',
          path: filePath,
          themes: fileContexts.map((c) => ({
            id: c.themeId,
            name: c.themeName,
            purpose:
              c.files.find((f) => f.path === filePath)?.purpose || 'Unknown',
          })),
          reason: 'Multiple themes modify the same file',
        });
      }
    }
  }

  /**
   * Detect method-level cross-references
   */
  private detectMethodReferences(
    contexts: NodeContext[],
    report: CrossReferenceReport
  ): void {
    const methodMap = new Map<string, NodeContext[]>();

    // Group contexts by methods
    for (const context of contexts) {
      for (const method of context.methods) {
        const key = `${method.file}:${method.name}`;
        if (!methodMap.has(key)) {
          methodMap.set(key, []);
        }
        methodMap.get(key)!.push(context);
      }
    }

    // Find cross-references
    for (const [methodKey, methodContexts] of methodMap) {
      if (methodContexts.length > 1) {
        const [file, method] = methodKey.split(':');
        report.references.push({
          type: 'method',
          path: file,
          method,
          themes: methodContexts.map((c) => ({
            id: c.themeId,
            name: c.themeName,
            purpose:
              c.methods.find((m) => m.name === method)?.purpose || 'Unknown',
          })),
          reason: 'Multiple themes modify the same method',
        });
      }
    }
  }

  /**
   * Detect shared components
   */
  private detectSharedComponents(
    contexts: NodeContext[],
    report: CrossReferenceReport
  ): void {
    // Look for common imports/exports
    const importMap = new Map<string, Set<string>>();

    for (const context of contexts) {
      for (const file of context.files) {
        for (const imp of file.imports) {
          if (!importMap.has(imp)) {
            importMap.set(imp, new Set());
          }
          importMap.get(imp)!.add(context.themeId);
        }
      }
    }

    // Find widely shared components
    for (const [component, themes] of importMap) {
      if (themes.size >= 3) {
        report.sharedComponents.push({
          component,
          usedByThemes: Array.from(themes),
          usageCount: themes.size,
          type: this.inferComponentType(component),
        });
      }
    }
  }

  /**
   * Detect dependency chains
   */
  private detectDependencyChains(
    contexts: NodeContext[],
    themes: ConsolidatedTheme[],
    report: CrossReferenceReport
  ): void {
    const themeMap = new Map<string, ConsolidatedTheme>();
    for (const theme of themes) {
      themeMap.set(theme.id, theme);
    }

    // Build dependency graph
    const dependencies = new Map<string, Set<string>>();

    for (const context of contexts) {
      const deps = new Set<string>();

      // Check file relationships
      for (const file of context.files) {
        for (const related of file.relatedFiles) {
          // Find which theme owns this related file
          const ownerContext = contexts.find((c) =>
            c.files.some((f) => f.path === related)
          );
          if (ownerContext && ownerContext.themeId !== context.themeId) {
            deps.add(ownerContext.themeId);
          }
        }
      }

      if (deps.size > 0) {
        dependencies.set(context.themeId, deps);
      }
    }

    // Detect chains
    for (const [themeId] of dependencies) {
      const chain = this.buildDependencyChain(themeId, dependencies, new Set());
      if (chain.length > 1) {
        report.dependencies.push({
          startTheme: themeId,
          chain: chain.map((id) => ({
            id,
            name: themeMap.get(id)?.name || 'Unknown',
          })),
          type: chain.length > 3 ? 'complex' : 'simple',
        });
      }
    }
  }

  /**
   * Detect smart duplications (when showing code in multiple contexts adds value)
   */
  private detectSmartDuplications(
    contexts: NodeContext[],
    report: CrossReferenceReport
  ): void {
    // Look for similar business purposes
    const purposeGroups = new Map<string, NodeContext[]>();

    for (const context of contexts) {
      const purpose = this.normalizePurpose(context.businessContext.purpose);
      if (!purposeGroups.has(purpose)) {
        purposeGroups.set(purpose, []);
      }
      purposeGroups.get(purpose)!.push(context);
    }

    // Find duplications that add value
    for (const [purpose, group] of purposeGroups) {
      if (group.length > 1) {
        // Check if different technical approaches to same business goal
        const approaches = new Set(
          group.map((c) => c.technicalContext.changeType)
        );
        if (approaches.size > 1) {
          report.duplications.push({
            type: 'valuable',
            purpose,
            themes: group.map((c) => ({
              id: c.themeId,
              name: c.themeName,
              approach: c.technicalContext.changeType,
              complexity: c.technicalContext.complexity,
            })),
            reason: 'Different technical approaches to same business goal',
            recommendation: 'Show in multiple contexts for comparison',
          });
        }
      }
    }

    // Look for test/implementation pairs
    for (const context of contexts) {
      if (context.technicalContext.changeType === 'test') {
        // Find corresponding implementation
        const testedMethods = context.methods.map((m) => m.name);
        const implementation = contexts.find(
          (c) =>
            c.themeId !== context.themeId &&
            c.methods.some((m) => testedMethods.includes(m.name))
        );

        if (implementation) {
          report.duplications.push({
            type: 'test-implementation',
            purpose: 'Test and implementation pair',
            themes: [
              {
                id: context.themeId,
                name: context.themeName,
                approach: 'test',
                complexity: context.technicalContext.complexity,
              },
              {
                id: implementation.themeId,
                name: implementation.themeName,
                approach: 'implementation',
                complexity: implementation.technicalContext.complexity,
              },
            ],
            reason: 'Test and implementation should be shown together',
            recommendation: 'Link these themes for better understanding',
          });
        }
      }
    }
  }

  /**
   * Build dependency chain recursively
   */
  private buildDependencyChain(
    themeId: string,
    dependencies: Map<string, Set<string>>,
    visited: Set<string>
  ): string[] {
    if (visited.has(themeId)) {
      return []; // Circular dependency
    }

    visited.add(themeId);
    const chain: string[] = [themeId];

    const deps = dependencies.get(themeId);
    if (deps) {
      for (const dep of deps) {
        const subChain = this.buildDependencyChain(dep, dependencies, visited);
        if (subChain.length > 0) {
          chain.push(...subChain);
          break; // Take first chain only
        }
      }
    }

    return chain;
  }

  /**
   * Infer component type from import path
   */
  private inferComponentType(importPath: string): ComponentType {
    const lower = importPath.toLowerCase();

    if (lower.includes('utils') || lower.includes('helper')) {
      return 'utility';
    }
    if (lower.includes('service')) {
      return 'service';
    }
    if (lower.includes('component')) {
      return 'component';
    }
    if (lower.includes('hook')) {
      return 'hook';
    }
    if (lower.includes('type') || lower.includes('interface')) {
      return 'type';
    }
    if (lower.includes('config')) {
      return 'config';
    }

    return 'module';
  }

  /**
   * Normalize business purpose for grouping
   */
  private normalizePurpose(purpose: string): string {
    return purpose
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5) // First 5 words
      .join(' ');
  }

  /**
   * Analyze cross-reference value
   */
  analyzeCrossReferenceValue(reference: CrossReference): CrossReferenceValue {
    const value: CrossReferenceValue = {
      isValuable: false,
      confidence: 0,
      reasons: [],
      recommendation: 'keep-separate',
    };

    // File references are often valuable
    if (reference.type === 'file' && reference.themes.length > 2) {
      value.isValuable = true;
      value.confidence = 0.8;
      value.reasons.push(
        'Multiple themes affect same file - important to see together'
      );
      value.recommendation = 'show-relationship';
    }

    // Method references indicate tight coupling
    if (reference.type === 'method') {
      value.isValuable = true;
      value.confidence = 0.9;
      value.reasons.push(
        'Method modified by multiple themes - potential conflict'
      );
      value.recommendation = 'consolidate-or-sequence';
    }

    return value;
  }
}

/**
 * Cross-reference report
 */
export interface CrossReferenceReport {
  references: CrossReference[];
  duplications: SmartDuplication[];
  sharedComponents: SharedComponent[];
  dependencies: DependencyChain[];
}

/**
 * Cross-reference between themes
 */
export interface CrossReference {
  type: 'file' | 'method' | 'component';
  path: string;
  method?: string;
  themes: Array<{
    id: string;
    name: string;
    purpose: string;
  }>;
  reason: string;
}

/**
 * Smart duplication (valuable to show in multiple contexts)
 */
export interface SmartDuplication {
  type: 'valuable' | 'test-implementation' | 'refactor';
  purpose: string;
  themes: Array<{
    id: string;
    name: string;
    approach: string;
    complexity: string;
  }>;
  reason: string;
  recommendation: string;
}

/**
 * Shared component
 */
export interface SharedComponent {
  component: string;
  usedByThemes: string[];
  usageCount: number;
  type: ComponentType;
}

/**
 * Dependency chain
 */
export interface DependencyChain {
  startTheme: string;
  chain: Array<{
    id: string;
    name: string;
  }>;
  type: 'simple' | 'complex';
}

/**
 * Component types
 */
export type ComponentType =
  | 'utility'
  | 'service'
  | 'component'
  | 'hook'
  | 'type'
  | 'config'
  | 'module';

/**
 * Cross-reference value assessment
 */
export interface CrossReferenceValue {
  isValuable: boolean;
  confidence: number;
  reasons: string[];
  recommendation:
    | 'keep-separate'
    | 'show-relationship'
    | 'consolidate-or-sequence';
}
