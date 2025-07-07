/**
 * Local testing module entry point
 * Exports all components needed for local testing functionality
 */
export * from './config/diff-modes';
export { LocalDiffService } from './services/local-diff-service';
export { LocalGitService } from './services/local-git-service';
export { OutputSaver } from './services/output-saver';
export * from './modes';
