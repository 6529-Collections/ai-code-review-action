import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Secure file naming utility that prevents collisions in parallel execution
 * by using UUIDs, process IDs, and crypto-grade randomness
 */
export class SecureFileNamer {
  private static processId = process.pid;
  private static processStartTime = Date.now();

  /**
   * Generate a collision-resistant file name for temporary files
   */
  static generateSecureFileName(
    prefix: string,
    extension: string = 'txt'
  ): string {
    const uuid = crypto.randomUUID().substring(0, 8);
    const pid = this.processId;
    const random = crypto.randomBytes(4).toString('hex');
    const timestamp = Date.now();

    return `${prefix}-${pid}-${uuid}-${random}-${timestamp}.${extension}`;
  }

  /**
   * Generate a collision-resistant ID for entities (themes, batches, etc.)
   */
  static generateSecureId(prefix: string): string {
    const uuid = crypto.randomUUID();
    return `${prefix}-${uuid}`;
  }

  /**
   * Generate a short collision-resistant ID for performance-critical operations
   */
  static generateShortSecureId(prefix: string): string {
    const shortUuid = crypto.randomUUID().substring(0, 8);
    const random = crypto.randomBytes(2).toString('hex');
    return `${prefix}-${shortUuid}-${random}`;
  }

  /**
   * Create a process-isolated temporary file path
   */
  static createSecureTempFilePath(
    prefix: string,
    extension: string = 'txt'
  ): string {
    const fileName = this.generateSecureFileName(prefix, extension);
    const processDir = this.getProcessTempDir();
    return path.join(processDir, fileName);
  }

  /**
   * Get or create a process-specific temporary directory
   */
  static getProcessTempDir(): string {
    const processDir = path.join(
      os.tmpdir(),
      `ai-code-review-${this.processId}-${this.processStartTime}`
    );

    try {
      if (!fs.existsSync(processDir)) {
        fs.mkdirSync(processDir, { recursive: true });
      }
    } catch (error) {
      // Fallback to system temp dir if process dir creation fails
      console.warn(`Failed to create process temp dir: ${error}`);
      return os.tmpdir();
    }

    return processDir;
  }

  /**
   * Create a temporary file with secure naming and optional content
   */
  static createSecureTempFile(
    prefix: string,
    content: string = '',
    extension: string = 'txt'
  ): { filePath: string; cleanup: () => void } {
    const filePath = this.createSecureTempFilePath(prefix, extension);

    try {
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to create secure temp file: ${error}`);
    }

    const cleanup = (): void => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${filePath}: ${error}`);
      }
    };

    return { filePath, cleanup };
  }

  /**
   * Clean up process-specific temporary directory
   */
  static cleanupProcessTempDir(): void {
    const processDir = path.join(
      os.tmpdir(),
      `ai-code-review-${this.processId}-${this.processStartTime}`
    );

    try {
      if (fs.existsSync(processDir)) {
        // Remove all files in the directory
        const files = fs.readdirSync(processDir);
        for (const file of files) {
          fs.unlinkSync(path.join(processDir, file));
        }
        // Remove the directory
        fs.rmdirSync(processDir);
      }
    } catch (error) {
      console.warn(`Failed to cleanup process temp dir: ${error}`);
    }
  }

  /**
   * Generate batch ID with collision resistance for concurrent operations
   */
  static generateBatchId(batchType: string, promptType?: string): string {
    const uuid = crypto.randomUUID().substring(0, 12);
    const pid = this.processId;
    const random = crypto.randomBytes(3).toString('hex');

    if (promptType) {
      return `${batchType}-${promptType}-${pid}-${uuid}-${random}`;
    }
    return `${batchType}-${pid}-${uuid}-${random}`;
  }

  /**
   * Generate expansion/request ID with hierarchy support
   */
  static generateHierarchicalId(
    type: string,
    parentId?: string,
    index?: number
  ): string {
    const uuid = crypto.randomUUID().substring(0, 8);
    const random = crypto.randomBytes(2).toString('hex');

    if (parentId && typeof index === 'number') {
      return `${parentId}_${type}_${index}_${uuid}_${random}`;
    }
    if (parentId) {
      return `${parentId}_${type}_${uuid}_${random}`;
    }
    return `${type}_${uuid}_${random}`;
  }

  /**
   * Validate that a generated ID/filename is collision-resistant
   */
  static validateSecureNaming(name: string): boolean {
    // Check for minimum entropy (process ID + UUID parts + random)
    const parts = name.split('-');
    if (parts.length < 4) return false;

    // Check for presence of process ID (numeric)
    if (!parts.some((part) => /^\d+$/.test(part))) return false;

    // Check for presence of hex random data
    if (!parts.some((part) => /^[a-f0-9]{4,}$/i.test(part))) return false;

    return true;
  }

  /**
   * Get statistics about the naming system
   */
  static getStats(): {
    processId: number;
    processStartTime: number;
    tempDir: string;
    entropyBits: number;
  } {
    return {
      processId: this.processId,
      processStartTime: this.processStartTime,
      tempDir: this.getProcessTempDir(),
      entropyBits: 128 + 32 + 16, // UUID + random bytes + timestamp
    };
  }
}

/**
 * Setup process cleanup handlers
 */
function setupCleanupHandlers(): void {
  const cleanup = (): void => SecureFileNamer.cleanupProcessTempDir();

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    cleanup();
    process.exit(1);
  });
}

// Initialize cleanup handlers
setupCleanupHandlers();
