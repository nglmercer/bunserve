import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { db } from '../data/ibd';
import { convertToHls, VIDEOS_DIR } from '../hlsconvert';
import { validateFields } from '../utils/verify';

interface UploadData {
    number: number;
    title: string;
    description: string;
    image: string;
    duration: number;
    season: number;
}

const formDataVerify: UploadData = {
    number: 0,
    title: '',
    description: '',
    image: '',
    duration: 0,
    season: 0
};

function getALLFORMDATA(formData: FormData): Record<string, string | File> {
    const data: Record<string, string | File> = {};
    for (const [key, value] of formData.entries()) {
        data[key] = value as string | File;
    }
    return data;
}

export async function handleUpload(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    console.log('Handling POST /upload request');

    try {
        const formData = await req.formData();
        const file = formData.get('video');
        const formDataObj = getALLFORMDATA(formData as FormData);
        const videoId = `${formDataObj.season}/${formDataObj.number}`;

        if (!file || !(file instanceof File) || file.size === 0) {
            console.error('Upload failed: No video file provided or file is empty.');
            return new Response('Debe subir un archivo de video válido.', { status: 400 });
        }

        console.log(`Received video file: ${file.name}, Size: ${file.size} bytes`);
        const options = {
            validators: {
                season: (value: any) => value > 0,
                number: (value: any) => value > 0
            }
        };
        const IsValid = validateFields({
            required: formDataObj,
            actualObj: formDataVerify,
            options
        });

        if (!IsValid || !IsValid.isValid) {
           return new Response(JSON.stringify({
                message: 'Debe subir un archivo de video válido.',
                errors: IsValid.errors
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }
        
        const videoDir = join(VIDEOS_DIR, formDataObj.season.toString());
        await mkdir(videoDir, { recursive: true });
        
        const tempPath = join(videoDir, `${formDataObj.number}_${file.name}`);
        console.log(`Saving temporary video to: ${tempPath}`);
        await writeFile(tempPath, new Uint8Array(await file.arrayBuffer()));
        console.log(`Temporary video saved successfully.`);
        
        console.log(`Starting HLS conversion for videoId: ${videoId}`, formDataObj);
        const result = await convertToHls(tempPath, { videoId });

        if (result) {
            db.insert('episodes', formDataObj);
        }
        
        return new Response(JSON.stringify({
            message: 'Video procesado y listo para streaming.',
            playlistUrl: "" + result.masterPlaylistUrl + "",
            result: result
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