# Vigía Perú

Primera versión de un observatorio de eventos hidrometeorológicos, sin dependencias externas. Requiere Node.js 22 o superior.

## Ejecutar

Desde `/workspace/0011`: `npm start` (puerto 3000; configurable con `PORT`). Ejecutar pruebas con `npm test`. Salud del servidor: `GET /api/health`.

## Alcance actual

- Panel adaptable, registro estructurado, búsqueda, copia de fichas y exportación JSON.
- Persistencia local del navegador. No hay cuentas, almacenamiento compartido ni respaldo automático. Exportar para conservar los reportes; borrar datos del navegador los elimina.
- Ejemplo de Tumbes identificado como ejemplo, sin fecha ni verificación inventadas. No se incluye como reporte real.
- Carga de JPG, PNG y WebP de hasta 15 MB, vista previa y coordenadas manuales con enlace a OpenStreetMap. Las imágenes no se suben al servidor ni se guardan. No hay extracción EXIF, análisis visual ni geolocalización automática en esta versión.
- Enlaces a ENFEN y SENAMHI. Sin ingestión automática ni comunicados simulados. Los intentos de consulta de ambos portales desde el entorno devolvieron 403 del proxy; no se pudo inspeccionar su estructura ni validar una integración.
- ANA: enlaces al ONRH (`https://snirh.ana.gob.pe/onrh/`) y al reporte de ríos (`https://snirh.ana.gob.pe/onrh/Reportes.aspx?R=PRIOS`). Consulta externa, sin extracción automática ni autenticación integrada. El seguimiento de descolmatación queda pendiente.

## Pendientes de integración

Permitir en la red `enfen.imarpe.gob.pe` y `observatorio.senamhi.gob.pe`, revisar sus mecanismos públicos y condiciones, y validar un conector antes de anunciar sincronización. Para imágenes, integrar un servicio de análisis con credenciales del servidor y consentimiento para enviar imágenes; conservar evidencia, procedencia y nivel de confianza. No inferir población afectada contando personas visibles.

No es un sistema oficial de alertas. Las fichas distinguen cifras reportadas y estimadas; todos los registros quedan pendientes de contraste oficial. La ubicación de una imagen no se confirma con coordenadas ingresadas manualmente.


## Dashboard automático (v0.2)

El dashboard filtra por las 25 regiones y por fuente. Las noticias proceden de búsquedas temáticas en Google News RSS (26 consultas), se deduplican por URL y se filtran por fecha de publicación en una ventana móvil de 24 horas. Una mención de región no confirma que el evento haya ocurrido allí. Se puede excluir contenido sin región identificada.

`python scripts/collect.py` recopila las fuentes sin dependencias externas y escribe `data/dashboard.json`. `node scripts/build.mjs` genera el sitio estático en `dist/`. GitHub Actions ejecuta ambos pasos en cada publicación y cada hora (minuto 17); GitHub puede retrasar u omitir ejecuciones programadas. El botón de recarga descarga el último archivo publicado, no dispara una nueva recopilación.

SENAMHI se consulta mediante la API pública `https://servicios.senamhi.gob.pe/api/hydrology/warnings`, identificada en los módulos del portal; el esquema se valida antes de usarlo. La conectividad real está pendiente por los bloqueos del entorno. ENFEN y ANA utilizan por ahora extracción de enlaces documentales desde HTML; los paneles interactivos de ANA aún requieren un conector específico. Los documentos oficiales extraíbles se muestran separados de las noticias. Sin fecha verificada no se consideran publicaciones de las últimas 24 horas. Los errores, accesos limitados y hora de consulta se muestran por fuente. El extractor HTML no sustituye conectores para paneles interactivos de SENAMHI/ANA ni extrae caudales, niveles de riesgo o afectados de capturas. No se simulan datos. Las noticias vencidas desaparecen de la vista incluso si no se ha publicado una actualización.

Pruebas del recopilador: `python -m unittest discover -s test -p 'test_*.py'`. Los tests usan fixtures sintéticos identificados dentro del código de prueba; nunca se publican como noticias.


## Análisis de imágenes y mapa (v0.3)

La sección de imágenes usa una conversación junto a un mapa integrado. Se adjunta la imagen, se escribe una pregunta y se autoriza su envío. El servidor consulta Gemini y propone hasta tres hipótesis con pistas visuales; las coincidencias de nombres se buscan en Nominatim/OpenStreetMap. No se solicitan coordenadas manuales y nunca se presentan las hipótesis como ubicaciones verificadas. No hay búsqueda web ni extracción EXIF en este flujo; el modelo no confirma por sí solo el lugar, la fecha, un desbordamiento ni la población afectada.

**Estado de validación:** interfaz, contrato del proveedor y controles probados con respuestas simuladas de prueba. No se realizó una consulta real de visión porque no hay credencial de Gemini configurada. Sin servicio activado la interfaz lo muestra y no inventa respuestas.

### Activar el análisis para la web publicada

GitHub Pages continúa alojando la interfaz y el dashboard horario. El análisis necesita el servidor Node incluido en este repositorio; la credencial nunca debe incluirse en archivos de Pages, variables del workflow público ni el JavaScript.

1. Crear una credencial en Google AI Studio, con Gemini habilitado y cuota disponible. No compartirla por chat ni en Git.
2. En el panel de Render, elegir **New → Blueprint**, conectar `GabrielCuba23/0011` y usar `render.yaml`. Revisar el plan y los costes/cuotas vigentes antes de crear el servicio.
3. Introducir `GEMINI_API_KEY` en el campo seguro de Render. `VIGIA_ACCESS_TOKEN` se genera en Render para limitar quién puede usar el análisis. `ALLOWED_ORIGIN` permite `https://gabrielcuba23.github.io`. El modelo predeterminado es `gemini-2.5-flash`; puede cambiarse mediante `GEMINI_MODEL` por un modelo disponible que admita imagen y salida JSON estructurada.
4. Al terminar, comprobar `GET /api/capabilities` en la dirección real del servicio: `imageAnalysis` debe ser `true`.
5. En Vigía → Análisis de imágenes → **Conectar servicio de análisis**, ingresar la dirección HTTPS de Render y la clave `VIGIA_ACCESS_TOKEN` obtenida en su panel seguro. No ingresar la clave de Gemini en la web. Comprobar conexión y analizar una imagen con consentimiento.

La dirección se recuerda en el navegador; la clave de acceso solo se conserva en memoria de la página. Las imágenes y preguntas se envían a Gemini y se mantienen en memoria del servidor durante la consulta; no se guardan en el repositorio ni se registran en logs por la aplicación. Aplican las políticas y retención del proveedor. Los nombres propuestos se envían a Nominatim; el mapa embebido carga desde OpenStreetMap. El backend permite hasta 30 solicitudes de análisis por hora y dos consultas simultáneas por proceso; se puede ajustar `ANALYSIS_HOURLY_LIMIT`. El contador se reinicia al reiniciar el proceso. Nominatim se consulta de forma secuencial, como máximo una consulta cada 1,1 s por proceso, con caché de coincidencias por 24 h; usar una sola instancia o un geocodificador propio para escalar. No activar varias réplicas contra el servicio público de Nominatim. Los errores de IA no se convierten en resultados ficticios; si no hay coincidencia cartográfica, no se coloca un marcador.

Para pruebas locales con valores propios: copiar `.env.example` a `.env`, completar los valores fuera de Git y ejecutar `node --env-file=.env server.js` con Node >=24.5. En el entorno cloud, conservar el proxy y la verificación TLS; `NODE_USE_ENV_PROXY=1` habilita el proxy heredado en fetch de Node. `GEOCODER_CONTACT` puede identificar el contacto operativo en el User-Agent de Nominatim. La activación en Render y un análisis real de una foto siguen pendientes de una cuenta y credencial del usuario.
