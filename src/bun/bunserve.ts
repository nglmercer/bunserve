// src/index.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static'
import { mkdir } from 'fs/promises';
import { handleUpload } from './routes/upload'; // Importa el manejador de upload
import { getStream,getStreamPlaylist } from './routes/streamhtl'; // Importa el manejador de streaming
import { VIDEOS_DIR } from './hlsconvert'; // Importa para acceder a VIDEOS_DIR

const PORT = 4000;
console.log('Starting Elysia server...');

// Crear la instancia de Elysia
const app = new Elysia()
  // Añadir el plugin de CORS (reemplaza la funcionalidad de handleCorsPreflight y addCorsHeaders)
  .use(cors({
    origin: '*', // Puedes ajustar esto según tus necesidades de seguridad
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  
  // Middleware de logging
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    console.log(`[${request.method}] ${url.pathname}`);
  })
  
  // Ruta para subir archivos
  .post('/upload', async ({ request }) => {
    try {
      return await handleUpload(request);
    } catch (error) {
      console.error("Error handling upload:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .post('/update/:audio', async ({ request, params }) => {
    try {
    //  return await handleUpload(request, params.audio);
    } catch (error) {
      console.error("Error handling upload:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  // Ruta para streaming con parámetro dinámico
  .get('/stream-resource/:season/:episode', async ({ request, params }) => {
    try {
      return await getStream(request, params);
    } catch (error) {
      console.error("Error handling stream:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  .get('/stream-resource/:season/:episode/:quality/:file', async ({ request, params }) => {
    try {
      return await getStreamPlaylist(request, params);
    } catch (error) {
      console.error("Error handling stream:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  })
  // Manejo de errores global
  .onError(({ error }) => {
    console.error("Server error:", error);
    return new Response("¡Ups! Algo salió mal en el servidor.", { status: 500 });
  })
  .use(staticPlugin())
  // Fallback para rutas no encontradas
  .all('*', () => new Response("Ruta no encontrada.", { status: 404 }))
  
  // Iniciar el servidor
  .listen(PORT);

// Es importante que VIDEOS_DIR sea la ruta correcta desde la raíz del proyecto
console.log(`Ensuring directory exists: ${VIDEOS_DIR}`);
mkdir(VIDEOS_DIR, { recursive: true })
  .then(() => {
    console.log(`Directory ${VIDEOS_DIR} ensured.`);
    console.log(`Servidor Elysia escuchando en http://localhost:${PORT}`);
  })
  .catch(err => {
    console.error(`Error creating directory ${VIDEOS_DIR}:`, err);
    // Considera si el servidor debe detenerse si no puede crear el directorio
    // process.exit(1);
  });

// Exporta la app si necesitas importarla en otro lugar (e.g., para tests)
export default app;