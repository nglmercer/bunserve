// src/services/hls-conversion.ts

import type * as Types from '../types/index';
import { defaultHlsOptions } from '../config/default-options';
import { createOutputDirectory } from '../utils/fs-utils';
import { getVideoMetadata, processResolution } from '../utils/ffmpeg-utils';
import { validateVideoFilePath, validateVideoId, determineTargetResolutions } from '../utils/validation-utils';
import { createMasterPlaylist } from '../utils/playlist-utils';
import { createConversionTask, updateTaskStatus, completeTask, failTask } from '../utils/task-utils';

/**
 * Main function to convert a video to HLS format
 */
export const convertToHls = async (
  inputPath: string,
  formDataObj: Types.UploadData,
  userOptions: Partial<Types.HlsOptions> = {}
): Promise<Types.ConversionResult> => {
  // Validate inputs
  const videoId = `${formDataObj.season_id}/${formDataObj.number}`;
  validateVideoFilePath(inputPath);
  validateVideoId(videoId);
  
  // Merge options with defaults
  const options: Types.HlsOptions = { ...defaultHlsOptions, ...userOptions };

  let taskId: string | null = null;

  try {
    // Create output directory
    const outputDir = await createOutputDirectory(videoId);

    // Get video metadata
    const { width: originalWidth, height: originalHeight, bitrateStr: originalBitrateStr } =
      await getVideoMetadata(inputPath);

    // Create a task
    const taskData = {
      videoId,
      season_id: formDataObj.season_id,
      episode: formDataObj.number,
      originalWidth,
      originalHeight,
      bitrate: originalBitrateStr,
      resolutions: [{
        name: `${originalHeight}p`,
        season_id: formDataObj.season_id,
        episode: formDataObj.number,
        size: `${originalWidth}x${originalHeight}`,
        bitrate: originalBitrateStr,
        isOriginal: true
      }]
    };
    
    taskId = createConversionTask(taskData);

    console.log(`[${videoId}] Original resolution: ${originalWidth}x${originalHeight}, Bitrate: ${originalBitrateStr}`);

    // Determine target resolutions
    const targetResolutions = determineTargetResolutions(
      originalWidth,
      originalHeight,
      originalBitrateStr,
      options.resolutions
    );

    console.log(`[${videoId}] Target resolutions:`, targetResolutions.map(r => r.name));

    // Process each resolution
    updateTaskStatus('processing', taskId);

    const processingPromises = targetResolutions.map(resInfo =>
      processResolution(inputPath, outputDir, resInfo, options, videoId)
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
        console.error(`[${videoId}] A resolution processing task failed:`,
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
      await createMasterPlaylist(outputDir, successfulResults, options, videoId);

    // Update task with final resolutions
    const finalTaskData = {
      ...taskData,
      resolutions: successfulResults.map(res => ({
        name: res.name,
        season_id: formDataObj.season_id,
        episode: formDataObj.number,
        size: res.size,
        bitrate: res.bitrate,
        isOriginal: res.isOriginal || false,
        bandwidth: res.bandwidth,
        playlistRelativePath: res.playlistRelativePath
      }))
    };
    
    // Complete task with updated data
    const result = completeTask(taskId);
    console.log(`[${videoId}] HLS conversion completed successfully.`, result);
    /* db.insert('episodes', result); */
    
    // Return result
    return {
      message: 'HLS conversion successful',
      outputDir,
      masterPlaylistPath,
      masterPlaylistUrl,
      result:{ ...result, ...finalTaskData }
    };

  } catch (error) {
    // Handle errors
    console.error(`[${videoId}] Error during HLS conversion process:`,
      error instanceof Error ? error.message : String(error));
    if (taskId) {
      failTask(taskId, error instanceof Error ? error : new Error(String(error)));
    }

    throw error;
  }
};