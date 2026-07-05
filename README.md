# Escuela — Instrucciones de despliegue y configuración de Firebase

Este repositorio incluye una aplicación estática (index.html) que usa Firebase Firestore para
almacenar y sincronizar registros de estudiantes. Para proteger las credenciales, se proporciona
una plantilla de configuración que debes completar localmente.

Pasos para configurar Firebase y habilitar guardado en la nube

1. Crear proyecto en Firebase
   - Ve a https://console.firebase.google.com/ y crea un proyecto nuevo (o usa uno existente).

2. Configurar Firestore
   - En el panel del proyecto, ve a Firestore Database y crea una base de datos (modo de prueba para desarrollo).

3. Obtener firebaseConfig
   - En Configuración del proyecto → Tus apps → Añadir app (web) si aún no tienes una.
   - Copia la configuración (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

4. Aplicar la configuración localmente (dos opciones):

  Opción A (recomendada para no subir credenciales):
  - Copia `firebase-config.example.js` a `firebase-config.js` en la raíz del repositorio:

      cp firebase-config.example.js firebase-config.js

  - Abre `firebase-config.js` y reemplaza los valores con los de tu proyecto Firebase.
  - `firebase-config.js` está incluido en `.gitignore` para evitar subidas accidentales.

  Opción B (alternativa):
  - Edita `index.html` y reemplaza el objeto `firebaseConfig` (líneas cerca de 340) con tus valores.
  - Esta opción es menos segura si el repositorio es público.

5. Reglas de seguridad (temporal para desarrollo)

  Para pruebas rápidas puedes usar reglas abiertas (NO recomendado en producción):

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

  - En producción debes restringir el acceso: por ejemplo permitir solo usuarios autenticados o validar datos.

6. Despliegue de GitHub Pages
  - GitHub Pages ya está habilitado para este repositorio (según la configuración del repo).
  - Si editas `index.html` (o añades firebase-config.js localmente), sube los cambios y espera unos minutos
    para que GitHub Pages publique la nueva versión en: `https://<tu-usuario>.github.io/escuela/`

Comprobaciones posteriores
  - Abre la página y revisa la consola del navegador (DevTools) para ver "Firebase inicializado correctamente".
  - Crea/edita/elimina un estudiante y verifica que aparecen documentos en la colección `estudiantes` de Firestore.

Si quieres, puedo:
- Añadir un pequeño script en index.html para detectar y cargar `firebase-config.js` de forma segura si existe.
- Crear un Pull Request con esos cambios en vez de un commit directo.

