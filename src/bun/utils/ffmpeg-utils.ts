// src/utils/ffmpeg-utils.ts
import ffmpeg from 'fluent-ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import type * as Types from '../types/index'; // Assuming your types are here
import path from 'path';
import fs from 'fs/promises'; // Using promises version of fs

import winston from 'winston';
// Configure ffmpeg to use the correct ffprobe path
ffmpeg.setFfprobePath(ffprobePath);

// Setup logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'ffmpeg-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          const metaStr = Object.keys(metadata).length ? 
            `\n${JSON.stringify(metadata, null, 2)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    })
  ]
});

// --- Define a type for media classification ---
export type MediaType = 'video' | 'audio' | 'unknown' | 'error';

/**
 * Checks if a file is primarily video or audio using ffprobe.
 * Prioritizes 'video' if both streams are present.
 * @param filePath The path to the media file.
 * @returns A Promise resolving to 'video', 'audio', 'unknown', or 'error'.
 */
export const checkMediaType = (filePath: string): Promise<MediaType> => {
  return new Promise((resolve) => { // Changed reject to resolve('error') for easier handling in combined function
      ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
          logger.error(`ffprobe error checking type for ${filePath}: ${err.message}`);
          // Resolve with 'error' instead of rejecting to simplify control flow later
          return resolve('error');
      }
      if (!data || !data.streams || data.streams.length === 0) {
          logger.warn(`ffprobe returned no stream data for ${filePath}.`);
          return resolve('unknown');
      }

      const hasVideoStream = data.streams.some(s => s.codec_type === 'video');
      const hasAudioStream = data.streams.some(s => s.codec_type === 'audio');

      if (hasVideoStream) {
          resolve('video');
      } else if (hasAudioStream) {
          resolve('audio');
      } else {
          resolve('unknown');
      }
      });
  });
};


/**
 * Extracts audio from a media file and saves it as an MP3.
 * @param inputPath The path to the input media file (video or audio).
 * @param outputPath The desired path for the output audio file (e.g., '/path/to/output.mp3').
 * @param options Optional parameters for audio extraction.
 * @param options.audioCodec Audio codec to use (default: 'libmp3lame').
 * @param options.audioBitrate Audio bitrate (default: '192k').
 * @returns A Promise resolving with the output path on success, or rejecting on error.
 */
export const extractAudio = (
    inputPath: string,
    outputPath: string,
    options?: { audioCodec?: string; audioBitrate?: string }
): Promise<string> => {
    const { audioCodec = 'libmp3lame', audioBitrate = '192k' } = options || {};

    return new Promise(async (resolve, reject) => {
        // Basic validation
        if (!inputPath || !outputPath) {
            return reject(new Error("Input and output paths are required for audio extraction."));
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        try {
            await fs.mkdir(outputDir, { recursive: true });
        } catch (dirError: any) {
            return reject(new Error(`Failed to create output directory ${outputDir}: ${dirError.message}`));
        }

        logger.log("utils",`[Audio Extraction] Starting extraction from ${inputPath} to ${outputPath}`);

        ffmpeg(inputPath)
            .outputOptions([
                '-vn',                      // Disable video recording
                '-acodec', audioCodec,      // Set audio codec
                '-ab', audioBitrate,        // Set audio bitrate
                // '-ar', '44100',          // Optional: Set audio sample rate (often automatic)
                // '-ac', '2'               // Optional: Set audio channels to stereo (often automatic)
            ])
            .output(outputPath)
            .on('start', (commandLine) => {
                logger.log("utils",`[Audio Extraction] Spawned Ffmpeg with command: ${commandLine.substring(0, 250)}...`);
            })
            .on('progress', (progress) => {
                // Avoid excessive logging, maybe log every 10% or based on time
                if (progress.percent && Math.round(progress.percent) % 20 === 0) {
                    logger.log("utils",`[Audio Extraction] Progress (${path.basename(inputPath)}): ${progress.percent.toFixed(2)}%`);
                } else if (progress.timemark) {
                   // logger.log("utils",`[Audio Extraction] Processing timemark: ${progress.timemark}`);
                }
            })
            .on('end', () => {
                logger.log("utils",`[Audio Extraction] Finished successfully: ${outputPath}`);
                resolve(outputPath); // Resolve with the output path
            })
            .on('error', (err, stdout, stderr) => {
                logger.error(`[Audio Extraction] Error processing ${inputPath}:`, err.message);
                logger.error('[Audio Extraction] Ffmpeg stdout:', stdout);
                logger.error('[Audio Extraction] Ffmpeg stderr:', stderr);
                reject(new Error(`Error extracting audio from ${path.basename(inputPath)}: ${err.message}`));
            })
            .run();
    });
};


/**
 * Checks if a file is video or audio, and if so, extracts/converts its audio track to MP3 format.
 * @param inputPath Path to the input file.
 * @param outputDir Directory where the resulting audio file should be saved.
 * @param options Optional parameters for audio extraction (codec, bitrate).
 * @param options.outputFilename Optional base name for the output file (without extension). Defaults to input filename.
 * @param options.audioCodec Audio codec for output (default: 'libmp3lame').
 * @param options.audioBitrate Audio bitrate for output (default: '192k').
 * @returns A Promise resolving with the path to the generated audio file if successful,
 *          or null if the input was not audio/video or if an ffprobe error occurred.
 *          Rejects on Ffmpeg extraction error.
 */
export const ensureAudioFormat = async (
    inputPath: string,
    outputDir: string,
    options?: {
        outputFilename?: string;
        audioCodec?: string;
        audioBitrate?: string
    }
): Promise<string | null> => {
    logger.log("utils",`[Ensure Audio] Checking media type for: ${inputPath}`);
    const mediaType = await checkMediaType(inputPath);

    if (mediaType === 'error') {
        logger.error(`[Ensure Audio] Could not determine media type for ${inputPath} due to ffprobe error. Skipping.`);
        return null; // Indicate failure to process due to check error
    }

    if (mediaType === 'video' || mediaType === 'audio') {
        logger.log("utils",`[Ensure Audio] Type detected: ${mediaType}. Proceeding with audio extraction/conversion.`);

        const inputFilename = path.parse(inputPath).name;
        const outputBasename = options?.outputFilename || inputFilename;
        // Ensure the output has a sensible audio extension, default to mp3
        const outputExtension = options?.audioCodec === 'aac' ? '.aac' : '.mp3'; // Example for AAC
        const finalOutputFilename = `${outputBasename}${outputExtension}`;
        const outputPath = path.join(outputDir, finalOutputFilename);

        try {
            // Call extractAudio, passing through codec/bitrate options
            const resultPath = await extractAudio(inputPath, outputPath, {
                audioCodec: options?.audioCodec, // Will use default if undefined
                audioBitrate: options?.audioBitrate // Will use default if undefined
            });
            logger.log("utils",`[Ensure Audio] Successfully processed ${inputPath} to ${resultPath}`);
            return resultPath;
        } catch (extractionError: any) {
            logger.error(`[Ensure Audio] Failed to extract/convert audio for ${inputPath}: ${extractionError.message}`);
            // Re-throw the specific extraction error for the caller to handle if needed
            throw extractionError;
        }
    } else {
        logger.log("utils",`[Ensure Audio] File ${inputPath} is not a processable video or audio file (type: ${mediaType}). Skipping.`);
        return null; // Indicate that no processing was needed/possible
    }
};


// --- EXISTING FUNCTIONS ---

/**
 * Get video metadata using ffprobe
 * (Keep your existing function as is)
 */
export const getVideoMetadata = async (inputPath: string): Promise<Types.VideoMetadata> => {
  // ... (your existing implementation)
   return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));
      if (!data) return reject(new Error('ffprobe returned no data.'));

      const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
      // Allow proceeding if only audio exists, but return defaults or handle appropriately
      // Or, modify this function to specifically only work for videos if that's the intent.
      // For now, let's assume it MUST find a video stream based on original code:
      if (!videoStream && !data.streams?.some((s: any) => s.codec_type === 'audio')) {
          return reject(new Error('No video or audio streams found'));
      }
      // If video stream IS required:
       if (!videoStream) return reject(new Error('No video stream found'));


      const width = videoStream?.width; // Use optional chaining
      const height = videoStream?.height; // Use optional chaining
      const bitrateStr = videoStream?.bit_rate
        ? `${Math.round(Number(videoStream.bit_rate) / 1000)}k`
        : data.format?.bit_rate
          ? `${Math.round(data.format.bit_rate / 1000)}k`
          // Provide a default or handle cases where bitrate isn't crucial/available
          : '0k'; // Or perhaps reject if bitrate is essential

      // Modify dimension check if audio-only files are acceptable inputs here
      // If video stream IS required:
       if (!width || !height) {
         return reject(new Error('Could not determine video dimensions.'));
       }

      resolve({ width: width || 0, height: height || 0, bitrateStr }); // Provide defaults if needed
    });
  });
};

/**
 * Process a specific resolution
 * (Keep your existing function as is)
 */
export const processResolution = (
  inputPath: string,
  outputDir: string,
  resolutionInfo: Types.ResolutionInfo,
  options: Types.HlsOptions,
  videoId: string
): Promise<Types.ResolutionInfo> => {
  // ... (your existing implementation)
  return new Promise(async (resolve, reject) => {
    const { name, size, bitrate, isOriginal } = resolutionInfo;
    const {
      hlsTime, hlsPlaylistType, copyCodecsThresholdHeight,
      audioCodec, audioBitrate, videoCodec, videoProfile, crf, gopSize,
      segmentNameTemplate, resolutionPlaylistName
    } = options;

    const resOutputDir = path.join(outputDir, name);
    const playlistPath = path.join(resOutputDir, resolutionPlaylistName);
    const segmentPath = path.join(resOutputDir, segmentNameTemplate);
    const bandwidth = parseInt(String(bitrate).replace('k', '')) * 1000 || 500000;

    try {
      // Ensure the resolution directory exists
      // const fs = require('fs').promises; // Already imported at top
      try {
        await fs.access(resOutputDir);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          await fs.mkdir(resOutputDir, { recursive: true });
          logger.log("utils",`[HLS ${videoId}] Directory created: ${resOutputDir}`);
        } else {
          throw error; // Re-throw other errors
        }
      }

      let command = ffmpeg(inputPath);
      const outputOptions: string[] = [];

      // Adjust threshold logic if needed based on actual height parsing
      const numericHeight = parseInt(name.split('p')[0]); // Attempt to get numeric height
      const shouldCopyCodecs = isOriginal && !isNaN(numericHeight) && numericHeight <= copyCodecsThresholdHeight;


      if (shouldCopyCodecs) {
        logger.log("utils",`[HLS ${videoId}] Segmenting resolution ${name} by copying streams.`);
        outputOptions.push(
          '-c:v copy',
          '-c:a copy'
        );
      } else {
        logger.log("utils",`[HLS ${videoId}] Re-encoding to ${name}.`);
        // Ensure size is correctly formatted (e.g., -1:720 or 1280:-1)
        const scaleOption = size.includes(':') ? size : `-1:${name.replace('p','')}`; // Basic example, refine if needed
        outputOptions.push(
          `-vf scale=${scaleOption}`, // Use scaleOption
          `-c:a ${audioCodec}`, `-ar 48000`, `-b:a ${audioBitrate}`,
          `-c:v ${videoCodec}`, `-profile:v ${videoProfile}`, `-crf ${crf}`, `-sc_threshold 0`,
          `-g ${gopSize}`, `-keyint_min ${gopSize}`,
          `-b:v ${bitrate}`, // Video bitrate
          `-maxrate ${Math.floor(bandwidth * 1.2 / 1000)}k`, // Maxrate based on bandwidth
          `-bufsize ${Math.floor(bandwidth * 1.5 / 1000)}k`  // Bufsize based on bandwidth
        );
      }

      outputOptions.push(
        `-hls_time ${hlsTime}`,
        `-hls_playlist_type ${hlsPlaylistType}`,
        `-hls_segment_filename ${segmentPath}`,
        '-hls_flags delete_segments+independent_segments', // Useful flags
        `-hls_segment_type fmp4` // Use fmp4 for broader compatibility if desired
      );

      command
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('start', (commandLine) => logger.log("utils",`[HLS ${videoId}] Started processing ${name}: ${commandLine.substring(0, 200)}...`))
        .on('progress', (progress) => {
          // Log progress less frequently
          if (progress.percent && Math.round(progress.percent) % 10 === 0) {
             // Check if the last log was recent to avoid flood
            logger.log("utils",`[HLS ${videoId}] Processing ${name}: ${progress.percent.toFixed(2)}% done`);
          }
        })
        .on('end', () => {
          logger.log("utils",`[HLS ${videoId}] Finished processing ${name}`);
          resolve({
            // Ensure resolved object matches Types.ResolutionInfo structure
            name,
            size, // Original size string might be needed or calculated dimensions
            bitrate, // Bitrate string '5000k'
            bandwidth, // Calculated numeric bandwidth
            playlistRelativePath: `${name}/${resolutionPlaylistName}` // Relative path for master playlist
            // Add other fields from Types.ResolutionInfo if they exist and are needed here
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error(`[HLS ${videoId}] Error processing ${name}:`, err.message);
          logger.error(`[HLS ${videoId}] Ffmpeg stdout:`, stdout);
          logger.error(`[HLS ${videoId}] Ffmpeg stderr:`, stderr);
          reject(new Error(`Error processing ${name}: ${err.message}`));
        })
        .run();
    } catch (error: any) {
        logger.error(`[HLS ${videoId}] General error in processResolution for ${name}: ${error.message}`);
        reject(error);
    }
  });
};
export const generateAudioHls = (
  inputPath: string,
  outputDir: string, // Base output directory (e.g., /path/to/output/season/episode)
  options: Types.HlsOptions & { audioPlaylistName?: string; audioSegmentNameTemplate?: string }, // Extend options type if needed
  audioId: string,
  lang:string = "default"
): Promise<{ playlistPath: string; playlistRelativePath: string }> => {

  return new Promise(async (resolve, reject) => {
      const {
          hlsTime = 10,
          hlsPlaylistType = 'vod',
          audioCodec = 'aac', // Default to AAC for HLS audio
          audioBitrate = '128k', // Default audio bitrate
          audioPlaylistName = 'audio.m3u8', // Default playlist name
          // Default segment name: audio/segment000.aac (or .ts)
          audioSegmentNameTemplate = 'segment%03d.aac'
      } = options;

      const audioHlsDir = path.join(outputDir, 'audio_'+lang); 
      const playlistPath = path.join(audioHlsDir, audioPlaylistName);
      const segmentPath = path.join(audioHlsDir, audioSegmentNameTemplate); // Segments inside 'audio' dir
      const playlistRelativePath ="audio_"+lang+`/${audioPlaylistName}`; // Path relative to outputDir

      try {
          // Ensure the audio HLS directory exists
          await fs.mkdir(audioHlsDir, { recursive: true });
          logger.log("utils",`[AudioHLS ${audioId}] Directory created: ${audioHlsDir}`);

          const command = ffmpeg(inputPath);
          const outputOptions: string[] = [
              '-vn',                      // Ignore video stream
              `-c:a ${audioCodec}`,       // Set audio codec (e.g., aac)
              `-b:a ${audioBitrate}`,     // Set audio bitrate
              // '-ac 2',                 // Optional: Force stereo
              // '-ar 44100',             // Optional: Force sample rate
              `-hls_time ${hlsTime}`,     // Duration of segments
              `-hls_playlist_type ${hlsPlaylistType}`, // Playlist type (vod/event)
              `-hls_segment_filename ${segmentPath}`, // Naming pattern for segments
              '-hls_flags independent_segments', // Recommended for broader compatibility
              // '-hls_segment_type fmp4', // Use fmp4 if needed, requires segment extension change (.m4s)
              // '-hls_list_size 0'      // Keep all segments in VOD playlist (default for VOD)
          ];

          command
              .outputOptions(outputOptions)
              .output(playlistPath)
              .on('start', (commandLine) => logger.log("utils",`[AudioHLS ${audioId}] Started: ${commandLine.substring(0, 200)}...`))
              .on('progress', (progress) => {
                  if (progress.percent && Math.round(progress.percent) % 10 === 0) {
                      logger.log("utils",`[AudioHLS ${audioId}] Progress: ${progress.percent.toFixed(2)}% done`);
                  }
              })
              .on('end', () => {
                  logger.log("utils",`[AudioHLS ${audioId}] Finished successfully.`);
                  resolve({ playlistPath, playlistRelativePath });
              })
              .on('error', (err, stdout, stderr) => {
                  logger.error(`[AudioHLS ${audioId}] Error generating audio HLS:`, err.message);
                  logger.error(`[AudioHLS ${audioId}] Ffmpeg stdout:`, stdout);
                  logger.error(`[AudioHLS ${audioId}] Ffmpeg stderr:`, stderr);
                  reject(new Error(`Error generating audio HLS for ${audioId}: ${err.message}`));
              })
              .run();

      } catch (error: any) {
          logger.error(`[AudioHLS ${audioId}] Setup error before ffmpeg start: ${error.message}`);
          reject(error);
      }
  });
};


