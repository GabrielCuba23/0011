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

La dirección se recuerda en el navegador; desde v0.4.1 se puede recordar la clave del observatorio en localStorage, vinculada al servidor y después de validar el acceso. «Olvidar acceso» elimina esa credencial sin borrar noticias ni capturas. La credencial de Gemini sigue exclusivamente en el servidor. Las imágenes y preguntas se envían a Gemini y se mantienen en memoria del servidor durante la consulta; no se guardan en el repositorio ni se registran en logs por la aplicación. Aplican las políticas y retención del proveedor. Los nombres propuestos se envían a Nominatim; el mapa embebido carga desde OpenStreetMap. El backend permite hasta 30 solicitudes de análisis por hora y dos consultas simultáneas por proceso; se puede ajustar `ANALYSIS_HOURLY_LIMIT`. El contador se reinicia al reiniciar el proceso. Nominatim se consulta de forma secuencial, como máximo una consulta cada 1,1 s por proceso, con caché de coincidencias por 24 h; usar una sola instancia o un geocodificador propio para escalar. No activar varias réplicas contra el servicio público de Nominatim. Los errores de IA no se convierten en resultados ficticios; si no hay coincidencia cartográfica, no se coloca un marcador.

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


## Acceso recordado (v0.4.1)

«Recordar acceso en este navegador personal» conserva VIGIA_ACCESS_TOKEN en localStorage después de que `GET /api/auth/check` confirme la autorización. Se restaura únicamente para el mismo origen del servidor y se valida de nuevo al recargar. No se guarda GEMINI_API_KEY. Se puede desmarcar la opción para no persistir o usar «Olvidar acceso» sin borrar la mesa. La clave del observatorio queda accesible al perfil de navegador que se usa; no activar esta opción en equipos compartidos. Cambiar de servidor limpia el campo en memoria para no enviar la credencial a otro origen por accidente.

Comprobar conexión detecta versiones antiguas del backend y valida el token real; que haya variables configuradas ya no basta para mostrar acceso validado. El mensaje solo confirma acceso al servidor, no disponibilidad ni cuota de Gemini. La comprobación inicial admite hasta 90 segundos para arranques de Render Free. Las rutas de autenticación no hacen llamadas a Gemini ni consumen la cuota de análisis.


## Generación y diagnóstico de Gemini (v0.4.2)

El conector compartido `lib/gemini.js` se usa para imágenes, transcripción, análisis editorial y pruebas. Normaliza espacios, comillas exteriores y el prefijo `models/` de GEMINI_MODEL. Las llamadas siguen usando HTTPS verificado, el encabezado x-goog-api-key y la API oficial v1beta; nunca se coloca la credencial en URLs ni respuestas.

No se interpreta cualquier 404 como un modelo ausente. Un 404 genérico se informa como PROVIDER_ENDPOINT_NOT_FOUND. Solo un 404 que identifica el modelo como ausente puede consultar la lista real de la cuenta y reintentar una vez con otro Flash estable que admita generateContent; no se eligen modelos Pro, de audio, de imagen generativa ni previews. No hay reintentos ante claves inválidas, permisos, cuota, formato incorrecto o rutas desconocidas. Se utiliza un único plazo máximo de 90 segundos para listado y generación; una elección exitosa se recuerda hasta 6 horas en memoria del proceso, por credencial y modelo configurado, usando una clave hash no expuesta. Esto evita repetir una selección fallida en cada consulta. No garantiza que toda imagen o esquema se complete correctamente.

«Diagnosticar IA» consulta el catálogo y muestra el modelo configurado. «Probar generación real» llama a POST /api/diagnostics/generate con una solicitud JSON mínima sin imagen ni noticias del usuario; está protegida por el acceso del observatorio y consume una pequeña consulta dentro del límite de IA. Solo devuelve GENERATION_OK cuando Google genera el JSON esperado. La prueba no certifica la ubicación de una foto ni la disponibilidad de toda la funcionalidad visual. No se hizo una prueba con la credencial de producción desde este entorno; su resultado debe comprobarse en Render. Las pruebas unitarias usan respuestas simuladas y verifican el límite de reintentos y la ausencia de filtraciones de credenciales.


## Indisponibilidad 503 (v0.4.3)

Una respuesta 503 de generación admite ahora un único reintento del mismo modelo con una espera mínima de un segundo. Si sigue fallando, se puede probar una alternativa Flash estable que esté en la lista de la cuenta; nunca Pro ni previews. Hay como máximo tres solicitudes de generación por operación y un único plazo de 90 segundos compartido con la consulta del catálogo. Si Retry-After pide más de cinco segundos, no se reintenta durante la operación ni se intenta evadir la espera cambiando de modelo. Si todos los intentos fallan, se devuelve GOOGLE_GENERATION_UNAVAILABLE y se aplica una pausa de 30 segundos por credencial/modelo; nuevos intentos durante esa pausa devuelven PROVIDER_COOLDOWN sin volver a llamar a Google. Un fallo nunca se convierte en contenido generado ficticio.

Esto es una medida de recuperación limitada, no una solución a una caída o bloqueo del proveedor. No permite afirmar que Google tenga una incidencia global; solo describe las respuestas recibidas por la aplicación. Las pruebas de retry/backoff usan respuestas simuladas y no prueban la disponibilidad de la cuenta de producción.


## Evidencia de conectividad (v0.4.4)

Los fallos de transporte se clasifican como GENERATION_TIMEOUT, PROVIDER_DNS_ERROR, PROVIDER_TLS_ERROR, PROVIDER_CONNECT_TIMEOUT, PROVIDER_CONNECTION_RESET o PROVIDER_CONNECTION_FAILED. Los logs de Render incluyen eventos JSON con etapa, modelo, código de transporte, duración y estado HTTP cuando existe; no incluyen claves, cabeceras, imágenes, prompts, texto de noticias ni mensajes de excepción sin filtrar. No se desactiva la verificación TLS ni se amplían plazos a ciegas.

La prueba de generación ejecuta en paralelo una comprobación HTTP pública de Google sin enviar API key desde la aplicación. Recibir HTTP 400/403 en esa comprobación demuestra que respondió la ruta, no que la cuenta esté autorizada ni que generateContent funcione. Si la generación falla, el resultado incorpora esa evidencia para separar conectividad de disponibilidad o autorización. Una prueba exitosa en otro entorno tampoco garantiza disponibilidad desde Render: la causa exacta sigue pendiente hasta ver el diagnóstico real de producción.


## Búsqueda ampliada (v0.5.0)

No hay un límite fijo de 26 noticias. El modo anterior combinaba una consulta regional y una nacional; el conteo era el resultado recuperado tras los filtros. La búsqueda ampliada usa hasta seis consultas regionales: temas separados (lluvias/emergencias, obras/autoridades y ríos/infraestructura) y grupos de localidades cuando existe catálogo. Para Piura incluye Sullana, Talara, Paita, Sechura, Morropón, Chulucanas, Ayabaca, Huancabamba, Catacaos y Tambogrande. No se afirma cobertura completa de todos los distritos o medios.

El dashboard permite 24 h, 48 h o 7 días, tema agua/clima o toda la actualidad regional y hasta 160 caracteres de palabras adicionales (se usan hasta 15 términos, sin operadores avanzados). `/api/dashboard` acepta `hours=24|48|168`, `expanded=1|0`, `scope=water|all` y `terms=...`. La fecha se valida por publicación, no por la fecha de consulta. El respaldo estático conserva su cobertura anterior de 24 horas y no se presenta como una búsqueda ampliada si el servidor no soporta estos campos.

Se deduplican URLs sin parámetros de seguimiento y coincidencias de título, fuente y día; distintas fuentes siguen contando como publicaciones distintas aunque cubran el mismo evento. Se combinan las procedencias de consultas y se conserva una fecha más reciente si un enlace se actualizó. El resumen muestra consultas completadas, resultados recuperados y duplicados probables; una consulta fallida no elimina las otras. Las tarjetas cargan de 60 en 60 mediante Mostrar más; el conteo refleja todo el conjunto recuperado, no solo las tarjetas dibujadas.

Las referencias territoriales por localidades se identifican como inferencias revisables. Algunos nombres ambiguos requieren además mencionar su región para no asignarlos automáticamente (por ejemplo Huancabamba en Pasco no se convierte en Piura). Esto no confirma la ubicación de los hechos. Las búsquedas pueden omitir noticias que Google no haya indexado o cuyo título/extracto no identifique el territorio; ninguna cantidad se presenta como el universo de cobertura.

La caché se separa por región, periodo, tema y términos (hasta 48 entradas); las consultas repetidas se agrupan, se procesan hasta tres consultas en paralelo por búsqueda y hay un límite de ocho operaciones en curso. No hay paginación inventada del feed de Google News. Para ampliar el universo más allá del índice de Google se necesitan feeds o conectores públicos de medios adicionales con acceso permitido.


## Directorio aportado en Excel (v0.6.0)

Se importó `Directorio medios - ANA.xlsx` sin ejecutar fórmulas, macros ni instrucciones de sus celdas. La hoja Medios Redes contiene 400 filas con valores: 399 registros de medios y una fila con solo Cusco. Se unificaron siete registros repetidos conservando sus regiones/áreas y filas originales: 392 entradas, 118 con web, 293 con enlaces directos a redes y 26 con acortadores (categorías superpuestas). 256 entradas tienen redes directas y ninguna web. El registro de Diario Últimas Noticias de Pacasmayo no tiene enlace. La fila sin medio queda registrada como incidencia. No se incluyó el XLSX original ni sus propiedades en el repositorio; solo nombres y enlaces de medios del catálogo derivado.

`data/media-directory.json` conserva el catálogo normalizado, regiones y áreas declaradas, enlaces tipificados y filas de procedencia. `data/media-directory-review.csv` es un catálogo base con estados pendientes, no una certificación de actividad. Para repetir la importación se necesita openpyxl en el equipo de importación, no en Render: `python scripts/import_media.py <archivo.xlsx>`. Las pruebas de extracción y validación usan Python estándar sin requerir esa biblioteca. Nunca se solicitan o escriben valores de credenciales en el catálogo; URLs con credenciales o parámetros de secreto se rechazan. No se interpretan los enlaces de Facebook ni acortadores como webs RSS.

### Incorporación a la búsqueda

La opción «Incluir webs del directorio ANA» añade hasta tres grupos de consultas `site:` con ocho dominios cada uno, además de las consultas temáticas/geográficas anteriores. Se informa cuántos dominios se consultaron respecto del total. Seleccionar un medio concreto evita consultas regionales generales y nacionales; se consulta su dominio y su feed. El catálogo de Piura incluye Cutivalú, Walac Noticias, El Regional de Piura, El Tiempo, La Hora y Noticias Piura 3.0.

En una consulta regional se comprueban hasta seis medios con web en paralelo (máximo tres a la vez). La detección prueba la ruta convencional `/feed/` y, si no obtiene RSS válido, busca un enlace RSS/Atom declarado en la página pública. No se declara un feed activo hasta validar el documento. Los enlaces de feed se recuerdan hasta seis horas; las publicaciones se vuelven a leer, sujetas a la caché de búsqueda de cinco minutos. Una detección fallida se conserva 30 minutos para no insistir sobre el sitio. Una redirección solo se acepta dentro de los dominios revisados del mismo medio y con HTTPS verificado; no se cambian agentes para evadir bloqueos. Un error no significa que el medio esté cerrado.

Las consultas indexadas y las comprobaciones RSS se ejecutan en paralelo, con tiempos y tamaño de respuesta acotados. RSS y Atom se filtran por fecha de publicación; una entrada Atom solo con fecha de modificación no se presenta como noticia nueva. El tema y las palabras clave se aplican también al RSS directo. Las noticias de distintas vías se deduplican juntas. `sourceType=publisher-feed`, `directoryMediaId` y `sourceRegions` conservan su procedencia.

La región declarada de un medio no se copia a la ubicación del artículo. Se puede incluir expresamente contenido sin ubicación identificada de medios asignados a la región en el directorio; la tarjeta lo indica y su mapa sigue sin marcar una ubicación si no se ha identificado en el texto. La mesa no usa la sede del medio para inventar la ubicación del hecho.

### Consulta del catálogo y limitaciones

«Directorio de medios» permite filtrar por región/nombre, abrir enlaces y consultar un medio. Muestra el último estado RSS observado en la sesión y su fecha. El resumen CSV conserva estados pendientes; no se convierte en prueba de actividad tras una consulta parcial. En regiones con más de seis medios con web, seleccionar un medio permite comprobarlo aunque no estuviera entre los primeros seis. En la vista nacional no se inspeccionan todas las webs a la vez: hay que elegir región o medio. Los acortadores se conservan pendientes de resolución; no se siguen automáticamente hacia redes sociales. Facebook/otras redes no están conectadas por API ni se extraen saltándose acceso o autenticación. Se puede incorporar material de forma manual en la mesa.

Los dominios públicos revisados del catálogo se añaden a la importación de artículos HTML; destinos privados, protocolos o puertos no permitidos, credenciales y redirecciones fuera de los medios compatibles siguen rechazándose. El catálogo no implica propiedad o autorización de cuentas privadas.

La comprobación de `https://walac.pe/feed/` desde el entorno de trabajo fue bloqueada por su proxy (CONNECT 403), antes de poder validar el sitio. Por ello no se afirma que los 118 sitios tengan RSS ni que sean accesibles desde producción. Las pruebas de RSS, Atom y navegación usan respuestas simuladas identificadas; Render debe comprobar cada sitio real cuando se consulte su región. No se alteró GEMINI_MODEL ni la conexión de Gemini que ya funcionaba.


## Biblioteca y visor oficial PDF (v0.7.0)

Se añadió «Visor de documentos» y accesos desde las tarjetas SENAMHI/ANA de Fuentes oficiales. No usa Gemini ni necesita su clave. La biblioteca consulta desde Render categorías y boletines de SENAMHI mediante las rutas identificadas en el cliente oficial. ANA se consulta como portal público, con extracción de enlaces documentales explícitos; no se afirma que se haya encontrado una API pública de ONRH. La evidencia y las rutas exactas están en [docs/official-document-sources.md](docs/official-document-sources.md).

`GET /api/documents?source=senamhi|ana&category=...&refresh=1` entrega el catálogo, fecha de consulta, estado y limitaciones. Las categorías SENAMHI se leen del servicio real antes de consultar los boletines; no se inventan ids. La caché dura 10 minutos y puede renovarse manualmente tras al menos un minuto. Las consultas de categoría se ejecutan con paralelismo 2 y límites de respuesta; la biblioteca muestra hasta 500 documentos e informa del recorte para filtrar por categoría. La fecha es la edición publicada en los metadatos; no se convierte en una noticia de hoy si es desconocida.

`GET /api/documents/pdf?url=<enlace oficial>` valida hosts y redirecciones, solicita HTTPS verificado y comprueba bytes antes de servir el archivo como application/pdf. Solo se admiten servidores oficiales de SENAMHI, ANA y ENFEN expresamente enumerados. Los enlaces documentales HTTP antiguos de esos hosts se solicitan por HTTPS, nunca desactivando TLS. No se envían claves, cookies ni credenciales de Gemini a las fuentes. No se convierte una respuesta HTML de login, captcha o error en PDF. El tamaño máximo es 25 MiB y hay como máximo tres descargas simultáneas.

El usuario puede abrir el documento en el visor, descargar la copia recibida o abrir la fuente original. Los Blob URLs se revocan al cambiar de documento y se limpia el visor al cambiar de institución para evitar atribuir un PDF a la fuente equivocada. Los documentos sin fecha conocida siguen identificados como tales; ante fallos de actualización el catálogo anterior se conserva con aviso. También se puede pegar un enlace oficial para verificarlo sin esperar a que aparezca en el índice. Si el PDF requiere sesión o un formulario privado, queda fuera del conector público actual.

La consulta directa del API SENAMHI y de ANA desde el entorno de trabajo se vio bloqueada por la política de red; la navegación y el contrato se probaron con fixtures y el esquema del cliente oficial. La validación de datos reales en Render queda pendiente. No se garantiza que todos los PDF periódicos de ambas instituciones estén disponibles hasta comprobar esos resultados. No se modificó GEMINI_MODEL.
