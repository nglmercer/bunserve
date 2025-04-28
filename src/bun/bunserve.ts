// src/index.ts
import { mkdir } from 'fs/promises';
import { handleUpload } from './routes/upload'; // Importa el manejador de upload
import { handleCorsPreflight, addCorsHeaders } from './utils/cors'; // Importa utilidades CORS
import { VIDEOS_DIR } from './hlsconvert'; // Importa para acceder a VIDEOS_DIR
//import {db,dbPath } from './utils/ibd'; // Importa la instancia de la base de datos

const PORT = 4000;

console.log('Starting Bun server...');

const server = Bun.serve({
    port: PORT,
    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url);
        console.log(`[${req.method}] ${url.pathname}`); // Log de peticiones

        // 1. Manejar CORS Preflight (OPTIONS)
        const corsResponse = handleCorsPreflight(req);
        if (corsResponse) {
            return corsResponse;
        }

        let response: Response;

        // 2. Enrutamiento principal
        try {
            switch (url.pathname) {
                case '/upload':
                    response = await handleUpload(req); // Delega al manejador de upload
                    break;

                // case '/stream-resource/': // Ruta ignorada por ahora
                //   // Aquí iría la lógica para servir archivos HLS si la implementaras
                //   console.log('Stream resource requested (currently ignored)');
                //   response = new Response("Streaming endpoint not implemented yet.", { status: 501 });
                //   break;

                default:
                    response = new Response("Ruta no encontrada.", { status: 404 });
            }
        } catch (error) {
            console.error("Unhandled error in fetch handler:", error);
            response = new Response("Internal Server Error", { status: 500 });
        }


        // 3. Añadir headers CORS a TODAS las respuestas (excepto OPTIONS que ya los tiene)
        return addCorsHeaders(response);
    },
    error(error: Error): Response {
        console.error("Server error:", error);
        // Puedes personalizar esta respuesta de error
        return addCorsHeaders(new Response("¡Ups! Algo salió mal en el servidor.", { status: 500 }));
    }
});

// Crear directorios necesarios al iniciar (solo una vez)
// Es importante que VIDEOS_DIR sea la ruta correcta desde la raíz del proyecto
console.log(`Ensuring directory exists: ${VIDEOS_DIR}`);
mkdir(VIDEOS_DIR, { recursive: true })
    .then(() => {
        console.log(`Directory ${VIDEOS_DIR} ensured.`);
        console.log(`Servidor Bun escuchando en http://localhost:${server.port}`);
    })
    .catch(err => {
        console.error(`Error creating directory ${VIDEOS_DIR}:`, err);
        // Considera si el servidor debe detenerse si no puede crear el directorio
        // process.exit(1);
    });
// Exporta el servidor si necesitas importarlo en otro lugar (e.g., para tests)
export default server;