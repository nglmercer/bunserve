// src/types/index.ts

export interface ResolutionInfo {
    name: string;
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
}

export interface VideoMetadata {
    width: number;
    height: number;
    bitrateStr: string;
}

export interface TaskMetadata {
    videoId: string;
    originalWidth: number;
    originalHeight: number;
    bitrate: string;
    resolutions: string[];
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';