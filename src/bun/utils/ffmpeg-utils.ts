// src/utils/ffmpeg-utils.ts
import ffmpeg from 'fluent-ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import type * as Types from '../types/index'; // Assuming your types are here
import path from 'path';
import fs from 'fs/promises'; // Using promises version of fs

// Configure ffmpeg to use the correct ffprobe path
ffmpeg.setFfprobePath(ffprobePath);

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
          console.error(`ffprobe error checking type for ${filePath}: ${err.message}`);
          // Resolve with 'error' instead of rejecting to simplify control flow later
          return resolve('error');
      }
      if (!data || !data.streams || data.streams.length === 0) {
          console.warn(`ffprobe returned no stream data for ${filePath}.`);
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

        console.log(`[Audio Extraction] Starting extraction from ${inputPath} to ${outputPath}`);

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
                console.log(`[Audio Extraction] Spawned Ffmpeg with command: ${commandLine.substring(0, 250)}...`);
            })
            .on('progress', (progress) => {
                // Avoid excessive logging, maybe log every 10% or based on time
                if (progress.percent && Math.round(progress.percent) % 20 === 0) {
                    console.log(`[Audio Extraction] Progress (${path.basename(inputPath)}): ${progress.percent.toFixed(2)}%`);
                } else if (progress.timemark) {
                   // console.log(`[Audio Extraction] Processing timemark: ${progress.timemark}`);
                }
            })
            .on('end', () => {
                console.log(`[Audio Extraction] Finished successfully: ${outputPath}`);
                resolve(outputPath); // Resolve with the output path
            })
            .on('error', (err, stdout, stderr) => {
                console.error(`[Audio Extraction] Error processing ${inputPath}:`, err.message);
                console.error('[Audio Extraction] Ffmpeg stdout:', stdout);
                console.error('[Audio Extraction] Ffmpeg stderr:', stderr);
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
    console.log(`[Ensure Audio] Checking media type for: ${inputPath}`);
    const mediaType = await checkMediaType(inputPath);

    if (mediaType === 'error') {
        console.error(`[Ensure Audio] Could not determine media type for ${inputPath} due to ffprobe error. Skipping.`);
        return null; // Indicate failure to process due to check error
    }

    if (mediaType === 'video' || mediaType === 'audio') {
        console.log(`[Ensure Audio] Type detected: ${mediaType}. Proceeding with audio extraction/conversion.`);

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
            console.log(`[Ensure Audio] Successfully processed ${inputPath} to ${resultPath}`);
            return resultPath;
        } catch (extractionError: any) {
            console.error(`[Ensure Audio] Failed to extract/convert audio for ${inputPath}: ${extractionError.message}`);
            // Re-throw the specific extraction error for the caller to handle if needed
            throw extractionError;
        }
    } else {
        console.log(`[Ensure Audio] File ${inputPath} is not a processable video or audio file (type: ${mediaType}). Skipping.`);
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
): Promise<Types.ResolutionInfo & { playlistRelativePath: string; bandwidth: number }> => { // Ensure return type includes needed fields
  return new Promise(async (resolve, reject) => {
    const { name, size, bitrate, isOriginal } = resolutionInfo;
    const {
      hlsTime, hlsPlaylistType, copyCodecsThresholdHeight,
      audioCodec, audioBitrate, videoCodec, videoProfile, crf, gopSize,
      segmentNameTemplate, resolutionPlaylistName
    } = options;

    // Ensure segmentNameTemplate ends with .ts if using mpegts
    // If your template doesn't include the extension, FFmpeg might add it,
    // but being explicit can be better. Example: 'segment%03d.ts'
    const correctedSegmentNameTemplate = segmentNameTemplate.includes('.')
       ? segmentNameTemplate // Assume template includes extension
       : `${segmentNameTemplate}.ts`; // Add .ts if missing

    const resOutputDir = path.join(outputDir, name);
    const playlistPath = path.join(resOutputDir, resolutionPlaylistName);
    // Use the corrected template for the segment path
    const segmentPath = path.join(resOutputDir, correctedSegmentNameTemplate);
    // Ensure bandwidth calculation handles potential non-numeric bitrate string safely
    const numericBitrate = parseInt(String(bitrate).replace(/\D/g, ''), 10); // Remove non-digits
    const bandwidth = numericBitrate ? numericBitrate * 1000 : 500000; // Default if parsing fails

    try {
      // Ensure the resolution directory exists
      try {
        await fs.access(resOutputDir);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          await fs.mkdir(resOutputDir, { recursive: true });
          console.log(`[HLS ${videoId}] Directory created: ${resOutputDir}`);
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
        console.log(`[HLS ${videoId}] Segmenting resolution ${name} by copying streams.`);
        outputOptions.push(
          '-c:v copy',
          '-c:a copy'
        );
      } else {
        console.log(`[HLS ${videoId}] Re-encoding to ${name}.`);
        // Ensure size is correctly formatted (e.g., -1:720 or 1280:-1)
        // Refined scaleOption logic
        let scaleOption = '-2:720'; // Default fallback or adjust as needed
        if (size && size.includes(':')) {
            scaleOption = size; // Use provided size if it has ':'
        } else if (!isNaN(numericHeight)) {
            scaleOption = `-2:${numericHeight}`; // Use parsed height, let FFmpeg calculate width (-2)
        } else {
            console.warn(`[HLS ${videoId}] Could not determine valid scale for ${name}. Using default ${scaleOption}.`);
        }

        outputOptions.push(
          `-vf scale=${scaleOption}`,
          `-c:a ${audioCodec}`, `-ar 48000`, `-b:a ${audioBitrate}`,
          `-c:v ${videoCodec}`, `-profile:v ${videoProfile}`, `-crf ${crf}`, `-sc_threshold 0`,
          `-g ${gopSize}`, `-keyint_min ${gopSize}`,
          `-b:v ${bitrate}`, // Video bitrate (e.g., '5000k')
          `-maxrate ${Math.floor(bandwidth * 1.2 / 1000)}k`, // Maxrate based on bandwidth
          `-bufsize ${Math.floor(bandwidth * 1.5 / 1000)}k`  // Bufsize based on bandwidth
        );
      }

      // --- CRITICAL CHANGE HERE ---
      outputOptions.push(
        `-hls_time ${hlsTime}`,
        `-hls_playlist_type ${hlsPlaylistType}`,
        `-hls_segment_filename ${segmentPath}`, // Use the path with the corrected template
        '-hls_flags delete_segments+independent_segments',
        // Use mpegts instead of fmp4 to avoid init.mp4 and EXT-X-MAP
        `-hls_segment_type mpegts`
      );
      // --- END OF CHANGE ---


      command
        .outputOptions(outputOptions)
        .output(playlistPath)
        .on('start', (commandLine) => console.log(`[HLS ${videoId}] Started processing ${name}: ${commandLine.substring(0, 200)}...`))
        .on('progress', (progress) => {
          // Consider a less frequent logging strategy if needed
           if (progress.percent && Math.round(progress.percent) % 10 === 0) {
             // Basic throttle: only log every 10%
             // You could add a timestamp check for finer control
             console.log(`[HLS ${videoId}] Processing ${name}: ${progress.percent.toFixed(2)}% done`);
           }
        })
        .on('end', () => {
          console.log(`[HLS ${videoId}] Finished processing ${name}`);
          // Ensure the resolved object structure matches the Promise<...> type hint
          resolve({
            name,
            size, // Original size string
            bitrate, // Original bitrate string '5000k'
            isOriginal, // Pass through isOriginal status
            // Include the necessary fields for the master playlist
            playlistRelativePath: path.join(name, resolutionPlaylistName), // Relative path
            bandwidth: bandwidth // Numeric bandwidth value
          });
        })
        .on('error', (err, stdout, stderr) => {
          console.error(`[HLS ${videoId}] Error processing ${name}:`, err.message);
          // Log full stderr for debugging if it's not excessively long
          console.error(`[HLS ${videoId}] Ffmpeg stderr:`, stderr || 'Not available');
          reject(new Error(`Error processing ${name}: ${err.message}\nStderr: ${stderr}`));
        })
        .run();
    } catch (error: any) {
        console.error(`[HLS ${videoId}] General error in processResolution for ${name}: ${error.message}`);
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
          console.log(`[AudioHLS ${audioId}] Directory created: ${audioHlsDir}`);

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
              .on('start', (commandLine) => console.log(`[AudioHLS ${audioId}] Started: ${commandLine.substring(0, 200)}...`))
              .on('progress', (progress) => {
                  if (progress.percent && Math.round(progress.percent) % 10 === 0) {
                      console.log(`[AudioHLS ${audioId}] Progress: ${progress.percent.toFixed(2)}% done`);
                  }
              })
              .on('end', () => {
                  console.log(`[AudioHLS ${audioId}] Finished successfully.`);
                  resolve({ playlistPath, playlistRelativePath });
              })
              .on('error', (err, stdout, stderr) => {
                  console.error(`[AudioHLS ${audioId}] Error generating audio HLS:`, err.message);
                  console.error(`[AudioHLS ${audioId}] Ffmpeg stdout:`, stdout);
                  console.error(`[AudioHLS ${audioId}] Ffmpeg stderr:`, stderr);
                  reject(new Error(`Error generating audio HLS for ${audioId}: ${err.message}`));
              })
              .run();

      } catch (error: any) {
          console.error(`[AudioHLS ${audioId}] Setup error before ffmpeg start: ${error.message}`);
          reject(error);
      }
  });
};


