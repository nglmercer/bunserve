import Hls from 'hls.js';
import videojs from 'video.js';
let player = null;
const baseUrl = "http://localhost:4000/stream-resource/";

// Función para inicializar el reproductor Video.js
function initializePlayer() {
  // Verificar si ya existe un reproductor y destruirlo
  if (player) {
    player.dispose();
  }

  // Inicializar el reproductor con opciones
  player = videojs('my-player', {
    controls: true,
    autoplay: true,
    preload: 'auto',
    fluid: true,
    html5: {
      vhs: {
        overrideNative: true
      },
      nativeAudioTracks: false,
      nativeVideoTracks: false,
      hls: {
        enableLowInitialPlaylist: true,
        smoothQualityChange: true,
        overrideNative: true
      }
    }
  });

  // Manejar errores
  player.on('error', function() {
    console.error('Error del reproductor:', player.error());
  });

  // Cargar la fuente inicial
 loadSource(baseUrl + "1/1"); 
//loadSource("https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8")
}

// Función para cargar una nueva fuente
function loadSource(url) {
  if (player) {
    player.src({
      src: url,
      type: 'application/x-mpegURL' // Tipo MIME para archivos HLS
    });
    
    // Intenta reproducir después de cargar la fuente
    player.ready(function() {
      player.play().catch(err => {
        console.error("Error al reproducir:", err);
      });
    });
  }
}
initializePlayer();