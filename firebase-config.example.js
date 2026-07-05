// firebase-config.example.js
// Copia este archivo a 'firebase-config.js' en la raíz del repositorio y reemplaza los valores
// con la configuración de tu proyecto Firebase (Console → Configuración del proyecto → Tus apps).

// NOTA: Nunca subas 'firebase-config.js' al repositorio público. Este repositorio contiene
// .gitignore que excluye firebase-config.js por seguridad.

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// Exporta la configuración para que index.html pueda importarla si se añade un <script type="module">.
// Si prefieres seguir usando la inserción directa en index.html, copia manualmente los valores allí.

if (typeof module !== 'undefined' && module.exports) {
  module.exports = firebaseConfig;
}
