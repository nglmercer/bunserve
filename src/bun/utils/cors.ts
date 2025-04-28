// src/utils/cors.ts

// Headers comunes para respuestas CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // O un origen específico: 'http://tufrontend.com'
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Disposition', // Añade 'Content-Disposition' si lo usas
  };
  
  // Manejador para peticiones OPTIONS (preflight)
  export function handleCorsPreflight(req: Request): Response | null {
    if (req.method === 'OPTIONS') {
      console.log('Handling OPTIONS request');
      return new Response(null, { headers: corsHeaders });
    }
    return null; // No es una petición OPTIONS, deja que siga el flujo
  }
  
  // Función para añadir headers CORS a una respuesta existente
  export function addCorsHeaders(response: Response): Response {
      // Clona los headers existentes para no modificarlos directamente si ya existen
      const newHeaders = new Headers(response.headers);
      // Añade o sobrescribe los headers CORS
      Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
      });
      // Retorna una nueva respuesta con los headers actualizados
      // y el mismo body, status, etc.
      return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
      });
  }