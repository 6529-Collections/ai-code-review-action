import { MindmapNode, DirectChildAssignment } from '../types/mindmap-types';
/**
 * Direct code assignment service - no mechanical matching
 * PRD: "AI decides everything" - just validates and passes through AI assignments
 */
export declare class DirectCodeAssignmentService {
    /**
     * Process AI-assigned children (no mechanical distribution)
     */
    processDirectAssignments(parentNode: MindmapNode, assignments: DirectChildAssignment[]): Promise<MindmapNode[]>;
    /**
     * Create child node from AI assignment (no processing needed)
     */
    private createChildFromAssignment;
    /**
     * Validate that AI assignments cover all parent code
     */
    private validateCodeCoverage;
    /**
     * Extract all line content from code diffs for comparison
     */
    private extractAllLines;
    /**
     * Calculate metrics from assigned code
     */
    private calculateMetrics;
    /**
     * Extract affected files from code diffs
     */
    private extractAffectedFiles;
    /**
     * Calculate confidence based on assignment quality
     */
    private calculateConfidence;
    /**
     * Generate child node ID
     */
    private generateChildId;
}
