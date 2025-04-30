// src/utils/validation-utils.ts
import { type ResolutionInfo } from '../types';

/**
 * Validates a video file path
 */
export const validateVideoFilePath = (filePath: string): boolean => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid video file path');
  }
  
  // Check if path has a valid video extension
  const validExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'];
  const hasValidExtension = validExtensions.some(ext => 
    filePath.toLowerCase().endsWith(ext)
  );
  
  if (!hasValidExtension) {
    throw new Error('Unsupported video file format');
  }
  
  return true;
};

/**
 * Validates video ID
 */
export const validateVideoRelativePath = (videoId: string): boolean => {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid video ID');
  }
  
  // Check if video ID has valid characters (alphanumeric, dash, underscore, slash)
  const validIdPattern = /^[a-zA-Z0-9_\/-]+$/;
  if (!validIdPattern.test(videoId)) {
    throw new Error('Video ID contains invalid characters');
  }
  
  return true;
};

/**
 * Determine target resolutions based on original video dimensions
 */
export const determineTargetResolutions = (
  originalWidth: number,
  originalHeight: number,
  originalBitrateStr: string,
  userDefinedResolutions: ResolutionInfo[],
): ResolutionInfo[] => {
  let targetResolutions = [...userDefinedResolutions];
  const originalResName = `${originalHeight}p`;
  const originalAlreadyDefined = targetResolutions.some(r => r.name === originalResName);

  if (!originalAlreadyDefined) {
    const isDifferent = !targetResolutions.some(r => r.size === `${originalWidth}x${originalHeight}`);
    if (isDifferent) {
      targetResolutions.push({
        name: originalResName,
        season_id: userDefinedResolutions[0]?.season_id,
        episode: userDefinedResolutions[0]?.episode,
        size: `${originalWidth}x${originalHeight}`,
        bitrate: originalBitrateStr,
        isOriginal: true
      });
      targetResolutions.sort((a, b) => parseInt(a.name) - parseInt(b.name));
    } else {
      const existingRes = targetResolutions.find(r => r.size === `${originalWidth}x${originalHeight}`);
      if (existingRes) existingRes.isOriginal = true;
    }
  }

  return targetResolutions;
};

/**
 * Validates and completes an HLS options object
 */
export const validateHlsOptions = (options: any): boolean => {
  if (!options) {
    throw new Error('HLS options cannot be null or undefined');
  }
  
  // Validate resolutions if provided
  if (options.resolutions && Array.isArray(options.resolutions)) {
    options.resolutions.forEach((resolution: any, index: number) => {
      if (!resolution.name || !resolution.size || !resolution.bitrate) {
        throw new Error(`Invalid resolution at index ${index}`);
      }
    });
  }
  
  return true;
};