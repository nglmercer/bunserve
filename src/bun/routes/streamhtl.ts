import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { db } from '../data/ibd';
import { PROCESSED_DIR } from '../hlsconvert';
import { validateFields, templateError } from '../utils/verify';

export async function getStream(req: Request, params: any): Promise<Response> {
  const { season, episode } = params;
 
  // Build path to the HLS directory and master playlist
  const dirPath = join(PROCESSED_DIR, season.toString(), episode.toString());
  const masterPath = join(dirPath, 'master.m3u8');
 
  // Check if directory and master playlist exist
  if (!existsSync(dirPath) || !existsSync(masterPath)) {
    return new Response(templateError(false, 'Video not found', req), {
      status: 404,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // Return the master playlist file
  const filedata = readFileSync(masterPath, 'utf8');
  return new Response(filedata, {
    headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
    status: 200
  });
}

export async function getStreamPlaylist(req: Request, params: any): Promise<Response> {
  const { season, episode, quality, file } = params;
  
  // Build path to the HLS directory and file
  const dirPath = join(PROCESSED_DIR, season.toString(), episode.toString(), quality.toString());
  const filePath = join(dirPath, file);
  
  // Check if directory and file exist
  if (!existsSync(dirPath) || !existsSync(filePath)) {
    return new Response(templateError(false, 'Video not found', dirPath), {
      status: 404,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // Read file data
  const filedata = readFileSync(filePath);
  
  // Determine the correct content type based on file extension
  const contentType = file.endsWith('.m3u8') 
    ? 'application/vnd.apple.mpegurl' 
    : file.endsWith('.ts') 
      ? 'video/mp2t' 
      : 'application/octet-stream';
  
  return new Response(new Uint8Array(filedata), {
    headers: { 'Content-Type': contentType },
    status: 200
  });
}