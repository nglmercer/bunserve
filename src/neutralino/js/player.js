import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
const video = document.getElementById('videoPlayer');
const player = new Plyr(video);

let hlsInstance = null;

// Función para cargar un nuevo archivo M3U8
function loadHlsSource(url) {
  // Destruir instancia anterior si existe
  if (hlsInstance) {
    hlsInstance.destroy();
  }

  // Crear nueva instancia de Hls.js
  if (Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(err => console.error("Error al reproducir:", err));
    });
  } else {
    console.error("Hls.js no es compatible en este navegador.");
  }
}

// Función para cambiar la fuente
window.changeSource = function(newUrl) {
  loadHlsSource(newUrl);
}
const baseUrl = "http://localhost:4000/stream-resource/";
// Cargar fuente inicial
loadHlsSource(baseUrl + "1/1");