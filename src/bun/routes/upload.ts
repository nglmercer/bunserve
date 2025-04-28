// src/routes/upload.ts
import { join } from 'path';
import { writeFile } from 'fs/promises';
// Asumiendo que hls.ts está en ../utils y exporta como CJS (module.exports)
// Bun generalmente puede manejar la importación de CJS con 'import'
import { convertToHls, VIDEOS_DIR } from '../hlsconvert';
export async function handleUpload(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    console.log('Handling POST /upload request');

    try {
        const formData = await req.formData();
        const file = formData.get('video');
        const videoId = Date.now().toString(); // Identificador único para el video

        // Verifica si el archivo existe y es un archivo válido
        if (!file || !(file instanceof File) || file.size === 0) {
            console.error('Upload failed: No video file provided or file is empty.');
            return new Response('Debe subir un archivo de video válido.', { status: 400 });
        }

        console.log(`Received video file: ${file.name}, Size: ${file.size} bytes`);

        // Asegúrate de que VIDEOS_DIR exista (aunque ya lo haces al inicio del servidor)
        // await ensureDirExists(VIDEOS_DIR); // Opcional si ya está garantizado

        // Guardar video temporalmente
        const tempPath = join(VIDEOS_DIR, `${videoId}_${file.name}`); // Incluye nombre original para debug
        console.log(`Saving temporary video to: ${tempPath}`);
        await writeFile(tempPath, new Uint8Array(await file.arrayBuffer()));
        console.log(`Temporary video saved successfully.`);

        // Convertir a HLS
        console.log(`Starting HLS conversion for videoId: ${videoId}`);
        // Asegúrate que tu función convertToHls devuelva un objeto con 'playlistUrl'
        const result = await convertToHls(tempPath, { videoId });
        console.log(`HLS conversion completed for videoId: ${videoId}`);

        // (Opcional) Limpiar el archivo temporal después de la conversión
        // import { unlink } from 'fs/promises';
        // unlink(tempPath).catch(err => console.error(`Failed to delete temp file ${tempPath}:`, err));

        // Devolver la respuesta JSON con la URL de la playlist maestra
        return new Response(JSON.stringify({
            message: 'Video procesado y listo para streaming.',
            playlistUrl: result.masterPlaylistUrl // Usa la URL devuelta por convertToHls
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200 // OK
        });

    } catch (error: any) {
        console.error('Error processing video upload:', error);
        // Devuelve un error genérico al cliente por seguridad
        return new Response(JSON.stringify({
            message: `Error procesando el video: ${error.message || 'Error desconocido'}`
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500 // Internal Server Error
        });
    }
}