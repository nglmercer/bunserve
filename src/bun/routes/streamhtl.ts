import { join, resolve } from 'path';
import { db } from '../data/ibd';
import { convertToHls, PROCESSED_DIR } from '../hlsconvert';
import { validateFields } from '../utils/verify';

export async function getStream(req: Request, params: any, body: unknown): Promise<Response> {
  const data = {
    req: req,
    body: body,
    params: params,
  }
  const { season, episode } = params;
  const FilePath = join(PROCESSED_DIR, season.toString(), episode.toString());
  const existPath = resolve(FilePath);
  console.log(existPath);
  console.log(FilePath);
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
}