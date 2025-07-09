import * as fs from 'fs';
import * as path from 'path';
import { ConsolidatedTheme } from '@/mindmap/types/similarity-types';
import { logger } from '@/shared/logger/logger';

/**
 * Service for loading test data from test-output directory
 * Enables development mode by skipping Phase 1 and using saved mindmap data
 */
export class TestDataLoader {
  private static readonly TEST_OUTPUT_DIR = path.join(process.cwd(), 'test-output');

  /**
   * Load themes from latest test-output JSON file
   */
  static async loadLatestTestOutput(): Promise<ConsolidatedTheme[]> {
    if (!fs.existsSync(this.TEST_OUTPUT_DIR)) {
      throw new Error('test-output directory not found. Run Phase 1 first to generate test data.');
    }
    
    const files = fs.readdirSync(this.TEST_OUTPUT_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('analysis-'))
      .sort()
      .reverse(); // Latest first
    
    if (files.length === 0) {
      throw new Error('No test-output JSON files found. Run Phase 1 first to generate test data.');
    }
    
    const latestFile = files[0];
    const filePath = path.join(this.TEST_OUTPUT_DIR, latestFile);
    
    logger.info('TEST_DATA_LOADER', `Loading test data from: ${latestFile}`);
    
    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);
      
      // Extract themes from the test output structure
      const themes = data.rawAnalysis?.themes || [];
      
      if (themes.length === 0) {
        throw new Error(`No themes found in test output file: ${latestFile}`);
      }
      
      logger.info('TEST_DATA_LOADER', `Loaded ${themes.length} themes from test data`);
      
      return themes;
    } catch (error) {
      throw new Error(`Failed to load test output file ${latestFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Load specific test-output file by name
   */
  static async loadTestOutput(filename: string): Promise<ConsolidatedTheme[]> {
    const filePath = path.join(this.TEST_OUTPUT_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test output file not found: ${filename}`);
    }
    
    logger.info('TEST_DATA_LOADER', `Loading test data from: ${filename}`);
    
    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);
      
      const themes = data.rawAnalysis?.themes || [];
      
      if (themes.length === 0) {
        throw new Error(`No themes found in test output file: ${filename}`);
      }
      
      logger.info('TEST_DATA_LOADER', `Loaded ${themes.length} themes from ${filename}`);
      
      return themes;
    } catch (error) {
      throw new Error(`Failed to load test output file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * List available test output files
   */
  static listTestOutputFiles(): string[] {
    if (!fs.existsSync(this.TEST_OUTPUT_DIR)) {
      return [];
    }
    
    return fs.readdirSync(this.TEST_OUTPUT_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('analysis-'))
      .sort()
      .reverse(); // Latest first
  }
  
  /**
   * Get metadata from test output file
   */
  static getTestOutputMetadata(filename: string): any {
    const filePath = path.join(this.TEST_OUTPUT_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test output file not found: ${filename}`);
    }
    
    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(rawData);
      
      return data.metadata || {};
    } catch (error) {
      throw new Error(`Failed to read metadata from ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}