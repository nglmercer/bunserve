// src/types/index.ts

export interface ResolutionInfo {
    name: string | any;
    season_id?: number | string;
    episode?: number | string;
    size: string;
    bitrate: string;
    isOriginal?: boolean;
    bandwidth?: number;
    playlistRelativePath?: string;
}

export interface HlsOptions {
    resolutions: ResolutionInfo[];
    hlsTime: number;
    hlsPlaylistType: string;
    copyCodecsThresholdHeight: number;
    audioCodec: string;
    audioBitrate: string;
    videoCodec: string;
    videoProfile: string;
    crf: number;
    gopSize: number;
    proxyBaseUrlTemplate: string;
    masterPlaylistName: string;
    segmentNameTemplate: string;
    resolutionPlaylistName: string;
}

export interface ConversionOptions {
    videoId: string;
    basePath?: string;
}

export interface ConversionResult {
    message: string;
    outputDir: string;
    masterPlaylistPath: string;
    masterPlaylistUrl: string;
    result: Object | null;
}

export interface VideoMetadata {
    width: number;
    height: number;
    bitrateStr: string;
}
export interface AudioExtractionOptions {
    audioCodec?: string;    // e.g., 'libmp3lame', 'aac'
    audioBitrate?: string;  // e.g., '192k', '128k'
    outputFilename?: string;// Base name without extension
}