// src/services/hls-conversion.ts

import type * as Types from '../types/index';
import { defaultHlsOptions } from '../config/default-options';
import { createOutputDirectory } from '../utils/fs-utils';
import { getVideoMetadata, processResolution } from '../utils/ffmpeg-utils';
import { validateVideoFilePath, validateVideoRelativePath, determineTargetResolutions } from '../utils/validation-utils';
import { createMasterPlaylist } from '../utils/playlist-utils';
import { createConversionTask, updateTaskStatus, completeTask, failTask } from '../utils/task-utils';

/**
 * Validates inputs and prepares data for HLS conversion
 */
export const prepareHlsConversion = async (
  inputPath: string,
  data: Types.UploadData,
  userOptions: Partial<Types.HlsOptions> = {}
): Promise<{
  validatedPath: string;
  videoRelativePath: string;
  options: Types.HlsOptions;
  outputDir: string;
  taskId: string;
  videoMetadata: {
    originalWidth: number;
    originalHeight: number;
    originalBitrateStr: string;
  };
  taskData: any;
  targetResolutions: Types.ResolutionInfo[];
}> => {
  // Validate inputs
  const videoRelativePath = `${data.season_id}/${data.episode}`;
  validateVideoFilePath(inputPath);
  validateVideoRelativePath(videoRelativePath);
  
  // Merge options with defaults
  const options: Types.HlsOptions = { ...defaultHlsOptions, ...userOptions };

  // Create output directory
  const outputDir = await createOutputDirectory(videoRelativePath);

  // Get video metadata
  const { width: originalWidth, height: originalHeight, bitrateStr: originalBitrateStr } =
    await getVideoMetadata(inputPath);

  // Create a task
  const taskData = {
    outputDir,
    season_id: data.season_id,
    episode: data.episode,
    originalWidth,
    originalHeight,
    bitrate: originalBitrateStr,
    resolutions: [{
      name: `${originalHeight}p`,
      season_id: data.season_id,
      episode: data.episode,
      size: `${originalWidth}x${originalHeight}`,
      bitrate: originalBitrateStr,
      isOriginal: true
    }]
  };
  
  const taskId = createConversionTask(taskData);

  console.log(`[${videoRelativePath}] Original resolution: ${originalWidth}x${originalHeight}, Bitrate: ${originalBitrateStr}`);

  // Determine target resolutions
  const targetResolutions = determineTargetResolutions(
    originalWidth,
    originalHeight,
    originalBitrateStr,
    options.resolutions
  );

  console.log(`[${videoRelativePath}] Target resolutions:`, targetResolutions.map(r => r.name));

  return {
    validatedPath: inputPath,
    videoRelativePath,
    options,
    outputDir,
    taskId,
    videoMetadata: {
      originalWidth,
      originalHeight,
      originalBitrateStr
    },
    taskData,
    targetResolutions
  };
};

/**
 * Processes the actual HLS conversion using prepared data
 */
async function processHlsConversion(
  prepared: ReturnType<typeof prepareHlsConversion> extends Promise<infer T> ? T : never
): Promise<Types.ConversionResult> {
  const {
    validatedPath: inputPath,
    videoRelativePath,
    options,
    outputDir,
    taskId,
    taskData,
    targetResolutions
  } = await prepared;

  try {
    // Process each resolution
    updateTaskStatus('processing', taskId);

    const processingPromises = targetResolutions.map(resInfo =>
      processResolution(inputPath, outputDir, resInfo, options, videoRelativePath)
    );

    // Wait for all resolutions to be processed
    const results = await Promise.allSettled(processingPromises);

    // Handle results
    const successfulResults: Types.ResolutionInfo[] = [];
    const errors: Error[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        errors.push(result.reason as Error);
        console.error(`[${videoRelativePath}] A resolution processing task failed:`,
          result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
    });

    // Check if any errors occurred
    if (errors.length > 0) {
      throw new Error(`HLS conversion failed for ${errors.length} resolution(s).`);
    }

    if (successfulResults.length === 0) {
      throw new Error(`HLS conversion resulted in no successful resolutions.`);
    }

    // Create master playlist
    const { masterPlaylistPath, masterPlaylistUrl } =
      await createMasterPlaylist(outputDir, successfulResults, options, videoRelativePath);

    // Update task with final resolutions
    const finalTaskData = {
      ...taskData,
      resolutions: successfulResults.map(res => ({
        name: res.name,
        season_id: taskData.season_id,
        episode: taskData.episode,
        size: res.size,
        bitrate: res.bitrate,
        isOriginal: res.isOriginal || false,
        bandwidth: res.bandwidth,
        playlistRelativePath: res.playlistRelativePath
      }))
    };
    
    // Complete task with updated data
    const result = completeTask(taskId);
    console.log(`[${videoRelativePath}] HLS conversion completed successfully.`, result);
    /* db.insert('episodes', result); */
    
    // Return result
    return {
      message: 'HLS conversion successful',
      outputDir,
      masterPlaylistPath,
      masterPlaylistUrl,
      result: { ...result, ...finalTaskData }
    };

  } catch (error) {
    // Handle errors
    console.error(`[${videoRelativePath}] Error during HLS conversion process:`,
      error instanceof Error ? error.message : String(error));
    failTask(taskId, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Main function to convert a video to HLS format
 */
export const convertToHls = async (
  inputPath: string,
  data: Types.UploadData,
  userOptions: Partial<Types.HlsOptions> = {}
): Promise<Types.ConversionResult> => {
  try {
    // Step 1: Prepare the conversion (validate inputs and gather metadata)
    const prepared = await prepareHlsConversion(inputPath, data, userOptions);
    
    // Step 2: Process the actual conversion
    return await processHlsConversion(prepared);
  } catch (error) {
    console.error('HLS conversion failed:', 
      error instanceof Error ? error.message : String(error));
    throw error;
  }
};