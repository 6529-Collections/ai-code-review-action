import * as fs from 'fs';
import * as path from 'path';
import { ThemeAnalysisResult } from '@/shared/types/theme-types';

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
    ? '/github/workspace/output'
    : '.ai-code-review';
  private static readonly LOCAL_DIR = process.env.ACT === 'true'
    ? '/github/workspace/output'
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
    console.log(`[OUTPUT-SAVER-DEBUG] ACT env: ${process.env.ACT}`);
    console.log(`[OUTPUT-SAVER-DEBUG] OUTPUT_DIR: ${this.OUTPUT_DIR}`);
    console.log(`[OUTPUT-SAVER-DEBUG] LOCAL_DIR: ${this.LOCAL_DIR}`);
    
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

    console.log(`[OUTPUT-SAVER] Analysis saved to: ${filepath}`);
    console.log(`[OUTPUT-SAVER] File size: ${(jsonContent.length / 1024).toFixed(1)}KB`);

    return filepath;
  }

  /**
   * Get list of saved analysis files
   */
  static getSavedAnalyses(): string[] {
    if (!fs.existsSync(this.LOCAL_DIR)) {
      return [];
    }

    return fs.readdirSync(this.LOCAL_DIR)
      .filter(file => file.endsWith('.json') && file.startsWith('analysis-'))
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
      console.error(`[OUTPUT-SAVER] Failed to load analysis ${filename}:`, error);
      return null;
    }
  }

  /**
   * Clean up old analysis files (keep last N files)
   */
  static cleanupOldAnalyses(keepCount: number = 10): void {
    const files = this.getSavedAnalyses();
    
    if (files.length <= keepCount) {
      return;
    }

    const filesToDelete = files.slice(keepCount);
    let deletedCount = 0;

    for (const filename of filesToDelete) {
      try {
        const filepath = path.join(this.LOCAL_DIR, filename);
        fs.unlinkSync(filepath);
        deletedCount++;
      } catch (error) {
        console.warn(`[OUTPUT-SAVER] Failed to delete ${filename}:`, error);
      }
    }

    if (deletedCount > 0) {
      console.log(`[OUTPUT-SAVER] Cleaned up ${deletedCount} old analysis files`);
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
      metadata.gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      metadata.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().substring(0, 8);
    } catch (error) {
      // Git info is optional
      console.debug('[OUTPUT-SAVER] Could not get git info:', error);
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