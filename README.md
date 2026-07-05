# Escuela — Instrucciones de despliegue y configuración de Firebase

Esta rama introduce una reorganización: extrae la lógica JavaScript a `app.js`, carga condicional de `firebase-config.js` (local) y añade autenticación (Email/Password, Anónimo y Google Sign-In) para proteger las escrituras en Firestore.

Pasos para configurar Firebase y habilitar guardado en la nube

1. Crear proyecto en Firebase
   - Ve a https://console.firebase.google.com/ y crea un proyecto nuevo (o usa uno existente).

2. Configurar Firestore
   - En el panel del proyecto, ve a Firestore Database y crea una base de datos (modo de prueba para desarrollo).

3. Habilitar Authentication
   - En Firebase Console → Authentication → Sign-in method:
     - Habilita Email/Password.
     - Habilita Google si quieres permitir inicio con Google.
     - (Opcional) Habilita Anonymous para pruebas rápidas.

4. Obtener firebaseConfig
   - En Configuración del proyecto → Tus apps → Añadir app (web) si aún no tienes una.
   - Copia la configuración (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

5. Aplicar la configuración localmente (recomendado)

   Opción A (recomendada para no subir credenciales):
   - Copia `firebase-config.example.js` a `firebase-config.js` en la raíz del repositorio:

       cp firebase-config.example.js firebase-config.js

   - Abre `firebase-config.js` y reemplaza los valores con los de tu proyecto Firebase.
   - `firebase-config.js` está incluido en `.gitignore` para evitar subidas accidentales.

   Opción B (alternativa menos segura):
   - Edita `index.html` y reemplaza manualmente el objeto `firebaseConfig`.

6. Reglas de seguridad sugeridas (Firestore)

   - Para desarrollo rápido puedes usar reglas abiertas (NO recomendado en producción):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

   - Recomendado (mínimo) para producción: permitir escritura solo a usuarios autenticados y lectura pública o autenticada según necesidad. Ejemplo mínimo:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /estudiantes/{docId} {
         allow read: if true; // o `if request.auth != null;` según tu política
         allow write: if request.auth != null;
       }
     }
   }
   ```

7. Despliegue de GitHub Pages
   - Sirve la carpeta localmente para pruebas: `python -m http.server 8000` o `npx serve .`.
   - Para publicar en GitHub Pages, sube tus cambios (excepto `firebase-config.js`) y espera unos minutos. La URL será: `https://<tu-usuario>.github.io/escuela/`.

Pruebas rápidas

- Abrir la página y usar el botón "Iniciar sesión" en el header para crear una cuenta (Email/Password), entrar con Google o iniciar sesión anónima.
- Crear/editar/eliminar estudiantes.
- Simular offline (DevTools → Offline), crear un estudiante; al reconectar la app intentará sincronizar la cola de pendientes automáticamente.

Notas de seguridad

- NUNCA subas `firebase-config.js` si contiene credenciales de un proyecto en producción. Usa proyectos de desarrollo para pruebas.
- Revisa las reglas de Firestore antes de usar en producción para evitar accesos no deseados.

Si quieres, puedo:
- Abrir el Pull Request con estos cambios ahora (incluye app.js y README actualizado).
- Añadir tests o validación adicional en el formulario (por ejemplo, validación del teléfono, email obligatorio, etc.).

