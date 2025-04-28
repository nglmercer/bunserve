// src/index.ts
import { convertToHls } from './services/hls-conversion';
import { VIDEOS_DIR, PROCESSED_DIR } from './utils/fs-utils';

// Re-export main functionality and types
export {
  convertToHls,
  VIDEOS_DIR,
  PROCESSED_DIR
};

// Re-export types
export * from './types/index';