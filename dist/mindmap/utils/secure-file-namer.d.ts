/**
 * Secure file naming utility that prevents collisions in parallel execution
 * by using UUIDs, process IDs, and crypto-grade randomness
 */
export declare class SecureFileNamer {
    private static processId;
    private static processStartTime;
    /**
     * Generate a collision-resistant file name for temporary files
     */
    static generateSecureFileName(prefix: string, extension?: string): string;
    /**
     * Generate a collision-resistant ID for entities (themes, batches, etc.)
     */
    static generateSecureId(prefix: string): string;
    /**
     * Generate a short collision-resistant ID for performance-critical operations
     */
    static generateShortSecureId(prefix: string): string;
    /**
     * Create a process-isolated temporary file path
     */
    static createSecureTempFilePath(prefix: string, extension?: string): string;
    /**
     * Get or create a process-specific temporary directory
     */
    static getProcessTempDir(): string;
    /**
     * Create a temporary file with secure naming and optional content
     */
    static createSecureTempFile(prefix: string, content?: string, extension?: string): {
        filePath: string;
        cleanup: () => void;
    };
    /**
     * Clean up process-specific temporary directory
     */
    static cleanupProcessTempDir(): void;
    /**
     * Generate batch ID with collision resistance for concurrent operations
     */
    static generateBatchId(batchType: string, promptType?: string): string;
    /**
     * Generate expansion/request ID with hierarchy support
     */
    static generateHierarchicalId(type: string, parentId?: string, index?: number): string;
    /**
     * Validate that a generated ID/filename is collision-resistant
     */
    static validateSecureNaming(name: string): boolean;
    /**
     * Get statistics about the naming system
     */
    static getStats(): {
        processId: number;
        processStartTime: number;
        tempDir: string;
        entropyBits: number;
    };
}
