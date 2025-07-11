/**
 * Configuration and types for local testing diff modes
 */
export declare enum DiffModeType {
    UNCOMMITTED = "uncommitted",
    BRANCH = "branch"
}
export interface DiffModeConfig {
    mode: DiffModeType;
}
export declare const DEFAULT_DIFF_MODE_CONFIG: DiffModeConfig;
