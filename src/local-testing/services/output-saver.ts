import * as fs from 'fs';
import * as path from 'path';
import { ThemeAnalysisResult } from '@/shared/types/theme-types';
import { ReviewResult } from '@/review/types/review-types';

export interface SavedAnalysisMetadata {
  timestamp: string;
  mode: string;
  totalFiles: number;
  totalThemes: number;
  processingTimeMs: number;
  gitBranch?: string;
  gitCommit?: string;
}

export interface SavedAnalysis {
  metadata: SavedAnalysisMetadata;
  themes: any; // The formatted themes output
  summary: string;
  rawAnalysis: ThemeAnalysisResult;
}

/**
 * OutputSaver handles saving local testing results to disk
 */
export class OutputSaver {
  private static readonly OUTPUT_DIR = process.env.ACT === 'true' 
    ? './'
    : '.ai-code-review';
  private static readonly LOCAL_DIR = process.env.ACT === 'true'
    ? './test-output'
    : path.join(OutputSaver.OUTPUT_DIR, 'local-results');

  /**
   * Save analysis results to disk with timestamp and metadata
   */
  static async saveAnalysis(
    themes: any,
    summary: string,
    rawAnalysis: ThemeAnalysisResult,
    mode: string
  ): Promise<string> {
    
    // Ensure output directory exists
    await this.ensureDirectoryExists();

    // Generate metadata
    const metadata = await this.generateMetadata(rawAnalysis, mode);
    
    // Create saved analysis object
    const savedAnalysis: SavedAnalysis = {
      metadata,
      themes,
      summary,
      rawAnalysis,
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-${timestamp}.json`;
    const filepath = path.join(this.LOCAL_DIR, filename);

    // Save to file
    const jsonContent = JSON.stringify(savedAnalysis, null, 2);
    fs.writeFileSync(filepath, jsonContent, 'utf8');

    

    return filepath;
  }

  /**
   * Save review results to disk
   */
  static async saveReviewResults(
    reviewResult: ReviewResult,
    mode: string
  ): Promise<string> {
    
    // Ensure output directory exists
    await this.ensureDirectoryExists();

    // Generate timestamp once for consistency
    const timestamp = new Date().toISOString();
    const fileTimestamp = timestamp.replace(/[:.]/g, '-');
    const filename = `review-${fileTimestamp}.json`;
    const filepath = path.join(this.LOCAL_DIR, filename);

    // Create clean review save object without redundant data
    const savedReview = {
      saveMetadata: {
        timestamp,
        mode,
        savedAt: timestamp,
        version: '2.0',
        type: 'review-result'
      },
      ...reviewResult  // Spread the review result directly to avoid duplication
    };

    // Save to file
    const jsonContent = JSON.stringify(savedReview, null, 2);
    fs.writeFileSync(filepath, jsonContent, 'utf8');

    return filepath;
  }

  /**
   * Generate log file path with timestamp
   */
  static generateLogFilePath(timestamp?: string): string {
    const ts = timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `analysis-${ts}.log`;
    return path.join(this.LOCAL_DIR, filename);
  }

  /**
   * Initialize log file for live streaming
   */
  static async initializeLogFile(timestamp?: string): Promise<string> {
    await this.ensureDirectoryExists();
    const logPath = this.generateLogFilePath(timestamp);
    
    // Create empty log file
    try {
      fs.writeFileSync(logPath, '');
    } catch (error) {
      console.error(`Failed to create log file: ${error}`);
    }
    
    return logPath;
  }

  /**
   * Get list of saved analysis files
   */
  static getSavedAnalyses(): string[] {
    if (!fs.existsSync(this.LOCAL_DIR)) {
      return [];
    }

    return fs.readdirSync(this.LOCAL_DIR)
      .filter(file => (file.endsWith('.json') || file.endsWith('.log')) && file.startsWith('analysis-'))
      .sort()
      .reverse(); // Most recent first
  }

  /**
   * Load a specific saved analysis
   */
  static loadAnalysis(filename: string): SavedAnalysis | null {
    const filepath = path.join(this.LOCAL_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content) as SavedAnalysis;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up all analysis files for fresh start
   */
  static cleanAllAnalyses(): void {
    if (!fs.existsSync(this.LOCAL_DIR)) {
      return;
    }

    // Get all analysis files (both JSON and log)
    const allFiles = fs.readdirSync(this.LOCAL_DIR)
      .filter(file => file.startsWith('analysis-') && (file.endsWith('.json') || file.endsWith('.log')));

    // Delete all analysis files
    for (const filename of allFiles) {
      try {
        const filepath = path.join(this.LOCAL_DIR, filename);
        fs.unlinkSync(filepath);
      } catch (error) {
        // Ignore errors, continue cleanup
      }
    }
  }

  /**
   * Ensure output directories exist
   */
  private static async ensureDirectoryExists(): Promise<void> {
    if (!fs.existsSync(this.OUTPUT_DIR)) {
      fs.mkdirSync(this.OUTPUT_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(this.LOCAL_DIR)) {
      fs.mkdirSync(this.LOCAL_DIR, { recursive: true });
    }
  }

  /**
   * Generate metadata for the analysis
   */
  private static async generateMetadata(
    analysis: ThemeAnalysisResult,
    mode: string
  ): Promise<SavedAnalysisMetadata> {
    const metadata: SavedAnalysisMetadata = {
      timestamp: new Date().toISOString(),
      mode,
      totalFiles: analysis.themes?.length || 0, // Approximate from themes
      totalThemes: analysis.totalThemes,
      processingTimeMs: analysis.processingTime,
    };

    // Try to get git info
    try {
      const { execSync } = require('child_process');
      metadata.gitBranch = execSync('git branch --show-current', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      metadata.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().substring(0, 8);
    } catch (error) {
      // Git info is optional
    }

    return metadata;
  }

  /**
   * Get summary of all saved analyses
   */
  static getSavedAnalysesSummary(): Array<{filename: string, metadata: SavedAnalysisMetadata}> {
    const files = this.getSavedAnalyses();
    const summaries = [];

    for (const filename of files.slice(0, 20)) { // Show last 20
      const analysis = this.loadAnalysis(filename);
      if (analysis) {
        summaries.push({
          filename,
          metadata: analysis.metadata,
        });
      }
    }

    return summaries;
  }
}