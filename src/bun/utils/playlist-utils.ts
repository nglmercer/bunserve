// src/utils/playlist-utils.ts
import path from 'path';
import { promises as fs } from 'fs';
import { type ResolutionInfo, type HlsOptions } from '../types';

/**
 * Creates a master M3U8 playlist from the processed resolutions
 */
export const createMasterPlaylist = async (
  outputDir: string, 
  successfulResolutions: ResolutionInfo[], 
  options: HlsOptions,
  videoId: string,
  basePath: string = ''
): Promise<{ masterPlaylistPath: string; masterPlaylistUrl: string }> => {
  // Ensure basePath ends with a trailing slash if provided
  const newBasePath = basePath ? (basePath.endsWith('/') ? basePath : `${basePath}/`) : '';
  
  // Generate the proxy base URL
  const proxyBaseUrl = options.proxyBaseUrlTemplate
    .replace('{videoId}', videoId)
    .replace('{basePath}', newBasePath);
  
  // Sort resolutions by bandwidth
  const sortedResolutions = [...successfulResolutions].sort((a, b) => 
    (a.bandwidth || 0) - (b.bandwidth || 0)
  );
  
  // Create the master playlist content
  let masterPlaylistContent = '#EXTM3U\n#EXT-X-VERSION:3\n';
  
  sortedResolutions.forEach(res => {
    const relativePath = `${proxyBaseUrl}${res.playlistRelativePath}\n`;
    masterPlaylistContent += `#EXT-X-STREAM-INF:BANDWIDTH=${res.bandwidth},RESOLUTION=${res.size}\n`;
    masterPlaylistContent += relativePath;
  });
  
  // Write the master playlist file
  const masterPlaylistPath = path.join(outputDir, options.masterPlaylistName);
  await fs.writeFile(masterPlaylistPath, masterPlaylistContent);
  console.log(`[${videoId}] Master playlist created successfully: ${masterPlaylistPath}`);
  
  return {
    masterPlaylistPath,
    masterPlaylistUrl: `${proxyBaseUrl}${options.masterPlaylistName}`
  };
};

/**
 * Generates full playlist URLs
 */
export const generatePlaylistUrl = (
  proxyBaseUrl: string,
  playlistName: string
): string => {
  return `${proxyBaseUrl}${playlistName}`;
};