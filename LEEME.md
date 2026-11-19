# Biblioteca ESM — procedimientos y accidentabilidad — acceso seguro

## Qué contiene

- `index.html`: página pública de procedimientos, versiones y PDF (QR 1).
- `accidentabilidad.html`: página pública de Accidentabilidad, TOP 4 y Aprendizajes (QR 2).
- `admin.html`: panel de administración con **correo y contraseña**, protegido por Cloudflare Workers.
- `codigos-qr.html`: generación de dos QR desde la URL publicada.
- `cloudflare-worker/worker.js`: servidor seguro que valida el acceso y actualiza el repositorio GitHub mediante su API.
- `cloudflare-worker/wrangler.toml`: configuración inicial **sin secretos**.

**No hay ninguna contraseña de administrador ni token de GitHub dentro del ZIP.** No funcionan sin configurarlos privadamente en Cloudflare. El correo predeterminado es `ronal.vargas@esm.cl`.

## Paso 1 — GitHub Pages (bibliotecas públicas)

1. Crea o abre el repositorio público `Biblioteca-ESM` bajo `Sombrha7` (si te quedaste con otro nombre, se podrá ajustar).
2. Sube el contenido del ZIP a la raíz, incluyendo `index.html`, `accidentabilidad.html`, `admin.html`, los scripts y las carpetas `data` y `pdfs`.
3. Confirma que existen en GitHub `data/catalogo.json` y `data/accidentabilidad.json`.
4. En GitHub: `Settings → Pages → Deploy from a branch → main → /(root) → Save`.
5. Dirección esperada si mantuviste ese nombre: `https://sombrha7.github.io/Biblioteca-ESM/`.
6. Las dos páginas y sus QR son públicos sin registro para los trabajadores.

## Paso 2 — Cloudflare Workers (autenticación sin Supabase)

1. Crea o entra a una cuenta en [Cloudflare](https://dash.cloudflare.com/).
2. En `Workers & Pages`, crea un Worker llamado `biblioteca-esm-admin` usando la opción de editor web (Hello World), reemplaza el código con **todo el contenido** de `cloudflare-worker/worker.js` y pulsa **Deploy**.
3. En el Worker entra a `Settings → Variables and Secrets`. Agrega estas cinco **Variables** de tipo texto (ajusta el nombre del repositorio si en GitHub es otro):

   | Variable | Valor |
   | --- | --- |
   | `ADMIN_EMAIL` | `ronal.vargas@esm.cl` |
   | `REPO_OWNER` | `Sombrha7` |
   | `REPO_NAME` | `Biblioteca-ESM` |
   | `REPO_BRANCH` | `main` |
   | `SITE_ORIGIN` | `https://sombrha7.github.io` (sin barra final ni subcarpeta) |

4. Agrega estas tres **Secrets**, no Variables de texto y **nunca** archivos del repositorio:
   - `ADMIN_PASSWORD`: ingresa la contraseña privada del administrador. Por seguridad, elige una diferente de cualquiera que hayas compartido en un chat.
   - `SESSION_SECRET`: cadena aleatoria larga (idealmente 32+ caracteres) generada en un gestor de contraseñas.
   - `GITHUB_TOKEN`: token personal de GitHub de permisos específicos, limitado **solo a este repositorio**, con **Contents: Read and write**. En GitHub: `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`.

5. Guarda/implementa los cambios. Copia la URL pública de tu Worker, por ejemplo `https://biblioteca-esm-admin.<cuenta>.workers.dev`.

Si usas Wrangler en lugar del editor web: ajusta `cloudflare-worker/wrangler.toml`, ejecuta `npx wrangler deploy` dentro de esa carpeta y añade secretos con `npx wrangler secret put ADMIN_PASSWORD`, `npx wrangler secret put SESSION_SECRET`, `npx wrangler secret put GITHUB_TOKEN` (comandos separados; ingresarlos de forma privada).

## Paso 3 — Inicia sesión como administrador

1. Abre `https://sombrha7.github.io/Biblioteca-ESM/admin.html` (ajusta por tu URL real de Pages).
2. Escribe correo, contraseña y URL de Cloudflare Worker. La URL del Worker se recuerda **solo en este navegador**; **la contraseña y el token de sesión NO se almacenan en localStorage**.
3. Pulsa **Ingresar al administrador**. Aparecen dos pestañas: Procedimientos y Accidentabilidad/TOP 4.
4. Administra PDF, título, versión, categorías y fichas preventivas con fecha, lugar, qué pasó, qué reforzar.
5. Cierra sesión al terminar. La sesión caduca automáticamente a los 90 minutos.

## Paso 4 — QR

Abre `https://sombrha7.github.io/Biblioteca-ESM/codigos-qr.html` y descarga los QR separados. La herramienta necesita conexión al CDN de QR. Los QR siguen válidos si actualizas documentos sin cambiar la URL.

## Seguridad y limitaciones

- **Nunca se debe guardar la contraseña en código HTML/JavaScript público.** El Worker compara credenciales en el servidor y retiene los secretos dentro de Cloudflare.
- El servidor limita las escrituras a los dos JSON de la biblioteca y a PDF de tipo UUID; el token de GitHub permanece únicamente en Cloudflare.
- Solo se permite usar el panel desde el origen web autorizado. Para despliegue productivo se recomienda adicionalmente una regla de **rate limiting para `/login`** y autenticación multifactor, así como una contraseña fuerte. La autenticación de contraseña única no ofrece la misma protección que MFA.
- El repositorio GitHub es **público**. Los PDF y relatos publicados pueden estar accesibles directamente, y sus versiones anteriores pueden seguir en el historial incluso después de despublicar. **No publiques procedimientos internos restringidos, datos personales ni información confidencial.**
- Los totales anuales reflejan fichas publicadas, NO reemplazan indicadores oficiales de accidentabilidad ni constituyen tasas.
- La plataforma pública de lectura no usa Cloudflare Workers para mostrar información. La disponibilidad del panel de administración dependerá de Cloudflare y GitHub. No requiere actividad periódica para evitar pausas de Supabase.
- Para mejorar confiabilidad, comprime los PDF. El panel admite hasta 15 MB, pero las subidas grandes podrían necesitar ajustes según límites de Cloudflare Workers y GitHub.
- El uso del sitio no acredita lectura ni toma de conocimiento de procedimientos.
- El Worker es código provisto para **configuración y pruebas por el propietario**. No ha sido desplegado ni probado contra tu cuenta de GitHub/Cloudflare.
