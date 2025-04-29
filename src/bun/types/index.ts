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
    result: Object | null;
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

export type TaskStatus = 'pending' | 'processing' | 'in_progress' | 'completed' | 'failed';
export interface Task {
    id: string;
    status: TaskStatus;
    createdAt: Date;
    updatedAt: Date;
    data: Record<string, any>;
  }
export interface episodes {
    id: number | null;
    name: string | null;
    message: string | null;
    outputDir: string | null;
    masterPlaylistPath: string | null;
    masterPlaylistUrl: string | null;
    CreatedAt: string;
}