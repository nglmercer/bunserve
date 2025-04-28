// src/utils/ffmpeg-utils.ts
import ffmpeg from 'fluent-ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import type * as Types from '../types/index';
import path from 'path';

// Configure ffmpeg to use the correct ffprobe path
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Get video metadata using ffprobe
 */
export const getVideoMetadata = async (inputPath: string): Promise<Types.VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));
      if (!data) return reject(new Error('ffprobe returned no data.'));
      
      const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));

      const width = videoStream.width;
      const height = videoStream.height;
      const bitrateStr = videoStream.bit_rate
        ? `${Math.round(Number(videoStream.bit_rate) / 1000)}k`
        : data.format?.bit_rate
          ? `${Math.round(data.format.bit_rate / 1000)}k`
          : '5000k';

      if (!width || !height) {
        return reject(new Error('Could not determine video dimensions.'));
      }

      resolve({ width, height, bitrateStr });
    });
  });
};

/**
 * Process a specific resolution
 */
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
      const fs = require('fs').promises;
      try {
        await fs.access(resOutputDir);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          await fs.mkdir(resOutputDir, { recursive: true });
          console.log(`Directory created: ${resOutputDir}`);
        } else {
          throw error;
        }
      }

      let command = ffmpeg(inputPath);
      const outputOptions: string[] = [];

      const shouldCopyCodecs = isOriginal && parseInt(name) <= copyCodecsThresholdHeight;

      if (shouldCopyCodecs) {
        console.log(`[${videoId}] Segmenting resolution ${name} by copying streams.`);
        outputOptions.push(
          '-c:v copy',
          '-c:a copy'
        );
      } else {
        console.log(`[${videoId}] Re-encoding to ${name}.`);
        outputOptions.push(
          `-vf scale=${size}`,
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
        `-hls_segment_filename ${segmentPath}`
      );

      command
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('start', (commandLine) => console.log(`[${videoId}] Started processing ${name}: ${commandLine.substring(0, 200)}...`))
        .on('progress', (progress) => {
          if (progress.percent && Math.round(progress.percent) % 10 === 0) {
            console.log(`[${videoId}] Processing ${name}: ${progress.percent.toFixed(2)}% done`);
          }
        })
        .on('end', () => {
          console.log(`[${videoId}] Finished processing ${name}`);
          resolve({
            name,
            size,
            bitrate,
            bandwidth,
            playlistRelativePath: `${name}/${resolutionPlaylistName}`
          });
        })
        .on('error', (err) => {
          console.error(`[${videoId}] Error processing ${name}:`, err.message);
          reject(new Error(`Error processing ${name}: ${err.message}`));
        })
        .run();
    } catch (error) {
      reject(error);
    }
  });
};