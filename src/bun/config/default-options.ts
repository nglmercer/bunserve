// src/config/default-options.ts
import { type HlsOptions } from '../types/index';

/**
 * Default options for HLS conversion
 */
export const defaultHlsOptions: HlsOptions = {
  resolutions: [],
  hlsTime: 10,
  hlsPlaylistType: 'vod',
  copyCodecsThresholdHeight: 720,
  audioCodec: 'aac',
  audioBitrate: '128k',
  videoCodec: 'h264',
  videoProfile: 'main',
  crf: 20,
  gopSize: 48,
  proxyBaseUrlTemplate: '{basePath}{videoId}/',
  masterPlaylistName: 'master.m3u8',
  segmentNameTemplate: 'segment%03d.ts',
  resolutionPlaylistName: 'playlist.m3u8'
};