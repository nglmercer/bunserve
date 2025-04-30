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
/*
const taskData: {
    videoId: string;
    season_id: number;
    episode: number;
    originalWidth: number;
    originalHeight: number;
    bitrate: string;
    resolutions: {
        name: string;
        season_id: number;
        episode: number;
        size: string;
        bitrate: string;
        isOriginal: boolean;
    }[];
}*/
export interface TaskMetadata {
    videoId?: string;
    outputDir?: string;
    season_id: number | string;
    episode: number | string;
    originalWidth: number;
    originalHeight: number;
    bitrate: string;
    resolutions: ResolutionInfo[];
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
export interface UploadData {
    episode: number;
    title: string;
    description: string;
    image: string;
    duration: number;
    catalog_id: number;
    season_id: number;
}
