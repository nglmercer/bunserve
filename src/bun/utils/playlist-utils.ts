import path from 'path';
import { promises as fs } from 'fs';
import { parse, types, stringify } from 'hls-parser';
import { type ResolutionInfo, type HlsOptions } from '../types';

/**
 * Creates a master M3U8 playlist from the processed resolutions using hls-parser
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
  
  // Create a new master playlist object
  const masterPlaylist = new types.MasterPlaylist({
    version: 3,
    variants: []
  });
  
  // Add each resolution as a variant
  sortedResolutions.forEach(res => {
    const relativePath = `${proxyBaseUrl}${res.playlistRelativePath}`;
    
    // Parse resolution string (e.g., "1280x720") into width and height
    const [width, height] = res.size.split('x').map(num => parseInt(num, 10));
    
    // Create a new variant
    const variant = new types.Variant({
      uri: relativePath,
      bandwidth: res.bandwidth,
      resolution: {
        width,
        height
      }
    });
    
    // Add the variant to the master playlist
    masterPlaylist.variants.push(variant);
  });
  
  // Convert the master playlist object to M3U8 string
  const masterPlaylistContent = stringify(masterPlaylist);
  
  // Write the master playlist file
  const masterPlaylistPath = path.join(outputDir, options.masterPlaylistName);
  await fs.writeFile(masterPlaylistPath, masterPlaylistContent);
  console.log(`[${videoId}] Master playlist created successfully: ${masterPlaylistPath}`);
  
  return {
    masterPlaylistPath,
    masterPlaylistUrl: `${proxyBaseUrl}${options.masterPlaylistName}`
  };
};
export const generatePlaylistUrl = (
  proxyBaseUrl: string,
  playlistName: string
): string => {
  return `${proxyBaseUrl}${playlistName}`;
};