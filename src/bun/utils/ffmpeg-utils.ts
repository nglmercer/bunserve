// src/utils/ffmpeg-utils.ts
import ffmpeg from 'fluent-ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import type * as Types from '../types/index';
import path from 'path';
import fs from 'fs/promises';
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


// Common configuration constants
const CONFIG = {
  DEFAULT_AUDIO: {
    CODEC: 'libmp3lame',
    BITRATE: '192k',
    HLS_CODEC: 'aac'
  },
  DEFAULT_VIDEO: {
    CODEC: 'libx264',
    PROFILE: 'main',
    CRF: 23
  },
  HLS: {
    DEFAULT_TIME: 10,
    DEFAULT_TYPE: 'vod',
    DEFAULT_GOP_SIZE: 60
  }
};

// --- Media Type Utilities ---
export type MediaType = 'video' | 'audio' | 'unknown' | 'error';

export const checkMediaType = (filePath: string): Promise<MediaType> => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        logger.error('Error checking media type',{ path: filePath, error: err.message });
        return resolve('error');
      }
      
      if (!data?.streams?.length) {
        logger.warn('No stream data returned',{ path: filePath });
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

// --- File System Utilities ---
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  try {
    await fs.access(dirPath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
      logger.debug(`Directory created: ${dirPath}`);
    } else {
      throw error;
    }
  }
};

// --- Audio Processing Utilities ---
export const extractAudio = (
  inputPath: string,
  outputPath: string,
  options?: { audioCodec?: string; audioBitrate?: string }
): Promise<string> => {
  const { audioCodec = CONFIG.DEFAULT_AUDIO.CODEC, audioBitrate = CONFIG.DEFAULT_AUDIO.BITRATE } = options || {};

  return new Promise(async (resolve, reject) => {
    if (!inputPath || !outputPath) {
      return reject(new Error("Input and output paths are required"));
    }

    try {
      await ensureDirectoryExists(path.dirname(outputPath));
    } catch (dirError: any) {
      return reject(new Error(`Failed to create output directory: ${dirError.message}`));
    }

    logger.info( 'Starting audio extraction',{ input: inputPath, output: outputPath });

    ffmpeg(inputPath)
      .outputOptions([
        '-vn',
        '-acodec', audioCodec,
        '-ab', audioBitrate,
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        logger.debug( 'FFmpeg command started',{ command: commandLine.substring(0, 250) });
      })
      .on('progress', (progress) => {
        if (progress.percent && Math.round(progress.percent) % 20 === 0) {
          logger.info('Extraction progress',{ file: path.basename(inputPath), progress: progress.percent.toFixed(2) });
        }
      })
      .on('end', () => {
        logger.info( 'Audio extraction finished',{ output: outputPath });
        resolve(outputPath);
      })
      .on('error', (err, stdout, stderr) => {
        logger.error(
         
          'Audio extraction error',
          { error: err.message, file: path.basename(inputPath), stdout, stderr }
        );
        reject(new Error(`Error extracting audio: ${err.message}`));
      })
      .run();
  });
};

export const ensureAudioFormat = async (
  inputPath: string,
  outputDir: string,
  options?: {
    outputFilename?: string;
    audioCodec?: string;
    audioBitrate?: string
  }
): Promise<string | null> => {
  logger.info( 'Checking media type',{ path: inputPath });
  const mediaType = await checkMediaType(inputPath);

  if (mediaType === 'error') {
    logger.error( 'Could not determine media type',{ path: inputPath });
    return null;
  }

  if (mediaType === 'video' || mediaType === 'audio') {
    logger.info( 'Processing media',{ path: inputPath, type: mediaType });

    const inputFilename = path.parse(inputPath).name;
    const outputBasename = options?.outputFilename || inputFilename;
    const outputExtension = options?.audioCodec === 'aac' ? '.aac' : '.mp3';
    const finalOutputFilename = `${outputBasename}${outputExtension}`;
    const outputPath = path.join(outputDir, finalOutputFilename);

    try {
      const resultPath = await extractAudio(inputPath, outputPath, {
        audioCodec: options?.audioCodec,
        audioBitrate: options?.audioBitrate
      });
      logger.info( 'Media processed successfully',{ input: inputPath, output: resultPath });
      return resultPath;
    } catch (extractionError: any) {
      logger.error( 'Failed to extract/convert audio',{ error: extractionError.message, path: inputPath });
      throw extractionError;
    }
  } else {
    logger.info('File is not a processable media',{ path: inputPath, type: mediaType });
    return null;
  }
};

// --- Video Metadata ---
export const getVideoMetadata = async (inputPath: string): Promise<Types.VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));
      if (!data) return reject(new Error('ffprobe returned no data'));

      const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
      
      if (!videoStream && !data.streams?.some((s: any) => s.codec_type === 'audio')) {
        return reject(new Error('No video or audio streams found'));
      }
      
      if (!videoStream) return reject(new Error('No video stream found'));

      const width = videoStream?.width;
      const height = videoStream?.height;
      const bitrateStr = videoStream?.bit_rate
        ? `${Math.round(Number(videoStream.bit_rate) / 1000)}k`
        : data.format?.bit_rate
          ? `${Math.round(data.format.bit_rate / 1000)}k`
          : '0k';

      if (!width || !height) {
        return reject(new Error('Could not determine video dimensions'));
      }

      resolve({ width, height, bitrateStr });
    });
  });
};

// --- HLS Generation Utilities ---
export const processResolution = (
  inputPath: string,
  outputDir: string,
  resolutionInfo: Types.ResolutionInfo,
  options: Types.HlsOptions,
  videoId: string
): Promise<Types.ResolutionInfo> => {
  return new Promise(async (resolve, reject) => {
    const { name, size, bitrate, isOriginal } = resolutionInfo;
    const {
      hlsTime = CONFIG.HLS.DEFAULT_TIME,
      hlsPlaylistType = CONFIG.HLS.DEFAULT_TYPE,
      copyCodecsThresholdHeight,
      audioCodec = CONFIG.DEFAULT_AUDIO.HLS_CODEC,
      audioBitrate = CONFIG.DEFAULT_AUDIO.BITRATE,
      videoCodec = CONFIG.DEFAULT_VIDEO.CODEC,
      videoProfile = CONFIG.DEFAULT_VIDEO.PROFILE,
      crf = CONFIG.DEFAULT_VIDEO.CRF,
      gopSize = CONFIG.HLS.DEFAULT_GOP_SIZE,
      segmentNameTemplate,
      resolutionPlaylistName
    } = options;

    const resOutputDir = path.join(outputDir, name);
    const playlistPath = path.join(resOutputDir, resolutionPlaylistName);
    const segmentPath = path.join(resOutputDir, segmentNameTemplate);
    const bandwidth = parseInt(String(bitrate).replace('k', '')) * 1000 || 500000;

    try {
      await ensureDirectoryExists(resOutputDir);
      logger.info('Resolution directory created',{ dir: resOutputDir, videoId });

      let command = ffmpeg(inputPath);
      const outputOptions: string[] = [];

      const numericHeight = parseInt(name.split('p')[0]);
      const shouldCopyCodecs = isOriginal && !isNaN(numericHeight) && numericHeight <= copyCodecsThresholdHeight;

      if (shouldCopyCodecs) {
        logger.info('Segmenting by copying streams',{ resolution: name, videoId });
        outputOptions.push(
          '-c:v copy',
          '-c:a copy'
        );
      } else {
        logger.info('Re-encoding',{ resolution: name, videoId });
        const scaleOption = size.includes(':') ? size : `-1:${name.replace('p','')}`;
        outputOptions.push(
          `-vf scale=${scaleOption}`,
          `-c:a ${audioCodec}`, `-ar 48000`, `-b:a ${audioBitrate}`,
          `-c:v ${videoCodec}`, `-profile:v ${videoProfile}`, `-crf ${crf}`, `-sc_threshold 0`,
          `-g ${gopSize}`, `-keyint_min ${gopSize}`,
          `-b:v ${bitrate}`,
          `-maxrate ${Math.floor(bandwidth * 1.2 / 1000)}k`,
          `-bufsize ${Math.floor(bandwidth * 1.5 / 1000)}k`
        );
      }

      outputOptions.push(
        `-hls_time ${hlsTime}`,
        `-hls_playlist_type ${hlsPlaylistType}`,
        `-hls_segment_filename ${segmentPath}`,
        '-hls_flags delete_segments+independent_segments',
        `-hls_segment_type fmp4`
      );

      command
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('start', (commandLine) => logger.debug('Started processing',{ resolution: name, videoId, command: commandLine.substring(0, 200) }))
        .on('progress', (progress) => {
          if (progress.percent && Math.round(progress.percent) % 10 === 0) {
            logger.info('Processing progress',{ resolution: name, videoId, progress: progress.percent.toFixed(2) });
          }
        })
        .on('end', () => {
          logger.info('Finished processing',{ resolution: name, videoId });
          resolve({
            name,
            size,
            bitrate,
            bandwidth,
            playlistRelativePath: `${name}/${resolutionPlaylistName}`
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('Error processing resolution',{ 
            resolution: name, 
            videoId, 
            error: err.message, 
            stdout, 
            stderr 
          });
          reject(new Error(`Error processing ${name}: ${err.message}`));
        })
        .run();
    } catch (error: any) {
      logger.error( 'General error in processResolution',{ resolution: name, videoId, error: error.message });
      reject(error);
    }
  });
};

export const generateAudioHls = (
  inputPath: string,
  outputDir: string,
  options: Types.HlsOptions & { audioPlaylistName?: string; audioSegmentNameTemplate?: string },
  audioId: string,
  lang: string = "default"
): Promise<{ playlistPath: string; playlistRelativePath: string }> => {
  return new Promise(async (resolve, reject) => {
    const {
      hlsTime = CONFIG.HLS.DEFAULT_TIME,
      hlsPlaylistType = CONFIG.HLS.DEFAULT_TYPE,
      audioCodec = CONFIG.DEFAULT_AUDIO.HLS_CODEC,
      audioBitrate = CONFIG.DEFAULT_AUDIO.BITRATE,
      audioPlaylistName = 'audio.m3u8',
      audioSegmentNameTemplate = 'segment%03d.aac'
    } = options;

    const audioHlsDir = path.join(outputDir, 'audio_' + lang);
    const playlistPath = path.join(audioHlsDir, audioPlaylistName);
    const segmentPath = path.join(audioHlsDir, audioSegmentNameTemplate);
    const playlistRelativePath = "audio_" + lang + `/${audioPlaylistName}`;

    try {
      await ensureDirectoryExists(audioHlsDir);
      logger.info('Audio HLS directory created',{ dir: audioHlsDir, audioId });

      const command = ffmpeg(inputPath);
      const outputOptions: string[] = [
        '-vn',
        `-c:a ${audioCodec}`,
        `-b:a ${audioBitrate}`,
        `-hls_time ${hlsTime}`,
        `-hls_playlist_type ${hlsPlaylistType}`,
        `-hls_segment_filename ${segmentPath}`,
        '-hls_flags independent_segments'
      ];

      command
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('start', (commandLine) => logger.debug( 'Started audio HLS',{ audioId, command: commandLine.substring(0, 200) }))
        .on('progress', (progress) => {
          if (progress.percent && Math.round(progress.percent) % 10 === 0) {
            logger.info( 'Audio HLS progress',{ audioId, progress: progress.percent.toFixed(2) });
          }
        })
        .on('end', () => {
          logger.info( 'Audio HLS finished successfully',{ audioId });
          resolve({ playlistPath, playlistRelativePath });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error( 'Error generating audio HLS',{ 
            audioId, 
            error: err.message, 
            stdout, 
            stderr 
          });
          reject(new Error(`Error generating audio HLS for ${audioId}: ${err.message}`));
        })
        .run();
    } catch (error: any) {
      logger.error( 'Setup error before ffmpeg start',{ audioId, error: error.message });
      reject(error);
    }
  });
};

// Types moved to a separate types/index.ts file
// Export interface definitions remain the same