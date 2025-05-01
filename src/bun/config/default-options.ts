// src/config/default-options.ts
import { type HlsOptions } from '../types/index';

const BaseUrl = 'http://localhost:4000/stream-resource/';

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
  proxyBaseUrlTemplate: BaseUrl + '{basePath}{videoId}/',
  masterPlaylistName: 'master.m3u8',
  segmentNameTemplate: 'segment%03d.ts',
  resolutionPlaylistName: 'playlist.m3u8'
};