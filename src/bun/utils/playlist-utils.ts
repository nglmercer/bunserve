import path from 'path';
import { promises as fs } from 'fs';
import { parse, types, stringify } from 'hls-parser';
import { type ResolutionInfo, type HlsOptions } from '../types';
import { defaultHlsOptions } from '../config/default-options';

// --- Constantes para Agrupar Pistas ---
const AUDIO_GROUP_ID = 'aac-audio';
const SUBTITLE_GROUP_ID = 'subs';

// --- Tipos para Información de Pistas ---
interface MediaTrackInfo {
  lang: string;
  name: string;
  relativePath: string;
  isDefault?: boolean;
  autoselect?: boolean;
}

interface AudioTrackInfo extends MediaTrackInfo {}
interface SubtitleTrackInfo extends MediaTrackInfo {
  isForced?: boolean;
}
const BaseUrl = 'http://localhost:4000/stream-resource/';

export const generatePlaylistUrl = (
  proxyBaseUrl: string = BaseUrl, // Using BaseUrl as default
  playlistName: string
): string => {
  // Handle null or undefined values
  if (!proxyBaseUrl) proxyBaseUrl = BaseUrl;
  
  // Format proxyBaseUrl to ensure it ends with a slash if not empty
  const formattedProxyBaseUrl = proxyBaseUrl 
    ? (proxyBaseUrl.endsWith('/') ? proxyBaseUrl : `${proxyBaseUrl}/`) 
    : '';
  
  return `${formattedProxyBaseUrl}${playlistName}`;
};

export const generateProxyBaseUrl = (
  videoId: string,
  basePath: string = BaseUrl, // Using BaseUrl as default
  proxyBaseUrlTemplate: string = defaultHlsOptions.proxyBaseUrlTemplate
): string => {
  // Handle null or undefined values
  if (!videoId) videoId = '';
  if (!basePath) basePath = BaseUrl;
  
  // Format basePath to ensure it ends with a slash if not empty
  const formattedBasePath = basePath 
    ? (basePath.endsWith('/') ? basePath : `${basePath}/`) 
    : '';
  
  // Apply template replacements
  let url = proxyBaseUrlTemplate;
  
  // Replace all occurrences of videoId first (in case it's used multiple times)
  url = url.replace(/\{videoId\}/g, videoId);
  
  // Replace basePath placeholder
  url = url.replace(/\{basePath\}/g, formattedBasePath);
  
  // Clean up any double slashes that might have been created (except after protocol)
  url = url.replace(/([^:])\/+/g, '$1/');
  
  // Preserve protocol double slashes if present
  url = url.replace(/^([a-zA-Z]+):\/([^/])/, '$1://$2');
  
  return url;
};
export const createMasterPlaylist = async (
  outputDir: string, 
  successfulResolutions: ResolutionInfo[], 
  options: HlsOptions,
  videoId: string,
  basePath: string = ''
): Promise<{ masterPlaylistPath: string; masterPlaylistUrl: string }> => {
  // Ensure basePath ends with a trailing slash if provided
  const newBasePath = generateProxyBaseUrl(videoId, basePath);
  
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

export const addMediaToMasterPlaylist = async (
  masterPlaylistPath: string,
  videoId: string,
  audioTracks: AudioTrackInfo[] = [],
  subtitleTracks: SubtitleTrackInfo[] = []
): Promise<void> => {
  try {
    const contentPath = masterPlaylistPath.endsWith('master.m3u8')
      ? masterPlaylistPath
      : path.join(masterPlaylistPath, 'master.m3u8');
    const content = await fs.readFile(contentPath, 'utf-8');
    const playlist = parse(content);

    if (!(playlist instanceof types.MasterPlaylist)) {
      throw new Error('El archivo no es un Master Playlist válido.');
    }
    const proxyBaseUrl = generateProxyBaseUrl(videoId);
    // Limpiar media existente (opcional)
    playlist.variants.forEach(v => {
      v.audio = [];
      v.subtitles = [];
    });

    // Agregar pistas de audio
    audioTracks.forEach(track => {
      const audioRendition = new types.Rendition({
        type: 'AUDIO',
        groupId: AUDIO_GROUP_ID,
        language: track.lang,
        name: track.name,
        isDefault: track.isDefault ?? false,
        autoselect: track.autoselect ?? true,
        forced: false,
        uri: `${proxyBaseUrl}${track.relativePath}`
      });
      
      playlist.variants.forEach(v => {
        v.audio.push(audioRendition as types.Rendition & { type: "AUDIO" });
      });
    });

    // Agregar pistas de subtítulos
    subtitleTracks.forEach(track => {
      const subtitleRendition = new types.Rendition({
        type: 'SUBTITLES',
        groupId: SUBTITLE_GROUP_ID,
        language: track.lang,
        name: track.name,
        isDefault: track.isDefault ?? false,
        autoselect: track.autoselect ?? true,
        forced: track.isForced ?? false,
        uri: `${proxyBaseUrl}${track.relativePath}`
      });
      
      playlist.variants.forEach(v => {
        v.subtitles.push(subtitleRendition as types.Rendition & { type: "SUBTITLES" });
      });
    });

    // Actualizar codecs para incluir audio si es necesario
    playlist.variants.forEach(variant => {
      if (audioTracks.length > 0) {
        const defaultAudio = audioTracks.find(t => t.isDefault);
        if (defaultAudio && variant.codecs && !variant.codecs.includes('mp4a')) {
          variant.codecs += ',mp4a.40.2';
        }
      }
    });

    // Guardar cambios
    await fs.writeFile(contentPath, stringify(playlist));
    console.log(`Master playlist actualizado con ${audioTracks.length} audios y ${subtitleTracks.length} subtítulos.`);
  } catch (error) {
    console.error('Error al añadir media al master playlist:', error);
    throw error;
  }
};