import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
/**
 * Service for loading test data from test-output directory
 * Enables development mode by skipping Phase 1 and using saved mindmap data
 */
export declare class TestDataLoader {
    private static readonly TEST_OUTPUT_DIR;
    /**
     * Validates filename for security and format compliance
     */
    private static validateFilename;
    /**
     * Load themes from latest test-output JSON file
     */
    static loadLatestTestOutput(): ConsolidatedTheme[];
    /**
     * Load specific test-output file by name
     */
    static loadTestOutput(filename: string): ConsolidatedTheme[];
    /**
     * List available test output files
     */
    static listTestOutputFiles(): string[];
    /**
     * Get metadata from test output file
     */
    static getTestOutputMetadata(filename: string): any;
}
