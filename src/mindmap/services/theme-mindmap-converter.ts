import { ConsolidatedTheme } from '../types/similarity-types';
import { 
  MindmapNode, 
  DirectChildAssignment, 
  CodeDiff, 
  DiffHunk, 
  LineChange,
  FileContext
} from '../types/mindmap-types';
import { logInfo, logError } from '../../utils/index';

/**
 * Bidirectional converter between ConsolidatedTheme and MindmapNode representations
 * Ensures proper data flow between theme expansion and direct code assignment systems
 */
export class ThemeMindmapConverter {
  
  /**
   * Convert ConsolidatedTheme to MindmapNode for use with AIMindmapService
   */
  static convertThemeToMindmapNode(theme: ConsolidatedTheme): MindmapNode {
    const codeDiff = this.convertCodeSnippetsToCodeDiff(theme.codeSnippets, theme.affectedFiles);
    
    return {
      id: theme.id,
      name: theme.name,
      level: theme.level,
      description: theme.description,
      businessContext: theme.businessImpact,
      technicalContext: theme.detailedDescription || theme.description,
      codeDiff,
      affectedFiles: theme.affectedFiles,
      metrics: {
        complexity: (theme.codeMetrics?.filesChanged || 0) > 2 ? 'high' : 'medium',
        fileCount: theme.affectedFiles.length
      },
      parentId: theme.parentId,
      children: [], // Will be populated by expansion
      crossReferences: [],
      isPrimary: true,
      expansionConfidence: theme.confidence
    };
  }

  /**
   * Convert MindmapNode back to ConsolidatedTheme
   */
  static convertMindmapNodeToTheme(node: MindmapNode): ConsolidatedTheme {
    const codeSnippets = this.convertCodeDiffToSnippets(node.codeDiff);
    
    return {
      id: node.id,
      name: node.name,
      description: node.description,
      level: node.level,
      parentId: node.parentId,
      childThemes: [], // Will be populated separately
      affectedFiles: node.affectedFiles,
      confidence: node.expansionConfidence,
      businessImpact: node.businessContext,
      codeSnippets,
      context: node.technicalContext,
      lastAnalysis: new Date(),
      sourceThemes: [node.id],
      consolidationMethod: 'expansion' as const,
      detailedDescription: node.description,
      technicalSummary: node.technicalContext,
      codeMetrics: {
        filesChanged: node.metrics.fileCount
      }
    };
  }

  /**
   * Convert DirectChildAssignment to ConsolidatedTheme
   */
  static convertDirectAssignmentToTheme(
    assignment: DirectChildAssignment, 
    parentTheme: ConsolidatedTheme
  ): ConsolidatedTheme {
    const codeSnippets = this.convertCodeDiffToSnippets(assignment.assignedCode);
    const affectedFiles = assignment.assignedCode.map(diff => diff.file);
    
    return {
      id: `${parentTheme.id}_child_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: assignment.name,
      description: assignment.description,
      level: parentTheme.level + 1,
      parentId: parentTheme.id,
      childThemes: [],
      affectedFiles,
      confidence: 0.8, // Will be determined by AI analysis
      businessImpact: assignment.businessValue,
      codeSnippets,
      context: assignment.contextualMeaning || assignment.description,
      lastAnalysis: new Date(),
      sourceThemes: [parentTheme.id],
      consolidationMethod: 'expansion' as const,
      detailedDescription: assignment.description,
      technicalSummary: assignment.technicalPurpose,
      codeMetrics: {
        filesChanged: affectedFiles.length
      }
    };
  }

  /**
   * Convert code snippets (string[]) to structured CodeDiff[]
   * This is a best-effort conversion since snippets may lack line numbers
   */
  private static convertCodeSnippetsToCodeDiff(snippets: string[], files: string[]): CodeDiff[] {
    const codeDiffs: CodeDiff[] = [];
    
    for (const file of files) {
      // Find snippets that mention this file
      const relevantSnippets = snippets.filter(snippet => 
        snippet.includes(file) || snippet.includes(file.split('/').pop() || '')
      );
      
      if (relevantSnippets.length === 0) continue;
      
      // Create a single hunk for all changes in this file
      const changes: LineChange[] = [];
      let lineNumber = 1;
      
      for (const snippet of relevantSnippets) {
        // Parse snippet for added/removed lines (simple heuristic)
        const lines = snippet.split('\n');
        for (const line of lines) {
          if (line.startsWith('+')) {
            changes.push({
              type: 'add',
              lineNumber: lineNumber++,
              content: line.substring(1).trim()
            });
          } else if (line.startsWith('-')) {
            changes.push({
              type: 'delete',
              lineNumber: lineNumber++,
              content: line.substring(1).trim()
            });
          } else if (line.trim() && !line.startsWith('@@') && !line.startsWith('diff')) {
            changes.push({
              type: 'context',
              lineNumber: lineNumber++,
              content: line.trim()
            });
          }
        }
      }
      
      if (changes.length > 0) {
        const hunk: DiffHunk = {
          oldStart: 1,
          oldLines: changes.filter(c => c.type === 'delete' || c.type === 'context').length,
          newStart: 1,
          newLines: changes.filter(c => c.type === 'add' || c.type === 'context').length,
          changes
        };
        
        const fileContext: FileContext = {
          startLine: 1,
          endLine: changes.length,
          contextType: this.inferContextType(file)
        };
        
        codeDiffs.push({
          file,
          hunks: [hunk],
          fileContext,
          ownership: 'primary',
          contextualMeaning: `Changes in ${file}`
        });
      }
    }
    
    return codeDiffs;
  }

  /**
   * Convert structured CodeDiff[] back to simple code snippets
   */
  private static convertCodeDiffToSnippets(codeDiffs: CodeDiff[]): string[] {
    const snippets: string[] = [];
    
    for (const diff of codeDiffs) {
      let fileSnippet = `--- ${diff.file}\n`;
      
      for (const hunk of diff.hunks) {
        fileSnippet += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
        
        for (const change of hunk.changes) {
          const prefix = change.type === 'add' ? '+' : change.type === 'delete' ? '-' : ' ';
          fileSnippet += `${prefix}${change.content}\n`;
        }
      }
      
      snippets.push(fileSnippet);
    }
    
    return snippets;
  }

  /**
   * Infer context type from file path
   */
  private static inferContextType(filePath: string): FileContext['contextType'] {
    if (filePath.includes('test') || filePath.includes('spec')) {
      return 'test';
    } else if (filePath.includes('config') || filePath.endsWith('.json') || filePath.endsWith('.yml')) {
      return 'config';
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
      return 'function'; // Default for code files
    } else {
      return 'module';
    }
  }

  /**
   * Validate that DirectChildAssignment has proper code assignments
   */
  static validateDirectAssignment(assignment: DirectChildAssignment): boolean {
    if (!assignment.assignedCode || assignment.assignedCode.length === 0) {
      logError(`DirectChildAssignment "${assignment.name}" has no assigned code`);
      return false;
    }
    
    // Check that all assigned code has proper structure
    for (const codeDiff of assignment.assignedCode) {
      if (!codeDiff.file || !codeDiff.hunks || codeDiff.hunks.length === 0) {
        logError(`DirectChildAssignment "${assignment.name}" has invalid CodeDiff structure`);
        return false;
      }
      
      for (const hunk of codeDiff.hunks) {
        if (!hunk.changes || hunk.changes.length === 0) {
          logError(`DirectChildAssignment "${assignment.name}" has empty hunk`);
          return false;
        }
      }
    }
    
    logInfo(`DirectChildAssignment "${assignment.name}" validation passed`);
    return true;
  }
}