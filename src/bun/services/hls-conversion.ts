// src/services/hls-conversion.ts
import type * as Types from '../types/index';
import { defaultHlsOptions } from '../config/default-options';
import { createOutputDirectory } from '../utils/fs-utils';
import {
  getVideoMetadata, // Might still be useful for logging original info
  processResolution,
  checkMediaType,    // <-- Import checkMediaType
  generateAudioHls // <-- Import the new function
} from '../utils/ffmpeg-utils';
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
/*
export const prepareAudioHlsConversion = async (
  inputPath: string,
  data: Types.UploadData, // Reuse UploadData or create specific type if needed
  userOptions: Partial<Types.HlsOptions> = {}
): Promise<{
  validatedPath: string;
  audioId: string; // Identifier for audio
  options: Types.HlsOptions;
  outputDir: string;
  taskId: string;
  taskData: any;
}> => {
  // Validate inputs
  const audioId = `${data.season_id}/${data.episode}`; // Use same identifier convention
  validateVideoFilePath(inputPath); // Reuse validation for file path
  validateVideoRelativePath(audioId); // Reuse validation for relative path format

  // Check if the file is actually processable audio/video
  const mediaType = await checkMediaType(inputPath);
   if (mediaType !== 'audio' && mediaType !== 'video') {
        throw new Error(`Input file '${inputPath}' is not a valid audio or video file (type: ${mediaType}). Cannot create audio HLS.`);
   }
   if (mediaType === 'error') {
        throw new Error(`Failed to check media type for '${inputPath}' due to an ffprobe error.`);
   }
   console.log(`[AudioHLS ${audioId}] Input file type detected: ${mediaType}`);


  // Merge options with defaults (using the same defaults for now)
  const options: Types.HlsOptions = { ...defaultHlsOptions, ...userOptions };

  // Create output directory (using the same function)
  const outputDir = await createOutputDirectory(audioId); // e.g., /output/public/videos/s1/e1

  // --- Optional: Get original metadata for logging/task ---
  let originalMetadata = { audioDetected: true }; // Basic info
  try {
      // Try getting video metadata if it's video, otherwise just note audio
      if (mediaType === 'video') {
          const { width, height, bitrateStr } = await getVideoMetadata(inputPath);
          originalMetadata = { ...originalMetadata, width, height, bitrateStr };
      } else {
          // Maybe use ffprobe again to get audio-specific metadata if needed
          // For now, just mark as audio
      }
  } catch (metaError: any) {
      console.warn(`[AudioHLS ${audioId}] Could not get full metadata: ${metaError.message}`);
  }


  // Create a task (adjust task data structure as needed for audio)
  const taskData = {
    inputType: mediaType,
    outputType: 'audio-hls',
    outputDir,
    season_id: data.season_id,
    episode: data.episode,
    targetAudioCodec: options.audioCodec || defaultHlsOptions.audioCodec,
    targetAudioBitrate: options.audioBitrate || defaultHlsOptions.audioBitrate,
    ...originalMetadata // Include any gathered metadata
  };

  const taskId = createConversionTask(taskData); // Use the same task creation util

  console.log(`[AudioHLS ${audioId}] Prepared for Audio HLS conversion. Task ID: ${taskId}`);

  return {
    validatedPath: inputPath,
    audioId,
    options,
    outputDir,
    taskId,
    taskData,
  };
};


async function processAudioHlsConversion(
  prepared: ReturnType<typeof prepareAudioHlsConversion> extends Promise<infer T> ? T : never
): Promise<Types.AudioHlsResult> { // Use a specific result type if defined
  const {
    validatedPath: inputPath,
    audioId,
    options,
    outputDir,
    taskId,
    taskData
  } = await prepared; // Await the promise from prepareAudioHlsConversion

  try {
    updateTaskStatus('processing', taskId);

    console.log(`[AudioHLS ${audioId}] Starting audio segmentation...`);

    // Call the core ffmpeg utility function
    const { playlistPath, playlistRelativePath } = await generateAudioHls(
        inputPath,
        outputDir, // Pass the base output dir (e.g., /output/public/videos/s1/e1)
        options,
        audioId
    );

    // Update task data with result paths
    const finalTaskData = {
        ...taskData,
        playlistPath, // Absolute path on server
        playlistRelativePath // Path relative to outputDir base (e.g., audio/audio.m3u8)
    };

    // Complete task
    const result = completeTask(taskId); // Assuming completeTask returns the final task object
    console.log(`[AudioHLS ${audioId}] Audio HLS conversion completed successfully.`);
    // Optionally save finalTaskData or result to DB here

    return {
      message: 'Audio HLS conversion successful',
      outputDir,
      playlistPath,
      playlistRelativePath,
      result: { ...result, ...finalTaskData } // Combine task result and final data
    };

  } catch (error) {
    console.error(`[AudioHLS ${audioId}] Error during audio HLS conversion process:`,
      error instanceof Error ? error.message : String(error));
    failTask(taskId, error instanceof Error ? error : new Error(String(error))); // Mark task as failed
    throw error; // Re-throw error for the caller
  }
}



export const convertToAudioHls = async (
  inputPath: string,
  data: Types.UploadData,
  userOptions: Partial<Types.HlsOptions> = {}
): Promise<Types.AudioHlsResult> => { // Return specific result type
  try {
    // Step 1: Prepare the conversion
    const prepared = await prepareAudioHlsConversion(inputPath, data, userOptions);

    // Step 2: Process the actual conversion
    return await processAudioHlsConversion(prepared);
  } catch (error) {
    console.error(`[AudioHLS] Conversion failed for ${data.season_id}/${data.episode}:`,
      error instanceof Error ? error.message : String(error));
    // Ensure error is thrown so caller knows it failed
    throw error;
  }
};
*/