# Vigía Perú

Observatorio de eventos, seguimiento editorial y análisis de imágenes. Requiere Node.js >=24.5; `npm ci` instala las dependencias fijadas en el lockfile.

## Ejecutar

Desde `/workspace/0011`: `npm ci` y `npm start` (puerto 3000; configurable con `PORT`). Ejecutar pruebas con `npm test`. Salud del servidor: `GET /api/health`.

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


## Mesa de noticias y consulta directa (v0.4)

### Actualización de noticias

`GET /api/dashboard?region=Tumbes` consulta feeds de noticias para la región y el país, y ENFEN, SENAMHI y ANA. La caché de noticias dura 5 minutos por región; consultas simultáneas se agrupan para evitar duplicar tráfico. Las fuentes oficiales tienen caché de 10 minutos; sus limitaciones de extracción siguen visibles. `refresh=1` permite renovar noticias con al menos 60 segundos desde la última consulta. Los errores conservan, cuando existe, la última consulta exitosa y noticias anteriores todavía dentro de 24 horas. Una consulta fallida no cambia su fecha de éxito.

La interfaz consulta cada cinco minutos mientras está visible y al cambiar de región. Usa la dirección del servidor ya configurada; en GitHub Pages el valor por defecto es `https://vigia-peru.onrender.com`. Si no responde, identifica claramente el archivo estático de GitHub como respaldo y muestra su fecha original. El respaldo no se considera actualización en directo. No se garantiza tiempo real: Google News puede indexar tarde, las fuentes pueden fallar y Render Free puede suspender el servicio o tardar en arrancar. Para cobertura continua con latencia controlada hace falta una instancia siempre activa y, si corresponde, feeds con condiciones de disponibilidad acordadas. No se cambiaron planes ni se contrataron servicios de pago.

### Selección y mapa

«Añadir a mesa» guarda una copia local de la publicación. La nueva sección permite seleccionar/deseleccionar, filtrar regiones, editar los textos y contadores, añadir enlaces, notas o capturas. La extracción automática de enlaces admite una lista de portales públicos; otros enlaces pueden guardarse junto a texto o captura. Cada redirección se valida; no se consultan destinos privados ni sitios fuera de esa lista. La extracción es parcial y no supera muros de pago ni requiere accesos privados.

Las capturas se guardan como archivos en IndexedDB de este navegador. La transcripción con Gemini requiere consentimiento y usa la conexión del servidor configurada en «Análisis de imágenes»; el resultado queda editable para revisión antes de guardarse. La mesa y el análisis se guardan en localStorage; no hay sincronización multiusuario ni entre equipos. El JSON exportado incluye textos, selección, métricas y análisis, pero no imágenes originales.

El mapa usa Leaflet y teselas públicas de OpenStreetMap. Los puntos se sitúan en capitales regionales como referencias de agrupación: no son coordenadas verificadas de incidentes. Una noticia puede mencionar más de una región. Sin ubicación, se cuenta como no localizada y no se inventa un marcador. Se debe respetar la política de teselas de OpenStreetMap; no se precargan ni descargan masivamente teselas para uso offline. El semáforo del mapa es de discurso, no peligro físico.

### Semáforo y métricas

`POST /api/news/analyze` procesa entre 1 y 30 insumos seleccionados con Gemini, con límites de tamaño. Rojo significa reclamo, confrontación o atribución de responsabilidad; amarillo controversia o información por verificar; verde información técnica documentada. El servidor valida que cada cita exista en el título o texto aportado y que su id esté entre los seleccionados. Sin citas válidas, la fila queda sin evidencia. Una fila verde sin insumo oficial o documento técnico marcado como revisado pasa a amarillo. Esto no verifica automáticamente el artículo ni sus afirmaciones. Cambiar o editar la selección invalida el análisis anterior.

Se calculan publicaciones seleccionadas, fuentes, regiones y volumen de publicaciones por hora en una ventana de 24 h (hora Perú). Estas son métricas de la muestra, no del universo de medios. Reacciones, comentarios, compartidos y vistas proceden por ahora de contadores **manuales**, con fecha de registro y cobertura de datos por métrica; vacío y cero son distintos. No representan audiencia única ni interacciones nuevas de las últimas 24 horas. Se pueden editar y se conserva un historial de registros previos por publicación. No hay conexión automática a APIs de Facebook, X, TikTok, Instagram ni YouTube: requiere definir cuentas, permisos, cuotas y credenciales autorizadas de cada plataforma. No se simulan datos de redes.

Los endpoints de importación, transcripción y análisis exigen `VIGIA_ACCESS_TOKEN`, conservan el control de origen y comparten los límites de concurrencia y consultas de IA. El endpoint público de noticias solo admite regiones del catálogo y destinos fijos; no recibe URLs arbitrarias.

### Dependencias y despliegue

`render.yaml` configura `npm ci` como comando de build. Se incluyen los bundles oficiales de Leaflet 1.9.4 y fast-xml-parser 5.12.0 con sus licencias para que el servicio existente también arranque si Render aún conserva el antiguo comando `node --check server.js`. No se editan los bundles de terceros. Para actualizarlos, reproducir `npm ci` y copiar los archivos de distribución del paquete verificado, conservando versiones y licencias. El lockfile fija las integridades de npm.

GitHub Actions instala dependencias, ejecuta pruebas y publica la interfaz. El horario anterior de GitHub permanece como respaldo estático; la consulta en directo ya no depende de su ejecución. Tras desplegar Render, comprobar `/api/health` con versión `0.4.0`, `/api/dashboard?region=Tumbes`, `/desk.js` y `/vendor/leaflet.js`. La consulta a fuentes y el análisis real con la credencial de producción deben validarse allí: la red de este entorno cloud todavía bloquea varios destinos externos. Las pruebas automáticas usan feeds y respuestas de IA de prueba, no noticias inventadas publicadas como reales.
