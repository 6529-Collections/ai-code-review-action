/**
 * Configuration and types for local testing diff modes
 */

export enum DiffModeType {
  UNCOMMITTED = 'uncommitted',
  BRANCH = 'branch',
  // Future modes can be added here
  // STAGED = 'staged',
  // LAST_COMMIT = 'last-commit',
  // PR = 'pr'
}

export interface DiffModeConfig {
  mode: DiffModeType;
  // Future options can be added here
  // baseBranch?: string;
  // commitCount?: number;
}

export const DEFAULT_DIFF_MODE_CONFIG: DiffModeConfig = {
  mode: DiffModeType.UNCOMMITTED,
};