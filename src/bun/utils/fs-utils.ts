// src/utils/fs-utils.ts
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Project paths configuration
 */
const PROJECT_ROOT = path.join(__dirname, '../..');
export const PROCESSED_DIR = path.join(PROJECT_ROOT, 'processed_videos');
export const VIDEOS_DIR = path.join(PROJECT_ROOT, 'videos');

/**
 * Ensures a directory exists, creating it if necessary
 */
export const ensureDirExists = async (dirPath: string): Promise<void> => {
  try {
    await fs.access(dirPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Directory created: ${dirPath}`);
      } catch (mkdirError) {
        console.error(`Error creating directory ${dirPath}:`, mkdirError);
        throw mkdirError;
      }
    } else {
      console.error(`Error accessing directory ${dirPath}:`, error);
      throw error;
    }
  }
};

/**
 * Writes a file safely, ensuring the directory exists
 */
export const writeFileSafe = async (filePath: string, content: string): Promise<void> => {
  const directory = path.dirname(filePath);
  await ensureDirExists(directory);
  await fs.writeFile(filePath, content);
};

/**
 * Creates the output directory for video processing
 */
export const createOutputDirectory = async (videoId: string): Promise<string> => {
  const outputDir = path.join(PROCESSED_DIR, videoId);
  await ensureDirExists(outputDir);
  return outputDir;
};

/**
 * Gets a resolution-specific output directory
 */
export const getResolutionDirectory = (baseOutputDir: string, resolutionName: string): string => {
  return path.join(baseOutputDir, resolutionName);
};