import { ConsolidatedTheme } from '../types/similarity-types';
import { MindmapNode, DirectChildAssignment } from '../types/mindmap-types';
/**
 * Bidirectional converter between ConsolidatedTheme and MindmapNode representations
 * Ensures proper data flow between theme expansion and direct code assignment systems
 */
export declare class ThemeMindmapConverter {
    /**
     * Convert ConsolidatedTheme to MindmapNode for use with AIMindmapService
     */
    static convertThemeToMindmapNode(theme: ConsolidatedTheme): MindmapNode;
    /**
     * Convert MindmapNode back to ConsolidatedTheme
     */
    static convertMindmapNodeToTheme(node: MindmapNode): ConsolidatedTheme;
    /**
     * Convert DirectChildAssignment to ConsolidatedTheme
     */
    static convertDirectAssignmentToTheme(assignment: DirectChildAssignment, parentTheme: ConsolidatedTheme): ConsolidatedTheme;
    /**
     * Convert code snippets (string[]) to structured CodeDiff[]
     * This is a best-effort conversion since snippets may lack line numbers
     */
    private static convertCodeSnippetsToCodeDiff;
    /**
     * Convert structured CodeDiff[] back to simple code snippets
     */
    private static convertCodeDiffToSnippets;
    /**
     * Infer context type from file path
     */
    private static inferContextType;
    /**
     * Validate that DirectChildAssignment has proper code assignments
     */
    static validateDirectAssignment(assignment: DirectChildAssignment): boolean;
}
