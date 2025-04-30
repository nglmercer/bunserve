import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { db } from '../data/ibd';
import { convertToHls, VIDEOS_DIR } from '../hlsconvert';
import { validateFields } from '../utils/verify';

export interface UploadData {
    episode: number;
    title: string;
    description: string;
    image: string;
    duration: number;
    catalog_id: number;
    season_id: number;
}

const formDataVerify: UploadData = {
    episode: 0,
    title: '',
    description: '',
    image: '',
    duration: 0,
    catalog_id: 0,
    season_id: 0
};
type FormDataParserOptions = {
    numberKeys?: string[];
    stringKeys?: string[];
    booleanKeys?: string[];
    ignoreKeys?: string[];
    [key: string]: any; // permite extender fácilmente
  };
  
  function parseFormData<T extends Record<string, any>>(
    formData: FormData,
    options: FormDataParserOptions = {}
  ): T {
    const { numberKeys = [], stringKeys = [], booleanKeys = [], ignoreKeys = [] } = options;
    const result = {} as T;
    
    for (const [key, value] of formData.entries()) {
      if (ignoreKeys.includes(key)) continue;
      if (value instanceof File) continue;
      
      if (numberKeys.includes(key)) {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          result[key as keyof T] = numValue as unknown as T[keyof T];
        }
      } else if (booleanKeys.includes(key)) {
        let boolValue: boolean;
        if (value === 'true' || value === '1') {
          boolValue = true;
        } else if (value === 'false' || value === '0') {
          boolValue = false;
        } else {
          boolValue = Boolean(value);
        }
        result[key as keyof T] = boolValue as unknown as T[keyof T];
      } else if (stringKeys.includes(key) || typeof value === 'string') {
        result[key as keyof T] = String(value) as unknown as T[keyof T];
      } else {
        result[key as keyof T] = value as unknown as T[keyof T];
      }
    }
    
    return result;
  }

  export async function handleUpload(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const formData = await req.formData();

        // Extraer el video
        const file = formData.get('video');
        if (!file || !(file instanceof File) || file.size === 0) {
            console.error('Upload failed: No video file provided or file is empty.');
            return new Response('Debe subir un archivo de video válido.', { status: 400 });
        }

        // Parsear datos del formulario
        const formDataObj = parseFormData<UploadData>(formData, {
            numberKeys: ['episode', 'duration', 'catalog_id', 'season_id'],
            stringKeys: ['title', 'description', 'image']
        });        

        console.log(`Received video file: ${file.name}, Size: ${file.size} bytes`);
        console.log('Parsed form data:', formDataObj);

        // Validación de campos requeridos
        const options = {
            validators: {
                season_id: (value: any) => value > 0,
                episode: (value: any) => value > 0
            }
        };

        const validation = validateFields({
            required: formDataVerify,
            actualObj: formDataObj,
            options
        });

        if (!validation || !validation.isValid) {
            return new Response(JSON.stringify({
                message: 'Algunos campos son inválidos.',
                errors: validation?.errors ?? {}
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }

        // Preparar directorio temporal
        const videoDir = join(VIDEOS_DIR, formDataObj.season_id.toString());
        await mkdir(videoDir, { recursive: true });

        const tempPath = join(videoDir, `${formDataObj.episode}_${file.name}`);
        console.log(`Saving temporary video to: ${tempPath}`);
        await writeFile(tempPath, new Uint8Array(await file.arrayBuffer()));
        console.log(`Temporary video saved successfully.`);

        // Iniciar conversión a HLS
        const result = await convertToHls(tempPath, formDataObj);

        if (result) {
            console.log('Inserting video to database...',formDataObj);
            db.insert('episodes', formDataObj);
        }

        return new Response(JSON.stringify({
            message: 'Video procesado y listo para streaming.',
            playlistUrl: result?.masterPlaylistUrl || '',
            result
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error('Error processing video upload:', error);
        return new Response(JSON.stringify({
            message: `Error procesando el video: ${error.message || 'Error desconocido'}`
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
}